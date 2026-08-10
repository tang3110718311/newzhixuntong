---
AIGC:
  ContentProducer: '001191110102MAD55U9H0F10002'
  ContentPropagator: '001191110102MAD55U9H0F10002'
  Label: '1'
  ProduceID: '4cfb8b61-0957-4390-9e4a-33fe53e72a37'
  PropagateID: '4cfb8b61-0957-4390-9e4a-33fe53e72a37'
  ReservedCode1: 'a7e95b59-3ed6-4199-ad4e-cddd4b4cd119'
  ReservedCode2: 'a7e95b59-3ed6-4199-ad4e-cddd4b4cd119'
---

# 企业知识库文件上传 + AI 解析 + 出题联动 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现企业知识库文件上传，AI 解析文档内容并提炼知识点存入知识库，出题/对练时自动注入知识库摘要作为依据。

**架构：** Next.js API（apps/api）接收 multipart 上传 → 磁盘存储（storage/knowledge/{tenant}/{fileId}/）+ files 表元数据 → document-parser 按 MIME 提取全文 → ai-provider summarizeKnowledge 提炼摘要 → knowledge_files 表落库 → 前端 KnowledgeSection 接真实 API。出题联动：generateScene 与对练 chat 自动拉取知识库摘要注入 prompt。

**技术栈：** Next.js 15 App Router（apps/api）、sql.js + repository.ts 数据层、pdf-parse / mammoth / xlsx / jszip 文档解析、OpenAI 兼容 LLM（ai-provider）。

**参考文档：** `docs/superpowers/specs/2026-08-10-knowledge-upload-design.md`

---

### 任务 1：新增 knowledge_files 表（双通道）

**文件：**
- 修改：`packages/database/sqlite/init.mjs:471-483`（knowledge_folders 建表后追加）
- 修改：`packages/database/src/sqlite.ts:184-196`（MIGRATION_SQL 数组追加）

- [ ] **步骤 1：init.mjs 追加建表语句**

在 `knowledge_folders` 建表语句后（L483 的 `);` 之后）追加：

```sql
create table if not exists knowledge_files (
  id text primary key,
  tenant_id text not null,
  folder_id text not null,
  file_id text not null,
  name text not null,
  mime_type text not null default 'application/octet-stream',
  size integer not null default 0,
  content text not null default '',
  summary text not null default '',
  parse_status text not null default 'parsing',
  parse_error text not null default '',
  created_by text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  deleted_at text
);
```

- [ ] **步骤 2：sqlite.ts MIGRATION_SQL 追加同构语句**

在 `knowledge_folders` 条目后（L195 的 `)` 后）追加相同建表 SQL（用 `datetime('now')` 默认值风格与现有保持一致）。

- [ ] **步骤 3：重启 API 后验证建表**

运行：`npx tsc --noEmit`（在 apps/api）预期 0 错误；重启 API(4000) 后执行 `node packages/database/sqlite/init.mjs` 无报错。

- [ ] **步骤 4：Commit**

```bash
git add packages/database/sqlite/init.mjs packages/database/src/sqlite.ts
git commit -m "feat(db): 新增 knowledge_files 表（双通道建表）"
```

### 任务 2：数据层 knowledge_files 仓储函数

**文件：**
- 修改：`packages/database/src/repository.ts:2078`（文件末尾，deleteKnowledgeFolder 之后）

- [ ] **步骤 1：编写 KnowledgeFileRow 类型 + createKnowledgeFile 函数**

追加到 repository.ts 末尾：

```ts
// ===== 知识库文件 =====

export type KnowledgeFileRow = {
  id: string;
  folderId: string;
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  content: string;
  summary: string;
  parseStatus: string;
  parseError: string;
  uploaderName: string | null;
  createdAt: string;
  updatedAt: string;
};

export function createKnowledgeFile(
  tenantId: string,
  input: {
    folderId: string;
    fileId: string;
    name: string;
    mimeType: string;
    size: number;
    content: string;
    summary: string;
    parseStatus: string;
    parseError?: string;
    createdBy?: string | null;
  },
) {
  const id = createId("kf");
  run(
    `insert into knowledge_files (id, tenant_id, folder_id, file_id, name, mime_type, size, content, summary, parse_status, parse_error, created_by, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, tenantId, input.folderId, input.fileId, input.name, input.mimeType, input.size, input.content, input.summary, input.parseStatus, input.parseError ?? "", input.createdBy ?? null],
  );
  return get<KnowledgeFileRow>(
    `select kf.id, kf.folder_id as folderId, kf.file_id as fileId, kf.name, kf.mime_type as mimeType, kf.size,
            kf.content, kf.summary, kf.parse_status as parseStatus, kf.parse_error as parseError,
            u.name as uploaderName, kf.created_at as createdAt, kf.updated_at as updatedAt
     from knowledge_files kf
     left join users u on u.id = kf.created_by and u.tenant_id = kf.tenant_id
     where kf.tenant_id = ? and kf.id = ?`,
    [tenantId, id],
  );
}
```

- [ ] **步骤 2：编写 listKnowledgeFiles + deleteKnowledgeFile + bumpFolderFileCount**

```ts
export function listKnowledgeFiles(tenantId: string, folderId: string) {
  return all<KnowledgeFileRow>(
    `select kf.id, kf.folder_id as folderId, kf.file_id as fileId, kf.name, kf.mime_type as mimeType, kf.size,
            kf.content, kf.summary, kf.parse_status as parseStatus, kf.parse_error as parseError,
            u.name as uploaderName, kf.created_at as createdAt, kf.updated_at as updatedAt
     from knowledge_files kf
     left join users u on u.id = kf.created_by and u.tenant_id = kf.tenant_id
     where kf.tenant_id = ? and kf.folder_id = ? and kf.deleted_at is null
     order by kf.created_at desc`,
    [tenantId, folderId],
  );
}

export function getKnowledgeFile(tenantId: string, id: string) {
  return get<KnowledgeFileRow>(
    `select kf.id, kf.folder_id as folderId, kf.file_id as fileId, kf.name, kf.mime_type as mimeType, kf.size,
            kf.content, kf.summary, kf.parse_status as parseStatus, kf.parse_error as parseError,
            u.name as uploaderName, kf.created_at as createdAt, kf.updated_at as updatedAt
     from knowledge_files kf
     left join users u on u.id = kf.created_by and u.tenant_id = kf.tenant_id
     where kf.tenant_id = ? and kf.id = ? and kf.deleted_at is null`,
    [tenantId, id],
  );
}

export function deleteKnowledgeFile(tenantId: string, id: string) {
  run(`update knowledge_files set deleted_at = datetime('now'), updated_at = datetime('now') where tenant_id = ? and id = ?`, [tenantId, id]);
}

// 文件夹 file_count / total_size 联动
export function bumpKnowledgeFolderStats(tenantId: string, folderId: string, deltaCount: number, deltaSize: number) {
  run(
    `update knowledge_folders
     set file_count = max(0, file_count + ?), total_size = max(0, total_size + ?), updated_at = datetime('now')
     where tenant_id = ? and id = ?`,
    [deltaCount, deltaSize, tenantId, folderId],
  );
}

// 出题联动：拉取已解析知识文件摘要
export function listKnowledgeSummaries(tenantId: string, limit = 20) {
  return all<{ folderName: string; name: string; summary: string }>(
    `select kf.name, kf.summary, kfolder.name as folderName
     from knowledge_files kf
     left join knowledge_folders kfolder on kfolder.id = kf.folder_id and kfolder.tenant_id = kf.tenant_id
     where kf.tenant_id = ? and kf.parse_status = 'done' and kf.deleted_at is null and kf.summary <> ''
     order by kf.created_at desc limit ?`,
    [tenantId, limit],
  );
}
```

- [ ] **步骤 3：验证编译**

运行：`npx tsc --noEmit`（packages/database）预期 0 错误。

- [ ] **步骤 4：Commit**

```bash
git add packages/database/src/repository.ts
git commit -m "feat(db): knowledge_files 仓储函数（CRUD + 摘要联动）"
```

### 任务 3：安装文档解析依赖

**文件：**
- 修改：`apps/api/package.json`（dependencies 追加）

- [ ] **步骤 1：安装依赖**

```bash
npm --workspace @zxt/api install pdf-parse@1.1.1 mammoth@1.8.0 xlsx@0.18.5 jszip@3.10.1
```

- [ ] **步骤 2：验证安装**

运行：`node -e "require('pdf-parse'); require('mammoth'); require('xlsx'); require('jszip'); console.log('ok')"`（workdir apps/api）预期打印 ok。

- [ ] **步骤 3：Commit**

```bash
git add apps/api/package.json package-lock.json
git commit -m "chore(api): 安装文档解析依赖 pdf-parse/mammoth/xlsx/jszip"
```

### 任务 4：文档解析器 document-parser.ts

**文件：**
- 创建：`apps/api/src/lib/document-parser.ts`
- 创建：`apps/api/src/types/pdf-parse.d.ts`（pdf-parse 无内置类型，strict 模式需声明）

- [ ] **步骤 1：编写类型声明 pdf-parse.d.ts**

```ts
declare module "pdf-parse" {
  interface PdfParseData {
    text: string;
    numpages: number;
    info: unknown;
    metadata: unknown;
    version: string;
  }
  function pdfParse(buffer: Buffer, options?: Record<string, unknown>): Promise<PdfParseData>;
  export default pdfParse;
}
```

- [ ] **步骤 2：编写解析器**

```ts
import { readFileSync } from "node:fs";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import JSZip from "jszip";

export type ParsedDocument = { text: string; truncated: boolean };

const MAX_CHARS = 20000;

function truncate(text: string): ParsedDocument {
  const truncated = text.length > MAX_CHARS;
  return { text: truncated ? text.slice(0, MAX_CHARS) : text, truncated };
}

export async function parseDocumentFile(filePath: string, mimeType: string): Promise<ParsedDocument> {
  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return truncate(readFileSync(filePath, "utf-8"));
  }
  if (mimeType === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const buffer = readFileSync(filePath);
    const data = await pdfParse(buffer);
    return truncate(data.text || "");
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const buffer = readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return truncate(result.value || "");
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    const buffer = readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      parts.push(`[${sheetName}]\n${csv}`);
    }
    return truncate(parts.join("\n\n"));
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    const buffer = readFileSync(filePath);
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => {
        const na = Number(a.match(/slide(\d+)\.xml/)?.[1] ?? 0);
        const nb = Number(b.match(/slide(\d+)\.xml/)?.[1] ?? 0);
        return na - nb;
      });
    const parts: string[] = [];
    for (const slideFile of slideFiles) {
      const xml = await zip.files[slideFile].async("text");
      const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
      parts.push(`[slide ${slideFile.match(/slide(\d+)/)?.[1] ?? "?"}]\n${texts.join("\n")}`);
    }
    return truncate(parts.join("\n\n"));
  }
  throw new Error(`不支持的文档格式：${mimeType}`);
}

export function isSupportedDocumentMime(mimeType: string): boolean {
  return [
    "text/plain",
    "text/markdown",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ].includes(mimeType);
}

export function mimeFromExtension(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return map[ext] || "application/octet-stream";
}
```

- [ ] **步骤 3：验证编译**

运行：`npx tsc --noEmit`（apps/api）预期 0 错误。

- [ ] **步骤 4：Commit**

```bash
git add apps/api/src/lib/document-parser.ts apps/api/src/types/pdf-parse.d.ts
git commit -m "feat(api): 文档解析器（PDF/Word/Excel/PPT/TXT）"
```

### 任务 5：ai-provider 增加 summarizeKnowledge 方法

**文件：**
- 修改：`packages/ai-provider/src/index.ts`

- [ ] **步骤 1：扩展类型与接口**

在 `ScoreTrainingInput` 后追加类型，在 `LlmProvider` 接口加方法：

```ts
export type SummarizeKnowledgeInput = {
  tenantId: string;
  fileName: string;
  content: string;
};

export type SummarizeKnowledgeResult = {
  summary: string;
};
```

`LlmProvider` 接口增加：`summarizeKnowledge(input: SummarizeKnowledgeInput): Promise<SummarizeKnowledgeResult>;`

- [ ] **步骤 2：实现 createOpenAiCompatibleLlmProvider 的 summarizeKnowledge**

在 `generateScoringRules` 方法后追加：

```ts
async summarizeKnowledge(input) {
  const prompt = [
    "你是企业培训知识库整理专家。请从以下培训资料中提炼出适合作为 AI 出题依据的知识点。",
    "要求：按要点分条列出，覆盖核心概念、关键流程、重要数据/条款、常见错误或易混淆点；表达简洁，每条不超过 60 字。",
    `文件名：${input.fileName}`,
    "资料内容：",
    input.content.slice(0, 8000),
  ].join("\n");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.modelName,
      temperature: 0.3,
      messages: [
        { role: "system", content: "你是知识提炼助手，直接输出要点列表，不要多余解释。" },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`模型接口调用失败：HTTP ${response.status} ${errorText.slice(0, 300)}`);
  }
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("模型接口未返回有效内容。");
  return { summary: content.trim() };
}
```

- [ ] **步骤 3：createUnconfiguredLlmProvider 增加同签名抛错方法**

```ts
async summarizeKnowledge() {
  throw new AiProviderNotConfiguredError();
},
```

- [ ] **步骤 4：验证编译**

运行：`npx tsc --noEmit`（packages/ai-provider + apps/api）预期 0 错误。

- [ ] **步骤 5：Commit**

```bash
git add packages/ai-provider/src/index.ts
git commit -m "feat(ai): LlmProvider 增加 summarizeKnowledge 知识摘要能力"
```

### 任务 6：上传/列表/删除 API 路由

**文件：**
- 创建：`apps/api/app/api/knowledge/files/route.ts`
- 创建：`apps/api/app/api/knowledge/files/[id]/route.ts`

- [ ] **步骤 1：编写 POST/GET 路由（files/route.ts）**

```ts
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  bumpKnowledgeFolderStats,
  createId,
  createKnowledgeFile,
  getDefaultAiProvider,
  getKnowledgeFile,
  listKnowledgeFiles,
} from "@zxt/database/client";
import { createOpenAiCompatibleLlmProvider } from "@zxt/ai-provider";
import { fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";
import { isSupportedDocumentMime, mimeFromExtension, parseDocumentFile } from "@/lib/document-parser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const STORAGE_ROOT = resolve(process.cwd(), "../../storage/knowledge");

export async function GET(request: Request) {
  try {
    const { tenantId } = await getTenantContext(request);
    const url = new URL(request.url);
    const folderId = url.searchParams.get("folderId") || "";
    if (!folderId) return fail("FOLDER_ID_REQUIRED", "缺少 folderId 参数。", 400);
    return ok(listKnowledgeFiles(tenantId, folderId));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId, user } = await getTenantContext(request);
    const formData = await request.formData();
    const file = formData.get("file");
    const folderId = String(formData.get("folderId") || "");

    if (!(file instanceof File)) return fail("FILE_REQUIRED", "缺少上传文件。", 400);
    if (!folderId) return fail("FOLDER_ID_REQUIRED", "缺少文件夹。", 400);
    if (file.size > MAX_FILE_SIZE) return fail("FILE_TOO_LARGE", "文件超过 50MB 限制。", 413);

    const mimeType = file.type || mimeFromExtension(file.name);
    if (!isSupportedDocumentMime(mimeType)) {
      return fail("UNSUPPORTED_FILE_TYPE", "仅支持 PDF / Word / Excel / PPT / TXT 文档。", 415);
    }

    // 物理落盘
    const fileId = createId("file");
    const dir = join(STORAGE_ROOT, tenantId, fileId);
    mkdirSync(dir, { recursive: true });
    const storagePath = join(dir, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    writeFileSync(storagePath, buffer);

    // 解析 + AI 摘要
    let content = "";
    let summary = "";
    let parseStatus = "done";
    let parseError = "";
    try {
      const parsed = await parseDocumentFile(storagePath, mimeType);
      content = parsed.text;
    } catch (err) {
      parseStatus = "failed";
      parseError = err instanceof Error ? err.message : "解析失败";
    }

    if (parseStatus === "done" && content.trim()) {
      try {
        const config = getDefaultAiProvider(tenantId);
        if (config && config.status === "enabled" && config.apiKeyEncrypted && config.baseUrl) {
          const provider = createOpenAiCompatibleLlmProvider({
            baseUrl: config.baseUrl,
            apiKey: config.apiKeyEncrypted,
            modelName: config.modelName,
            providerName: config.providerName,
          });
          const result = await provider.summarizeKnowledge({ tenantId, fileName: file.name, content });
          summary = result.summary;
        }
      } catch (err) {
        summary = "";
      }
    }

    // 落库
    const created = createKnowledgeFile(tenantId, {
      folderId,
      fileId,
      name: file.name,
      mimeType,
      size: file.size,
      content,
      summary,
      parseStatus,
      parseError,
      createdBy: user?.id ?? null,
    });
    if (!created) {
      rmSync(dir, { recursive: true, force: true });
      return fail("KNOWLEDGE_FILE_CREATE_FAILED", "文件入库失败。", 500);
    }
    bumpKnowledgeFolderStats(tenantId, folderId, 1, file.size);

    return ok(created, undefined, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
```

- [ ] **步骤 2：编写 DELETE 路由（files/[id]/route.ts）**

```ts
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { deleteKnowledgeFile, getKnowledgeFile, bumpKnowledgeFolderStats } from "@zxt/database/client";
import { fail, handleRouteError, ok } from "@/lib/response";
import { getTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STORAGE_ROOT = resolve(process.cwd(), "../../storage/knowledge");

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await getTenantContext(request);
    const { id } = await context.params;
    const file = getKnowledgeFile(tenantId, id);
    if (!file) return fail("KNOWLEDGE_FILE_NOT_FOUND", "文件不存在或已删除。", 404);
    deleteKnowledgeFile(tenantId, id);
    bumpKnowledgeFolderStats(tenantId, file.folderId, -1, -file.size);
    // 清理磁盘文件
    const dir = join(STORAGE_ROOT, tenantId, file.fileId);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    return ok({ id });
  } catch (error) {
    return handleRouteError(error);
  }
}
```

- [ ] **步骤 3：验证编译**

运行：`npx tsc --noEmit`（apps/api）预期 0 错误。

- [ ] **步骤 4：Commit**

```bash
git add apps/api/app/api/knowledge/files/
git commit -m "feat(api): 知识库文件上传/列表/删除 API（含解析+AI摘要）"
```

### 任务 7：前端 KnowledgeSection 接真实文件 API

**文件：**
- 修改：`apps/admin/src/components/KnowledgeSection.tsx`

- [ ] **步骤 1：替换模拟文件数据为真实 API**

- 新增 state：`const [files, setFiles] = useState<KnowledgeFile[]>([]);`、`const [uploading, setUploading] = useState(false);`
- 新增 `async function loadFiles(folderId: string)` 调 `apiFetch<KnowledgeFile[]>(\`/knowledge/files?folderId=${folderId}\`)` 并 setFiles
- 定义 KnowledgeFile 类型替换原模拟类型（含 parseStatus/parseError 字段）
- `handleView` 展开文件夹时调用 `loadFiles(folder.id)`；`getMockFiles` 删除，`detailFiles` 改为 `files` state
- 新增删除函数 `handleDeleteFile(file)`：confirm → DELETE → reloadFiles + reloadFolders
- 新增上传函数 `handleUploadFile(event)`：构造 FormData（file + folderId）POST `/knowledge/files`，Content-Type 不设（浏览器自动 multipart），完成 setMessage + loadFiles + loadFolders

注意 apiFetch 默认加 `"Content-Type": "application/json"`，上传时需覆盖为空：`headers: {}` 或显式 `"Content-Type": ""`。

- [ ] **步骤 2：改造"新建文件"按钮 + 隐藏文件选择器 + 上传中状态**

替换 L359 占位按钮为：

```tsx
<button className="btn primary" type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
  <Plus size={14} /> {uploading ? "解析中…" : "新建文件"}
</button>
<input ref={fileInputRef} type="file" hidden accept=".pdf,.docx,.xlsx,.pptx,.txt,.md" onChange={handleUploadFile} />
```

- [ ] **步骤 3：文件列表行展示解析状态**

文件行内：若 `parseStatus === "parsing"` 显示"解析中"徽标；`"failed"` 显示红色"解析失败"+ title 提示 parseError；`"done"` 显示绿色"已解析"。

- [ ] **步骤 4：验证编译**

运行：`npx tsc --noEmit`（apps/admin）预期 0 错误。

- [ ] **步骤 5：Commit**

```bash
git add apps/admin/src/components/KnowledgeSection.tsx
git commit -m "feat(admin): 知识库文件列表接真实 API + 上传/删除/解析状态"
```

### 任务 8：出题联动（generateScene 注入知识库摘要）

**文件：**
- 修改：`apps/api/app/api/ai/scenes/generate/route.ts`

- [ ] **步骤 1：拉取知识库摘要注入 attachmentSummaries**

在 `provider.generateScene({...})` 调用处，把 `attachmentSummaries: []` 改为从知识库拉取：

```ts
const knowledgeSummaries = listKnowledgeSummaries(tenantId, 20);
...
const draft = await provider.generateScene({
  tenantId,
  industryName: industry?.name,
  targetRole: body.targetRole,
  mode: body.mode,
  sceneDescription: body.sceneDescription,
  attachmentSummaries: knowledgeSummaries.map((k) => `【${k.folderName}】${k.name}\n${k.summary}`),
});
```

`listKnowledgeSummaries` 从 `@zxt/database/client` 导入。

- [ ] **步骤 2：验证编译**

运行：`npx tsc --noEmit`（apps/api）预期 0 错误。

- [ ] **步骤 3：Commit**

```bash
git add apps/api/app/api/ai/scenes/generate/route.ts
git commit -m "feat(api): AI 生成场景注入知识库摘要作为出题依据"
```

### 任务 9：端到端验证

- [ ] **步骤 1：重启服务**

停止 API(4000) + Admin(3000)，重新启动；执行 `node packages/database/sqlite/init.mjs` 初始化新表。

- [ ] **步骤 2：API 冒烟测试**

用 PowerShell/Node 上传一个临时 TXT（如 5 行培训话术）到已存在文件夹，验证：
- POST 返回 201，parseStatus=done，summary 非空（模型配置正常时）
- GET files 列表含新文件
- DELETE 后列表为空

- [ ] **步骤 3：浏览器验证**

刷新 localhost:3000 → 企业知识库 → 查看某文件夹 → 新建文件上传 → 列表出现文件 + 解析状态徽标 → 删除文件成功。

- [ ] **步骤 4：Commit**

```bash
git add -A
git commit -m "test: 知识库上传解析端到端验证"
```

> AI生成