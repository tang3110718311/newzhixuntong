import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const algorithm = "pbkdf2_sha512";
const iterations = 210000;
const keyLength = 32;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, iterations, keyLength, "sha512").toString("base64url");
  return `${algorithm}$${iterations}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [storedAlgorithm, storedIterations, salt, expectedHash] = storedHash.split("$");
  if (storedAlgorithm !== algorithm || !storedIterations || !salt || !expectedHash) return false;

  const expected = Buffer.from(expectedHash, "base64url");
  const actual = pbkdf2Sync(password, salt, Number(storedIterations), expected.length, "sha512");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
