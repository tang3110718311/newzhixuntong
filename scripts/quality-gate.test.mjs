import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const scriptPath = resolve(projectRoot, "scripts", "quality-gate.mjs");
const tempRoot = resolve(projectRoot, ".temp", "quality-gate-tests");

function writeFixture(root, files) {
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = resolve(root, relativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, "utf8");
  }
}

function runQualityGate(name, files, extraArgs = []) {
  const root = resolve(tempRoot, name);
  rmSync(root, { force: true, recursive: true });
  mkdirSync(root, { recursive: true });
  writeFixture(root, files);

  try {
    const output = execFileSync(process.execPath, [scriptPath, "--root", root, "--format", "json", ...extraArgs], {
      cwd: projectRoot,
      encoding: "utf8",
    });
    return JSON.parse(output);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

const benignReport = runQualityGate("benign", {
  "src/normal.ts": `
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);
    window.setTimeout(() => setToast(""), 2400);
    setInterval(() => pollStatus(), 2000);
    localStorage.setItem("zxt-practice-auto-send-voice", next ? "1" : "0");
    // TODO(auth-cookie): remove after all clients use HttpOnly cookies.
    const todos = [{ label: "待办", count: 1 }];
  `,
});

assert.equal(benignReport.total, 0, JSON.stringify(benignReport.findings, null, 2));

const riskyReport = runQualityGate("risky", {
  "src/risky.tsx": `
    alert("保存成功");
    setTimeout(() => setAiResponse("模拟AI已生成话术"), 800);
    localStorage.setItem("examRecords", JSON.stringify(scores));
    const password = "Zxt@2026";
    const tenantCode = "zxt-demo";
    return <div>敬请期待</div>;
  `,
});

const riskyCodes = new Set(riskyReport.findings.map((finding) => finding.code));
for (const code of ["ZXT-QG-001", "ZXT-QG-002", "ZXT-QG-003", "ZXT-QG-004", "ZXT-QG-005", "ZXT-QG-006"]) {
  assert.equal(riskyCodes.has(code), true, `${code} should be reported`);
}

const baselineRoot = resolve(tempRoot, "baseline");
rmSync(baselineRoot, { force: true, recursive: true });
mkdirSync(baselineRoot, { recursive: true });
writeFixture(baselineRoot, {
  "src/risky.tsx": `
    alert("保存成功");
    setTimeout(() => setAiResponse("模拟AI已生成话术"), 800);
  `,
});
const baselineReport = JSON.parse(execFileSync(process.execPath, [scriptPath, "--root", baselineRoot, "--format", "json"], {
  cwd: projectRoot,
  encoding: "utf8",
}));
const baselinePath = resolve(baselineRoot, "quality-gate.baseline.json");
writeFileSync(baselinePath, JSON.stringify({ findings: baselineReport.findings }, null, 2), "utf8");
const gatedReport = JSON.parse(execFileSync(process.execPath, [
  scriptPath,
  "--root",
  baselineRoot,
  "--format",
  "json",
  "--baseline",
  baselinePath,
  "--max-warnings",
  "0",
], {
  cwd: projectRoot,
  encoding: "utf8",
}));
assert.equal(gatedReport.passed, true, JSON.stringify(gatedReport, null, 2));
assert.equal(gatedReport.newTotal, 0, JSON.stringify(gatedReport, null, 2));
rmSync(baselineRoot, { force: true, recursive: true });

console.log("quality-gate tests passed");
