# AI 对练语音文字同步修复实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让移动端 AI 回复文字以语音播放进度为准，避免文字先于语音全部显示，并处理分句等待、TTS 失败和重播。

**架构：** 保留当前完整 AI JSON 接口和分句 TTS，移除独立打字机对最终文字状态的控制。首句音频准备并开始播放后，按当前句播放进度推进文字；后续句继续预取并按顺序播放。TTS 失败时结束同步状态并保留完整文字及重播入口。

**技术栈：** Next.js 15、React、TypeScript、浏览器 Audio API、现有 TTS API。

---

### 任务 1：提取并测试语音文字进度计算

**文件：**
- 创建：`apps/mobile/src/lib/speech-sync.ts`
- 创建：`apps/mobile/src/lib/speech-sync.test.ts`

- [ ] **步骤 1：编写失败测试**

测试句子偏移、播放比例边界和失败状态下的完整文字回退。

- [ ] **步骤 2：运行测试确认失败**

运行 `npx tsx apps/mobile/src/lib/speech-sync.test.ts`，预期因模块尚不存在而失败。

- [ ] **步骤 3：实现最小纯函数**

提供 `getDisplayedLength(textLength, progress)` 和 `getFullTextFallback(text)`，不包含 React 或 Audio 依赖。

- [ ] **步骤 4：运行测试确认通过**

运行同一命令，预期所有断言通过。

### 任务 2：修复 PracticeView 播放与文字时序

**文件：**
- 修改：`apps/mobile/src/components/PracticeView.tsx`

- [ ] **步骤 1：先增加当前行为的失败回归测试**

用任务 1 的纯函数测试复现“音频未开始时不能显示全文”和“句间等待不能推进到下一句”的期望行为。

- [ ] **步骤 2：移除独立打字机对 AI 消息的推进**

`pushAiMsgAndSpeak` 只初始化消息和同步状态，不启动固定 30ms/40 tick 的全文打字机。

- [ ] **步骤 3：以音频事件推进当前句文字**

保留现有 `timeupdate` 监听，但把显示长度限制在当前已播放句和已完成句的边界；首句音频开始前显示长度为 0。

- [ ] **步骤 4：处理句间等待和 TTS 失败**

下一句音频未准备好时保持上一句末尾；单句失败时标记语音失败、显示完整回复，并允许重播，不阻塞对练流程。

- [ ] **步骤 5：运行移动端类型检查**

运行 `npm --workspace @zxt/mobile run typecheck`，预期退出码为 0。

### 任务 3：增加重播和状态提示

**文件：**
- 修改：`apps/mobile/src/components/PracticeView.tsx`
- 修改：`apps/mobile/app/globals.css`（仅在现有样式不足时）

- [ ] **步骤 1：增加失败状态断言**

验证 TTS 失败后消息文字可见，且不会继续持有“AI 说话中，请稍候”的阻塞状态。

- [ ] **步骤 2：添加消息级重播入口**

复用已缓存 TTS；重播前停止当前 Audio，并重新建立当前消息的句子队列。

- [ ] **步骤 3：完善状态文案**

区分语音准备中、播放中、语音失败，不改变现有对练结束判定。

### 任务 4：完整验证与发布前检查

**文件：**
- 修改：无

- [ ] **步骤 1：运行纯函数回归测试**

运行 `npx tsx apps/mobile/src/lib/speech-sync.test.ts`，预期通过。

- [ ] **步骤 2：运行类型检查和生产构建**

运行 `npm run typecheck` 与 `npm run build`，预期均退出码为 0。

- [ ] **步骤 3：浏览器验证时序**

验证冷缓存、长回复、句间延迟、TTS 失败四种情况；确认文字不再先于语音全部显示，且移动端路径正常。

- [ ] **步骤 4：检查工作区和发布内容**

确认只包含本功能相关改动，不将现有 `scripts/start-local.mjs` 和未跟踪临时文件纳入发布包。
