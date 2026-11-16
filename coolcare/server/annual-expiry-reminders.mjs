import { enqueueMail, mailMode } from './booking-email.mjs';
import { annualExpiryKey, loadAnnualExpiryPlan } from './annual-expiry-policy.mjs';
import { reminderWindow } from './booking-reminder-policy.mjs';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function buildAnnualExpiryMail(plan) {
  const date = new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(plan.validUntil + 'T00:00:00Z'));
  let link = '';
  try {
    const url = new URL(process.env.WEB_ORIGIN || `https://${process.env.WEBSITE_HOSTNAME || ''}`);
    if (url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) link = url.origin + '/customer/plans';
  } catch { /* Navigation instructions work without a configured public origin. */ }
  const message = `Your annual plan ${plan.name} (Plan #${plan.seriesId}) reaches the end of its validity on ${date} (Singapore time). Sign in to My Plans to review current prices and renew your plan. Renewal is optional; no automatic renewal or charge applies.`;
  return { subject: `CoolCare: annual plan #${plan.seriesId} expires soon`, text: `Hi ${plan.customerName},\n\n${message}${link ? '\nMy Plans: ' + link : ''}\n\nCoolCare Admin Team`,
    html: `<div style="font:16px Arial,sans-serif;max-width:600px"><h1>Your annual plan expires soon</h1><p>Hi ${escape(plan.customerName)},</p><p>${escape(message)}</p>${link ? `<p><a href="${escape(link)}">Review and renew in My Plans</a></p>` : ''}<p>CoolCare Admin Team</p></div>` };
}

export async function enqueueAnnualExpiryReminders(pool, { now = new Date() } = {}) {
  if (!reminderWindow(now).enabled || mailMode() === 'disabled') return 0;
  let cursor = 0, queued = 0;
  for (;;) {
    const [rows] = await pool.execute('SELECT series_id,customer_id FROM annual_booking_series WHERE series_id>? ORDER BY series_id LIMIT 100', [cursor]);
    for (const row of rows) {
      cursor = row.series_id;
      const c = await pool.getConnection();
      try {
        await c.beginTransaction();
        await c.execute('SELECT customer_id FROM customer WHERE customer_id=? FOR UPDATE', [row.customer_id]);
        await c.execute('SELECT b.booking_id FROM booking b JOIN annual_booking_visit v ON v.booking_id=b.booking_id WHERE v.series_id=? ORDER BY b.booking_id FOR SHARE NOWAIT', [row.series_id]);
        const plan = await loadAnnualExpiryPlan(c, row.series_id, now);
        if (plan) {
          const eventKey = annualExpiryKey(plan);
          const [[existing]] = await c.execute('SELECT email_id FROM booking_email_outbox WHERE event_key=?', [eventKey]);
          if (!existing) {
            await enqueueMail(c, { eventKey, eventType: 'plan.expiring', bookingId: plan.visits[0]?.bookingId ?? null, recipient: plan.email, ...buildAnnualExpiryMail(plan) });
            queued++;
          }
        }
        await c.commit();
      } catch (error) {
        await c.rollback();
        if (['ER_LOCK_NOWAIT', 'ER_LOCK_DEADLOCK'].includes(error.code)) continue;
        throw error;
      } finally { c.release(); }
    }
    if (rows.length < 100) return queued;
  }
}
