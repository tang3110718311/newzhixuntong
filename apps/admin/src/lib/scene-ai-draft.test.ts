import assert from "node:assert/strict";
import { getInteractionPatternGuidance } from "../../../../packages/shared/src/relationship-type";
import {
  buildSupplementedSceneDescription,
  getSceneGenerationTargetRole,
  isPersistableInteractionPattern,
  mergeSceneAiDraft,
  mergeSceneWizardRoleForm,
} from "./scene-ai-draft";

assert.match(getInteractionPatternGuidance("customer_interaction"), /核心诉求/);
assert.match(getInteractionPatternGuidance("project_coordination"), /责任人/);

assert.equal(getSceneGenerationTargetRole(""), "学员");
assert.equal(getSceneGenerationTargetRole("  企业内训师  "), "企业内训师");

const merged = mergeSceneAiDraft(
  {
    interactionPattern: "customer_interaction",
    aiIdentity: "人工填写的甲方",
    aiBackground: "",
    learnerIdentity: "人工填写的学员",
    dialogGoal: "",
    scoringRules: [{ name: "人工评分", score: 100, criteria: "人工标准", deductionRule: "", evidenceRequired: "" }],
  },
  {
    interactionPattern: "project_coordination",
    interactionPatternReason: "需要协调资源和进度",
    aiRole: { identity: "AI 项目负责人", background: "项目背景", personality: "专业", emotion: "calm", goal: "推进项目" },
    learnerRole: { identity: "AI 建议的学员", goal: "确认资源" },
    scoringRules: [{ name: "AI 评分", score: 100, criteria: "AI 标准", deductionRule: "", evidenceRequired: "" }],
  },
);

assert.equal(merged.interactionPattern, "customer_interaction");
assert.deepEqual(merged.aiRecommendation, { pattern: "project_coordination", reason: "需要协调资源和进度" });
assert.equal(merged.aiIdentity, "人工填写的甲方");
assert.equal(merged.aiBackground, "项目背景");
assert.equal(merged.learnerIdentity, "人工填写的学员");
assert.equal(merged.dialogGoal, "确认资源");
assert.equal(merged.scoringRules?.[0]?.name, "人工评分");

assert.equal(
  buildSupplementedSceneDescription("原始场景", ["客户是谁？", "要达成什么？"], { 0: "市级客户", 1: "完成方案确认" }),
  "原始场景\n【补充信息】问题1：客户是谁？\n答案1：市级客户\n问题2：要达成什么？\n答案2：完成方案确认",
);

assert.throws(
  () => buildSupplementedSceneDescription("原始场景", ["客户是谁？"], {}),
  /请至少回答一个问题/,
);

assert.equal(isPersistableInteractionPattern("customer_interaction"), true);
assert.equal(isPersistableInteractionPattern("project_coordination"), true);
assert.equal(isPersistableInteractionPattern("pending"), false);
assert.equal(isPersistableInteractionPattern(undefined), false);

const wizardRoleForm = mergeSceneWizardRoleForm(
  {
    aiIdentity: "人工填写的甲方",
    aiBackground: "",
    aiPersonality: "",
    aiEmotion: "",
    aiStyle: "人工补充的话术风格",
    learnerIdentity: "人工填写的学员",
    dialogueGoal: "",
    initiator: "ai",
    endCondition: "",
    interruptCondition: "",
    dialogueExample: "",
    sceneDescription: "人工补充的场景描述",
  },
  {
    description: "AI 生成的场景描述",
    aiRole: { identity: "AI 甲方", background: "AI 背景", personality: "专业", emotion: "calm", goal: "推进确认" },
    learnerRole: { identity: "AI 学员", goal: "明确下一步" },
    endCondition: "确认计划",
    interruptCondition: "连续跑题",
  },
);

assert.equal(wizardRoleForm.aiIdentity, "人工填写的甲方");
assert.equal(wizardRoleForm.aiBackground, "AI 背景");
assert.equal(wizardRoleForm.aiStyle, "人工补充的话术风格");
assert.equal(wizardRoleForm.learnerIdentity, "人工填写的学员");
assert.equal(wizardRoleForm.sceneDescription, "人工补充的场景描述");
assert.equal(wizardRoleForm.endCondition, "确认计划");

console.log("scene-ai-draft tests passed");
