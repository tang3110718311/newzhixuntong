export type GenerateSceneInput = {
  tenantId: string;
  industryName?: string;
  targetRole: string;
  mode: "voice" | "text";
  sceneDescription: string;
  attachmentSummaries?: string[];
};

export type ScoringRuleDraft = {
  name: string;
  score: number;
  criteria: string;
  deductionRule: string;
  evidenceRequired: string;
};

export type GeneratedSceneDraft = {
  name: string;
  sceneType: string;
  description: string;
  aiRole: {
    identity: string;
    background: string;
    personality: string;
    emotion: string;
    goal: string;
  };
  learnerRole: {
    identity: string;
    goal: string;
  };
  endCondition: string;
  interruptCondition: string;
  scoringRules?: ScoringRuleDraft[];
};

export type GenerateScoringInput = {
  tenantId: string;
  sceneName: string;
  sceneGoal: string;
  capabilityItems?: Array<{ name: string; weight: number }>;
};

export type ScoreTrainingInput = {
  tenantId: string;
  sceneName: string;
  transcript: string;
  scoringRules: ScoringRuleDraft[];
};

export type SummarizeKnowledgeInput = {
  tenantId: string;
  fileName: string;
  content: string;
};

export type SummarizeKnowledgeResult = {
  summary: string;
};

export type TrainingScoreResult = {
  score: number;
  details: Array<{ name: string; score: number; evidenceText: string; deductionReason: string }>;
  suggestions: string[];
};

export type TranscribeInput = {
  tenantId: string;
  fileId: string;
  language?: string;
};

export type TranscribeResult = {
  text: string;
  durationMs: number;
};

export type SynthesizeInput = {
  tenantId: string;
  text: string;
  voice?: string;
};

export type SynthesizeResult = {
  fileId: string;
  durationMs: number;
};

export interface LlmProvider {
  generateScene(input: GenerateSceneInput): Promise<GeneratedSceneDraft>;
  generateScoringRules(input: GenerateScoringInput): Promise<ScoringRuleDraft[]>;
  scoreTraining(input: ScoreTrainingInput): Promise<TrainingScoreResult>;
  summarizeKnowledge(input: SummarizeKnowledgeInput): Promise<SummarizeKnowledgeResult>;
}

export interface SttProvider {
  transcribe(input: TranscribeInput): Promise<TranscribeResult>;
}

export interface TtsProvider {
  synthesize(input: SynthesizeInput): Promise<SynthesizeResult>;
}

export class AiProviderNotConfiguredError extends Error {
  constructor(message = "模型服务未配置，请先在系统配置中填写供应商、Base URL 和 API Key。") {
    super(message);
    this.name = "AiProviderNotConfiguredError";
  }
}

export type OpenAiCompatibleConfig = {
  baseUrl: string;
  apiKey: string;
  modelName: string;
  providerName?: string;
};

function normalizeChatCompletionsUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

function extractJsonObject(text: string) {
  const clean = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("模型返回内容不是 JSON 对象。");
  }
  return JSON.parse(clean.slice(start, end + 1)) as GeneratedSceneDraft;
}

function defaultScoringRules(): ScoringRuleDraft[] {
  return [
    {
      name: "目标识别",
      score: 25,
      criteria: "能准确识别客户或被训对象的核心诉求。",
      deductionRule: "未识别关键诉求按遗漏程度扣分。",
      evidenceRequired: "需要从对话文本中找到复述或确认诉求的证据。",
    },
    {
      name: "专业表达",
      score: 25,
      criteria: "表达符合业务规范，解释清楚，避免违规承诺。",
      deductionRule: "表述不清、承诺越权或用语不规范扣分。",
      evidenceRequired: "需要提供关键表达片段作为评分依据。",
    },
    {
      name: "互动推进",
      score: 25,
      criteria: "能持续引导对话并推进下一步动作。",
      deductionRule: "没有明确下一步动作或反馈时限扣分。",
      evidenceRequired: "需要提供推进动作、反馈安排等证据。",
    },
    {
      name: "情绪与风险处理",
      score: 25,
      criteria: "能识别情绪、处理风险并保持沟通稳定。",
      deductionRule: "忽视情绪、激化冲突或遗漏风险点扣分。",
      evidenceRequired: "需要提供安抚、澄清、风险提示等证据。",
    },
  ];
}

function normalizeGeneratedScene(raw: GeneratedSceneDraft, input: GenerateSceneInput): GeneratedSceneDraft {
  const scoringRules = Array.isArray(raw.scoringRules) && raw.scoringRules.length ? raw.scoringRules : defaultScoringRules();
  const total = scoringRules.reduce((sum, rule) => sum + Number(rule.score || 0), 0);

  return {
    name: raw.name || `${input.targetRole}训练场景`,
    sceneType: raw.sceneType || input.targetRole,
    description: raw.description || input.sceneDescription,
    aiRole: {
      identity: raw.aiRole?.identity || "业务对象",
      background: raw.aiRole?.background || input.sceneDescription,
      personality: raw.aiRole?.personality || "关注结果，会追问关键细节。",
      emotion: raw.aiRole?.emotion || "calm",
      goal: raw.aiRole?.goal || "获得明确答复和可执行安排。",
    },
    learnerRole: {
      identity: raw.learnerRole?.identity || input.targetRole,
      goal: raw.learnerRole?.goal || "按规范完成沟通并达成训练目标。",
    },
    endCondition: raw.endCondition || "学员完成关键回应并明确下一步动作。",
    interruptCondition: raw.interruptCondition || "出现违规承诺、泄露敏感信息或严重不当表达时中断。",
    scoringRules: total === 100 ? scoringRules : defaultScoringRules(),
  };
}

export function createOpenAiCompatibleLlmProvider(config: OpenAiCompatibleConfig): LlmProvider {
  const endpoint = normalizeChatCompletionsUrl(config.baseUrl);

  return {
    async generateScene(input) {
      const prompt = [
        "你是 AI 智训通的行业场景设计专家。",
        "请基于输入生成一个可直接落库的角色训练场景，只返回 JSON，不要 Markdown。",
        "JSON 字段必须包含：name, sceneType, description, aiRole, learnerRole, endCondition, interruptCondition, scoringRules。",
        "aiRole 字段包含 identity, background, personality, emotion, goal。",
        "learnerRole 字段包含 identity, goal。",
        "scoringRules 是数组，每项包含 name, score, criteria, deductionRule, evidenceRequired，总分必须为 100。",
        `行业：${input.industryName || "通用行业"}`,
        `目标角色：${input.targetRole}`,
        `训练模式：${input.mode}`,
        `场景说明：${input.sceneDescription}`,
        input.attachmentSummaries?.length ? `资料摘要：${input.attachmentSummaries.join("\n")}` : "",
      ].filter(Boolean).join("\n");

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.modelName,
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "你只输出严格 JSON 对象，禁止输出解释文字。" },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`模型接口调用失败：HTTP ${response.status} ${errorText.slice(0, 300)}`);
      }

      const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("模型接口未返回有效内容。");
      }

      return normalizeGeneratedScene(extractJsonObject(content), input);
    },
    async generateScoringRules(input) {
      const scene = await this.generateScene({
        tenantId: input.tenantId,
        targetRole: "学员",
        mode: "voice",
        sceneDescription: `${input.sceneName}\n${input.sceneGoal}`,
      });
      return scene.scoringRules || [];
    },
    async summarizeKnowledge(input) {
      const prompt = [
        "你是企业培训知识库整理专家。请从以下培训资料中提炼出适合作为 AI 出题依据的知识点。",
        "要求：按要点分条列出，覆盖核心概念、关键流程、重要数据/条款、常见错误或易混淆点；表达简洁，每条不超过 60 字。",
        `文件名：${input.fileName}`,
        "资料内容：",
        input.content.slice(0, 8000),
      ].join("\n");

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.modelName,
          temperature: 0.3,
          messages: [
            { role: "system", content: "你是知识提炼助手，直接输出要点列表，不要多余解释。" },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`模型接口调用失败：HTTP ${response.status} ${errorText.slice(0, 300)}`);
      }
      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("模型接口未返回有效内容。");
      return { summary: content.trim() };
    },
    async scoreTraining() {
      throw new Error("训练评分模型适配器待接入。");
    },
  };
}

export function createUnconfiguredLlmProvider(): LlmProvider {
  return {
    async generateScene() {
      throw new AiProviderNotConfiguredError();
    },
    async generateScoringRules() {
      throw new AiProviderNotConfiguredError();
    },
    async scoreTraining() {
      throw new AiProviderNotConfiguredError();
    },
    async summarizeKnowledge() {
      throw new AiProviderNotConfiguredError();
    },
  };
}