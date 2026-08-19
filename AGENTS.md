---
AIGC:
  ContentProducer: '001191110102MAD55U9H0F10002'
  ContentPropagator: '001191110102MAD55U9H0F10002'
  Label: '1'
  ProduceID: '4dd60fdc-dd1e-455d-96f8-d56db9724cac'
  PropagateID: '4dd60fdc-dd1e-455d-96f8-d56db9724cac'
  ReservedCode1: '1e2c6910-6f0c-4733-bafa-5e54e28ee083'
  ReservedCode2: '1e2c6910-6f0c-4733-bafa-5e54e28ee083'
---

# AGENTS.md — 智训通 zxt-next 项目 AI 自动上下文入口

> 本文件是项目内所有 AI 工具（Codex / 星辰超级智能体 / WorkBuddy / Trae / Claude Code 等）的统一入口。
> 任何 AI 智能体只要进入本工作目录，必须先读取本文件，再按下面“自动上下文读取顺序”补齐项目背景。

## 一句话

**动手之前先拷问：每次只问一个问题、每个问题带推荐答案、能从文件查到的事实自己查、宏哥拍板所有决策、确认理解一致前不写代码。**

## 自动上下文读取顺序

任何 AI 在本目录接到“开发 / 部署 / 测试 / 排查 / 总结”任务时，先按顺序读取：

1. `AGENTS.md`：项目铁律、协作方式、通用禁止事项。
2. `docs/AI协作/00-总控看板.md`：当前主目标、窗口分工、活跃任务。
3. `docs/AI协作/01-项目当前状态.md`：本地端口、生产域名、语音服务、账号、未提交风险。
4. `docs/AI协作/tasks/Txxx-*.md`：如果任务能对应到具体 T 任务，必须读取对应任务文件。
5. 只在需要时读取专题文档：
   - 原型 / UI：`docs/skills/zxt-prototype-alignment.md`
   - 沟通确认：`docs/skills/zxt-grill-me-protocol.md`
   - 部署：`deploy/README.deploy.md`、`docs/AI协作/tasks/T001-生产部署与域名访问.md`
   - 本地启动：`docs/AI协作/tasks/T002-本地启动脚本防卡住.md`
   - 移动端语音：`docs/AI协作/tasks/T003-移动端语音文字同步.md`
   - 移动端考试：`docs/AI协作/tasks/T004-移动端考试流程可用性.md`
   - 业务巡检：`docs/AI协作/tasks/T005-业务板块真实可用性巡检.md`

如果当前 AI 工具不能自动读取本文件，宏哥只需要说：“先读 AGENTS.md”，后续背景由 AI 自己继续读取，不再让宏哥重复解释。

## 完整协议

请阅读并遵守：`docs/skills/zxt-grill-me-protocol.md`（智训通「先问后做」沟通协议，grill-me 中文版）

## 项目铁律（必须遵守，不询问）

1. **代码只读/拉取，严禁 push**，不创建远程分支/tag/MR。
2. **原型对齐**：正文 14px（禁 13px），页面标题 24px，卡片标题 20px，统计卡数字 24px；间距：卡间 16px / 模块 20px / 区块 24px；`home-grid` 两列（中间主内容 + 右侧 278px），右侧 3 卡纯白底；筛选区用 `filter-bar`/`filter-row`/`filter-input`，禁止内联样式。详见 `docs/skills/zxt-prototype-alignment.md`。
3. **页面数据按原型写死静态数据**（唯一例外：学员首页接真实 API）。
4. **sql.js 内存库**：写库必须先停进程 → 写库 → 再启动；服务用 `next start` 生产模式，代码改动必须 `next build` + 重启才生效。
5. **只 commit 自己窗口的文件**（三窗口并行开发，见 `docs/三窗口并行开发分工.md`），`git add` 明确到文件名，不 `git add .`。
6. 中文 HTTP 测试用 Node/Python UTF-8 脚本（PowerShell 有编码黑洞），放 `.temp/`。
7. 浏览器验证：登录 `13800000000` / `Zxt@2026`，租户 `zxt-demo`；本机开发可 `ALLOW_DEV_TENANT_HEADER=true` + `x-tenant-code: zxt-demo` 免登录调 API（`http://127.0.0.1:4000`）。
8. 服务端口：API(4000) / Admin(3000)；重启用 `scripts/stop-local.mjs`、`start-local.mjs`。

## 工作流程（适用于新功能/需求/方案）

1. 收到需求 → **不要立刻写代码**
2. 按协议逐项追问（每次 1 个问题，带推荐答案）
3. 能从文件/文档查证的事实先查（如 `docs/AI协作/`、`docs/skills/`）
4. 输出完整方案总结，等宏哥确认
5. 确认后才进入开发；改完跑 `npx tsc --noEmit -p apps/admin/tsconfig.json` + 浏览器逐区块验证

## 相关文档索引

| 文档 | 用途 |
|------|------|
| `docs/AI协作/00-总控看板.md` | 多 AI / 多窗口协作总入口，记录当前主目标、分工、活跃任务 |
| `docs/AI协作/01-项目当前状态.md` | 本地与生产环境事实、账号、端口、未提交风险 |
| `docs/AI协作/02-新窗口启动模板.md` | 新开 AI 会话时可复制的启动模板 |
| `docs/AI协作/tasks/` | 每个子任务的目标、范围、状态、验证方式和风险 |
| `docs/skills/zxt-grill-me-protocol.md` | 本协议全文 |
| `docs/skills/zxt-prototype-alignment.md` | 原型对齐规范 |
| `docs/三窗口并行开发分工.md` | 并行开发文件边界 |
| `docs/开发变更记录.md` | 变更记录 |
| `docs/团队协作开发手册.md` | 团队协作规范 |

> AI生成
