import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AI 供应商 API Key 加解密（AES-256-GCM）。
 * 主密钥从环境变量 AI_SECRET_KEY 读取（64 位 hex 或 43 字符 base64url，对应 32 字节）。
 * - 未配置主密钥时：encrypt 原样返回明文、decrypt 原样返回（本地开发模式兼容）。
 * - 加密格式：enc:v1:<iv>.<authTag>.<ciphertext>（均为 base64url）。
 * - 解密失败（密钥不匹配等）返回原串，不抛错，避免影响业务。
 */

const ALGO = "aes-256-gcm";
const PREFIX = "enc:v1:";

function getMasterKey(): Buffer | null {
  const raw = process.env.AI_SECRET_KEY;
  if (!raw) return null;
  let buf: Buffer | null = null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    buf = Buffer.from(raw, "hex");
  } else if (/^[A-Za-z0-9_-]{43}$/.test(raw)) {
    buf = Buffer.from(raw, "base64url");
  } else {
    buf = Buffer.from(raw, "utf8");
  }
  return buf.length === 32 ? buf : null;
}

export function isEncryptedSecret(stored: string): boolean {
  return Boolean(stored && stored.startsWith(PREFIX));
}

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const key = getMasterKey();
  if (!key) return plain; // 未配置主密钥 → 保持明文（本地开发）
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptSecret(stored: string): string {
  if (!stored || !stored.startsWith(PREFIX)) return stored;
  try {
    const parts = stored.slice(PREFIX.length).split(".");
    if (parts.length !== 3) return stored;
    const [ivB64, tagB64, dataB64] = parts;
    const key = getMasterKey();
    if (!key) return stored;
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return stored; // 密钥不匹配/数据损坏 → 返回原串，不崩溃
  }
}
