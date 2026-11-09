import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCompletedBookingMail, enqueueCompletedBookingEmail, bookingMailEventTypes } from '../server/booking-email.mjs';
const booking = { booking_id: 42, created_at: '2026-11-01', full_name: '<script>Customer</script>', services: 'Repair & cleaning' };
test('completion mail links to authenticated reports and feedback and escapes customer content', () => {
  const previous = process.env.WEB_ORIGIN;
  try {
    process.env.WEB_ORIGIN = 'https://coolcare.example';
    const mail = buildCompletedBookingMail(booking);
    assert.ok(mail.text.includes('https://coolcare.example/customer/history/42'));
    assert.ok(mail.text.includes('https://coolcare.example/customer/feedback'));
    assert.match(mail.text, /Please sign in/); assert.match(mail.text, /CoolCare Admin Team/);
    assert.doesNotMatch(mail.html, /<script>/); assert.match(mail.html, /Repair &amp; cleaning/);
    assert.ok(bookingMailEventTypes.includes('booking.completed'));
    process.env.WEB_ORIGIN = 'https://user:secret@bad.example/path';
    assert.doesNotMatch(buildCompletedBookingMail(booking).text, /bad.example|secret/);
  } finally { if (previous === undefined) delete process.env.WEB_ORIGIN; else process.env.WEB_ORIGIN = previous; }
});
test('an ended visit without a submitted report or with an unresolved return sends nothing', async () => {
  let calls = 0;
  const db = { execute: async (sql, args) => { calls++; assert.match(sql, /submitted_time IS NOT NULL/); assert.match(sql, /completed_at IS NOT NULL/); assert.match(sql, /follow_up_status/); assert.deepEqual(args, [42]); return [[]]; } };
  assert.equal(await enqueueCompletedBookingEmail(db, 42), null); assert.equal(calls, 1);
});
