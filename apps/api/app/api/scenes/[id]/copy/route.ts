import { randomBytes } from "node:crypto";

import { createMaterial, createScene, getSceneDetail } from "@zxt/database";
import { fail, handleRouteError, ok } from "@/lib/response";
import { requireTrainingManager } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function buildCopyCode(sourceCode: string) {
  const safePrefix = sourceCode.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase() || "SCENE";
  const suffix = randomBytes(2).toString("hex").toUpperCase();
  return `CPY-${safePrefix}-${suffix}`;
}

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
      code: buildCopyCode(detail.scene.code),
      mode: detail.scene.mode,
      createMode: detail.scene.createMode,
      createdBy: user?.id ?? null,
      sceneType: detail.scene.sceneType,
      description: detail.scene.description || "",
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
