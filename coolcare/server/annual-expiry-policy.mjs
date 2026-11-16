import { createHash } from 'node:crypto';
import { getAdminAnnualPlan } from './customer/plans.mjs';
import { addCalendarDays, singaporeToday } from './customer/booking-schedule.mjs';

export function annualExpiryDue(plan, now = new Date()) {
  const today = singaporeToday(now);
  return Boolean(plan && plan.visits?.length === 4 && ['Active', 'Completed'].includes(plan.status) && plan.canRenew && !plan.existingRenewalSeriesId
    && plan.validUntil > today && plan.validUntil <= addCalendarDays(today, 7));
}
export function annualExpiryKey(plan) {
  return `plan.expiring:${plan.seriesId}:${plan.validUntil}:${createHash('sha256').update(plan.email).digest('hex').slice(0, 24)}`;
}
export async function loadAnnualExpiryPlan(pool, seriesId, now = new Date()) {
  const [[active]] = await pool.execute(`SELECT s.series_id FROM annual_booking_series s JOIN customer c ON c.customer_id=s.customer_id
    JOIN user_account u ON u.user_id=c.user_id WHERE s.series_id=? AND u.status='Active'`, [seriesId]);
  if (!active) return null;
  const plan = await getAdminAnnualPlan(pool, seriesId, now);
  return annualExpiryDue(plan, now) ? plan : null;
}
