import { execFile } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const pidFile = resolve(import.meta.dirname, "..", ".logs", "chattts-pid.json");
const port = Number(process.env.CHAT_TTS_PORT || process.env.CHATTS_PORT || 8179);
if (!existsSync(pidFile)) {
  const portPid = await findListeningPid(port);
  if (portPid) {
    stopPid(portPid);
  } else {
    console.log("No ChatTTS pid file found.");
  }
  process.exit(0);
}

const payload = JSON.parse(readFileSync(pidFile, "utf8"));
let pid = payload.chattts;
if (typeof pid !== "number") {
  pid = await findListeningPid(port);
}
if (typeof pid !== "number") {
  console.log("Invalid ChatTTS pid file.");
  unlinkSync(pidFile);
  process.exit(0);
}

stopPid(pid);
unlinkSync(pidFile);

function stopPid(pid) {
  try {
    process.kill(pid);
    console.log(`Stopped ChatTTS: ${pid}`);
  } catch (error) {
    console.log(`Skip ChatTTS: ${pid} (${error.message})`);
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
