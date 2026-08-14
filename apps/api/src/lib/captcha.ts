import { randomUUID } from "node:crypto";
import { HttpError } from "./response";

type CaptchaChallenge = {
  targetX: number;
  expiresAt: number;
  attempts: number;
};

type CaptchaToken = {
  expiresAt: number;
};

const challenges = new Map<string, CaptchaChallenge>();
const tokens = new Map<string, CaptchaToken>();
let lastCleanupAt = 0;

function intEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cleanup(now = Date.now()) {
  if (now - lastCleanupAt < 60_000) return;
  lastCleanupAt = now;
  for (const [id, challenge] of challenges.entries()) {
    if (challenge.expiresAt <= now) challenges.delete(id);
  }
  for (const [token, value] of tokens.entries()) {
    if (value.expiresAt <= now) tokens.delete(token);
  }
}

export function issueCaptchaChallenge() {
  cleanup();
  const expiresIn = intEnv("CAPTCHA_EXPIRES_IN", 120);
  const captchaId = randomUUID();
  const targetX = randomInt(150, 236);

  challenges.set(captchaId, {
    targetX,
    expiresAt: Date.now() + expiresIn * 1000,
    attempts: 0,
  });

  return {
    captchaId,
    targetX,
    expiresIn,
    pieceSize: 42,
    trackMax: 260,
  };
}

export function verifyCaptchaChallenge(captchaId: string, positionX: number) {
  cleanup();
  const now = Date.now();
  const challenge = challenges.get(captchaId);
  if (!challenge || challenge.expiresAt <= now) {
    challenges.delete(captchaId);
    throw new HttpError("CAPTCHA_EXPIRED", "图形验证码已过期，请刷新后重试。", 401);
  }

  challenge.attempts += 1;
  const tolerance = intEnv("CAPTCHA_TOLERANCE", 12);
  const maxAttempts = intEnv("CAPTCHA_MAX_ATTEMPTS", 5);
  if (Math.abs(positionX - challenge.targetX) > tolerance) {
    if (challenge.attempts >= maxAttempts) challenges.delete(captchaId);
    throw new HttpError("INVALID_CAPTCHA", "图形验证码未对齐，请重试。", 401);
  }

  challenges.delete(captchaId);
  const tokenExpiresIn = intEnv("CAPTCHA_TOKEN_EXPIRES_IN", 60);
  const captchaToken = randomUUID();
  tokens.set(captchaToken, { expiresAt: now + tokenExpiresIn * 1000 });
  return { captchaToken, expiresIn: tokenExpiresIn };
}

export function consumeCaptchaToken(captchaToken: string) {
  cleanup();
  const token = tokens.get(captchaToken);
  if (!token || token.expiresAt <= Date.now()) {
    tokens.delete(captchaToken);
    return false;
  }

  tokens.delete(captchaToken);
  return true;
}
