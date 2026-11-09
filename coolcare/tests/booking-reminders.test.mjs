import test from 'node:test';
import assert from 'node:assert/strict';
import { reminderWindow, bookingReminderKey } from '../server/booking-reminder-policy.mjs';
import { enqueueTomorrowBookingReminders } from '../server/booking-reminders.mjs';
import { buildBookingChangeMail, bookingMailEventTypes } from '../server/booking-email.mjs';

test('reminder window is tomorrow from 09:00 Singapore, independent of host timezone and DST', () => {
  assert.deepEqual(reminderWindow(new Date('2026-11-09T00:59:59Z')), { date: '2026-11-10', enabled: false });
  assert.deepEqual(reminderWindow(new Date('2026-11-09T01:00:00Z')), { date: '2026-11-10', enabled: true });
  assert.deepEqual(reminderWindow(new Date('2026-12-31T15:59:59Z')), { date: '2027-01-01', enabled: true });
  assert.deepEqual(reminderWindow(new Date('2026-12-31T16:00:00Z')), { date: '2027-01-02', enabled: false });
});

const booking = { booking_id: 42, created_at: '2026-01-01', preferred_service_date: '2026-11-10', preferred_time_slot: '09:00 - 11:00', slot_start: '09:00:00', slot_end: '12:15:00', address_line: '<img src=x> Unit 1', email: 'customer@example.test', full_name: '<script>Customer</script>', services: 'Cleaning & repair' };
test('reminder snapshot deduplicates restarts and distinguishes schedule, address and recipient changes', () => {
  const original = bookingReminderKey(booking);
  assert.equal(original, bookingReminderKey({ ...booking }));
  assert.equal(original, bookingReminderKey({ ...booking, preferred_service_date: new Date('2026-11-10T00:00:00Z') }));
  for (const [key, value] of Object.entries({ preferred_service_date: '2026-11-11', slot_start: '10:00:00', slot_end: '13:00:00', address_line: 'Unit 2', email: 'new@example.test' })) {
    assert.notEqual(original, bookingReminderKey({ ...booking, [key]: value }));
  }
  assert.doesNotMatch(original, /customer@example/);
});

test('reminder mail includes actual appointment time and address, escaped English content and booking identity', () => {
  const mail = buildBookingChangeMail(booking, 'booking.reminder');
  assert.match(mail.subject, /BK-2026-0042/);
  assert.match(mail.text, /tomorrow/);
  assert.match(mail.text, /10 Nov 2026, 09:00 - 12:15 \(Singapore time\)/);
  assert.match(mail.text, /Service address: <img src=x> Unit 1/);
  assert.doesNotMatch(mail.text, /09:00 - 11:00/);
  assert.doesNotMatch(mail.html, /<script>|<img/);
  assert.match(mail.html, /Cleaning &amp; repair/);
  assert.ok(bookingMailEventTypes.includes('booking.reminder'));
});

test('scanner does not touch the database before the morning reminder window', async () => {
  let called = false;
  assert.equal(await enqueueTomorrowBookingReminders({ execute: async () => { called = true; throw new Error('Unexpected database call'); } }, { now: new Date('2026-11-09T00:59:00Z') }), 0);
  assert.equal(called, false);
});

test('scanner advances beyond a full first page, including bookings no longer eligible after selection', async () => {
  const cursors = [], locked = [];
  const c = { beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {}, execute: async (sql, args) => {
    if (sql.startsWith('SELECT booking_id FROM booking')) locked.push(args[0]);
    return [[]];
  } };
  const pool = { getConnection: async () => c, execute: async (sql, args) => {
    cursors.push(args[1]);
    return [args[1] === 0 ? Array.from({ length: 100 }, (_, i) => ({ booking_id: i + 1 })) : [{ booking_id: 101 }]];
  } };
  assert.equal(await enqueueTomorrowBookingReminders(pool, { now: new Date('2026-11-09T01:00:00Z') }), 0);
  assert.deepEqual(cursors, [0, 100]);
  assert.equal(locked.length, 101);
});
