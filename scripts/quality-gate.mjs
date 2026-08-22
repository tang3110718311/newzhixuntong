/**
 * quality-gate.mjs — 业务红线扫描脚本
 *
 * 扫描 zxt-next 源码中的业务红线违规，输出结构化报告。
 * 用法：
 *   node scripts/quality-gate.mjs                    # 扫描整个项目
 *   node scripts/quality-gate.mjs --root <dir>        # 扫描指定目录
 *   node scripts/quality-gate.mjs --max-warnings 0    # 有任何违规就 exit 1
 *   node scripts/quality-gate.mjs --format json       # JSON 输出
 *   node scripts/quality-gate.mjs --baseline quality-gate.baseline.json --max-warnings 0 # 只阻断基线外新增违规
 *
 * 退出码：
 *   0 = 通过（违规数 <= max-warnings）
 *   1 = 不通过（违规数 > max-warnings）
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, relative, extname } from "node:path";

// ─── 参数解析 ──────────────────────────────────────────────

const args = process.argv.slice(2);
let scanRoot = resolve(import.meta.dirname, "..");
let maxWarnings = Infinity;
let format = "text";
let baselinePath = "";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--root" && args[i + 1]) {
    scanRoot = resolve(args[i + 1]);
    i++;
  } else if (args[i] === "--max-warnings" && args[i + 1]) {
    maxWarnings = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === "--format" && args[i + 1]) {
    format = args[i + 1];
    i++;
  } else if (args[i] === "--baseline" && args[i + 1]) {
    baselinePath = resolve(args[i + 1]);
    i++;
  }
}

// ─── 规则定义 ──────────────────────────────────────────────

/**
 * @typedef {{
 *   code: string,
 *   severity: "BLOCKER"|"CRITICAL"|"MAJOR",
 *   title: string,
 *   pattern?: RegExp,
 *   matches?: (line: string, index: number, lines: string[]) => boolean,
 *   hint: string
 * }} Rule
 */

function contextFor(lines, index, radius = 4) {
  const start = Math.max(0, index - radius);
  const end = Math.min(lines.length, index + radius + 1);
  return lines.slice(start, end).join("\n");
}

function isAiSimulationTimeout(line, index, lines) {
  if (!/\b(?:window\.)?setTimeout\s*\(/.test(line)) return false;
  const context = contextFor(lines, index);
  const hasMockIntent = /(?:模拟|假|演示|mock|fake).{0,30}(?:AI|ai|模型|智能|异步|延迟|回复|生成|分析)|(?:AI|ai|模型|智能).{0,30}(?:模拟|假|演示|mock|fake)|setAiResponse|mockAi|fakeAi/i.test(context);
  const hasFakeAiUi = /(?:AI正在分析|AI\s*分析附件|AI\s*生成|生成对话目标|setGoalAiStatus)/i.test(context)
    && !/(?:apiFetch|apiPost|fetch\s*\(|\/api\/ai)/i.test(context);
  return hasMockIntent || hasFakeAiUi;
}

function isBusinessLocalStorage(line) {
  if (!/\b(?:window\.)?localStorage\s*\.\s*setItem\s*\(/.test(line)) return false;

  const literalKey = /setItem\s*\(\s*["'`]([^"'`]+)["'`]/.exec(line)?.[1] || "";
  const keyOrLine = literalKey || line;

  if (/(?:auth|token|avatar|profile|voice|theme|preference|prefs|layout|sidebar|captcha)/i.test(keyOrLine)) {
    return false;
  }

  return /(?:score|scores|grade|progress|exam|record|records|attempt|training|material|scene|course|lesson|result|report|done|count|study)/i.test(keyOrLine)
    || /JSON\.stringify\([^)]*(?:score|progress|record|exam|training|material|result|study)/i.test(line);
}

function hasPlaceholderText(line) {
  if (/^\s*(?:\/\/|\*)/.test(line)) return false;
  const codeOnly = line.split("//")[0];
  return /(?:敬请期待|暂未开放|开发中|功能即将上线|Coming soon)/i.test(codeOnly)
    || /(?:["'`>]\s*TODO\s*(?:["'`<]))/.test(codeOnly);
}

function isMockRealtimeInterval(line, index, lines) {
  if (!/\b(?:window\.)?setInterval\s*\(/.test(line)) return false;
  const context = contextFor(lines, index);
  return /(?:模拟|假|演示|mock|fake).{0,30}(?:实时|推送|轮询|刷新)|(?:实时推送|伪实时|fake\s*realtime|mock\s*realtime)/i.test(context);
}

/** @type {Rule[]} */
const RULES = [
  {
    code: "ZXT-QG-001",
    severity: "CRITICAL",
    title: "假按钮：alert() 充当交互反馈",
    pattern: /\balert\s*\(/g,
    hint: "alert() 是浏览器原生弹窗，不是真实交互。应使用 toast/通知组件或调用真实 API。",
  },
  {
    code: "ZXT-QG-002",
    severity: "CRITICAL",
    title: "假AI：setTimeout 模拟异步处理",
    matches: isAiSimulationTimeout,
    hint: "setTimeout 模拟延迟不是真实 AI 调用。应调用真实 AI 接口或后端 API。",
  },
  {
    code: "ZXT-QG-003",
    severity: "CRITICAL",
    title: "localStorage 存业务数据",
    matches: isBusinessLocalStorage,
    hint: "业务数据（成绩、分数、进度等）不应存 localStorage。应通过 API 存数据库。",
  },
  {
    code: "ZXT-QG-004",
    severity: "CRITICAL",
    title: "硬编码默认密码",
    pattern: /["'`](?:Zxt@\d{4}|admin123|password123|12345678)["'`]/g,
    hint: "密码不应硬编码在源码中。应通过环境变量或用户输入传入。",
  },
  {
    code: "ZXT-QG-005",
    severity: "MAJOR",
    title: "演示租户硬编码",
    pattern: /["'`]zxt-demo["'`]/g,
    hint: "演示租户标识不应硬编码在生产源码中。应通过数据库配置或环境变量管理。",
  },
  {
    code: "ZXT-QG-006",
    severity: "MAJOR",
    title: "空数据写死占位文案",
    matches: hasPlaceholderText,
    hint: '空数据应展示「暂无数据」而非写死占位文案，避免误导用户以为功能存在。',
  },
  {
    code: "ZXT-QG-007",
    severity: "MAJOR",
    title: "setInterval 模拟实时推送",
    matches: isMockRealtimeInterval,
    hint: "setInterval 轮询不是真实实时通信。应使用 WebSocket 或 SSE 推送。",
  },
];

// ─── 文件收集 ──────────────────────────────────────────────

const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  ".temp",
  ".git",
  ".worktrees", // git worktree 副本，不参与门禁扫描
  "coverage",
  ".scannerwork",
]);

/**
 * 递归收集所有需扫描的源文件
 * @param {string} dir
 * @returns {string[]}
 */
function collectFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const name of entries) {
    const full = resolve(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (!EXCLUDE_DIRS.has(name)) {
        results.push(...collectFiles(full));
      }
    } else if (st.isFile() && SCAN_EXTENSIONS.has(extname(name))) {
      results.push(full);
    }
  }
  return results;
}

// ─── 扫描执行 ──────────────────────────────────────────────

const files = collectFiles(scanRoot);

/** @type {{ code: string, severity: string, title: string, file: string, line: number, snippet: string, hint: string }[]} */
const findings = [];

for (const filePath of files) {
  let content;
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    continue;
  }

  const lines = content.split(/\r?\n/);

  for (const rule of RULES) {
    // 逐行扫描，记录行号
    for (let i = 0; i < lines.length; i++) {
      let matched = false;
      if (typeof rule.matches === "function") {
        matched = rule.matches(lines[i], i, lines);
      } else if (rule.pattern) {
        rule.pattern.lastIndex = 0;
        matched = rule.pattern.test(lines[i]);
      }
      if (matched) {
        const relPath = relative(process.cwd(), filePath).replace(/\\/g, "/");
        findings.push({
          code: rule.code,
          severity: rule.severity,
          title: rule.title,
          file: relPath,
          line: i + 1,
          snippet: lines[i].trim().slice(0, 120),
          hint: rule.hint,
        });
      }
    }
  }
}

// ─── 排除已知豁免（白名单） ──────────────────────────────────

/**
 * 白名单：脚本自身、测试文件、seed 文件等已知且已确认的合法用法。
 * 格式：{ filePattern: RegExp, codes: string[] }
 */
const WHITELIST = [
  { filePattern: /quality-gate\.mjs$/, codes: ["ALL"] }, // 脚本自身
  { filePattern: /\.test\./, codes: ["ALL"] }, // 测试文件
  { filePattern: /smoke-p1-exam\.mjs$/, codes: ["ALL"] }, // smoke 测试脚本
  { filePattern: /seed\.mjs$/, codes: ["ZXT-QG-004", "ZXT-QG-005"] }, // seed 脚本允许默认密码和演示租户
  { filePattern: /sqlite\/init\.mjs$/, codes: ["ZXT-QG-004", "ZXT-QG-005"] }, // 本地初始化脚本允许默认种子数据
];

const filteredFindings = findings.filter((f) => {
  for (const wl of WHITELIST) {
    if (wl.filePattern.test(f.file)) {
      if (wl.codes.includes("ALL") || wl.codes.includes(f.code)) {
        return false; // 豁免
      }
    }
  }
  return true;
});

function findingKey(finding) {
  return [finding.code, finding.file, finding.snippet].join("|");
}

function loadBaselineKeys(filePath) {
  if (!filePath || !existsSync(filePath)) return new Set();
  const baselineText = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const parsed = JSON.parse(baselineText);
  const baselineFindings = Array.isArray(parsed) ? parsed : parsed.findings || [];
  return new Set(baselineFindings.map(findingKey));
}

const baselineKeys = loadBaselineKeys(baselinePath);
const newFindings = baselineKeys.size
  ? filteredFindings.filter((finding) => !baselineKeys.has(findingKey(finding)))
  : filteredFindings;
const suppressedCount = filteredFindings.length - newFindings.length;

// ─── 报告输出 ──────────────────────────────────────────────

const blockerCount = newFindings.filter((f) => f.severity === "BLOCKER").length;
const criticalCount = newFindings.filter((f) => f.severity === "CRITICAL").length;
const majorCount = newFindings.filter((f) => f.severity === "MAJOR").length;
const total = newFindings.length;
const passed = total <= maxWarnings;

if (format === "json") {
  const report = {
    passed,
    total,
    newTotal: total,
    baselineTotal: filteredFindings.length,
    suppressed: suppressedCount,
    blocker: blockerCount,
    critical: criticalCount,
    major: majorCount,
    findings: newFindings,
  };
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("\n═══════════════════════════════════════════");
  console.log("  ZXT 业务红线扫描报告 (quality-gate)");
  console.log("═══════════════════════════════════════════\n");

  if (newFindings.length === 0) {
    console.log(baselineKeys.size ? "  ✓ 未发现新增业务红线违规" : "  ✓ 未发现业务红线违规");
    if (suppressedCount > 0) {
      console.log(`  已按基线忽略历史问题: ${suppressedCount} 处`);
    }
    console.log();
  } else {
    // 按规则分组
    const byCode = {};
    for (const f of newFindings) {
      if (!byCode[f.code]) byCode[f.code] = [];
      byCode[f.code].push(f);
    }

    for (const code of Object.keys(byCode).sort()) {
      const group = byCode[code];
      const severity = group[0].severity;
      const title = group[0].title;
      console.log(`[${severity}] ${code}: ${title} (${group.length} 处)`);
      console.log(`  提示: ${group[0].hint}`);
      for (const f of group.slice(0, 20)) {
        console.log(`    → ${f.file}:${f.line}  ${f.snippet}`);
      }
      if (group.length > 20) {
        console.log(`    ... 还有 ${group.length - 20} 处`);
      }
      console.log();
    }

    if (suppressedCount > 0) {
      console.log(`  已按基线忽略历史问题: ${suppressedCount} 处`);
    }
    console.log("───────────────────────────────────────────");
    console.log(`  汇总: ${total} 处违规 (CRITICAL ${criticalCount} / MAJOR ${majorCount})`);
    console.log(`  结果: ${passed ? "✓ 通过" : "✗ 不通过"} (阈值: ${maxWarnings === Infinity ? "∞" : maxWarnings})`);
    console.log("───────────────────────────────────────────\n");
  }
}

process.exit(passed ? 0 : 1);
