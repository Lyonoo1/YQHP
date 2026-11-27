import crypto from 'node:crypto';

export const SESSION_COOKIE_NAME = 'yqhp_session';
export const SESSION_TTL_SECONDS = 2 * 60 * 60; // 2 hours
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

export interface VerifiedSessionPayload {
  uid: string;
  jti: string;
  iat: number;
  exp: number;
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
): { token: string; payload: VerifiedSessionPayload } {
  const payload: VerifiedSessionPayload = {
    uid: userId,
    jti: crypto.randomBytes(12).toString('hex'),
    iat: nowMs,
    exp: nowMs + ttlMs,
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
    if (nowMs >= parsed.exp) {
      return null;
    }
    return {
      uid: parsed.uid,
      jti: parsed.jti,
      iat: typeof parsed.iat === 'number' ? parsed.iat : 0,
      exp: parsed.exp,
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
