# 智训通 AI 协作说明

本目录用于让多个 AI 会话共享同一份项目背景。

## 读取顺序

1. `../../AGENTS.md`
2. `00-总控看板.md`
3. `01-项目当前状态.md`
4. 当前任务对应的 `tasks/Txxx-*.md`

## 文件职责

| 文件 | 用途 |
|---|---|
| `00-总控看板.md` | 当前主目标、窗口分工、活跃任务 |
| `01-项目当前状态.md` | 本地服务、生产部署、语音服务、登录验证信息 |
| `02-新窗口启动模板.md` | 给新 AI 会话的复制模板 |
| `tasks/Txxx-*.md` | 单个任务的目标、范围、状态、验证和风险 |

## 工具入口

| 入口文件 | 主要适配 |
|---|---|
| `../../AGENTS.md` | Codex / 通用 AI 入口，权威规则 |
| `../../AGENT.md` | 只识别单数 Agent 文件名的工具 |
| `../../CLAUDE.md` | Claude Code / Trae 可导入入口 |
| `../../GEMINI.md` | Gemini 类工具 |
| `../../工作区规则.md` | 星辰超级智能体 / WorkBuddy 等中文智能体 |
| `../../.github/copilot-instructions.md` | GitHub Copilot |
| `../../.cursor/rules/zxt-project.mdc` | Cursor |
| `../../.trae/rules/zxt-project.md` | Trae |

## 维护规则

- 新任务先在 `00-总控看板.md` 增加一行，再创建对应 `tasks/Txxx-*.md`。
- 每个 AI 窗口只更新自己负责的任务文件。
- 已完成任务保留任务文件，不删除；状态改为 `done` 并写清楚验证结果。
- 不在这里保存密码、token、密钥或生产服务器敏感信息。
