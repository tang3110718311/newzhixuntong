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

# AGENTS.md — 智训通 zxt-next 项目 AI 协作规则

> 本文件是项目内所有 AI 工具（Codex / 星辰智能体 / WorkBuddy / Trae / Claude Code）的统一入口。
> 打开项目后请先阅读本文件与下方引用的协议文档，再开始工作。

## 一句话

**动手之前先拷问：每次只问一个问题、每个问题带推荐答案、能从文件查到的事实自己查、宏哥拍板所有决策、确认理解一致前不写代码。**

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
3. 能从文件/文档查证的事实先查（如 `docs/skills/`、`MEMORY.md`）
4. 输出完整方案总结，等宏哥确认
5. 确认后才进入开发；改完跑 `npx tsc --noEmit -p apps/admin/tsconfig.json` + 浏览器逐区块验证

## 相关文档索引

| 文档 | 用途 |
|------|------|
| `docs/skills/zxt-grill-me-protocol.md` | 本协议全文 |
| `docs/skills/zxt-prototype-alignment.md` | 原型对齐规范 |
| `docs/三窗口并行开发分工.md` | 并行开发文件边界 |
| `docs/开发变更记录.md` | 变更记录 |
| `docs/团队协作开发手册.md` | 团队协作规范 |

> AI生成