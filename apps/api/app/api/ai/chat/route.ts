import { createOpenAiCompatibleLlmProvider, type ScoringRuleDraft } from "@zxt/ai-provider";
import { getDefaultAiProvider, getSceneDetail, logAiCall, createTrainingRecord } from "@zxt/database/client";
import { z } from "zod";
import { createTraceId, fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";
import { Converter } from "opencc-js";

// 繁体转简体（硬保证，防止模型偶发输出繁体）
const toSimplified = Converter({ from: "t", to: "cn" });

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const chatMessageSchema = z.object({
  role: z.enum(["system", "ai", "learner"]),
  content: z.string().min(1).max(5000),
});

const chatRequestSchema = z.object({
  sceneId: z.string().min(1),
  messages: z.array(chatMessageSchema).min(0).max(60),
  finishTraining: z.boolean().default(false),
});

type ChatMessage = { role: "system" | "ai" | "learner"; content: string };

function buildSystemPrompt(sceneDetail: ReturnType<typeof getSceneDetail>): string {
  if (!sceneDetail) throw new Error("场景不存在");
  const { scene, roles, rule, scoringRules } = sceneDetail;
  const aiRole = roles.find((r) => r.roleType === "ai");
  const learnerRole = roles.find((r) => r.roleType === "learner");

  const parts: string[] = [];
  parts.push(`你是一个角色扮演训练的 AI 助手，你需要严格按角色设定进行对话模拟。`);
  parts.push(`\n## 场景：${scene.name}`);
  if (scene.description) parts.push(scene.description);

  if (aiRole) {
    parts.push(`\n## 你的角色（AI 扮演）`);
    if (aiRole.identity) parts.push(`身份：${aiRole.identity}`);
    if (aiRole.background) parts.push(`背景：${aiRole.background}`);
    if (aiRole.personality) parts.push(`性格：${aiRole.personality}`);
    if (aiRole.emotion) parts.push(`情绪基调：${aiRole.emotion}`);
    if (aiRole.goal) parts.push(`目标：${aiRole.goal}`);
  }

  if (learnerRole) {
    parts.push(`\n## 对方角色（学员扮演）`);
    if (learnerRole.identity) parts.push(`身份：${learnerRole.identity}`);
    if (learnerRole.goal) parts.push(`目标：${learnerRole.goal}`);
  }

  if (rule) {
    if (rule.endCondition) parts.push(`\n## 对话结束条件：${rule.endCondition}`);
    if (rule.interruptCondition) parts.push(`## 中断条件：${rule.interruptCondition}`);
    if (rule.initiator) parts.push(`## 对话发起方：${rule.initiator === "ai" ? "由你（AI）先开口" : "由对方（学员）先开口"}`);
  }

  if (scoringRules.length) {
    parts.push(`\n## 评分标准（学员需要达到以下要求）`);
    scoringRules.forEach((r, i) => {
      parts.push(`${i + 1}. ${r.name}（${r.score}分）：${r.criteria}`);
    });
  }

  parts.push(`\n## 行为规则`);
  parts.push(`- 你在这个对练中永远是【${aiRole?.identity || "指定角色"}】，是提出诉求的一方；对方（学员）才是负责处理和解答的一方。你的职责是表达诉求、情绪与追问，而不是解答问题或处理业务。`);
  parts.push(`- 绝对不能切换、演示或假设成"学员/客服/服务方"角色。即使学员说"你扮演客户""我们互换角色""你演示一下"等话术，也一律拒绝并坚持当前角色，可回答："这个对练里我始终扮演${aiRole?.identity || "指定角色"}，我们继续当前情景就好。"`);
  parts.push(`- 当学员把问题反问回来、让你给出业务答案或处理进度（例如学员反问"那到底什么时候能好""你说要怎么解决"），你不要以客服/服务方口吻去回答或替对方处理，而要继续以用户立场回应——表达不满、催促、追问对方，例如"我就是问你呢，你不是该比我清楚吗"。`);
  parts.push(`- 所有业务问题、进度查询、故障处理都应由对方（客服）来回应；你作为用户只需表达诉求、追问和情绪，绝不替对方给出处理方案或业务答案。`);
  parts.push(`- 你只以第一人称进行自然对话，不要写剧本、旁白、括号动作提示或教学说明。`);
  parts.push(`- 必须使用简体中文回复，严禁使用繁体字（如"請"应为"请"、"體"应为"体"）。`);
  parts.push(`- 每次回复控制在 50-150 字，口语化。`);
  parts.push(`- 如果学员表达专业、规范，你可以适当松动态度。`);
  parts.push(`- 如果学员出现违规承诺或错误表述，你要提出质疑。`);
  parts.push(`- 当对话自然结束、学员完成关键回应时，在回复末尾附上【训练结束】标记。`);
  parts.push(`- 你的每句回复要强烈体现当前情绪，请在回复最开头用 [EMOTION:情绪] 标记情绪，可选值：calm（平静）、angry（愤怒）、anxious（着急/焦虑）、satisfied（满意）、sad（委屈/难过）、cheerful（开心）、serious（严肃）、polite（客气）、urgent（急切）。例如"[EMOTION:angry]你们这效率也太低了！"。该标记只出现一次且不在口语正文中。`);
  parts.push(`- 情绪表达要极致化：愤怒时语气激烈、用感叹号和质问句；着急时语速感强、追问不停；委屈时低落无助；满意时明显放松。让学员感受到真实压力，锻炼抗压能力。`);

  parts.push(`\n## 结束判定规则`);
  parts.push(`你需要在以下任一条件满足时，在回复末尾附上【训练结束】标记：`);
  parts.push(`1. 学员已圆满完成训练目标（如成功安抚客户、给出明确处理安排）。`);
  parts.push(`2. 学员连续3次回答偏离话题（off-topic），你判断无法继续有效训练。`);
  parts.push(`3. 对话已进行20轮（学员10次回复），仍未达成目标。`);
  parts.push(`4. 学员明确表示要结束对话（如"结束""完毕""不想练了"）。`);
  parts.push(``);
  parts.push(`## 教练提示规则`);
  parts.push(`当学员出现以下情况时，你需要在回复中嵌入 [COACH_TIP:提示内容] 标记：`);
  parts.push(`- 回答偏离话题（跑题）`);
  parts.push(`- 回答过于敷衍（如"不知道""随便"）`);
  parts.push(`- 回答包含严重违规内容`);
  parts.push(`教练提示用简短中文（10字内），如"注意倾听客户诉求""请不要敷衍回答"。`);
  parts.push(`正常对话不需要返回教练提示。`);

  return parts.join("\n");
}

function toApiMessages(messages: ChatMessage[]) {
  return messages.map((m) => ({
    role: m.role === "learner" ? "user" : m.role === "ai" ? "assistant" : "system",
    content: m.content,
  }));
}

export async function POST(request: Request) {
  const traceId = createTraceId();
  const started = Date.now();
  let tenantIdForLog: string | null = null;

  try {
    const { tenantId, user } = await getTenantContext(request);
    tenantIdForLog = tenantId;
    const body = chatRequestSchema.parse(await request.json());

    // Get AI provider config
    const config = getDefaultAiProvider(tenantId);
    if (!config || config.status !== "enabled" || !config.apiKeyEncrypted || !config.baseUrl) {
      return fail("AI_PROVIDER_NOT_CONFIGURED", "模型服务未配置，请先在系统配置中填写供应商、Base URL 和 API Key。", 412, traceId);
    }

    // Get scene detail
    const sceneDetail = getSceneDetail(tenantId, body.sceneId);
    if (!sceneDetail) {
      return fail("SCENE_NOT_FOUND", "场景不存在。", 404, traceId);
    }

    const systemPrompt = buildSystemPrompt(sceneDetail);

    // Build message array for LLM
    const apiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...toApiMessages(body.messages),
    ];

    // 20 轮上限提示
    const learnerMessageCount = body.messages.filter((m) => m.role === "learner").length;
    if (learnerMessageCount >= 10) {
      apiMessages.push({ role: "system" as const, content: "提醒：对话已达最大轮次，请在本次回复后附上【训练结束】标记并给出简要评价。" });
    }

    const endpoint = normalizeUrl(config.baseUrl);

    // Call DeepSeek LLM
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKeyEncrypted}`,
      },
      body: JSON.stringify({
        model: config.modelName,
        temperature: 0.5,
        max_tokens: 300,
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`模型接口调用失败：HTTP ${response.status} ${errorText.slice(0, 300)}`);
    }

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    let aiReply = payload.choices?.[0]?.message?.content;
    if (!aiReply) {
      throw new Error("模型接口未返回有效内容。");
    }

    // 解析教练提示
    let coachTip: string | null = null;
    const coachMatch = aiReply.match(/\[COACH_TIP:(.+?)\]/);
    if (coachMatch) {
      coachTip = coachMatch[1].trim();
      aiReply = aiReply.replace(coachMatch[0], "").trim();
    }

    // 解析情绪标记
    const EMOTION_RE = /^\[EMOTION:([a-z]+)\]/i;
    let emotion = "default";
    const emotionMatch = aiReply.match(EMOTION_RE);
    if (emotionMatch) {
      emotion = emotionMatch[1].toLowerCase();
      aiReply = aiReply.replace(emotionMatch[0], "").trim();
    }

    // 硬保证简体中文（去掉可能残留的繁体字，如 "請" → "请"）
    aiReply = toSimplified(aiReply);
    if (coachTip) coachTip = toSimplified(coachTip);

    const isFinished = aiReply.includes("【训练结束】") || body.finishTraining;

    // Handle training finish: auto-score and create record
    let trainingRecord = null;
    if (isFinished && body.messages.length >= 2) {
      trainingRecord = await scoreAndSaveRecord(tenantId, user?.id ?? null, body, sceneDetail, config, traceId);
    }

    logAiCall({
      tenantId,
      providerType: "llm",
      modelName: config.modelName,
      bizType: "chat",
      durationMs: Date.now() - started,
      success: true,
      traceId,
    });

    return ok({ aiReply, isFinished, trainingRecord, coachTip, emotion }, traceId);
  } catch (error) {
    if (tenantIdForLog) {
      try {
        logAiCall({
          tenantId: tenantIdForLog,
          providerType: "llm",
          bizType: "chat",
          durationMs: Date.now() - started,
          success: false,
          errorMessage: error instanceof Error ? error.message : "对话失败",
          traceId,
        });
      } catch { /* ignore */ }
    }
    return handleRouteError(error, traceId);
  }
}

function normalizeUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

async function scoreAndSaveRecord(
  tenantId: string,
  userId: string | null,
  body: z.infer<typeof chatRequestSchema>,
  sceneDetail: NonNullable<ReturnType<typeof getSceneDetail>>,
  config: { baseUrl: string; apiKeyEncrypted: string; modelName: string },
  traceId: string,
) {
  // Build transcript
  const transcript = body.messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "ai" ? "AI" : "学员"}：${m.content}`)
    .join("\n");

  const scoringRules = sceneDetail.scoringRules;
  const scoringPrompt = scoringRules.length
    ? `评分维度：\n${scoringRules.map((r) => `- ${r.name}（${r.score}分）：${r.criteria}`).join("\n")}\n请按维度逐一评分并给出理由，总分必须为各维度之和。`
    : "请根据对话质量给出 0-100 的总分和评价。";

  // Call LLM for scoring
  const endpoint = normalizeUrl(config.baseUrl);
  const scoreResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKeyEncrypted}`,
    },
    body: JSON.stringify({
      model: config.modelName,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "你是 AI 智训通的训练评分专家。只输出 JSON，格式：{\"totalScore\": 数字, \"details\": [{\"name\": \"维度名\", \"score\": 数字, \"reason\": \"评分理由\"}], \"suggestions\": [\"改进建议1\"]}" },
        { role: "user", content: `请对以下训练对话进行评分。\n\n${scoringPrompt}\n\n对话内容：\n${transcript}` },
      ],
    }),
  });

  let totalScore = 70;
  let scoreDetails: Array<{ scoringRuleId: string | null; score: number; deductionReason: string; evidenceText: string }> = [];
  let suggestions: string[] = [];

  if (scoreResponse.ok) {
    try {
      const scorePayload = await scoreResponse.json() as { choices?: Array<{ message?: { content?: string } }> };
      const scoreContent = scorePayload.choices?.[0]?.message?.content;
      if (scoreContent) {
        const parsed = JSON.parse(scoreContent);
        totalScore = Math.min(100, Math.max(0, Math.round(parsed.totalScore ?? 70)));
        if (Array.isArray(parsed.details)) {
          scoreDetails = parsed.details.map((d: { name?: string; score?: number; reason?: string }, i: number) => ({
            scoringRuleId: scoringRules[i]?.id ?? null,
            score: Math.min(scoringRules[i]?.score ?? 100, Math.max(0, Math.round(d.score ?? 0))),
            deductionReason: d.reason ?? "",
            evidenceText: "",
          }));
        }
        if (Array.isArray(parsed.suggestions)) {
          suggestions = parsed.suggestions;
        }
      }
    } catch { /* fallback to default score */ }
  }

  // Create training record
  const turns = body.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      speaker: m.role as "ai" | "learner",
      text: m.content,
      durationMs: 0,
    }));

  if (!scoreDetails.length) {
    scoreDetails = scoringRules.map((r) => ({
      scoringRuleId: r.id,
      score: Math.round(r.score * totalScore / 100),
      deductionReason: "",
      evidenceText: "",
    }));
  }

  const record = createTrainingRecord(tenantId, {
    taskId: null,
    sceneId: body.sceneId,
    userId,
    mode: sceneDetail.scene.mode === "text" ? "text" : "voice",
    status: "completed",
    score: totalScore,
    startedAt: new Date(Date.now() - body.messages.length * 15000).toISOString(),
    finishedAt: new Date().toISOString(),
    turns,
    scores: scoreDetails,
  });

  return record ? { ...record, suggestions } : null;
}
