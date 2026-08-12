"use client";

interface MaterialViewProps {
  scene: any;
  sceneMeta: any;
  onBack: () => void;
  onDone: () => void;
  showToast: (msg: string) => void;
}

/** 场景学习资料查看页 */
export default function MaterialView({ scene, sceneMeta, onBack, onDone, showToast }: MaterialViewProps) {
  const materials = scene?.materials || [];
  const sceneName = sceneMeta?.sceneName || scene?.scene?.name || "学习资料";

  const markDone = () => {
    onDone();
    showToast("资料已学习，可开始 AI 对练");
  };

  return (
    <>
      <div className="task-detail-head">
        <button className="task-detail-back" type="button" onClick={onBack} aria-label="返回任务详情">
          ‹
        </button>
        <div className="task-detail-title">
          <h1>学习资料</h1>
          <p>{sceneName}</p>
        </div>
      </div>

      <div className="scenario-workspace-head">
        <span className="scenario-index">📄</span>
        <div>
          <h2>{sceneName}</h2>
          <p>请先阅读学习资料，掌握场景背景与沟通目标。</p>
        </div>
      </div>

      {materials.length === 0 ? (
        <div className="scene-work-card">
          <h3>学习资料</h3>
          <p className="card-sub">本场景暂无配套学习资料，可直接进入 AI 对练。</p>
        </div>
      ) : (
        materials.map((m: any, i: number) => (
          <div className="scene-work-card" key={m.id || i}>
            <h3>
              {i + 1}. {m.name}
            </h3>
            {m.type && <p className="card-sub">{m.type} 资料</p>}
            <div className="material-content">{m.content || "暂无内容"}</div>
          </div>
        ))
      )}

      <div className="task-detail-actions">
        <button className="secondary" type="button" onClick={onBack}>
          返回
        </button>
        <button className="primary" type="button" onClick={markDone}>
          我已阅读完成
        </button>
      </div>
    </>
  );
}
