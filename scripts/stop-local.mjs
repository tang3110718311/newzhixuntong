import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const pidFile = resolve(import.meta.dirname, "..", ".logs", "pids.json");
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

if (existsSync(pidFile)) {
  const pids = JSON.parse(readFileSync(pidFile, "utf8"));
  for (const [name, pid] of Object.entries(pids)) {
    if (name === "startedAt" || typeof pid !== "number") continue;
    killPid(pid, name);
  }
  unlinkSync(pidFile);
} else {
  console.log("No pid file found.");
}

for (const [name, port] of Object.entries(PORTS)) {
  for (const pid of findListeningPids(port)) {
    killPid(pid, `${name} listener on ${port}`);
  }
}
