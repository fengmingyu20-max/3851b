import test from 'node:test';
import assert from 'node:assert/strict';
import { createPasswordResetService, resetLink, resetRequestSchema, resetPasswordSchema, resetRequestMessage } from '../server/password-reset.mjs';

test('reset links use configured origin and fragment; no secret in the request URL', () => {
  const token = 'a'.repeat(64), url = new URL(resetLink('https://coolcare.example', token));
  assert.equal(url.origin, 'https://coolcare.example');
  assert.equal(url.pathname, '/reset-password'); assert.equal(url.search, '');
  assert.equal(url.hash, '#' + token);
  assert.throws(() => resetLink('javascript:alert(1)', token));
});
test('reset validates email, random token, matching passwords and bcrypt byte bound', () => {
  assert.equal(resetRequestSchema.parse({ email: ' Alice@Example.com ' }).email, 'alice@example.com');
  const value = { token: 'a'.repeat(64), newPassword: 'fixture-password', confirmPassword: 'fixture-password' };
  assert.equal(resetPasswordSchema.safeParse(value).success, true);
  assert.equal(resetPasswordSchema.safeParse({ ...value, userId: 1 }).success, false);
  assert.equal(resetPasswordSchema.safeParse({ ...value, token: '' }).success, false);
  assert.equal(resetPasswordSchema.safeParse({ ...value, confirmPassword: 'different' }).success, false);
  assert.equal(resetPasswordSchema.safeParse({ ...value, newPassword: '��'.repeat(25), confirmPassword: '��'.repeat(25) }).success, false);
});
test('disabled mail gives a generic response without changing any account', async () => {
  const service = createPasswordResetService({ execute: () => { throw new Error('Must not access accounts'); } }, { getMode: () => 'disabled' });
  assert.deepEqual(await service.request({ email: 'test@example.invalid' }), { success: true, message: resetRequestMessage, resendAfter: 60 });
});
