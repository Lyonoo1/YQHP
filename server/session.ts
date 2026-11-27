import crypto from 'node:crypto';

export const SESSION_COOKIE_NAME = 'yqhp_session';
export const SESSION_TTL_SECONDS = 2 * 60 * 60; // 2 hours
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

export interface VerifiedSessionPayload {
  uid: string;
  jti: string;
  iat: number;
  exp: number;
  tv?: number;
}

const FALLBACK_SESSION_SECRET = crypto.randomBytes(32).toString('hex');

export function getSessionSecret(): string {
  const fromEnv = process.env.SESSION_SECRET?.trim();
  return fromEnv && fromEnv.length >= 16 ? fromEnv : FALLBACK_SESSION_SECRET;
}

function signPayload(payloadB64: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

export function createSignedSessionToken(
  userId: string,
  nowMs: number = Date.now(),
  secret: string = getSessionSecret(),
  ttlMs: number = SESSION_TTL_MS,
  tokenVersion: number = 0,
): { token: string; payload: VerifiedSessionPayload } {
  const payload: VerifiedSessionPayload = {
    uid: userId,
    jti: crypto.randomBytes(12).toString('hex'),
    iat: nowMs,
    exp: nowMs + ttlMs,
    tv: Number.isInteger(tokenVersion) && tokenVersion >= 0 ? tokenVersion : 0,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = signPayload(payloadB64, secret);
  return {
    token: `${payloadB64}.${sig}`,
    payload,
  };
}

export function verifySignedSessionToken(
  token: string | undefined,
  nowMs: number = Date.now(),
  secret: string = getSessionSecret(),
): VerifiedSessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0 || dotIdx !== token.lastIndexOf('.')) return null;

  const payloadB64 = token.slice(0, dotIdx);
  const providedSig = token.slice(dotIdx + 1);
  if (!payloadB64 || !providedSig) return null;

  const expectedSig = signPayload(payloadB64, secret);
  const providedBuf = Buffer.from(providedSig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    ) as Partial<VerifiedSessionPayload>;
    if (
      typeof parsed.uid !== 'string' ||
      !parsed.uid ||
      typeof parsed.jti !== 'string' ||
      !parsed.jti ||
      typeof parsed.exp !== 'number' ||
      !Number.isFinite(parsed.exp)
    ) {
      return null;
    }
    if (
      parsed.tv !== undefined &&
      (typeof parsed.tv !== 'number' || !Number.isInteger(parsed.tv) || parsed.tv < 0)
    ) {
      return null;
    }
    if (nowMs >= parsed.exp) {
      return null;
    }
    return {
      uid: parsed.uid,
      jti: parsed.jti,
      iat: typeof parsed.iat === 'number' ? parsed.iat : 0,
      exp: parsed.exp,
      tv: parsed.tv ?? 0,
    };
  } catch {
    return null;
  }
}

export function parseCookieValue(
  cookieHeader: string | undefined,
  cookieName: string = SESSION_COOKIE_NAME,
): string | undefined {
  if (!cookieHeader) return undefined;
  const pairs = cookieHeader.split(';');
  for (const part of pairs) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    if (key === cookieName) {
      const rawVal = part.slice(eqIdx + 1).trim();
      if (!rawVal) return undefined;
      try {
        return decodeURIComponent(rawVal);
      } catch {
        return rawVal;
      }
    }
  }
  return undefined;
}

export function buildSessionCookieHeader(
  token: string,
  options: { isHttps: boolean; maxAgeSeconds?: number; nowMs?: number },
): string {
  const maxAge = Math.max(0, Math.floor(options.maxAgeSeconds ?? SESSION_TTL_SECONDS));
  const expiresDate = new Date((options.nowMs ?? Date.now()) + maxAge * 1000).toUTCString();
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAge}`,
    `Expires=${expiresDate}`,
  ];
  if (options.isHttps) {
    // HTTPS (including cross-site preview iframes) requires Secure + SameSite=None + Partitioned
    attrs.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    // Plain HTTP (e.g. IP deployment in WeChat / local dev): browsers reject Secure/SameSite=None over HTTP
    attrs.push('SameSite=Lax');
  }
  return attrs.join('; ');
}

export function buildClearSessionCookieHeader(isHttps: boolean): string {
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (isHttps) {
    attrs.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    attrs.push('SameSite=Lax');
  }
  return attrs.join('; ');
}

export function isSameOriginOrCustomHeader(params: {
  xRequestedWith?: string;
  origin?: string;
  host?: string;
  forwardedHost?: string;
}): boolean {
  if (params.xRequestedWith === 'XMLHttpRequest') {
    return true;
  }
  if (!params.origin) return false;
  const expectedHost = (params.forwardedHost || params.host || '').split(',')[0].trim().toLowerCase();
  if (!expectedHost) return false;
  try {
    const parsedOrigin = new URL(params.origin);
    return parsedOrigin.host.toLowerCase() === expectedHost;
  } catch {
    return false;
  }
}

export interface LoginRateLimiterOptions {
  maxAttempts?: number;
  windowMs?: number;
  lockoutMs?: number;
}

interface LoginAttemptRecord {
  failures: number[];
  lockedUntilMs: number;
}

export class LoginRateLimiter {
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly lockoutMs: number;
  private readonly records = new Map<string, LoginAttemptRecord>();

  constructor(options: LoginRateLimiterOptions = {}) {
    this.maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 8));
    this.windowMs = Math.max(1000, Math.floor(options.windowMs ?? 10 * 60 * 1000));
    this.lockoutMs = Math.max(1000, Math.floor(options.lockoutMs ?? 5 * 60 * 1000));
  }

  public check(
    key: string,
    nowMs: number = Date.now(),
  ): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
    const record = this.records.get(key);
    if (!record) return { allowed: true };

    if (record.lockedUntilMs > nowMs) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((record.lockedUntilMs - nowMs) / 1000)),
      };
    }

    const cutoff = nowMs - this.windowMs;
    record.failures = record.failures.filter((ts) => ts > cutoff);
    if (record.failures.length === 0) {
      this.records.delete(key);
    }
    return { allowed: true };
  }

  public recordFailure(
    key: string,
    nowMs: number = Date.now(),
  ): { locked: boolean; remainingAttempts: number; retryAfterSeconds: number } {
    const cutoff = nowMs - this.windowMs;
    const existing = this.records.get(key);
    const failures = existing ? existing.failures.filter((ts) => ts > cutoff) : [];
    failures.push(nowMs);

    if (failures.length >= this.maxAttempts) {
      const lockedUntilMs = nowMs + this.lockoutMs;
      this.records.set(key, { failures, lockedUntilMs });
      return {
        locked: true,
        remainingAttempts: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(this.lockoutMs / 1000)),
      };
    }

    this.records.set(key, { failures, lockedUntilMs: 0 });
    return {
      locked: false,
      remainingAttempts: this.maxAttempts - failures.length,
      retryAfterSeconds: 0,
    };
  }

  public clear(key: string): void {
    this.records.delete(key);
  }

  public prune(nowMs: number = Date.now()): void {
    const cutoff = nowMs - this.windowMs;
    for (const [key, record] of this.records.entries()) {
      if (record.lockedUntilMs > nowMs) continue;
      record.failures = record.failures.filter((ts) => ts > cutoff);
      if (record.failures.length === 0) {
        this.records.delete(key);
      }
    }
  }
}
