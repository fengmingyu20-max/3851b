import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { createPasswordResetService, resetRequestMessage } from '../server/password-reset.mjs';
import { changePassword } from '../server/account-password.mjs';
import { createApp } from '../server/app.mjs';

test('MySQL password recovery keeps tokens single use, preserves accounts and revokes old sessions', async t => {
  const config = { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306), user: process.env.REGISTRATION_TEST_DB_USER || 'root', password: process.env.REGISTRATION_TEST_DB_PASSWORD };
  const admin = await mysql.createConnection(config);
  const name = `cc_reset_test_${process.pid}_${Date.now()}`;
  await admin.query(`CREATE DATABASE ${name}`);
  const pool = mysql.createPool({ ...config, database: name, connectionLimit: 8 });
  t.after(async () => { await pool.end(); await admin.query(`DROP DATABASE ${name}`); await admin.end(); });
  await pool.query('CREATE TABLE role(role_id INT PRIMARY KEY,role_name VARCHAR(30))');
  await pool.query("INSERT INTO role VALUES (1,'Customer'),(2,'Technician'),(3,'Admin')");
  await pool.query("CREATE TABLE user_account(user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,role_id INT,full_name VARCHAR(120),email VARCHAR(255) UNIQUE,password_hash VARCHAR(255),phone VARCHAR(30),status VARCHAR(30) NOT NULL DEFAULT 'Active')");
  await pool.query('CREATE TABLE web_customer_profile(user_id INT UNSIGNED PRIMARY KEY,property_type VARCHAR(120))');
  await pool.query('CREATE TABLE admin_profile(user_id INT UNSIGNED PRIMARY KEY,access_level VARCHAR(30))');
  const migration = await readFile(new URL('../database/39-password-reset.sql', import.meta.url), 'utf8');
  await pool.query(migration); await pool.query(migration);
  let timestamp = Date.now(), sequence = 0, rejectMail = false;
  const sent = [];
  const transport = { sendMail: async message => {
    sent.push(message); if (rejectMail) throw new Error('private-provider-value');
    return { accepted: [message.to.address] };
  } };
  const service = createPasswordResetService(pool, { origin: 'https://coolcare.example', now: () => timestamp, getMode: () => 'local', transportFactory: () => transport });
  const oldPassword = 'fixture-old-password', nextPassword = 'fixture-next-password';
  const create = async (status = 'Active', roleId = 1) => {
    const email = `reset-${++sequence}@example.invalid`;
    const [result] = await pool.execute('INSERT INTO user_account(role_id,full_name,email,password_hash,phone,status) VALUES (?,?,?,?,?,?)', [roleId, 'Reset fixture', email, await bcrypt.hash(oldPassword, 4), '12345678', status]);
    return { id: result.insertId, email };
  };
  const passwordOf = async id => (await pool.execute('SELECT password_hash FROM user_account WHERE user_id=?', [id]))[0][0].password_hash;
  const rowOf = async id => (await pool.execute('SELECT * FROM password_reset_token WHERE user_id=?', [id]))[0][0];
  const lastToken = () => sent.at(-1).text.match(/\/reset-password#([a-f0-9]{64})/)[1];
  const issue = async account => { const response = await service.request({ email: account.email }); await service.drain(); return { response, token: lastToken() }; };
  const reset = (token, password = nextPassword) => service.reset({ token, newPassword: password, confirmPassword: password });

  await t.test('existing, missing and inactive addresses get identical responses; requesting never changes a password', async () => {
    const active = await create(), inactive = await create('Inactive'), before = await passwordOf(active.id);
    const existing = await service.request({ email: active.email }); await service.drain();
    const count = sent.length;
    assert.deepEqual(existing, { success: true, message: resetRequestMessage, resendAfter: 60 });
    assert.deepEqual(await service.request({ email: 'missing@example.invalid' }), existing);
    assert.deepEqual(await service.request({ email: inactive.email }), existing);
    await service.drain(); assert.equal(sent.length, count);
    assert.equal(await passwordOf(active.id), before);
    assert.notEqual((await rowOf(active.id)).token_hash, lastToken());
    assert.deepEqual(Object.keys(existing).sort(), ['message','resendAfter','success']);
  });
  await t.test('a token updates only its own account, works once and does not change roles', async () => {
    const account = await create('Active', 3), other = await create(), otherHash = await passwordOf(other.id);
    const { token } = await issue(account);
    await assert.rejects(reset('f'.repeat(64)), error => error.status === 400);
    await assert.rejects(reset(token, oldPassword), error => error.status === 400);
    assert.equal((await rowOf(account.id)).delivery_status, 'Ready');
    assert.deepEqual(await reset(token), { userId: account.id });
    assert.equal(await bcrypt.compare(nextPassword, await passwordOf(account.id)), true);
    assert.equal(await bcrypt.compare(oldPassword, await passwordOf(account.id)), false);
    assert.equal(await passwordOf(other.id), otherHash);
    assert.equal((await pool.execute('SELECT role_id FROM user_account WHERE user_id=?', [account.id]))[0][0].role_id, 3);
    assert.equal((await rowOf(account.id)).token_hash, null);
    await assert.rejects(reset(token), error => error.status === 400);
  });
  await t.test('cooldown, resend replacement and expiry reject stale links', async () => {
    const account = await create(), first = await issue(account), before = sent.length;
    await service.request({ email: account.email }); await service.drain(); assert.equal(sent.length, before);
    timestamp += 60001; const second = await issue(account);
    assert.notEqual(first.token, second.token);
    await assert.rejects(reset(first.token), error => error.status === 400);
    timestamp += 1800000;
    await assert.rejects(reset(second.token), error => error.status === 400);
    assert.equal(await bcrypt.compare(oldPassword, await passwordOf(account.id)), true);
  });
  await t.test('hourly cap counts sends and returns the same public message', async () => {
    const account = await create(), before = sent.length;
    let response;
    for (let i = 0; i < 5; i++) { response = (await issue(account)).response; timestamp += 60001; }
    assert.deepEqual(await service.request({ email: account.email }), response);
    await service.drain(); assert.equal(sent.length, before + 5);
  });
  await t.test('mail failure leaves the old credential and no usable token', async () => {
    const account = await create(), before = await passwordOf(account.id); rejectMail = true;
    const { response, token } = await issue(account); rejectMail = false;
    assert.equal(response.success, true); assert.equal((await rowOf(account.id)).delivery_status, 'Failed');
    assert.equal((await rowOf(account.id)).token_hash, null);
    await assert.rejects(reset(token), error => error.status === 400);
    assert.equal(await passwordOf(account.id), before);
  });
  await t.test('password changes, email changes and deactivation invalidate issued reset links', async () => {
    const changed = await create(), first = await issue(changed);
    await changePassword(pool, changed.id, { currentPassword: oldPassword, newPassword: 'fixture-manual-change', confirmPassword: 'fixture-manual-change' });
    await assert.rejects(reset(first.token), error => error.status === 400);
    const emailChanged = await create(), second = await issue(emailChanged);
    await pool.execute('UPDATE user_account SET email=? WHERE user_id=?', ['changed@example.invalid', emailChanged.id]);
    await assert.rejects(reset(second.token), error => error.status === 400);
    const inactive = await create(), third = await issue(inactive);
    await pool.execute("UPDATE user_account SET status='Inactive' WHERE user_id=?", [inactive.id]);
    await assert.rejects(reset(third.token), error => error.status === 400);
  });
  await t.test('simultaneous consumption succeeds once and failed writes roll back token consumption', async () => {
    const account = await create(), { token } = await issue(account);
    await pool.query("CREATE TRIGGER reject_reset BEFORE UPDATE ON user_account FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fixture failure'");
    await assert.rejects(reset(token)); assert.equal((await rowOf(account.id)).delivery_status, 'Ready');
    assert.equal(await bcrypt.compare(oldPassword, await passwordOf(account.id)), true);
    await pool.query('DROP TRIGGER reject_reset');
    const results = await Promise.allSettled([reset(token), reset(token)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  });
  await t.test('HTTP requires CSRF, clears old account sessions and accepts only the new credential', async () => {
    const account = await create(), other = await create();
    const server = createApp({ pool, secret: 'reset-http-test-secret-at-least-32-characters', passwordResetMailTransportFactory: () => transport }).listen(0, '127.0.0.1');
    await once(server, 'listening'); const base = `http://127.0.0.1:${server.address().port}`;
    function client() {
      let cookie = '', csrf = '';
      const request = async (path, method = 'GET', body) => {
        const response = await fetch(base + path, { method, headers: { Cookie: cookie, 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
        const setCookie = response.headers.getSetCookie()[0]; if (setCookie) cookie = setCookie.split(';')[0];
        return response;
      };
      return { request, session: async () => { csrf = (await (await request('/api/session')).json()).csrf; }, login: async (email, password) => { const r = await request('/api/public/login', 'POST', { email, password }); const body = await r.json(); if (r.ok) csrf = body.csrf; return r.status; } };
    }
    const guest = client(), oldSession = client(), unrelated = client();
    try {
      assert.equal((await guest.request('/api/public/account/forgot-password', 'POST', { email: account.email })).status, 403);
      await oldSession.session(); assert.equal(await oldSession.login(account.email, oldPassword), 200);
      await unrelated.session(); assert.equal(await unrelated.login(other.email, oldPassword), 200);
      await guest.session();
      assert.equal((await guest.request('/api/public/account/forgot-password', 'POST', { email: account.email })).status, 200);
      for (let i = 0; i < 100 && (await rowOf(account.id))?.delivery_status !== 'Ready'; i++) await new Promise(resolve => setTimeout(resolve, 20));
      const token = lastToken();
      assert.equal((await guest.request('/api/public/account/reset-password', 'POST', { token, newPassword: nextPassword, confirmPassword: nextPassword })).status, 200);
      assert.equal((await (await oldSession.request('/api/public/session')).json()).user, null);
      assert.equal((await (await unrelated.request('/api/public/session')).json()).user.email, other.email);
      await guest.session();
      assert.equal(await guest.login(account.email, oldPassword), 401);
      assert.equal(await guest.login(account.email, nextPassword), 200);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
});
