import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ParkHupuStore } from './store';

function createTempStore(): { store: ParkHupuStore; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yqhp-auth-test-'));
  const store = new ParkHupuStore({ dataDir: dir, enableBackgroundTimer: false });
  return {
    store,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

test('ParkHupuStore no longer exposes passwordless quickLogin and enforces account + password login', () => {
  const { store, cleanup } = createTempStore();
  try {
    assert.equal('quickLogin' in store, false);

    // Register a player with personal password
    const reg = store.register({
      nickname: '园区库里',
      account: 'curry30',
      password: 'my-secret-password',
    });
    assert.equal(reg.ok, true);
    if (!reg.ok) return;
    assert.equal(reg.user.account, 'CURRY30');

    // Empty or wrong password rejected
    assert.equal(store.login('CURRY30', '').ok, false);
    assert.equal(store.login('CURRY30', 'wrong-pass').ok, false);
    assert.equal(store.login('UNKNOWN99', 'my-secret-password').ok, false);

    // Case-insensitive account + exact password succeeds
    const loginOk = store.login('curry30', 'my-secret-password');
    assert.equal(loginOk.ok, true);
    if (!loginOk.ok) return;
    assert.equal(loginOk.user.id, reg.user.id);
    assert.equal(store.getUserByToken(loginOk.token)?.id, reg.user.id);
  } finally {
    cleanup();
  }
});

test('changing password requires currentPassword and immediately invalidates all prior sessions', () => {
  const { store, cleanup } = createTempStore();
  try {
    const reg = store.register({
      nickname: '园区欧文',
      account: 'KYRIE11',
      password: 'old-password-1',
    });
    assert.equal(reg.ok, true);
    if (!reg.ok) return;

    // Simulate a second device / prior session logged into the same account
    const otherDeviceLogin = store.login('KYRIE11', 'old-password-1');
    assert.equal(otherDeviceLogin.ok, true);
    if (!otherDeviceLogin.ok) return;
    const oldSessionToken = otherDeviceLogin.token;
    assert.equal(store.getUserByToken(oldSessionToken)?.id, reg.user.id);

    // Editing nickname without changing password does NOT require currentPassword
    const nickUpdate = store.updateProfile(reg.user, { nickname: '德鲁大叔' });
    assert.equal(nickUpdate.ok, true);
    if (!nickUpdate.ok) return;
    assert.equal(nickUpdate.token, undefined);
    assert.equal(store.getUserByToken(oldSessionToken)?.nickname, '德鲁大叔');

    // Changing password without currentPassword is rejected
    const missingCurrent = store.updateProfile(nickUpdate.user, {
      password: 'new-password-2',
    });
    assert.equal(missingCurrent.ok, false);

    // Changing password with wrong currentPassword is rejected
    const wrongCurrent = store.updateProfile(nickUpdate.user, {
      currentPassword: 'not-the-old-password',
      password: 'new-password-2',
    });
    assert.equal(wrongCurrent.ok, false);

    // Changing password with valid currentPassword succeeds and rotates tokenVersion
    const pwdChanged = store.updateProfile(nickUpdate.user, {
      currentPassword: 'old-password-1',
      password: 'new-password-2',
    });
    assert.equal(pwdChanged.ok, true);
    if (!pwdChanged.ok) return;
    assert.ok(pwdChanged.token);

    // Prior sessions (both register token and second device token) are immediately invalidated
    assert.equal(store.getUserByToken(reg.token), null);
    assert.equal(store.getUserByToken(oldSessionToken), null);

    // Rotated session token remains valid for the current user
    assert.equal(store.getUserByToken(pwdChanged.token)?.id, reg.user.id);

    // Old password can no longer log in; new password logs in cleanly
    assert.equal(store.login('KYRIE11', 'old-password-1').ok, false);
    assert.equal(store.login('KYRIE11', 'new-password-2').ok, true);
  } finally {
    cleanup();
  }
});
