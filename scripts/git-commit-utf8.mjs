#!/usr/bin/env node
/**
 * UTF-8 中文 commit 工具
 * 用法:
 *   node scripts/git-commit-utf8.mjs "提交标题"
 *   node scripts/git-commit-utf8.mjs "提交标题" -m "正文第一行" -m "正文第二行"
 *
 * 解决 Windows PowerShell 中文 commit message 双重编码乱码问题。
 */
import { execFileSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { resolve } from "path";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("用法: node scripts/git-commit-utf8.mjs <标题> [-m <正文>]...");
  process.exit(1);
}

const title = args[0];
const bodyLines = [];
for (let i = 1; i < args.length; i += 2) {
  if (args[i] === "-m" && args[i + 1]) bodyLines.push(args[i + 1]);
}

const fullMsg = bodyLines.length ? `${title}\n\n${bodyLines.join("\n")}\n` : `${title}\n`;
const msgFile = resolve(".temp/commit-msg.txt");
writeFileSync(msgFile, fullMsg, "utf8");

try {
  // 1) git add -A
  execFileSync("git", ["add", "-A"], { stdio: "inherit" });
  // 2) git commit -F <file> with UTF-8 env
  execFileSync("git", ["commit", "-F", msgFile], {
    stdio: "inherit",
    env: { ...process.env, LC_ALL: "C.UTF-8", LANG: "C.UTF-8" },
  });
  // 3) 显示结果
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  console.log(`\n✅ 提交成功: ${sha.slice(0, 7)} ${title}`);
  // 4) 验证 message 编码
  const raw = execFileSync("git", ["cat-file", "-p", sha], { encoding: "buffer" });
  const decoded = raw.toString("utf8").split("\n\n").slice(1).join("\n\n").trim();
  console.log(`📝 message: ${decoded.split("\n")[0]}`);
} catch (e) {
  console.error("提交失败:", e.message);
  process.exit(1);
} finally {
  try { unlinkSync(msgFile); } catch {}
}
