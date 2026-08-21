import { createMaterial, createScene, getSceneDetail } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { requireTrainingManager } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, user } = await requireTrainingManager(request);
    const { id } = await context.params;
    const detail = getSceneDetail(tenantId, id);
    if (!detail) return fail("SCENE_NOT_FOUND", "场景不存在或已删除。", 404);

    const aiRole = detail.roles.find((role) => role.roleType === "ai");
    const learnerRole = detail.roles.find((role) => role.roleType === "learner");

    const created = createScene(tenantId, {
      industryPackageId: detail.scene.industryPackageId ?? null,
      name: `${detail.scene.name}（复制）`,
      // 复制场景也由数据库统一按最新规则生成：CJ + 租户编码 + 日期 + 三位流水号
      code: "",
      mode: detail.scene.mode,
      createMode: detail.scene.createMode,
      createdBy: user?.id ?? null,
      sceneType: detail.scene.sceneType,
      status: "disabled",
      description: detail.scene.description || "",
      passScore: detail.scene.passScore,
      aiRole: aiRole ? {
        identity: aiRole.identity || "",
        background: aiRole.background || "",
        personality: aiRole.personality || "",
        emotion: aiRole.emotion || "",
        languageStyle: aiRole.languageStyle || "",
        goal: aiRole.goal || "",
      } : undefined,
      learnerRole: learnerRole ? {
        identity: learnerRole.identity || "",
        goal: learnerRole.goal || "",
      } : undefined,
      endCondition: detail.rule?.endCondition || "",
      interruptCondition: detail.rule?.interruptCondition || "",
      dialogueExample: detail.rule?.description || "",
      initiator: detail.rule?.initiator || "ai",
      scoringRules: detail.scoringRules.map((rule) => ({
        name: rule.name,
        score: rule.score,
        criteria: rule.criteria,
        deductionRule: rule.deductionRule,
        evidenceRequired: rule.evidenceRequired,
      })),
      attachmentFileIds: detail.attachments.map((attachment) => attachment.id),
    });

    if (!created) return fail("SCENE_COPY_FAILED", "场景复制失败，请稍后重试。", 500);

    detail.materials.forEach((material) => {
      createMaterial(tenantId, {
        name: material.name,
        type: material.type,
        industryPackageId: material.industryPackageId,
        sceneId: created.id,
        tags: JSON.parse(material.tags || "[]"),
        content: material.content,
      });
    });

    return ok(created, undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
