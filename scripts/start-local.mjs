import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const logsDir = resolve(root, ".logs");
const pidFile = resolve(logsDir, "pids.json");
mkdirSync(logsDir, { recursive: true });

const nextBin = resolve(root, "node_modules/next/dist/bin/next");
const nodeBin = process.execPath;
const PORTS = {
  api: 4000,
  admin: 3000,
};

function findListeningPids(port) {
  if (process.platform !== "win32") return [];
  try {
    const output = execFileSync("netstat", ["-ano"], { encoding: "utf8" });
    const pids = new Set();
    for (const line of output.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const local = parts[1] || "";
      const pid = Number(parts[parts.length - 1]);
      if (local.match(new RegExp(`(^|:)${port}$`)) && Number.isFinite(pid) && pid > 0) {
        pids.add(pid);
      }
    }
    return [...pids];
  } catch {
    return [];
  }
}

function killPid(pid, label) {
  try {
    process.kill(pid);
    console.log(`Stopped ${label}: ${pid}`);
  } catch (error) {
    console.log(`Skip ${label}: ${pid} (${error.message})`);
  }
}

async function waitForPortFree(port, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (findListeningPids(port).length === 0) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
}

async function stopPortListeners() {
  for (const [name, port] of Object.entries(PORTS)) {
    const pids = findListeningPids(port);
    for (const pid of pids) {
      killPid(pid, `${name} listener on ${port}`);
    }
    if (pids.length > 0) await waitForPortFree(port);
  }
}

async function cleanupOldPidFile() {
  if (!existsSync(pidFile)) return;
  try {
    const pids = JSON.parse(readFileSync(pidFile, "utf8"));
    for (const [name, pid] of Object.entries(pids)) {
      if (name === "startedAt" || typeof pid !== "number") continue;
      killPid(pid, name);
    }
  } finally {
    unlinkSync(pidFile);
  }
  await stopPortListeners();
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

await cleanupOldPidFile();
await stopPortListeners();

const api = start("api", "apps/api", 4000);
const admin = start("admin", "apps/admin", 3000);

try {
  await waitForHttp("api", "http://localhost:4000/api/health", api);
  await waitForHttp("admin", "http://localhost:3000", admin);
  const pids = {
    api: findListeningPids(PORTS.api)[0] || api.pid,
    admin: findListeningPids(PORTS.admin)[0] || admin.pid,
    spawned: {
      api: api.pid,
      admin: admin.pid,
    },
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
