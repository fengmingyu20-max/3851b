import { enqueueBookingLifecycleEmail, mailMode } from './booking-email.mjs';
import { bookingReminderKey, loadReminderBooking, reminderWindow } from './booking-reminder-policy.mjs';

export async function enqueueTomorrowBookingReminders(pool, { now = new Date() } = {}) {
  const window = reminderWindow(now);
  if (!window.enabled || mailMode() === 'disabled') return 0;
  let cursor = 0, queued = 0;
  // Keyset pages prevent a large first page of already-notified bookings from
  // starving later bookings. Each booking lock is held only while queuing.
  for (;;) {
    const [bookings] = await pool.execute(`SELECT booking_id FROM booking WHERE preferred_service_date=?
      AND booking_status IN ('Assigned','Return visit') AND booking_id>? ORDER BY booking_id LIMIT 100`, [window.date, cursor]);
    for (const row of bookings) {
      cursor = row.booking_id;
      const c = await pool.getConnection();
      try {
        await c.beginTransaction();
        // Match the booking-first lock order used by cancel/reschedule/dispatch.
        await c.execute('SELECT booking_id FROM booking WHERE booking_id=? FOR UPDATE', [row.booking_id]);
        const booking = await loadReminderBooking(c, row.booking_id, window.date, { lock: true });
        if (booking) {
          const eventKey = bookingReminderKey(booking);
          const [[existing]] = await c.execute('SELECT email_id,status,delivery_mode,last_error FROM booking_email_outbox WHERE event_key=?', [eventKey]);
          if (!existing) {
            await enqueueBookingLifecycleEmail(c, row.booking_id, 'booking.reminder', { eventKey });
            queued++;
          } else if (existing.delivery_mode === 'disabled' && existing.last_error === 'REMINDER_SUPERSEDED') {
            // A same-day change can be reverted to this exact appointment.
            // Reuse its message identity instead of creating a second event.
            await c.execute("UPDATE booking_email_outbox SET delivery_mode=?,last_error=NULL,next_attempt_at=NOW() WHERE email_id=? AND status='Pending' AND delivery_mode='disabled' AND last_error='REMINDER_SUPERSEDED'", [mailMode(), existing.email_id]);
            queued++;
          }
        }
        await c.commit();
      } catch (error) { await c.rollback(); throw error; }
      finally { c.release(); }
    }
    if (bookings.length < 100) return queued;
  }
}

export function startBookingReminderWorker(pool) {
  let running = null, stopped = false;
  function tick() {
    if (running || stopped) return;
    running = enqueueTomorrowBookingReminders(pool)
      .catch(error => console.error('Booking reminder worker:', error.code || error.name))
      .finally(() => { running = null; });
  }
  const timer = setInterval(tick, 60000);
  timer.unref();
  tick();
  return async () => { stopped = true; clearInterval(timer); await running; };
}
