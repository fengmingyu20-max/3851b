import { createHash } from 'node:crypto';
import { addCalendarDays, singaporeToday } from './customer/booking-schedule.mjs';

// Calendar-day reminder, not a rolling 24-hour delay. Catch up after downtime
// only while it is still the day before the appointment in Singapore.
export function reminderWindow(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', hourCycle: 'h23' }).format(now));
  return { date: addCalendarDays(singaporeToday(now), 1), enabled: hour >= 9 };
}

export function bookingReminderKey(booking) {
  const date = booking.preferred_service_date instanceof Date ? booking.preferred_service_date.toISOString().slice(0, 10) : String(booking.preferred_service_date).slice(0, 10);
  const snapshot = [date, String(booking.slot_start || '').slice(0, 8), String(booking.slot_end || '').slice(0, 8), booking.preferred_time_slot, booking.address_line, booking.email];
  return `booking.reminder:${booking.booking_id}:${createHash('sha256').update(JSON.stringify(snapshot)).digest('hex').slice(0, 40)}`;
}

// Both scanner and delivery use this policy: pending requests and unconfirmed
// return requests must never be described as tomorrow's confirmed appointment.
export async function loadReminderBooking(connection, bookingId, date, { lock = false } = {}) {
  const [[booking]] = await connection.execute(`SELECT b.booking_id,b.preferred_service_date,b.preferred_time_slot,b.slot_start,b.slot_end,u.email,sa.address_line
    FROM booking b JOIN customer c ON c.customer_id=b.customer_id
    JOIN user_account u ON u.user_id=c.user_id JOIN service_address sa ON sa.address_id=b.address_id
    WHERE b.booking_id=? AND b.preferred_service_date=? AND b.booking_status IN ('Assigned','Return visit')
      AND b.slot_start IS NOT NULL AND b.slot_end IS NOT NULL AND u.status='Active'
      AND EXISTS(SELECT 1 FROM work_order w JOIN assignment a ON a.assignment_id=w.assignment_id AND a.booking_id=w.booking_id
        WHERE w.booking_id=b.booking_id AND w.current_status IN ('Assigned','Return visit') AND a.assignment_status IN ('Assigned','Accepted'))
    ${lock ? 'FOR UPDATE' : ''}`, [bookingId, date]);
  return booking || null;
}
