import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { registrationEmailSchema, registrationSchema, matchesRegistrationCode, createRegistrationService } from '../server/registration-email.mjs';

const secret = 'registration-test-secret-with-at-least-32-characters';
test('registration requires a full six-digit code and opaque challenge; normalizes the email', () => {
  assert.equal(registrationEmailSchema.parse(' Alice@Example.com '), 'alice@example.com');
  const form = { fullName: 'Alice', email: 'Alice@Example.com', phone: '12345678', password: 'test-only-password', confirmPassword: 'test-only-password' };
  assert.equal(registrationSchema.safeParse(form).success, false);
  const valid = { ...form, verificationId: 'a'.repeat(48), emailCode: '000123' };
  assert.equal(registrationSchema.parse(valid).email, 'alice@example.com');
  for (const emailCode of ['', '12345', '1234567', 'abcdef']) assert.equal(registrationSchema.safeParse({ ...valid, emailCode }).success, false);
});
test('code digest binds code to email, challenge and server secret', () => {
  const email = 'alice@example.com', challenge_id = 'a'.repeat(48), code = '000123';
  const row = { challenge_id, code_hash: createHmac('sha256', secret).update(JSON.stringify([email, challenge_id, code])).digest('hex') };
  assert.equal(matchesRegistrationCode(secret, row, email, code), true);
  assert.equal(matchesRegistrationCode(secret, row, email, '000124'), false);
  assert.equal(matchesRegistrationCode(secret, row, 'other@example.com', code), false);
  assert.equal(matchesRegistrationCode(secret, { ...row, challenge_id: 'b'.repeat(48) }, email, code), false);
  assert.equal(matchesRegistrationCode(secret + 'changed', row, email, code), false);
});
test('disabled or unconfigured mail fails closed before any DB or account mutation', async () => {
  const pool = { getConnection: () => { throw new Error('Must not write to DB'); } };
  const disabled = createRegistrationService(pool, { secret, getMode: () => 'disabled' });
  await assert.rejects(disabled.requestCode({ email: 'alice@example.com' }, 'session'), error => error.status === 503);
  const missing = createRegistrationService(pool, { secret, getMode: () => 'smtp', transportFactory: () => { throw new Error('private provider details'); } });
  await assert.rejects(missing.requestCode({ email: 'alice@example.com' }, 'session'), error => error.status === 503 && !error.message.includes('private'));
});
