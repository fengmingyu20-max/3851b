// Isolated MySQL fixture: no real emails, live credentials or business tables.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { createRegistrationService } from '../server/registration-email.mjs';
import { createApp } from '../server/app.mjs';
const secret = 'registration-integration-secret-at-least-32-characters';

test('MySQL verification gates registration, resends, expiry, attempts, session and concurrent consumption', async t => {
  const admin = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306), user: process.env.REGISTRATION_TEST_DB_USER || 'root', password: process.env.REGISTRATION_TEST_DB_PASSWORD });
  const name = `cc_registration_test_${process.pid}_${Date.now()}`;
  await admin.query(`CREATE DATABASE ${name}`);
  const pool = mysql.createPool({ host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306), user: process.env.REGISTRATION_TEST_DB_USER || 'root', password: process.env.REGISTRATION_TEST_DB_PASSWORD, database: name, connectionLimit: 8 });
  t.after(async () => { await pool.end(); await admin.query(`DROP DATABASE ${name}`); await admin.end(); });
  await pool.query('CREATE TABLE role(role_id INT PRIMARY KEY,role_name VARCHAR(30))');
  await pool.query("INSERT INTO role VALUES (1,'Customer'),(2,'Admin')");
  await pool.query("CREATE TABLE user_account(user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,role_id INT,full_name VARCHAR(120),email VARCHAR(255) UNIQUE,password_hash VARCHAR(255),phone VARCHAR(30))");
  await pool.query('CREATE TABLE customer(customer_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,user_id INT UNSIGNED UNIQUE, FOREIGN KEY(user_id) REFERENCES user_account(user_id))');
  await pool.query('CREATE TABLE web_customer_profile(user_id INT UNSIGNED PRIMARY KEY,property_type VARCHAR(120), FOREIGN KEY(user_id) REFERENCES user_account(user_id))');
  const migration = await readFile(new URL('../database/38-registration-email.sql', import.meta.url), 'utf8');
  await pool.query(migration); await pool.query(migration);
  let timestamp = Date.now(), rejectMail = false;
  const sent = [];
  const transport = { sendMail: async message => {
    sent.push(message);
    if (rejectMail) throw new Error('private-provider-secret');
    return { accepted: [message.to.address] };
  } };
  const service = createRegistrationService(pool, { secret, now: () => timestamp, getMode: () => 'local', transportFactory: () => transport });
  let sequence = 0;
  const form = () => ({ email: `customer-${++sequence}@example.invalid`, fullName: 'Verified customer', phone: '12345678', password: 'fixture-only-password', confirmPassword: 'fixture-only-password', propertyType: 'Apartment', role: 'Admin' });
  const issue = async (account, session = 'browser-a') => {
    const response = await service.requestCode({ email: account.email }, session);
    const emailCode = sent.at(-1).text.match(/code is: (\d{6})/)[1];
    assert.deepEqual(Object.keys(response).sort(), ['expiresIn','resendAfter','success','verificationId']);
    return { ...account, verificationId: response.verificationId, emailCode };
  };
  const countAccounts = async () => (await pool.query('SELECT COUNT(*) AS n FROM user_account'))[0][0].n;
  const rowFor = async email => (await pool.execute('SELECT * FROM registration_email_verification WHERE email=?', [email]))[0][0];

  await t.test('only verified address creates Customer and code is single use', async () => {
    const account = form();
    await assert.rejects(service.register(account, 'browser-a'));
    assert.equal(await countAccounts(), 0);
    const input = await issue(account);
    assert.notEqual((await rowFor(account.email)).code_hash, input.emailCode);
    await assert.rejects(service.register(input, 'other-browser'), error => error.status === 400);
    await assert.rejects(service.register({ ...input, email: 'other@example.invalid' }, 'browser-a'), error => error.status === 400);
    assert.equal(await countAccounts(), 0);
    const result = await service.register(input, 'browser-a');
    const [[user]] = await pool.execute('SELECT * FROM user_account WHERE user_id=?', [result.user.id]);
    assert.equal(user.role_id, 1); assert.equal(await bcrypt.compare(account.password, user.password_hash), true);
    assert.equal((await rowFor(account.email)).code_hash, null);
    await assert.rejects(service.register(input, 'browser-a'), error => error.status === 400);
    timestamp += 60001;
    await assert.rejects(service.requestCode({ email: account.email }, 'browser-a'), error => error.status === 409);
  });
  await t.test('five wrong guesses persist, then even the correct code is rejected', async () => {
    const input = await issue(form());
    const wrong = input.emailCode === '000000' ? '000001' : '000000';
    for (let i = 0; i < 5; i++) await assert.rejects(service.register({ ...input, emailCode: wrong }, 'browser-a'), error => error.status === 400);
    assert.equal((await rowFor(input.email)).attempts, 5);
    await assert.rejects(service.register(input, 'browser-a'), error => error.status === 400);
  });
  await t.test('cooldown, replacement and expiry are enforced by server', async () => {
    const input = await issue(form());
    await assert.rejects(issue(input), error => error.status === 429);
    timestamp += 60001;
    const replacement = await issue(input);
    await assert.rejects(service.register(input, 'browser-a'), error => error.status === 400);
    timestamp += 600000;
    await assert.rejects(service.register(replacement, 'browser-a'), error => error.status === 400);
  });
  await t.test('per-address hourly cap applies across browsers', async () => {
    const account = form();
    for (let i = 0; i < 5; i++) { await issue(account, `browser-${i}`); timestamp += 60001; }
    await assert.rejects(issue(account, 'another-browser'), error => error.status === 429);
  });
  await t.test('mail failure leaves no account and no usable verification hash', async () => {
    const account = form(), before = await countAccounts(); rejectMail = true;
    await assert.rejects(issue(account), error => error.status === 503 && !error.message.includes('private'));
    rejectMail = false;
    const row = await rowFor(account.email);
    assert.equal(row.delivery_status, 'Failed'); assert.equal(row.code_hash, null);
    assert.equal(await countAccounts(), before);
  });
  await t.test('simultaneous requests and registrations serialize on the email row', async () => {
    const account = form();
    const requests = await Promise.allSettled([issue(account), issue(account)]);
    assert.equal(requests.filter(r => r.status === 'fulfilled').length, 1);
    const input = requests.find(r => r.status === 'fulfilled').value;
    const before = await countAccounts();
    const registrations = await Promise.allSettled([service.register(input, 'browser-a'), service.register(input, 'browser-a')]);
    assert.equal(registrations.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(await countAccounts(), before + 1);
  });
  await t.test('account insert failure rolls back profile and code consumption; verified retry works', async () => {
    const input = await issue(form());
    await pool.query("CREATE TRIGGER reject_registration BEFORE INSERT ON web_customer_profile FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fixture failure'");
    const before = await countAccounts();
    await assert.rejects(service.register(input, 'browser-a'));
    assert.equal(await countAccounts(), before);
    assert.equal((await rowFor(input.email)).delivery_status, 'Ready');
    await pool.query('DROP TRIGGER reject_registration');
    await service.register(input, 'browser-a');
  });
  await t.test('HTTP endpoints require CSRF and bind code to the issuing cookie session', async () => {
    const server = createApp({ pool, secret, registrationMailTransportFactory: () => transport }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const account = form();
    const headers = async () => {
      const r = await fetch(base + '/api/session'); const body = await r.json();
      return { 'Content-Type': 'application/json', Cookie: r.headers.getSetCookie()[0].split(';')[0], 'X-CSRF-Token': body.csrf };
    };
    const post = (path, body, h = {}) => fetch(base + '/api/public/register' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify(body) });
    try {
      assert.equal((await post('/email-code', account)).status, 403);
      const h = await headers();
      assert.equal((await post('', account, h)).status, 400);
      const response = await post('/email-code', account, h); assert.equal(response.status, 200);
      const challenge = await response.json(), emailCode = sent.at(-1).text.match(/code is: (\d{6})/)[1];
      const input = { ...account, verificationId: challenge.verificationId, emailCode };
      assert.equal((await post('', input, await headers())).status, 400);
      assert.equal((await post('', input, h)).status, 201);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
});
