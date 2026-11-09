import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBookingChangeMail, bookingAppointment, enqueueBookingLifecycleEmail } from '../server/booking-email.mjs';
const booking = { booking_id: 42, created_at: '2025-12-31 10:00:00', booking_status: 'Submitted', full_name: '<script>Customer</script>', services: 'Repair & Cleaning', address_line: '<img src=x>', preferred_service_date: '2035-02-06', slot_start: '14:00:00', slot_end: '15:30:00', preferred_time_slot: '14:00 - 16:00' };
const previousAppointment = { date: '2035-01-23', start: '09:00:00', end: '10:00:00' };
test('change emails preserve booking identity, exact old/new duration, pending state and escaped public content', () => {
  const result = buildBookingChangeMail(booking, 'booking.rescheduled', { previousAppointment });
  assert.match(result.subject, /BK-2025-0042/);
  assert.match(result.text, /Previous appointment: 23 Jan 2035, 09:00 - 10:00 \(Singapore time\)/);
  assert.match(result.text, /New appointment: 6 Feb 2035, 14:00 - 15:30 \(Singapore time\)/);
  assert.match(result.text, /Awaiting administrator confirmation/);
  assert.doesNotMatch(result.html, /<script>|<img/);
  assert.match(result.html, /&lt;script&gt;/);
  assert.equal(bookingAppointment({ ...booking, preferred_service_date: new Date('2035-02-06T00:00:00Z') }).date, '2035-02-06');
});
test('rejection reasons are escaped and cancellations do not claim payment refunds', () => {
  const rejected = buildBookingChangeMail(booking, 'booking.rejected', { reason: '<script>Unavailable & busy</script>' });
  assert.match(rejected.text, /Reason: <script>Unavailable & busy/);
  assert.doesNotMatch(rejected.html, /<script>/);
  assert.match(rejected.html, /Unavailable &amp; busy/);
  const cancelled = buildBookingChangeMail(booking, 'booking.cancelled');
  assert.match(cancelled.text, /has been cancelled/); assert.doesNotMatch(cancelled.text, /refund|plan has been cancelled/i);
});
test('return invitation, requested time and final confirmation have distinct meanings', () => {
  const appointment = { date: '2035-03-06', start: '11:00:00', end: '12:45:00' };
  const invite = buildBookingChangeMail(booking, 'return.invited', { previousAppointment, customerMessage: 'Choose a new date <script>' });
  assert.match(invite.text, /No return appointment has been confirmed/);
  assert.doesNotMatch(invite.text, /Confirmed return appointment/);
  assert.doesNotMatch(invite.html, /<script>/);
  const requested = buildBookingChangeMail(booking, 'return.requested', { previousAppointment, appointment });
  assert.match(requested.text, /not confirmed yet/);
  assert.match(requested.text, /Requested return appointment: 6 Mar 2035, 11:00 - 12:45/);
  const scheduled = buildBookingChangeMail(booking, 'return.scheduled', { previousAppointment, appointment });
  assert.match(scheduled.text, /Confirmed return appointment: 6 Mar 2035, 11:00 - 12:45/);
  assert.throws(() => buildBookingChangeMail(booking, 'return.requested'));
});
test('repeated business changes must supply an operation/history event identity', async () => {
  const db = { execute: () => { throw new Error('Must reject before querying'); } };
  await assert.rejects(enqueueBookingLifecycleEmail(db, 42, 'booking.rescheduled'), /stable change event key/);
});
