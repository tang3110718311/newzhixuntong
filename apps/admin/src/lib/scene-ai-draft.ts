export type SceneAiDraft = {
  interactionPattern?: "customer_interaction" | "project_coordination" | "pending";
  interactionPatternReason?: string;
  followUpQuestions?: string[];
  aiRole?: { identity: string; background: string; personality: string; emotion: string; goal: string };
  learnerRole?: { identity: string; goal: string };
  endCondition?: string;
  interruptCondition?: string;
  scoringRules?: Array<{ name: string; score: number; criteria: string; deductionRule: string; evidenceRequired: string }>;
};

export type SceneAiDraftForm = {
  interactionPattern: "customer_interaction" | "project_coordination" | "";
  aiRecommendation?: { pattern: string; reason: string } | null;
  aiIdentity?: string;
  aiBackground?: string;
  aiPersonality?: string;
  aiEmotion?: string;
  aiPosition?: string;
  learnerIdentity?: string;
  dialogGoal?: string;
  dialogEndCondition?: string;
  dialogInterrupt?: string;
  scoringRules: Array<{ name: string; score: number; criteria: string; deductionRule: string; evidenceRequired: string }>;
};

export type SceneWizardRoleForm = {
  aiIdentity: string;
  aiBackground: string;
  aiPersonality: string;
  aiEmotion: string;
  aiStyle: string;
  learnerIdentity: string;
  dialogueGoal: string;
  initiator: string;
  endCondition: string;
  interruptCondition: string;
  dialogueExample: string;
  sceneDescription: string;
};

function keepNonEmpty(current: string, generated?: string) {
  return current.trim() ? current : (generated || "");
}

export function getSceneGenerationTargetRole(learnerIdentity?: string | null) {
  return learnerIdentity?.trim() || "学员";
}

export function isPersistableInteractionPattern(value?: string): value is "customer_interaction" | "project_coordination" {
  return value === "customer_interaction" || value === "project_coordination";
}

export function buildSupplementedSceneDescription(
  sceneDescription: string,
  questions: string[],
  answers: Record<number, string>,
) {
  const supplements = questions
    .map((question, index) => {
      const answer = answers[index]?.trim();
      return answer ? `问题${index + 1}：${question}\n答案${index + 1}：${answer}` : "";
    })
    .filter(Boolean);
  if (!supplements.length) throw new Error("请至少回答一个问题后再试。");
  return `${sceneDescription}\n【补充信息】${supplements.join("\n")}`;
}

export function mergeSceneAiDraft(current: SceneAiDraftForm, draft: SceneAiDraft): SceneAiDraftForm {
  const aiRole = draft.aiRole;
  const learnerRole = draft.learnerRole;
  return {
    ...current,
    aiRecommendation: draft.interactionPattern
      ? { pattern: draft.interactionPattern, reason: draft.interactionPatternReason || "" }
      : current.aiRecommendation,
    aiIdentity: keepNonEmpty(current.aiIdentity || "", aiRole?.identity),
    aiBackground: keepNonEmpty(current.aiBackground || "", aiRole?.background),
    aiPersonality: keepNonEmpty(current.aiPersonality || "", aiRole?.personality),
    aiEmotion: keepNonEmpty(current.aiEmotion || "", aiRole?.emotion),
    aiPosition: keepNonEmpty(current.aiPosition || "", aiRole?.goal),
    learnerIdentity: keepNonEmpty(current.learnerIdentity || "", learnerRole?.identity),
    dialogGoal: keepNonEmpty(current.dialogGoal || "", learnerRole?.goal),
    dialogEndCondition: keepNonEmpty(current.dialogEndCondition || "", draft.endCondition),
    dialogInterrupt: keepNonEmpty(current.dialogInterrupt || "", draft.interruptCondition),
    scoringRules: current.scoringRules.length ? current.scoringRules : (draft.scoringRules || current.scoringRules),
  };
}

export function mergeSceneWizardRoleForm(
  current: SceneWizardRoleForm,
  draft: Pick<SceneAiDraft, "aiRole" | "learnerRole" | "endCondition" | "interruptCondition"> & { description?: string },
): SceneWizardRoleForm {
  return {
    ...current,
    aiIdentity: keepNonEmpty(current.aiIdentity, draft.aiRole?.identity),
    aiBackground: keepNonEmpty(current.aiBackground, draft.aiRole?.background),
    aiPersonality: keepNonEmpty(current.aiPersonality, draft.aiRole?.personality),
    aiEmotion: keepNonEmpty(current.aiEmotion, draft.aiRole?.emotion),
    learnerIdentity: keepNonEmpty(current.learnerIdentity, draft.learnerRole?.identity),
    dialogueGoal: keepNonEmpty(current.dialogueGoal, draft.learnerRole?.goal),
    endCondition: keepNonEmpty(current.endCondition, draft.endCondition),
    interruptCondition: keepNonEmpty(current.interruptCondition, draft.interruptCondition),
    sceneDescription: keepNonEmpty(current.sceneDescription, draft.description),
  };
}
