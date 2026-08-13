import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(1000).default(20),
  keyword: z.string().optional().default(""),
  status: z.string().optional().default(""),
  mode: z.string().optional().default(""),
  createMode: z.string().optional().default(""),
  orgId: z.string().optional().default(""),
});

export const updateTenantSettingsSchema = z.object({
  name: z.string().min(2).max(80),
  planCode: z.enum(["trial", "standard", "professional", "enterprise"]).default("trial"),
  expireAt: z.string().datetime().optional().nullable(),
  resourceQuota: z.object({
    sceneLimit: z.coerce.number().int().min(0).max(100000).default(50),
    aiTokenLimit: z.coerce.number().int().min(0).max(100000000).default(100000),
    sttSeconds: z.coerce.number().int().min(0).max(100000000).default(3600),
    ttsCharacters: z.coerce.number().int().min(0).max(100000000).default(100000),
  }),
});
export const createIndustryPackageSchema = z.object({
  name: z.string().min(2).max(80),
  code: z.string().min(2).max(40),
  industryType: z.string().min(2).max(40),
  targetRoles: z.string().min(2).max(300),
  description: z.string().max(1000).optional().default(""),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(80),
  code: z.string().min(2).max(40),
  type: z.enum(["department", "company", "team", "external"]).default("department"),
  parentId: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
});
export const createUserSchema = z.object({
  name: z.string().min(2).max(40),
  mobile: z.string().min(6).max(30),
  email: z.string().email().optional().or(z.literal("")),
  roleCode: z.enum(["tenant_admin", "trainer", "learner"]).default("learner"),
  orgId: z.string().optional().nullable(),
  initialPassword: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  mobile: z.string().min(6).max(30),
  password: z.string().min(8).max(128),
  code: z.string().min(4).max(10),
});

export const sendCodeSchema = z.object({
  mobile: z.string().min(6).max(30),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z.string().min(8).max(128),
}).refine((value) => value.currentPassword !== value.newPassword, {
  message: "New password must differ from the current password.",
  path: ["newPassword"],
});

export const capabilityItemInputSchema = z.object({
  name: z.string().min(1).max(80),
  weight: z.coerce.number().int().min(1).max(100),
  scoreDesc: z.string().max(1000).optional().default(""),
  riskTag: z.string().max(80).optional().default(""),
});

export const createCapabilityModelSchema = z.object({
  industryPackageId: z.string().min(1),
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional().default(""),
  passScore: z.coerce.number().int().min(0).max(100).default(80),
  items: z.array(capabilityItemInputSchema).min(1).max(20),
}).refine((value) => value.items.reduce((sum, item) => sum + item.weight, 0) === 100, {
  message: "能力项权重合计必须等于 100。",
  path: ["items"],
});
export const sceneCreateModeSchema = z.enum(["ai_practice", "ai_exam", "fixed_practice", "fixed_exam"]);
export const sceneCreateModeLabels: Record<string, string> = {
  ai_practice: "AI对练模式",
  ai_exam: "AI对练+考试模式",
  fixed_practice: "固定对练模式",
  fixed_exam: "固定对练+考试模式",
};
export const createSceneSchema = z.object({
  industryPackageId: z.string().optional().nullable(),
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(60),
  mode: z.enum(["voice", "text"]).default("voice"),
  createMode: sceneCreateModeSchema.default("ai_practice"),
  sceneType: z.string().min(1).max(80),
  description: z.string().min(1).max(2000),
  aiRole: z.object({
    identity: z.string().max(200).optional().default(""),
    background: z.string().max(300).optional().default(""),
    personality: z.string().max(200).optional().default(""),
    emotion: z.string().max(50).optional().default(""),
    languageStyle: z.string().max(200).optional().default(""),
    goal: z.string().max(200).optional().default(""),
  }).optional(),
  learnerRole: z.object({
    identity: z.string().max(200).optional().default(""),
    goal: z.string().max(500).optional().default(""),
  }).optional(),
  endCondition: z.string().max(300).optional().default(""),
  interruptCondition: z.string().max(300).optional().default(""),
  dialogueExample: z.string().max(2000).optional().default(""),
  initiator: z.enum(["ai", "learner", "random"]).optional().default("ai"),
  scoringRules: z.array(z.object({
    name: z.string().min(1).max(80),
    score: z.number().min(0).max(100),
    criteria: z.string().max(500).optional().default(""),
    deductionRule: z.string().max(500).optional().default(""),
    evidenceRequired: z.string().max(500).optional().default(""),
  })).optional().default([]),
});


export const updateSceneSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).optional(),
  aiRole: z.object({
    identity: z.string().max(200).optional().default(""),
    background: z.string().max(300).optional().default(""),
    personality: z.string().max(200).optional().default(""),
    emotion: z.string().max(50).optional().default(""),
    languageStyle: z.string().max(200).optional().default(""),
    goal: z.string().max(200).optional().default(""),
  }).optional(),
  learnerRole: z.object({
    identity: z.string().max(200).optional().default(""),
    goal: z.string().max(500).optional().default(""),
  }).optional(),
  endCondition: z.string().max(300).optional(),
  interruptCondition: z.string().max(300).optional(),
  dialogueExample: z.string().max(2000).optional(),
  initiator: z.enum(["ai", "learner", "random"]).optional(),
  scoringRules: z.array(z.object({
    name: z.string().min(1).max(80),
    score: z.number().min(0).max(100),
    criteria: z.string().max(500).optional().default(""),
    deductionRule: z.string().max(500).optional().default(""),
    evidenceRequired: z.string().max(500).optional().default(""),
  })).optional(),
});

export const createMaterialSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.enum(["script", "faq", "policy", "case", "other"]).default("script"),
  industryPackageId: z.string().optional().nullable(),
  sceneId: z.string().optional().nullable(),
  tags: z.array(z.string().min(1).max(30)).default([]),
  content: z.string().min(1).max(10000),
});


export const createAppealSchema = z.object({
  bizType: z.enum(["training_record"]).default("training_record"),
  bizId: z.string().min(1),
  userId: z.string().optional().nullable(),
  reason: z.string().min(5).max(1000),
});

export const handleAppealSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  handlerId: z.string().optional().nullable(),
});
export const scoringRuleInputSchema = z.object({
  name: z.string().min(1).max(80),
  score: z.coerce.number().int().min(0).max(100),
  criteria: z.string().min(1).max(1000),
  deductionRule: z.string().max(1000).optional().default(""),
  evidenceRequired: z.string().max(1000).optional().default(""),
});

export const updateScoringRulesSchema = z.object({
  rules: z.array(scoringRuleInputSchema).min(1).max(20),
}).refine((value) => value.rules.reduce((sum, rule) => sum + rule.score, 0) === 100, {
  message: "评分规则总分必须等于 100。",
  path: ["rules"],
});

export const createTaskSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(60),
  type: z.string().min(2).max(60),
  description: z.string().max(2000).optional().default(""),
  sceneIds: z.array(z.string()).min(1),
  participantUserIds: z.array(z.string()).default([]),
  participantOrgIds: z.array(z.string()).default([]),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  answerForm: z.enum(["voice", "text"]).optional().default("voice"),
});

export const trainingTurnInputSchema = z.object({
  speaker: z.enum(["ai", "learner"]),
  text: z.string().min(1).max(5000),
  durationMs: z.coerce.number().int().min(0).max(3600000).optional().default(0),
  startedAt: z.string().datetime().optional().nullable(),
});

export const scoreDetailInputSchema = z.object({
  scoringRuleId: z.string().optional().nullable(),
  score: z.coerce.number().int().min(0).max(100),
  deductionReason: z.string().max(1000).optional().default(""),
  evidenceText: z.string().max(1000).optional().default(""),
});

export const createTrainingRecordSchema = z.object({
  taskId: z.string().optional().nullable(),
  sceneId: z.string().min(1),
  userId: z.string().optional().nullable(),
  mode: z.enum(["voice", "text"]).default("voice"),
  status: z.enum(["completed", "in_progress"]).default("completed"),
  score: z.coerce.number().int().min(0).max(100),
  startedAt: z.string().datetime().optional().nullable(),
  finishedAt: z.string().datetime().optional().nullable(),
  turns: z.array(trainingTurnInputSchema).min(1).max(50),
  scores: z.array(scoreDetailInputSchema).min(1).max(20),
});
export const updateAiProviderSchema = z.object({
  providerType: z.enum(["llm", "stt", "tts"]).default("llm"),
  providerName: z.string().min(2).max(80),
  modelName: z.string().min(1).max(120),
  baseUrl: z.string().url(),
  apiKey: z.string().min(8).max(300).optional(),
  status: z.enum(["enabled", "disabled"]).default("enabled"),
  isDefault: z.boolean().default(true),
});

export const generateSceneSchema = z.object({
  industryPackageId: z.string().optional().nullable(),
  sceneDescription: z.string().min(10, "场景描述至少需要 10 个字").max(2000, "场景描述不能超过 2000 个字"),
  targetRole: z.string().min(1).max(120),
  mode: z.enum(["voice", "text"]).default("voice"),
  createMode: sceneCreateModeSchema.default("ai_practice"),
  attachmentFileIds: z.array(z.string()).default([]),
});
export const transcribeAudioSchema = z.object({
  fileId: z.string().min(1),
  language: z.string().max(20).optional().default("zh-CN"),
});

export const synthesizeSpeechSchema = z.object({
  text: z.string().min(1).max(5000),
  voice: z.string().max(80).optional().default("default"),
});

export const createExamBankSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(1000).optional().default(""),
});

export const examQuestionInputSchema = z.object({
  bankId: z.string().optional().nullable(),
  type: z.enum(["single", "multi", "judge"]),
  stem: z.string().min(1).max(2000),
  options: z.array(z.string().min(1).max(500)).min(2).max(8),
  answer: z.string().min(1).max(500),
  analysis: z.string().max(2000).optional().default(""),
  score: z.coerce.number().int().min(1).max(100).default(5),
});

export const createExamSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(60).optional(),
  bankId: z.string().optional().nullable(),
  description: z.string().max(2000).optional().default(""),
  durationMinutes: z.coerce.number().int().min(1).max(600).default(60),
  passScore: z.coerce.number().int().min(0).max(100).default(60),
});

export const updateExamSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).optional(),
  durationMinutes: z.coerce.number().int().min(1).max(600).optional(),
  passScore: z.coerce.number().int().min(0).max(100).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

export const createExamAttemptSchema = z.object({
  examId: z.string().min(1),
  userId: z.string().optional().nullable(),
});

export const submitExamAttemptSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().min(1),
    answer: z.string().min(0).max(500),
  })).min(1).max(200),
});

export const createRoleSchema = z.object({
  name: z.string().min(2).max(80),
  code: z.string().min(2).max(40),
  permissions: z.array(z.string().min(1).max(80)).default([]),
  status: z.enum(["enabled", "disabled"]).default("enabled"),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
});

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  code: z.string().min(2).max(40).optional(),
  permissions: z.array(z.string().min(1).max(80)).optional(),
  status: z.enum(["enabled", "disabled"]).optional(),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
});

export const createMenuSchema = z.object({
  parentId: z.string().optional().nullable(),
  name: z.string().min(2).max(80),
  code: z.string().min(2).max(60),
  icon: z.string().max(80).optional().default(""),
  status: z.enum(["enabled", "disabled"]).default("enabled"),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
});

export const updateMenuSchema = z.object({
  parentId: z.string().optional().nullable(),
  name: z.string().min(2).max(80).optional(),
  code: z.string().min(2).max(60).optional(),
  icon: z.string().max(80).optional(),
  status: z.enum(["enabled", "disabled"]).optional(),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
});

export const createPostSchema = z.object({
  orgId: z.string().optional().nullable(),
  name: z.string().min(2).max(80),
  headcount: z.coerce.number().int().min(0).max(100000).default(0),
  status: z.enum(["enabled", "disabled"]).default("enabled"),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
});

export const updatePostSchema = z.object({
  orgId: z.string().optional().nullable(),
  name: z.string().min(2).max(80).optional(),
  headcount: z.coerce.number().int().min(0).max(100000).optional(),
  status: z.enum(["enabled", "disabled"]).optional(),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
});

export const createKnowledgeFolderSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional().default(""),
});

export const updateKnowledgeFolderSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(1000).optional(),
});






