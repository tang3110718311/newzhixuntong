import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const logsDir = resolve(root, ".logs");
const pidFile = resolve(logsDir, "pids.json");
mkdirSync(logsDir, { recursive: true });

const nextBin = resolve(root, "node_modules/next/dist/bin/next");
const nodeBin = process.execPath;

function cleanupOldPidFile() {
  if (!existsSync(pidFile)) return;
  try {
    const pids = JSON.parse(readFileSync(pidFile, "utf8"));
    for (const [name, pid] of Object.entries(pids)) {
      if (name === "startedAt" || typeof pid !== "number") continue;
      try {
        process.kill(pid);
      } catch {
        // Ignore stale PIDs; the readiness probe below is the source of truth.
      }
    }
  } finally {
    unlinkSync(pidFile);
  }
}

function start(name, cwd, port) {
  const out = openSync(resolve(logsDir, `${name}.detached.out.log`), "a");
  const err = openSync(resolve(logsDir, `${name}.detached.err.log`), "a");
  const child = spawn(nodeBin, [nextBin, "start", "-p", String(port)], {
    cwd: resolve(root, cwd),
    detached: true,
    stdio: ["ignore", out, err],
    env: {
      ...process.env,
      NODE_ENV: "production",
    },
    windowsHide: true,
  });
  child.unref();
  return child;
}

async function waitForHttp(name, url, child, timeoutMs = 20000) {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`${name} exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error(`${name} did not become ready at ${url}: ${lastError}`);
}

function stopChildren(children) {
  for (const child of children) {
    try {
      process.kill(child.pid);
    } catch {
      // Best effort cleanup only.
    }
  }
}

cleanupOldPidFile();

const api = start("api", "apps/api", 4000);
const admin = start("admin", "apps/admin", 3000);

try {
  await waitForHttp("api", "http://localhost:4000/api/health", api);
  await waitForHttp("admin", "http://localhost:3000", admin);
  const pids = {
    api: api.pid,
    admin: admin.pid,
    startedAt: new Date().toISOString(),
    urls: {
      admin: "http://localhost:3000",
      api: "http://localhost:4000/api",
    },
  };
  writeFileSync(pidFile, JSON.stringify(pids, null, 2));
  console.log(JSON.stringify(pids, null, 2));
} catch (error) {
  stopChildren([api, admin]);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}