#!/usr/bin/env node
/**
 * Git 中文提交 UTF-8 自动配置脚本
 * 用法: node scripts/setup-git-utf8.mjs
 *
 * 设置 Git 全局编码为 UTF-8，避免 Windows PowerShell 中文 commit message 双重编码乱码。
 * 影响：本次电脑所有 git 项目都会使用 UTF-8（全局配置）。
 */
import { execFileSync } from "child_process";

const configs = [
  ["i18n.commitEncoding", "UTF-8"],
  ["i18n.logOutputEncoding", "UTF-8"],
  ["core.quotepath", "false"],          // 中文文件名正常显示
  ["core.pager", ""],                    // 避免分页器对中文输出造成干扰
  ["gui.encoding", "UTF-8"],
];

console.log("📝 配置 Git 全局编码为 UTF-8...\n");
for (const [key, val] of configs) {
  try {
    execFileSync("git", ["config", "--global", key, val], { stdio: "inherit" });
    console.log(`  ✓ ${key} = ${val}`);
  } catch (e) {
    console.log(`  ✗ ${key} 失败: ${e.message}`);
  }
}

console.log("\n✅ 配置完成！中文 commit message 不再乱码。");
console.log("💡 提示：如果 PowerShell 还乱码，先执行 `chcp 65001` 切换代码页再提交。");
console.log("💡 推荐：项目内中文提交用 `node scripts/git-commit-utf8.mjs \"标题\"` 工具更稳。");

// 验证
try {
  const out = execFileSync("git", ["config", "--global", "--get", "i18n.commitEncoding"], { encoding: "utf8" });
  console.log(`\n🔍 当前 i18n.commitEncoding = ${out.trim()}`);
} catch {
  console.log("\n⚠️  验证失败，请手动检查 git config --global --list");
}
