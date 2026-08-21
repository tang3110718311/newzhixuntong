"use client";

import MobilePageAction from "./MobilePageAction";

interface MaterialViewProps {
  scene: any;
  sceneMeta: any;
  onBack: () => void;
  onDone: () => void;
  showToast: (msg: string) => void;
}

/** 场景学习资料预览（底部弹窗，对齐原型 v30） */
export default function MaterialView({ scene, sceneMeta, onBack, onDone, showToast }: MaterialViewProps) {
  const materials = scene?.materials || [];
  const sceneName = sceneMeta?.sceneName || scene?.scene?.name || "学习资料";
  const sceneDesc =
    sceneMeta?.description ||
    scene?.scene?.description ||
    "请先阅读学习资料，掌握场景背景与沟通目标。";

  const markDone = () => {
    onDone();
    showToast("资料已学习，可开始 AI 对练");
  };

  return (
    <div className="material-mask show" onClick={onBack}>
      <div className="material-modal" onClick={(e) => e.stopPropagation()}>
        <div className="material-modal-head">
          <span className="material-tag">在线资料预览</span>
          <MobilePageAction kind="close" variant="overlay" onClick={onBack} />
        </div>
        <h2 className="material-modal-title">{sceneName}</h2>
        <p className="material-modal-sub">图文资料 · {scene?.materials?.length || 1} 篇</p>

        <div className="material-modal-body">
          {materials.length === 0 ? (
            <>
              <p className="material-intro">本资料用于帮助你了解本场景的沟通背景、关键目标和建议表达方式。</p>
              <div className="material-keypoint">
                <b>学习重点</b>
                <p>{sceneDesc}</p>
              </div>
              <p className="material-tip">
                资料为可选学习内容。你可以先查看资料，也可以直接开始 AI 对练。
              </p>
            </>
          ) : (
            materials.map((m: any, i: number) => (
              <div className="material-block" key={m.id || i}>
                <h3>{i + 1}. {m.name}</h3>
                <p className="material-content">{m.content || "暂无内容"}</p>
              </div>
            ))
          )}
        </div>

        <div className="material-modal-foot">
          <span>查看资料可选，完成对练后即可参加考试</span>
          <button className="material-done-btn" type="button" onClick={markDone}>
            完成资料学习
          </button>
        </div>
      </div>
    </div>
  );
}
