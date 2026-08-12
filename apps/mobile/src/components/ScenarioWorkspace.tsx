"use client";

interface ScenarioWorkspaceProps {
  scene: any;
  task: any;
  sceneMeta: any;
  index: number;
  total: number;
  onBackToDetail: () => void;
  onEnterPractice: () => void;
  showToast: (msg: string) => void;
}

export default function ScenarioWorkspace({
  scene,
  task,
  sceneMeta,
  index,
  total,
  onBackToDetail,
  onEnterPractice,
  showToast,
}: ScenarioWorkspaceProps) {
  const s = scene?.scene;
  const aiRole = scene?.roles?.find((r: any) => r.roleType === "ai");
  const learnerRole = scene?.roles?.find((r: any) => r.roleType === "learner");
  const materials = scene?.materials || [];

  return (
    <>
      <div className="task-detail-head">
        <button className="task-detail-back" type="button" onClick={onBackToDetail} aria-label="返回任务详情">
          ‹
        </button>
        <div className="task-detail-title">
          <h1>场景工作台</h1>
          <p>
            场景 {index + 1}/{total} · {sceneMeta?.sceneName}
          </p>
        </div>
      </div>
      <div className="scenario-workspace-head">
        <span className="scenario-index">{String(index + 1).padStart(2, "0")}</span>
        <div>
          <h2>{s?.name || sceneMeta?.sceneName}</h2>
          <p>{s?.description || sceneMeta?.sceneType || "完成本场景的学习、对练与考试。"}</p>
        </div>
        <span className="scene-status-pill doing">进行中</span>
      </div>

      <div className="scene-work-card">
        <h3>对话目标</h3>
        <p className="card-sub">{aiRole?.goal || "完成一次专业、自然的沟通，准确识别对方关注点，并推动下一步。"}</p>
        <h3>AI 角色</h3>
        <p className="card-sub">
          {aiRole?.identity || "场景角色"} · {aiRole?.personality || "专业"} （{aiRole?.roleType === "ai" ? "AI" : "学员"}）
        </p>
        {aiRole?.background && <p className="card-sub">{aiRole.background}</p>}
      </div>

      {materials.length > 0 && (
        <div className="scene-work-card">
          <h3>学习资料</h3>
          <div className="scene-material">
            <span className="material-icon">📄</span>
            <div className="material-main">
              <b>{materials[0].name}</b>
              <span>{materials[0].type} 资料</span>
            </div>
          </div>
        </div>
      )}

      <div className="scene-work-card">
        <h3>训练流程</h3>
        <div className="task-detail-list">
          <li>阅读学习资料，掌握场景背景与沟通目标</li>
          <li>进入 AI 对练，与 AI 角色完成多轮模拟对话</li>
          <li>完成场景考试，检验学习成果</li>
        </div>
      </div>

      <div className="task-detail-actions">
        <button
          className="secondary"
          type="button"
          onClick={() => {
            if (materials.length > 0) {
              showToast("资料：请先阅读《" + materials[0].name + "》");
            } else {
              showToast("本场景暂无资料，可直接对练");
            }
          }}
        >
          查看资料
        </button>
        <button className="primary" type="button" onClick={onEnterPractice}>
          开始 AI 对练
        </button>
      </div>
    </>
  );
}
