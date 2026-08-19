import assert from "node:assert/strict";
import { createAsyncSubmitGuard } from "./submit-guard";

async function main() {
  const guard = createAsyncSubmitGuard();
  let calls = 0;
  let releaseFirst: (() => void) | undefined;

  const first = guard.run(async () => {
    calls += 1;
    await new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    return "first";
  });

  const second = guard.run(async () => {
    calls += 1;
    return "second";
  });

  assert.equal(second, undefined, "重复提交应在首次提交完成前被拦截");
  assert.equal(calls, 1, "首次提交未完成前不应启动第二次提交");
  assert.equal(guard.isRunning(), true, "首次提交未完成时应保持锁定");

  releaseFirst?.();
  assert.equal(await first, "first");
  assert.equal(guard.isRunning(), false, "提交完成后应释放锁");

  const third = await guard.run(async () => {
    calls += 1;
    return "third";
  });

  assert.equal(third, "third", "首次提交完成后应允许新提交");
  assert.equal(calls, 2, "完成释放后只应执行一次新的提交");

  console.log("submit-guard tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
