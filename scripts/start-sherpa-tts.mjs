import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const root = resolve(import.meta.dirname, "..");
const logsDir = resolve(root, ".logs");
const pidFile = resolve(logsDir, "sherpa-tts-pid.json");
const apiEnvPath = resolve(root, "apps/api/.env");
mkdirSync(logsDir, { recursive: true });

const envFile = readEnvFile(apiEnvPath);
const pythonBin = process.env.TTS_PYTHON_BIN || envFile.TTS_PYTHON_BIN || "python";
const port = Number(process.env.SHERPA_TTS_PORT || envFile.SHERPA_TTS_PORT || 8180);
const script = resolve(root, "apps/api/sherpa_tts_service.py");

if (await isReady(port)) {
  const existingPid = await findListeningPid(port);
  const payload = {
    sherpa_tts: existingPid,
    status: "already-running",
    url: `http://127.0.0.1:${port}`,
    logFile: resolve(logsDir, "sherpa-tts-service.log"),
  };
  if (existingPid) writeFileSync(pidFile, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

cleanupStalePid();

const child = spawn(pythonBin, [script], {
  cwd: root,
  detached: true,
  stdio: "ignore",
  windowsHide: true,
  env: {
    ...process.env,
    ...envFile,
    SHERPA_TTS_PORT: String(port),
    SHERPA_TTS_LOG_FILE: resolve(logsDir, "sherpa-tts-service.log"),
  },
});
child.unref();

await waitForReady(port, 60000);

const payload = {
  sherpa_tts: child.pid,
  startedAt: new Date().toISOString(),
  url: `http://127.0.0.1:${port}`,
  logFile: resolve(logsDir, "sherpa-tts-service.log"),
};
writeFileSync(pidFile, JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload, null, 2));

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const text = readFileSync(path, "utf8");
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function cleanupStalePid() {
  if (!existsSync(pidFile)) return;
  try {
    const pid = JSON.parse(readFileSync(pidFile, "utf8")).sherpa_tts;
    if (typeof pid === "number") process.kill(pid);
  } catch {
    // Stale or invalid pid file; overwrite it after the new service is ready.
  }
}

async function waitForReady(port, timeoutMs) {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && payload.ok) return;
      lastError = JSON.stringify(payload);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 2000));
  }
  throw new Error(`sherpa-tts service did not become ready on port ${port}: ${lastError}`);
}

async function isReady(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, { cache: "no-store" });
    const payload = await response.json();
    return response.ok && Boolean(payload.ok);
  } catch {
    return false;
  }
}

async function findListeningPid(port) {
  try {
    const { stdout } = await execFileAsync("netstat", ["-ano"]);
    const pattern = new RegExp(`:${port}\\s+.*LISTENING\\s+(\\d+)`, "i");
    for (const line of stdout.split(/\r?\n/)) {
      const match = line.match(pattern);
      if (match) return Number(match[1]);
    }
  } catch {
    return null;
  }
  return null;
}
