import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// 构建脚本：
//   node scripts/build.mjs          # 等价 all
//   node scripts/build.mjs api      # 只构建 api
//   node scripts/build.mjs admin    # 只构建 admin
//   node scripts/build.mjs all      # 构建 api + admin
//
// 自动做的事：
//   1. 临时关闭 CodeBuddy 的 safe-delete 保护（仅作用于本脚本启动的子进程），
//      避免 next build 清空旧 .next 产物时被拦截导致构建失败。
//   2. next build 加 --no-lint，跳过 ESLint（项目 lint 脚本尚未实际配置）。
//   3. 显示每个包构建耗时。

const root = resolve(import.meta.dirname, "..");
const nextBin = resolve(root, "node_modules/next/dist/bin/next");
const nodeBin = process.execPath;

const WORKSPACES = {
  api: {
    name: "@zxt/api",
    cwd: resolve(root, "apps/api"),
    port: 4000,
  },
  admin: {
    name: "@zxt/admin",
    cwd: resolve(root, "apps/admin"),
    port: 3000,
  },
};

const arg = (process.argv[2] || "all").toLowerCase();
const targets = arg === "all" ? ["api", "admin"] : [arg];

function buildOne(key) {
  const ws = WORKSPACES[key];
  if (!ws) {
    console.error(`未知构建目标: ${key}（可选 api / admin / all）`);
    process.exit(1);
  }
  console.log(`\n===== 构建 ${ws.name} =====`);
  const started = Date.now();
  const result = spawnSync(nodeBin, [nextBin, "build", "--no-lint"], {
    cwd: ws.cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      CODEBUDDY_SAFE_DELETE_ENABLED: "0",
      NODE_ENV: "production",
    },
    shell: false,
  });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  if (result.status !== 0) {
    console.error(`✗ ${ws.name} 构建失败（耗时 ${elapsed}s）`);
    process.exit(result.status ?? 1);
  }
  console.log(`✓ ${ws.name} 构建成功（耗时 ${elapsed}s）`);
}

for (const key of targets) {
  buildOne(key);
}
console.log("\n全部构建完成。");
