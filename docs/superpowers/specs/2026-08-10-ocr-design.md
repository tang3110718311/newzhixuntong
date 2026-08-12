---
AIGC:
  ContentProducer: '001191110102MAD55U9H0F10002'
  ContentPropagator: '001191110102MAD55U9H0F10002'
  Label: '1'
  ProduceID: 'a5202ee3-df6c-4ae6-8375-75538224339f'
  PropagateID: 'a5202ee3-df6c-4ae6-8375-75538224339f'
  ReservedCode1: '0c0ebd7a-74b1-43a0-9541-0c0a23d8967a'
  ReservedCode2: '0c0ebd7a-74b1-43a0-9541-0c0a23d8967a'
---

# 知识库图片 OCR 接入 设计文档

日期：2026-08-10
状态：已批准（宏哥）

## 1. 背景与目标

企业知识库目前只支持文档类 5 种格式（PDF/Word/Excel/PPT/TXT），大量培训材料是 PNG/JPG 截图（如"六条服务红线""故障报修流程""固网设备认知"等，部分超 20MB）无法入库。

目标：为知识库接入图片 OCR 能力，使图片（PNG/JPG/JPEG/BMP/WebP）上传后自动识别文字并入库，与其他文档走完全相同的"解析 → AI 摘要 → 出题联动"流程。

**核心需求（宏哥确认）**：
- OCR 方案：**百度 OCR 通用文字识别 API**（免费额度 1000 次/月，已验证 OCR 链路可用）
- 密钥存放：环境变量（.env），不硬编码、不进 git
- 大图处理：超 4MB 自动压缩（sharp）后再识别
- 密钥提供方式：由部署环境或本地 `.env` 单独配置，文档和仓库不保存明文密钥

## 2. 环境变量

`.env`（apps/api）增加：

```
BAIDU_OCR_API_KEY=<your-baidu-ocr-api-key>
BAIDU_OCR_SECRET_KEY=<your-baidu-ocr-secret-key>
```

## 3. OCR 服务模块

新增 `apps/api/src/lib/ocr.ts`：

### 3.1 getBaiduAccessToken()
- 用 API Key + Secret Key 调 `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=xxx&client_secret=xxx` 换取 access_token
- 返回的 access_token 有效期约 30 天，模块内缓存复用（首次获取后存内存变量，不重复请求）
- 失败抛错（含错误信息）

### 3.2 compressImage(buffer)
- 用 sharp 压缩图片至 ≤4MB（百度 OCR base64 限制）
- 策略：若原图 >4MB，先按最长边 2000px 缩放 + JPEG 质量 85 输出；仍 >4MB 则递减质量（75/60）直至达标
- 返回压缩后的 buffer

### 3.3 recognizeImage(buffer)
- 图片 buffer → base64
- 调百度通用文字识别 `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=xxx`
- POST body（application/x-www-form-urlencoded）：`image=<base64>`
- 解析返回 `words_result[]`，拼接 `words` 为文本（每行一个识别结果）
- 返回 `{ text: string }`

## 4. 解析器扩展

`apps/api/src/lib/document-parser.ts`：

### 4.1 isSupportedDocumentMime 增加
```ts
"image/png", "image/jpeg", "image/bmp", "image/webp"
```
（jpg 的 MIME 是 image/jpeg）

### 4.2 parseDocumentFile 增加图片分支
```ts
if (mimeType.startsWith("image/")) {
  const buffer = readFileSync(filePath);
  const result = await recognizeImage(buffer);
  return truncate(result.text || "");
}
```

### 4.3 mimeFromExtension 增加
```ts
png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", bmp: "image/bmp", webp: "image/webp"
```

## 5. 上传路由

`apps/api/app/api/knowledge/files/route.ts`：
- MIME 白名单校验自动通过（isSupportedDocumentMime 已扩展）
- 错误提示文案：`"仅支持 PDF / Word / Excel / PPT / TXT 文档及图片。"`
- 图片流程与其他文档一致：落盘 → parseDocumentFile（内部走 OCR）→ AI 摘要 → 入库

## 6. 前端

`apps/admin/src/components/KnowledgeSection.tsx` + `apps/admin/src/components/admin-dashboard.tsx` + `apps/admin/app/scenes/[id]/edit/page.tsx`（三处上传）：
- accept 增加 `.png,.jpg,.jpeg,.bmp,.webp`
- 提示文案更新（"支持文档及图片"）

## 7. 依赖

- `sharp`：图片压缩（安装到 apps/api）

## 8. 错误处理

- access_token 获取失败：抛错，上传时 parseStatus=failed + parseError 记录原因（不影响文件入库）
- OCR 调用失败（限流/超时/网络）：同样记 parseError，文件仍入库但无内容
- 压缩失败：跳过压缩直接用原图（若超限则 OCR 报错记录）
- 无密钥配置：OCR 抛"未配置"错误，parseStatus=failed

## 9. 测试

- 上传一张小图（<4MB 带文字）→ 验证识别文字入库 + AI 摘要
- 上传一张大图（>4MB）→ 验证自动压缩 + 识别成功
- 无密钥场景 → 验证 parseStatus=failed 且有错误信息
- 出题联动：图片识别文字后，生成场景时能引用该摘要

## 10. 明确不做（YAGNI）

- 手写体识别（通用 OCR 够用）
- 表格/图表结构还原（只提文字）
- 多语言识别（默认中文）
- 离线 OCR / 本地部署

> AI生成
