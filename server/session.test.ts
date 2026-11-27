import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LoginRateLimiter,
  SESSION_TTL_MS,
  SESSION_TTL_SECONDS,
  buildClearSessionCookieHeader,
  buildSessionCookieHeader,
  createSignedSessionToken,
  isSameOriginOrCustomHeader,
  parseCookieValue,
  verifySignedSessionToken,
} from './session';

test('signed session token remains valid within 2 hours and expires strictly at 2 hours', () => {
  const secret = 'test-secret-key-for-unit-tests-1234';
  const startMs = Date.parse('2026-11-27T10:00:00.000Z');
  const { token, payload } = createSignedSessionToken('player_yy01', startMs, secret);

  assert.equal(payload.uid, 'player_yy01');
  assert.equal(payload.exp - payload.iat, SESSION_TTL_MS);
  assert.equal(payload.tv, 0);

  // Valid immediately and 1 second before expiry
  const immediate = verifySignedSessionToken(token, startMs, secret);
  assert.equal(immediate?.uid, 'player_yy01');
  assert.equal(immediate?.tv, 0);

  const justBeforeExpiry = verifySignedSessionToken(token, startMs + SESSION_TTL_MS - 1000, secret);
  assert.equal(justBeforeExpiry?.uid, 'player_yy01');

  // Expired at exactly 2 hours
  const atExpiry = verifySignedSessionToken(token, startMs + SESSION_TTL_MS, secret);
  assert.equal(atExpiry, null);

  // Tampered signature or payload rejected
  const tampered = `${token.slice(0, -2)}xx`;
  assert.equal(verifySignedSessionToken(tampered, startMs, secret), null);

  // Token version is preserved across sign/verify
  const v3 = createSignedSessionToken('player_yy01', startMs, secret, SESSION_TTL_MS, 3);
  assert.equal(verifySignedSessionToken(v3.token, startMs, secret)?.tv, 3);
});

test('cookie parser and HTTPS/HTTP cookie builders handle 2-hour persistence cleanly', () => {
  const header = 'foo=1; yqhp_session=abc.def; bar=2';
  assert.equal(parseCookieValue(header), 'abc.def');
  assert.equal(parseCookieValue('other=value'), undefined);

  const httpsCookie = buildSessionCookieHeader('tok.sig', { isHttps: true });
  assert.match(httpsCookie, /HttpOnly/);
  assert.match(httpsCookie, /Secure/);
  assert.match(httpsCookie, /SameSite=None/);
  assert.match(httpsCookie, /Partitioned/);
  assert.match(httpsCookie, new RegExp(`Max-Age=${SESSION_TTL_SECONDS}`));

  const httpCookie = buildSessionCookieHeader('tok.sig', { isHttps: false });
  assert.match(httpCookie, /HttpOnly/);
  assert.match(httpCookie, /SameSite=Lax/);
  assert.doesNotMatch(httpCookie, /Secure/);
  assert.match(httpCookie, new RegExp(`Max-Age=${SESSION_TTL_SECONDS}`));

  const clearCookie = buildClearSessionCookieHeader(false);
  assert.match(clearCookie, /Max-Age=0/);
});

test('CSRF helper accepts XMLHttpRequest header or matching Origin/Host and rejects cross-site origins', () => {
  assert.equal(
    isSameOriginOrCustomHeader({ xRequestedWith: 'XMLHttpRequest' }),
    true,
  );
  assert.equal(
    isSameOriginOrCustomHeader({
      origin: 'http://124.221.147.57',
      host: '124.221.147.57',
    }),
    true,
  );
  assert.equal(
    isSameOriginOrCustomHeader({
      origin: 'https://evil.example.com',
      host: '124.221.147.57',
    }),
    false,
  );
  assert.equal(isSameOriginOrCustomHeader({}), false);
});

test('LoginRateLimiter locks after repeated failures, recovers after lockout, and resets on success', () => {
  const limiter = new LoginRateLimiter({
    maxAttempts: 3,
    windowMs: 60_000,
    lockoutMs: 120_000,
  });
  const t0 = 1_000_000;

  assert.equal(limiter.check('127.0.0.1:YY08', t0).allowed, true);
  assert.equal(limiter.recordFailure('127.0.0.1:YY08', t0 + 1000).locked, false);
  assert.equal(limiter.recordFailure('127.0.0.1:YY08', t0 + 2000).locked, false);

  const third = limiter.recordFailure('127.0.0.1:YY08', t0 + 3000);
  assert.equal(third.locked, true);
  assert.equal(third.retryAfterSeconds, 120);

  const blocked = limiter.check('127.0.0.1:YY08', t0 + 30_000);
  assert.equal(blocked.allowed, false);

  // Other accounts are not affected
  assert.equal(limiter.check('127.0.0.1:YY01', t0 + 30_000).allowed, true);

  // After lockout expires, attempts are allowed again
  assert.equal(limiter.check('127.0.0.1:YY08', t0 + 123_001).allowed, true);

  // Clear resets failure count
  limiter.recordFailure('127.0.0.1:YY02', t0);
  limiter.recordFailure('127.0.0.1:YY02', t0 + 500);
  limiter.clear('127.0.0.1:YY02');
  assert.equal(limiter.recordFailure('127.0.0.1:YY02', t0 + 1000).remainingAttempts, 2);
});
