import crypto from "crypto";

export const ADMIN_COOKIE_NAME = "momment_admin";

export function createAdminSessionValue() {
  const secret = getAdminSecret();
  return crypto.createHash("sha256").update(`momment-admin:${secret}`).digest("hex");
}

export function isValidAdminPassword(password: string) {
  const configuredHash = process.env.ADMIN_PASSWORD_SHA256;
  if (configuredHash) {
    return safeEqual(sha256(password), configuredHash);
  }

  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) {
    return false;
  }

  return safeEqual(password, configuredPassword);
}

export function isValidAdminSession(value: string | undefined) {
  if (!value) {
    return false;
  }

  return safeEqual(value, createAdminSessionValue());
}

function getAdminSecret() {
  return process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD_SHA256 ?? process.env.ADMIN_PASSWORD ?? "";
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}
