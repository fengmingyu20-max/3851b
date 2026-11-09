import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import { changePublicBooking } from '../server/public-site.mjs';
import { rejectBooking, editRejectionReason, rescheduleAdminBooking } from '../server/admin-operations.mjs';
import { updateReturn } from '../server/return-visits.mjs';
import { deliverPendingBookingEmails } from '../server/booking-email.mjs';
import { listBookingEmails, retryBookingEmail } from '../server/admin-workspace.mjs';
import { minimumBookingDate, nextWeekday, addCalendarDays } from '../server/customer/booking-schedule.mjs';

test('real booking and return transactions create one committed notification per successful change', async t => {
  const config = { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306), user: process.env.REGISTRATION_TEST_DB_USER || 'root', password: process.env.REGISTRATION_TEST_DB_PASSWORD, dateStrings: true, decimalNumbers: true };
  const admin = await mysql.createConnection({ ...config, multipleStatements: true });
  const name = `cc_change_mail_test_${process.pid}_${Date.now()}`;
  assert.match(name, /^cc_change_mail_test_\d+_\d+$/);
  let pool;
  t.after(async () => { if (pool) await pool.end(); await admin.query(`DROP DATABASE IF EXISTS ${name}`); await admin.end(); });
  const directory = new URL('../database/', import.meta.url);
  const files = ['schema.sql', 'seed.sql', ...(await readdir(directory)).filter(f => /^\d{2}-.*\.sql$/.test(f)).sort()];
  for (const file of files) {
    const sql = (await readFile(new URL(file, directory), 'utf8')).replace(/\bcoolcare_service_app\b/g, name);
    try { await admin.query(sql); } catch (error) { throw new Error(`Isolated fixture migration ${file}: ${error.code}`); }
  }
  pool = mysql.createPool({ ...config, database: name, connectionLimit: 8 });
  await pool.execute("UPDATE technician SET availability_status='Available'");
  const [[customer]] = await pool.query('SELECT customer_id,user_id FROM customer ORDER BY customer_id LIMIT 1');
  const user = { id: customer.user_id };
  const [[actor]] = await pool.query("SELECT user_id AS userId FROM admin_profile WHERE access_level='Owner'");
  const [[service]] = await pool.query("SELECT service_id FROM simple_service_catalog WHERE code='repair'");
  const [[tech]] = await pool.query('SELECT technician_id FROM technician ORDER BY technician_id LIMIT 1');
  let sequence = 0;
  const make = async (status = 'Submitted') => {
    const date = nextWeekday(addCalendarDays(minimumBookingDate(), 100 + ++sequence * 35));
    const [address] = await pool.execute("INSERT INTO service_address(customer_id,address_line,postal_code) VALUES (?,?,'238839')", [customer.customer_id, 'Mail fixture address ' + sequence]);
    const [booking] = await pool.execute(`INSERT INTO booking(customer_id,address_id,service_id,preferred_service_date,preferred_time_slot,slot_start,slot_end,estimated_duration_minutes,required_technicians,booking_status,total_amount)
      VALUES (?,?,?,?,'09:00 - 11:00','09:00:00','10:00:00',60,1,?,50)`, [customer.customer_id, address.insertId, service.service_id, date, status]);
    return { id: booking.insertId, date };
  };
  const mails = async id => (await pool.execute('SELECT * FROM booking_email_outbox WHERE booking_id=? ORDER BY email_id', [id]))[0];
  const status = async id => (await pool.execute('SELECT booking_status FROM booking WHERE booking_id=?', [id]))[0][0].booking_status;

  await t.test('customer aliases share cancellation/reschedule logic, no-op retries and ownership checks', async () => {
    const b = await make(), newDate = addCalendarDays(b.date, 7);
    await assert.rejects(changePublicBooking(pool, { id: 4294967295 }, b.id, 'cancel', { status: 'Cancelled' }));
    assert.equal((await mails(b.id)).length, 0);
    await assert.rejects(changePublicBooking(pool, user, b.id, 'reschedule', { preferredDate: '2000-01-01', timeWindow: '14:00 - 16:00' }));
    await changePublicBooking(pool, user, b.id, 'reschedule', { preferredDate: newDate, timeWindow: '14:00 - 16:00' });
    await changePublicBooking(pool, user, b.id, 'reschedule', { preferredDate: newDate, timeWindow: '14:00 - 16:00' });
    const [changed] = await mails(b.id);
    assert.equal(changed.event_type, 'booking.rescheduled');
    assert.match(changed.body_text, /14:00 - 15:00/); assert.match(changed.body_text, /09:00 - 10:00/);
    assert.match(changed.body_text, /Awaiting administrator confirmation/);
    await changePublicBooking(pool, user, b.id, 'cancel', { status: 'Cancelled' });
    await changePublicBooking(pool, user, b.id, 'cancel', { status: 'Cancelled' });
    const rows = await mails(b.id); assert.equal(rows.length, 2);
    assert.equal(rows[1].event_type, 'booking.cancelled'); assert.equal(await status(b.id), 'Cancelled');
    assert.equal(rows[0].body_text, changed.body_text, 'a later cancellation must not rewrite the reschedule snapshot');
    const [[recipient]] = await pool.execute('SELECT email FROM user_account WHERE user_id=?', [user.id]);
    assert.equal(rows[0].recipient, recipient.email);
  });
  await t.test('admin rejection, revised public reason and admin reschedule respect replay and no-op behavior', async () => {
    const b = await make(), request = { requestId: randomUUID(), reason: 'No available appointment <script>' };
    await rejectBooking(pool, actor, b.id, request); await rejectBooking(pool, actor, b.id, request);
    assert.equal((await mails(b.id)).length, 1); assert.equal((await mails(b.id))[0].event_type, 'booking.rejected');
    assert.doesNotMatch((await mails(b.id))[0].body_html, /<script>/);
    const edit = { requestId: randomUUID(), version: 1, reason: 'Customer requested a different service.' };
    await editRejectionReason(pool, actor, b.id, edit); await editRejectionReason(pool, actor, b.id, edit);
    assert.equal((await mails(b.id)).length, 2); assert.equal((await mails(b.id))[1].event_type, 'booking.rejection_updated');
    const a = await make('Confirmed'), input = { requestId: randomUUID(), preferredDate: addCalendarDays(a.date, 7), timeSlot: '11:00 - 13:00' };
    await rescheduleAdminBooking(pool, actor, a.id, input); await rescheduleAdminBooking(pool, actor, a.id, input);
    assert.equal((await mails(a.id)).length, 1); assert.match((await mails(a.id))[0].body_text, /Awaiting technician assignment/);
    await rescheduleAdminBooking(pool, actor, a.id, { ...input, requestId: randomUUID() });
    assert.equal((await mails(a.id)).length, 1, 'a new request ID with no appointment change sends nothing');
    assert.equal((await listBookingEmails(pool, b.id)).rows.length, 2);
  });
  await t.test('outbox insertion failure rolls back cancellation; provider failure preserves committed state and retries', async () => {
    const b = await make();
    await pool.query("CREATE TRIGGER reject_mail BEFORE INSERT ON booking_email_outbox FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fixture failure'");
    await assert.rejects(changePublicBooking(pool, user, b.id, 'cancel', { status: 'Cancelled' }));
    await pool.query('DROP TRIGGER reject_mail');
    assert.equal(await status(b.id), 'Submitted'); assert.equal((await mails(b.id)).length, 0);
    await changePublicBooking(pool, user, b.id, 'cancel', { status: 'Cancelled' });
    const [message] = await mails(b.id);
    const scoped = { execute: pool.execute.bind(pool), getConnection: async () => {
      const c = await pool.getConnection(); return { beginTransaction: c.beginTransaction.bind(c), commit: c.commit.bind(c), rollback: c.rollback.bind(c), release: c.release.bind(c), execute: (sql, args) => sql.startsWith('SELECT * FROM booking_email_outbox WHERE delivery_mode=') ? c.execute(sql.replace('WHERE delivery_mode=?', 'WHERE booking_id=? AND delivery_mode=?'), [b.id, ...args]) : c.execute(sql, args) };
    } };
    assert.equal(await deliverPendingBookingEmails(scoped, { mode: 'local', limit: 1, transport: { sendMail: async () => { throw Object.assign(new Error('fixture outage'), { code: 'ECONNECTION' }); } } }), 0);
    assert.equal(await status(b.id), 'Cancelled');
    assert.equal((await listBookingEmails(pool, b.id)).rows[0].canRetry, true);
    await retryBookingEmail(pool, actor, b.id, message.email_id, { requestId: randomUUID() });
    const sent = [];
    assert.equal(await deliverPendingBookingEmails(scoped, { mode: 'local', limit: 1, transport: { sendMail: async mail => { sent.push(mail); return { accepted: [mail.to.address] }; } } }), 1);
    assert.equal(sent[0].messageId, message.message_id); assert.equal(sent[0].text, message.body_text);
    assert.equal((await mails(b.id)).length, 1);
  });
  await t.test('return invite, requested schedule, reinvite and final dispatch notify without confusing proposed and confirmed times', async () => {
    const b = await make('Awaiting return arrangement');
    const [assignment] = await pool.execute("INSERT INTO assignment(booking_id,technician_id,assigned_by_admin_id,assignment_status) VALUES (?,?,?,'Assigned')", [b.id, tech.technician_id, actor.userId]);
    const [job] = await pool.execute("INSERT INTO work_order(booking_id,assignment_id,appointment_date,appointment_time,current_status) VALUES (?,?,?,'09:00:00','Awaiting return arrangement')", [b.id, assignment.insertId, b.date + ' 09:00:00']);
    await pool.execute("INSERT INTO service_progress(job_id,follow_up_status) VALUES (?,'Required')", [job.insertId]);
    await pool.execute("INSERT INTO service_report(job_id,work_performed,submitted_time) VALUES (?,'Fixture return report',UTC_TIMESTAMP())", [job.insertId]);
    let version = 0;
    const act = async (role, extra) => {
      const data = { requestId: randomUUID(), expectedVersion: version, ...extra };
      const result = await updateReturn(pool, role, role === 'admin' ? actor.userId : user.id, job.insertId, data);
      const replay = await updateReturn(pool, role, role === 'admin' ? actor.userId : user.id, job.insertId, data);
      assert.equal(replay.replayed, true); version = result.version;
    };
    await act('admin', { action: 'invite', customerMessage: 'Please choose a new return appointment.' });
    await act('customer', { action: 'choose', date: addCalendarDays(b.date, 21), timeSlot: '11:00 - 13:00' });
    assert.match((await mails(b.id))[1].body_text, /not confirmed yet/);
    await act('admin', { action: 'invite', customerMessage: 'Please select an alternative weekday.' });
    await act('customer', { action: 'choose', date: addCalendarDays(b.date, 28), timeSlot: '14:00 - 16:00' });
    await act('admin', { action: 'dispatch', technicianId: tech.technician_id, durationMinutes: 90 });
    const rows = await mails(b.id);
    assert.deepEqual(rows.map(r => r.event_type), ['return.invited', 'return.requested', 'return.invited', 'return.requested', 'return.scheduled']);
    assert.match(rows.at(-1).body_text, /Confirmed return appointment:/); assert.match(rows.at(-1).body_text, /14:00 - 15:30/);
    assert.equal(await status(b.id), 'Return visit');
    const before = rows.length;
    await assert.rejects(updateReturn(pool, 'customer', 4294967295, job.insertId, { requestId: randomUUID(), expectedVersion: version, action: 'choose', date: addCalendarDays(b.date, 35), timeSlot: '09:00 - 11:00' }));
    assert.equal((await mails(b.id)).length, before);
    assert.equal((await listBookingEmails(pool, b.id)).rows.length, 5);
  });
});
