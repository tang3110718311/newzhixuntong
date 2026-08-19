import { randomInt as cryptoRandomInt, randomUUID } from "node:crypto";
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

const pieceSize = 42;
const pieceTop = 43;
const pieceStartX = 12;
const trackMax = 260;
const imageWidth = 320;
const imageHeight = 132;

function intEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function randomInt(min: number, max: number) {
  return cryptoRandomInt(min, max + 1);
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

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function issueBackgroundImage(targetX: number) {
  const gapX = pieceStartX + targetX;
  const sunX = randomInt(236, 280);
  const sunY = randomInt(22, 42);
  const hillA = randomInt(52, 78);
  const hillB = randomInt(78, 104);
  const hue = randomInt(185, 215);
  const accentHue = randomInt(30, 48);

  return svgToDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}" viewBox="0 0 ${imageWidth} ${imageHeight}">
  <defs>
    <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="hsl(${hue},76%,78%)"/>
      <stop offset="0.48" stop-color="hsl(${hue + 8},72%,88%)"/>
      <stop offset="0.49" stop-color="hsl(${accentHue},92%,80%)"/>
      <stop offset="1" stop-color="hsl(${accentHue},98%,90%)"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#37646e" flood-opacity=".36"/>
    </filter>
  </defs>
  <rect width="320" height="132" rx="9" fill="url(#sky)"/>
  <circle cx="${sunX}" cy="${sunY}" r="18" fill="#fff6bd" opacity=".82"/>
  <path d="M0 ${hillB} C60 ${hillA},112 ${hillB + 12},170 ${hillA + 4} S272 ${hillB - 16},320 ${hillA + 10} V132 H0 Z" fill="#73bda5" opacity=".72"/>
  <path d="M0 100 C72 82,122 112,190 92 S270 80,320 96 V132 H0 Z" fill="#5ba890" opacity=".78"/>
  <path d="M0 92 L320 34" stroke="#ffffff" stroke-opacity=".28" stroke-width="12"/>
  <rect x="${gapX}" y="${pieceTop}" width="${pieceSize}" height="${pieceSize}" rx="7" fill="#ffffff" opacity=".28" stroke="#ffffff" stroke-width="2" stroke-dasharray="6 4"/>
  <rect x="${gapX + 3}" y="${pieceTop + 3}" width="${pieceSize - 6}" height="${pieceSize - 6}" rx="6" fill="#0f3850" opacity=".18" filter="url(#softShadow)"/>
  <text x="16" y="113" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#fff" opacity=".9">ZXT</text>
</svg>`.trim());
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
    backgroundImage: issueBackgroundImage(targetX),
    expiresIn,
    pieceSize,
    trackMax,
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
