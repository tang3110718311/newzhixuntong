import { pbkdf2Sync, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "../../..");

function loadRootEnv() {
  const envPath = resolve(rootDir, ".env");
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?
/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (process.env[key]) continue;
      process.env[key] = rest.join("=").trim().replace(/^"|"$/g, "");
    }
  } catch {
    // Prisma CLI usually loads .env before seed; this fallback keeps direct node execution usable.
  }
}

loadRootEnv();

const prisma = new PrismaClient();
const now = new Date();

function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const iterations = 210000;
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha512").toString("base64url");
  return `pbkdf2_sha512$${iterations}$${salt}$${hash}`;
}

const defaultAdminPassword = process.env.ZXT_SEED_ADMIN_PASSWORD || "Zxt@2026";

const sceneTemplates = [
  {
    code: "CJ-KF-TS-001",
    name: "客户投诉处理对练",
    sceneType: "投诉处理",
    description: "客户因服务等待时间长、问题未闭环产生不满，训练客服识别诉求、安抚情绪并推进处理。",
    aiRole: {
      identity: "情绪焦急的宽带用户",
      background: "用户连续两次反馈问题未解决，对处理效率不满。",
      personality: "表达直接，容易追问责任和时限。",
      emotion: "anxious",
      goal: "确认问题能被正式受理，并获得明确处理时限。",
    },
    studentRole: {
      identity: "客服坐席",
      goal: "准确识别投诉诉求，完成安抚、核实、承诺和闭环说明。",
    },
    scoring: [
      ["诉求识别", 25, "能准确复述客户核心问题和情绪点。"],
      ["情绪安抚", 20, "表达有同理心，不推诿，不与客户争辩。"],
      ["流程合规", 25, "按投诉受理流程核实信息、登记工单、说明时限。"],
      ["解决推进", 20, "给出明确下一步、责任环节和反馈方式。"],
      ["表达规范", 10, "用语清晰、礼貌、无敏感承诺。"],
    ],
  },
  {
    code: "CJ-KF-ZF-002",
    name: "套餐资费咨询对练",
    sceneType: "套餐资费咨询",
    description: "客户咨询套餐价格、流量、宽带和合约限制，训练客服解释资费并推荐合适方案。",
    aiRole: {
      identity: "关注价格的套餐咨询客户",
      background: "客户认为现有套餐偏贵，想比较不同档位和优惠。",
      personality: "谨慎，关注价格、合约期和售后。",
      emotion: "calm",
      goal: "弄清套餐差异，判断是否办理或变更套餐。",
    },
    studentRole: {
      identity: "营业厅客户经理",
      goal: "问清需求，解释资费边界，推荐匹配套餐并提示关键规则。",
    },
    scoring: [
      ["需求探询", 20, "能问清预算、流量、宽带、家庭成员等关键信息。"],
      ["资费解释", 30, "能准确说明套餐内容、费用构成和限制条件。"],
      ["方案匹配", 25, "推荐方案与客户需求一致，不过度营销。"],
      ["风险提示", 15, "主动说明合约期、违约金、优惠到期等注意事项。"],
      ["沟通体验", 10, "表达简洁清楚，客户容易理解。"],
    ],
  },
  {
    code: "CJ-KF-GZ-003",
    name: "网络故障报修受理对练",
    sceneType: "网络故障报修",
    description: "客户反馈宽带无法上网，训练客服快速定位问题、登记报修并说明处理安排。",
    aiRole: {
      identity: "网络中断的家庭宽带用户",
      background: "用户晚上发现无法上网，担心影响第二天办公。",
      personality: "急切，关注恢复时间。",
      emotion: "urgent",
      goal: "尽快确认故障原因和上门处理安排。",
    },
    studentRole: {
      identity: "客服报修受理人员",
      goal: "完成身份核验、基础排障、故障登记和处理时限说明。",
    },
    scoring: [
      ["身份核验", 15, "能合规核验用户身份和业务地址。"],
      ["基础排障", 25, "能引导检查光猫、路由器、电源和指示灯。"],
      ["工单登记", 25, "准确记录故障现象、影响范围和联系方式。"],
      ["时限说明", 20, "说明预计处理时限和后续通知方式。"],
      ["安抚表达", 15, "回应客户急迫情绪，表达专业可信。"],
    ],
  },
];

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { code: "zxt-demo" },
    update: {
      name: "智训通本地验证租户",
      status: "active",
      planCode: "trial",
      resourceQuotaJson: JSON.stringify({ sceneLimit: 50, aiTokenLimit: 100000, sttSeconds: 3600 }),
    },
    create: {
      name: "智训通本地验证租户",
      code: "zxt-demo",
      status: "active",
      planCode: "trial",
      resourceQuotaJson: JSON.stringify({ sceneLimit: 50, aiTokenLimit: 100000, sttSeconds: 3600 }),
    },
  });

  const org = await prisma.organization.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "CS-DEPT" } },
    update: { name: "客户服务部" },
    create: { tenantId: tenant.id, code: "CS-DEPT", name: "客户服务部", type: "department" },
  });

  const admin = await prisma.user.upsert({
    where: { tenantId_mobile: { tenantId: tenant.id, mobile: "13800000000" } },
    update: {
      name: "智训通管理员",
      orgId: org.id,
      roleCode: "tenant_admin",
      status: "active",
      passwordHash: hashPassword(defaultAdminPassword),
      passwordMustChange: false,
    },
    create: {
      tenantId: tenant.id,
      orgId: org.id,
      name: "智训通管理员",
      mobile: "13800000000",
      email: "admin@example.com",
      roleCode: "tenant_admin",
      status: "active",
      passwordHash: hashPassword(defaultAdminPassword),
      passwordMustChange: false,
    },
  });

  const learner = await prisma.user.upsert({
    where: { tenantId_mobile: { tenantId: tenant.id, mobile: "13900000001" } },
    update: {
      name: "周晓雯",
      orgId: org.id,
      roleCode: "learner",
      status: "active",
      passwordHash: hashPassword(defaultAdminPassword),
      passwordMustChange: true,
    },
    create: {
      tenantId: tenant.id,
      orgId: org.id,
      name: "周晓雯",
      mobile: "13900000001",
      roleCode: "learner",
      status: "active",
      passwordHash: hashPassword(defaultAdminPassword),
      passwordMustChange: true,
    },
  });
  const industry = await prisma.industryPackage.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "IND-CS" } },
    update: {
      name: "客服训练包",
      industryType: "customer_service",
      targetRoles: "客服坐席、营业厅客户经理、投诉处理人员、质检主管",
      status: "enabled",
      description: "面向投诉处理、套餐资费咨询、网络故障报修等高频客服场景。",
      isSystemTemplate: true,
      updatedBy: admin.id,
    },
    create: {
      tenantId: tenant.id,
      code: "IND-CS",
      name: "客服训练包",
      industryType: "customer_service",
      targetRoles: "客服坐席、营业厅客户经理、投诉处理人员、质检主管",
      status: "enabled",
      description: "面向投诉处理、套餐资费咨询、网络故障报修等高频客服场景。",
      isSystemTemplate: true,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  const capabilityModel = await prisma.capabilityModel.upsert({
    where: { id: `${tenant.id}-cs-capability` },
    update: { name: "客服岗位能力模型", description: "客服场景通用能力维度", passScore: 80 },
    create: {
      id: `${tenant.id}-cs-capability`,
      tenantId: tenant.id,
      industryPackageId: industry.id,
      name: "客服岗位能力模型",
      description: "客服场景通用能力维度",
      passScore: 80,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  await prisma.capabilityItem.deleteMany({ where: { tenantId: tenant.id, capabilityModelId: capabilityModel.id } });
  await prisma.capabilityItem.createMany({
    data: [
      { tenantId: tenant.id, capabilityModelId: capabilityModel.id, name: "需求识别", weight: 25, scoreDesc: "快速识别客户核心诉求。" },
      { tenantId: tenant.id, capabilityModelId: capabilityModel.id, name: "合规表达", weight: 25, scoreDesc: "按业务规范说明边界。" },
      { tenantId: tenant.id, capabilityModelId: capabilityModel.id, name: "情绪安抚", weight: 20, scoreDesc: "处理客户情绪并保持专业。" },
      { tenantId: tenant.id, capabilityModelId: capabilityModel.id, name: "闭环推进", weight: 30, scoreDesc: "明确下一步动作和反馈时限。" },
    ],
  });

  const scenes = [];
  for (const template of sceneTemplates) {
    const scene = await prisma.scene.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: template.code } },
      update: {
        industryPackageId: industry.id,
        name: template.name,
        mode: "voice",
        status: "published",
        isTemplate: true,
        sourceType: "template",
        sceneType: template.sceneType,
        description: template.description,
        updatedBy: admin.id,
      },
      create: {
        tenantId: tenant.id,
        industryPackageId: industry.id,
        code: template.code,
        name: template.name,
        mode: "voice",
        status: "published",
        isTemplate: true,
        sourceType: "template",
        sceneType: template.sceneType,
        description: template.description,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });

    await prisma.sceneRole.deleteMany({ where: { tenantId: tenant.id, sceneId: scene.id } });
    await prisma.sceneRole.createMany({
      data: [
        { tenantId: tenant.id, sceneId: scene.id, roleType: "ai", ...template.aiRole },
        { tenantId: tenant.id, sceneId: scene.id, roleType: "learner", identity: template.studentRole.identity, goal: template.studentRole.goal },
      ],
    });

    await prisma.sceneRule.upsert({
      where: { tenantId_sceneId: { tenantId: tenant.id, sceneId: scene.id } },
      update: {
        initiator: "ai",
        endCondition: "学员完成关键回应并明确后续闭环动作。",
        interruptCondition: "出现违规承诺、辱骂客户、泄露敏感信息时中断。",
        description: template.description,
      },
      create: {
        tenantId: tenant.id,
        sceneId: scene.id,
        initiator: "ai",
        endCondition: "学员完成关键回应并明确后续闭环动作。",
        interruptCondition: "出现违规承诺、辱骂客户、泄露敏感信息时中断。",
        description: template.description,
      },
    });

    await prisma.scoringRule.deleteMany({ where: { tenantId: tenant.id, sceneId: scene.id } });
    await prisma.scoringRule.createMany({
      data: template.scoring.map(([name, score, criteria], index) => ({
        tenantId: tenant.id,
        sceneId: scene.id,
        name,
        score,
        criteria,
        deductionRule: "未覆盖关键动作按比例扣分。",
        evidenceRequired: "需从对话文本中找到对应表达证据。",
        sortOrder: index + 1,
      })),
    });

    scenes.push(scene);
  }

  const task = await prisma.task.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "RW-CS-20260805-001" } },
    update: {
      name: "客服高频场景训练任务",
      type: "scenario_training",
      status: "published",
      startAt: new Date("2026-08-05T09:00:00+08:00"),
      endAt: new Date("2026-08-12T23:59:59+08:00"),
      publishAt: now,
      updatedBy: admin.id,
    },
    create: {
      tenantId: tenant.id,
      code: "RW-CS-20260805-001",
      name: "客服高频场景训练任务",
      type: "scenario_training",
      status: "published",
      startAt: new Date("2026-08-05T09:00:00+08:00"),
      endAt: new Date("2026-08-12T23:59:59+08:00"),
      publishAt: now,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  await prisma.taskScene.deleteMany({ where: { tenantId: tenant.id, taskId: task.id } });
  await prisma.taskScene.createMany({
    data: scenes.map((scene, index) => ({
      tenantId: tenant.id,
      taskId: task.id,
      sceneId: scene.id,
      sortOrder: index + 1,
      requiredTrainTimes: 1,
      passScore: 80,
    })),
  });

  await prisma.taskParticipant.deleteMany({ where: { tenantId: tenant.id, taskId: task.id } });
  await prisma.taskParticipant.create({
    data: {
      tenantId: tenant.id,
      taskId: task.id,
      userId: learner.id,
      orgId: org.id,
      status: "in_progress",
    },
  });

  const record = await prisma.trainingRecord.upsert({
    where: { tenantId_recordNo: { tenantId: tenant.id, recordNo: "TR-CS-001" } },
    update: {
      taskId: task.id,
      sceneId: scenes[0].id,
      userId: learner.id,
      mode: "voice",
      status: "completed",
      score: 86,
      startedAt: new Date("2026-08-05T10:00:00+08:00"),
      finishedAt: new Date("2026-08-05T10:08:00+08:00"),
    },
    create: {
      tenantId: tenant.id,
      recordNo: "TR-CS-001",
      taskId: task.id,
      sceneId: scenes[0].id,
      userId: learner.id,
      mode: "voice",
      status: "completed",
      score: 86,
      startedAt: new Date("2026-08-05T10:00:00+08:00"),
      finishedAt: new Date("2026-08-05T10:08:00+08:00"),
    },
  });

  await prisma.trainingTurn.deleteMany({ where: { tenantId: tenant.id, recordId: record.id } });
  await prisma.trainingTurn.createMany({
    data: [
      { tenantId: tenant.id, recordId: record.id, speaker: "ai", text: "我前两天已经反映过宽带问题，现在还是没解决，你们到底什么时候处理？", durationMs: 8000 },
      { tenantId: tenant.id, recordId: record.id, speaker: "learner", text: "非常抱歉给您带来不便，我先帮您核实前一次工单记录，并为您确认这次处理时限。", durationMs: 9000 },
    ],
  });

  await prisma.scoreDetail.deleteMany({ where: { tenantId: tenant.id, recordId: record.id } });
  await prisma.scoreDetail.createMany({
    data: [
      { tenantId: tenant.id, recordId: record.id, score: 22, deductionReason: "诉求识别较完整，但未复述客户等待时间。", evidenceText: "核实前一次工单记录" },
      { tenantId: tenant.id, recordId: record.id, score: 18, deductionReason: "有安抚表达。", evidenceText: "非常抱歉给您带来不便" },
      { tenantId: tenant.id, recordId: record.id, score: 24, deductionReason: "流程基本合规。", evidenceText: "核实前一次工单记录" },
      { tenantId: tenant.id, recordId: record.id, score: 14, deductionReason: "处理时限表达不够明确。", evidenceText: "确认这次处理时限" },
      { tenantId: tenant.id, recordId: record.id, score: 8, deductionReason: "表达规范。", evidenceText: "帮您核实" },
    ],
  });

  await prisma.aiProviderConfig.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.aiProviderConfig.create({
    data: {
      tenantId: tenant.id,
      providerType: "llm",
      providerName: "待配置模型供应商",
      modelName: "待配置模型",
      baseUrl: "",
      apiKeyEncrypted: "",
      status: "disabled",
      isDefault: true,
    },
  });

  console.log(`Seed complete: tenant=${tenant.code}, scenes=${scenes.length}, task=${task.code}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });