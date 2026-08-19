const API_BASE = (process.env.P1_SMOKE_API_BASE || "http://localhost:4000/api").replace(/\/+$/, "");
const ADMIN_MOBILE = process.env.P1_SMOKE_ADMIN_MOBILE || "13800000000";
const ADMIN_PASSWORD = process.env.P1_SMOKE_ADMIN_PASSWORD || "Zxt@2026";
const SETUP_UI_ONLY = process.argv.includes("--setup-ui");

async function api(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(
      `${method} ${path} failed: HTTP ${response.status} ${payload?.code || ""} ${payload?.message || ""}`.trim(),
    );
  }
  return payload.data;
}

function solveCaptcha(challenge) {
  const encoded = String(challenge.backgroundImage || "").split(",")[1] || "";
  const svg = Buffer.from(encoded, "base64").toString("utf8");
  const match = svg.match(/<rect x="(\d+)" y="43" width="42"/);
  if (!match) throw new Error("Unable to parse captcha target from SVG.");
  return Number(match[1]) - 12;
}

async function login(mobile, password) {
  const challenge = await api("/auth/captcha");
  const verified = await api("/auth/captcha", {
    method: "POST",
    body: {
      captchaId: challenge.captchaId,
      positionX: solveCaptcha(challenge),
    },
  });
  return api("/auth/login", {
    method: "POST",
    body: { mobile, password, captchaToken: verified.captchaToken },
  });
}

function log(step, message) {
  console.log(`${String(step).padStart(2, "0")} ${message}`);
}

async function main() {
  log(0, `P1 exam smoke started: ${API_BASE}${SETUP_UI_ONLY ? " (setup UI fixture only)" : ""}`);

  const stamp = Date.now().toString(36).toUpperCase();
  const admin = await login(ADMIN_MOBILE, ADMIN_PASSWORD);
  log(1, `ADMIN_LOGIN_OK role=${admin.user.roleCode} tenant=${admin.user.tenantCode}`);

  const learnerMobile = `139${String(Date.now()).slice(-8)}`;
  const learnerPassword = "Zxt@2026";
  const learner = await api("/users", {
    method: "POST",
    token: admin.token,
    body: {
      name: `P1SmokeLearner${stamp.slice(-4)}`,
      mobile: learnerMobile,
      email: "",
      roleCode: "learner",
      orgId: null,
      initialPassword: learnerPassword,
    },
  });
  log(2, `LEARNER_CREATE_OK id=${learner.id} mobile=${learner.mobile}`);

  const bank = await api("/exam-banks", {
    method: "POST",
    token: admin.token,
    body: {
      name: `P1-SMOKE-BANK-${stamp}`,
      description: "Automated P1 commercial readiness smoke test.",
    },
  });
  log(3, `BANK_CREATE_OK id=${bank.id}`);

  const q1 = await api("/exam-questions", {
    method: "POST",
    token: admin.token,
    body: {
      bankId: bank.id,
      type: "single",
      stem: `P1-SMOKE-Q1-${stamp}: choose A`,
      options: ["YES", "NO"],
      answer: "A",
      analysis: "A is correct.",
      score: 50,
    },
  });
  const q2 = await api("/exam-questions", {
    method: "POST",
    token: admin.token,
    body: {
      bankId: bank.id,
      type: "judge",
      stem: `P1-SMOKE-Q2-${stamp}: choose B`,
      options: ["YES", "NO"],
      answer: "B",
      analysis: "B is correct.",
      score: 50,
    },
  });
  log(4, `QUESTIONS_CREATE_OK ids=${q1.id},${q2.id}`);

  const exam = await api("/exams", {
    method: "POST",
    token: admin.token,
    body: {
      name: `P1-SMOKE-EXAM-${stamp}`,
      code: `P1-${stamp}`,
      bankId: bank.id,
      description: "Verifies bank -> exam -> publish -> attempt -> submit -> refresh.",
      durationMinutes: 30,
      passScore: 60,
    },
  });
  if (exam.questionCount !== 2 || exam.totalScore !== 100) {
    throw new Error(`Unexpected exam totals: questionCount=${exam.questionCount}, totalScore=${exam.totalScore}`);
  }
  log(5, `EXAM_CREATE_OK id=${exam.id} status=${exam.status} questions=${exam.questionCount}`);

  const published = await api(`/exams?id=${encodeURIComponent(exam.id)}`, {
    method: "PATCH",
    token: admin.token,
    body: {},
  });
  if (published.status !== "published") throw new Error(`Exam was not published: ${published.status}`);
  log(6, `EXAM_PUBLISH_OK id=${published.id} status=${published.status}`);

  const learnerSession = await login(learnerMobile, learnerPassword);
  log(7, `LEARNER_LOGIN_OK id=${learnerSession.user.id} role=${learnerSession.user.roleCode}`);

  const learnerExams = await api("/exams", { token: learnerSession.token });
  const visibleExam = learnerExams.find((item) => item.id === exam.id);
  if (!visibleExam) throw new Error("Published exam is not visible to learner after refresh.");
  log(8, `LEARNER_EXAM_VISIBLE_OK id=${visibleExam.id}`);

  const learnerDetail = await api(`/exams?id=${encodeURIComponent(exam.id)}`, { token: learnerSession.token });
  if (learnerDetail.questions.length !== 2) {
    throw new Error(`Learner detail question count mismatch: ${learnerDetail.questions.length}`);
  }
  if (learnerDetail.questions.some((question) => question.answer || question.analysis)) {
    throw new Error("Learner exam detail leaked answer or analysis.");
  }
  log(9, "LEARNER_EXAM_DETAIL_OK answers_hidden=true");

  if (SETUP_UI_ONLY) {
    const fixture = {
      apiBase: API_BASE,
      learner: {
        id: learner.id,
        mobile: learnerMobile,
        password: learnerPassword,
      },
      exam: {
        id: exam.id,
        name: exam.name,
        answers: [
          { questionNo: 1, questionId: q1.id, answer: "A" },
          { questionNo: 2, questionId: q2.id, answer: "B" },
        ],
      },
    };
    console.log(`P1_UI_FIXTURE ${JSON.stringify(fixture)}`);
    console.log("P1_EXAM_UI_FIXTURE_READY");
    return;
  }

  const attempt = await api("/exam-attempts", {
    method: "POST",
    token: learnerSession.token,
    body: { examId: exam.id },
  });
  if (attempt.status !== "in_progress") throw new Error(`Attempt did not start: ${attempt.status}`);
  log(10, `ATTEMPT_START_OK id=${attempt.id} status=${attempt.status}`);

  const submitted = await api(`/exam-attempts?id=${encodeURIComponent(attempt.id)}`, {
    method: "PUT",
    token: learnerSession.token,
    body: {
      answers: [
        { questionId: q1.id, answer: "A" },
        { questionId: q2.id, answer: "B" },
      ],
    },
  });
  if (submitted.score !== 100 || submitted.status !== "passed") {
    throw new Error(`Unexpected submitted result: score=${submitted.score}, status=${submitted.status}`);
  }
  log(11, `ATTEMPT_SUBMIT_OK id=${submitted.id} score=${submitted.score} status=${submitted.status}`);

  const attemptsAfterRefresh = await api(`/exam-attempts?examId=${encodeURIComponent(exam.id)}`, {
    token: learnerSession.token,
  });
  const refreshed = attemptsAfterRefresh.find((item) => item.id === attempt.id);
  if (!refreshed || refreshed.score !== 100 || refreshed.status !== "passed") {
    throw new Error("Submitted score was not readable after refresh.");
  }
  log(12, `ATTEMPT_REFRESH_OK id=${refreshed.id} score=${refreshed.score} status=${refreshed.status}`);

  const board = await api("/dashboard/learner", { token: learnerSession.token });
  if (!board || Number(board.examAverage) < 100) {
    throw new Error(`Learner dashboard did not include submitted exam score: examAverage=${board?.examAverage}`);
  }
  log(13, `LEARNER_DASHBOARD_OK examAverage=${board.examAverage}`);

  console.log("P1_EXAM_SMOKE_PASS");
}

main().catch((error) => {
  console.error("P1_EXAM_SMOKE_FAIL");
  console.error(error.stack || error.message || error);
  process.exit(1);
});
