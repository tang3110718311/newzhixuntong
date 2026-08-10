---
AIGC:
  ContentProducer: '001191110102MAD55U9H0F10002'
  ContentPropagator: '001191110102MAD55U9H0F10002'
  Label: '1'
  ProduceID: '520e0e06-6879-4391-a1e3-9ce911d49467'
  PropagateID: '520e0e06-6879-4391-a1e3-9ce911d49467'
  ReservedCode1: '386eddae-f400-4657-9e9f-0741fbf09db6'
  ReservedCode2: '386eddae-f400-4657-9e9f-0741fbf09db6'
---

# 企业知识库文件上传 + AI 解析 + 出题联动 设计文档

日期：2026-08-10
状态：已批准（宏哥）

## 1. 背景与目标

企业知识库目前只支持新建/查看/删除文件夹，文件列表为前端模拟数据，"新建文件"按钮为占位（提示"第二阶段上线"）。

目标：实现文件上传 + AI 解析 + 知识库落库，使 AI 在出题/对练时能引用知识库内容作为依据。

**核心需求（宏哥确认）**：
- 上传文件后 AI 解析内容，作为出题依据和知识库
- 出题方式：**现场动态出题**（解析内容存入知识库，对练/出题时 AI 根据知识库内容现场出题，不预存题目）
- 解析格式：**文档类 5 种**（PDF/Word/Excel/PPT/TXT），不解析视频

## 2. 数据模型

### 2.1 新增 `knowledge_files` 表（init.mjs seed + sqlite.ts MIGRATION_SQL 双通道）

```sql
create table if not exists knowledge_files (
  id text primary key,
  tenant_id text not null,
  folder_id text not null,           -- 所属知识文件夹 knowledge_folders.id
  file_id text not null,             -- 关联 files 物理表
  name text not null,
  mime_type text not null default 'application/octet-stream',
  size integer not null default 0,
  content text not null default '',  -- 解析出的全文
  summary text not null default '',  -- AI 提炼的知识点/要点摘要（出题依据）
  parse_status text not null default 'parsing',  -- parsing/done/failed
  parse_error text not null default '',
  created_by text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);
```

### 2.2 复用现有 `files` 表（物理存储元数据）

已有表结构（storage_path/hash/mime_type），直接复用不修改。

## 3. 文件物理存储

- 本地磁盘目录：`apps/api/storage/knowledge/{tenantId}/{fileId}/{文件名}`
- 用 Node `fs` 直接写入（Next API route 内），不引入对象存储
- 元数据写入 `files` 表（storage_path 指向磁盘路径）
- 限制：单文件 ≤ 50MB

## 4. 解析器

新增 `apps/api/lib/document-parser.ts`，按 MIME 分流：

| 格式 | MIME | 解析方案 | 依赖 |
|---|---|---|---|
| PDF | application/pdf | pdf-parse 提取文本 | pdf-parse |
| Word | application/vnd.openxmlformats-officedocument.wordprocessingml.document | mammoth 提取文本 | mammoth |
| Excel | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | xlsx 读 sheet 转文本 | xlsx |
| PPT | application/vnd.openxmlformats-officedocument.presentationml.presentation | jszip 解压 XML 提取文本 | jszip |
| TXT | text/plain | fs 直接读 | 无 |

解析出全文后，调 LLM 提炼知识点摘要（`summary` 字段）：
- 输入：全文（截断前 ~8000 字符）+ 文件名
- 输出：结构化要点列表（如：核心条款、关键话术、流程步骤、易错点）

## 5. API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/knowledge/files` | multipart 上传（file + folderId），同步解析 + AI 摘要，落库后返回 |
| GET | `/api/knowledge/folders/[id]/files` | 文件夹内文件列表（真实数据） |
| DELETE | `/api/knowledge/files/[id]` | 删除文件（软删 + 删磁盘文件） |

响应结构沿用现有 `{ success, code, data }` 约定。

## 6. 前端

`KnowledgeSection.tsx`：
- 详情面板"新建文件"按钮 → 打开文件选择器（input type=file，accept 限定 5 种格式）
- 上传中显示 loading 状态（按钮禁用 + 提示"解析中…"）
- 上传完成后刷新文件列表（接真实 GET API，替换 MOCK_FILES）
- 文件列表展示解析状态（解析中/已完成/失败），失败显示原因
- 删除文件按钮接 DELETE API

## 7. 出题联动（现场动态出题）

在 AI 生成场景 / 对练对话时，自动拉取该租户知识库摘要注入 prompt：
- 复用现有 `attachmentSummaries` 机制（ai-provider generateScene 已支持）
- 新增：生成场景 API 时自动从 `knowledge_files` 拉取 parse_status='done' 的 summary，按文件夹/关键字匹配注入
- 对练 chat 接口同理：把知识库要点注入 system prompt，AI 出题/回答基于知识库内容

## 8. 错误处理

- 上传：无文件/无 folderId → 400；文件超 50MB → 413；格式不支持 → 415
- 解析失败：parse_status='failed' + parse_error，不阻塞上传流程（文件仍入库，摘要留空）
- AI 摘要失败：summary 留空，出题时降级为仅注入原始内容
- 磁盘写入失败 → 500，回滚 files/knowledge_files 记录

## 9. 测试

- 上传 5 种格式文件各 1 个，验证解析+入库
- 上传超大文件/不支持格式，验证错误提示
- 文件夹文件列表真实数据替换模拟数据
- 出题场景：带知识库摘要 vs 不带，验证 prompt 注入

## 10. 明确不做（YAGNI）

- 视频解析/转写（成本高）
- 文件编辑/预览
- 异步任务队列（同步解析够用）
- 全文检索（暂按文件夹/名称匹配）

> AI生成