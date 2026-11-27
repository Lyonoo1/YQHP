import test from 'node:test';
import assert from 'node:assert/strict';
import {
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

  // Valid immediately and 1 second before expiry
  const immediate = verifySignedSessionToken(token, startMs, secret);
  assert.equal(immediate?.uid, 'player_yy01');

  const justBeforeExpiry = verifySignedSessionToken(token, startMs + SESSION_TTL_MS - 1000, secret);
  assert.equal(justBeforeExpiry?.uid, 'player_yy01');

  // Expired at exactly 2 hours
  const atExpiry = verifySignedSessionToken(token, startMs + SESSION_TTL_MS, secret);
  assert.equal(atExpiry, null);

  // Tampered signature or payload rejected
  const tampered = `${token.slice(0, -2)}xx`;
  assert.equal(verifySignedSessionToken(tampered, startMs, secret), null);
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
