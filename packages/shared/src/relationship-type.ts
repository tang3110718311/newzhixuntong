export const INTERACTION_PATTERNS = [
  "customer_interaction",
  "project_coordination",
] as const;

export const AI_ONLY_INTERACTION_PATTERN = "pending" as const;
export const DEFAULT_INTERACTION_PATTERN = "customer_interaction" as const;

export type InteractionPattern = (typeof INTERACTION_PATTERNS)[number];
export type InteractionPatternValue = InteractionPattern | typeof AI_ONLY_INTERACTION_PATTERN;

export const INTERACTION_PATTERN_LABELS: Record<InteractionPatternValue, string> = {
  customer_interaction: "客户沟通型",
  project_coordination: "项目协调型",
  pending: "待判断",
};

export const INTERACTION_PATTERN_DESCRIPTIONS: Record<InteractionPatternValue, string> = {
  customer_interaction: "对方像客户、甲方或服务对象，会提出需求、质疑、催办和验收意见。",
  project_coordination: "对方像协作部门、项目干系人或相关方，围绕进度、资源、责任边界和口径一致性协调推进。",
  pending: "场景同时出现多种关系特征，暂时无法准确归类，建议补充场景信息后重新判断。",
};

export function normalizeInteractionPattern(value?: string | null): InteractionPatternValue {
  if (value === "project_coordination" || value === "customer_interaction" || value === "pending") return value;
  return DEFAULT_INTERACTION_PATTERN;
}

export function getInteractionPatternGuidance(value?: string | null) {
  const pattern = normalizeInteractionPattern(value);
  if (pattern === "project_coordination") {
    return "重点确认责任人、时间、依赖事项和下一步动作，推动事情落地；学员推责时要求补充可执行方案。";
  }
  if (pattern === "pending") {
    return "关系类型暂不明确，保持通用角色规则，不强行套用客户沟通或项目协调模板。";
  }
  return "重点识别并回应客户、甲方或服务对象的核心诉求；可以适度催办，但在方案可执行并完成确认后自然收尾。";
}
