import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const pidFile = resolve(import.meta.dirname, "..", ".logs", "pids.json");
if (!existsSync(pidFile)) {
  console.log("No pid file found.");
  process.exit(0);
}
const pids = JSON.parse(readFileSync(pidFile, "utf8"));
for (const [name, pid] of Object.entries(pids)) {
  if (name === "startedAt" || typeof pid !== "number") continue;
  try {
    process.kill(pid);
    console.log(`Stopped ${name}: ${pid}`);
  } catch (error) {
    console.log(`Skip ${name}: ${pid} (${error.message})`);
  }
}
unlinkSync(pidFile);