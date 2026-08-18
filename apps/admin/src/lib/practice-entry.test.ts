import assert from "node:assert/strict";
import { createAutoStartGuard, shouldAutoStartPractice } from "./practice-entry";

assert.equal(
  shouldAutoStartPractice(new URLSearchParams("sceneId=scene_complaint&taskId=task_customer_service_20260805")),
  true,
  "从任务进入对练时应跳过训练说明并自动开始",
);

assert.equal(
  shouldAutoStartPractice(new URLSearchParams("sceneId=scene_complaint")),
  false,
  "从对练中心进入时应保留训练说明",
);

const guard = createAutoStartGuard();
assert.equal(guard.tryStart(), true, "首次任务入口初始化应允许发起 AI 首问");
assert.equal(guard.tryStart(), false, "重复初始化不得再次发起 AI 首问");

console.log("practice-entry tests passed");
