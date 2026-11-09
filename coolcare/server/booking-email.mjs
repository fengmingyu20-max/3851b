import { bookingReference } from './booking-reference.mjs';
import nodemailer from 'nodemailer';
import { randomUUID } from 'node:crypto';
import { createAzureMailTransport } from './azure-email.mjs';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
export function mailMode() { return ['smtp', 'disabled'].includes(process.env.MAIL_MODE) ? process.env.MAIL_MODE : 'local'; }

export const bookingMailEventTypes = Object.freeze(['booking.assigned', 'booking.cancelled', 'booking.rescheduled', 'booking.rejected', 'booking.rejection_updated', 'booking.rebooked', 'return.invited', 'return.requested', 'return.scheduled']);
export function bookingAppointment(booking) {
  const value = booking.preferred_service_date;
  return { date: value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10), start: booking.slot_start, end: booking.slot_end, timeSlot: booking.preferred_time_slot };
}
function appointmentText(appointment) {
  const date = new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${appointment.date}T00:00:00Z`));
  const time = appointment.start && appointment.end ? `${String(appointment.start).slice(0, 5)} - ${String(appointment.end).slice(0, 5)}` : appointment.timeSlot;
  return `${date}, ${time} (Singapore time)`;
}
export function buildBookingChangeMail(booking, eventType, { previousAppointment, appointment, reason, customerMessage } = {}) {
  const definitions = {
    'booking.cancelled': ['Booking cancelled', 'Your booking has been cancelled. This applies to the appointment shown below.'],
    'booking.rescheduled': ['Booking appointment changed', 'Your booking appointment has been changed.'],
    'booking.rejected': ['Booking request declined', 'The administrator has declined your booking request.'],
    'booking.rejection_updated': ['Booking rejection reason updated', 'The administrator has updated the reason for declining your booking request. The booking remains rejected.'],
    'booking.rebooked': ['Annual plan visit rebooked', 'Your annual plan visit has been rebooked under its existing plan.'],
    'return.invited': ['Return visit: choose a new appointment', 'A return visit is needed. Please open My Bookings and choose a new return appointment. No return appointment has been confirmed yet.'],
    'return.requested': ['Return appointment request received', 'Your preferred return appointment has been received and is awaiting administrator confirmation. It is not confirmed yet.'],
    'return.scheduled': ['Return visit confirmed', 'The administrator has confirmed and assigned your return visit.'],
  };
  const definition = definitions[eventType];
  if (!definition) throw new Error('Unsupported booking change mail event.');
  const [title, intro] = definition;
  const reference = bookingReference(booking.booking_id, booking.created_at);
  const fields = [['Booking reference', reference], ['Services', booking.services], ['Service address', booking.address_line]];
  if (['booking.rescheduled', 'booking.rebooked'].includes(eventType)) {
    if (!previousAppointment) throw new Error('Previous appointment snapshot is required.');
    fields.push(['Previous appointment', appointmentText(previousAppointment)], ['New appointment', appointmentText(appointment || bookingAppointment(booking))]);
    fields.push(['Next step', booking.booking_status === 'Submitted' ? 'Awaiting administrator confirmation.' : 'Awaiting technician assignment.']);
  } else if (eventType.startsWith('return.')) {
    if (previousAppointment) fields.push(['Previous service appointment', appointmentText(previousAppointment)]);
    if (eventType !== 'return.invited') {
      if (!appointment) throw new Error('Return appointment snapshot is required.');
      fields.push([eventType === 'return.requested' ? 'Requested return appointment' : 'Confirmed return appointment', appointmentText(appointment)]);
    }
    if (customerMessage) fields.push(['Message from the service team', customerMessage]);
  } else fields.push(['Service appointment', appointmentText(bookingAppointment(booking))]);
  if (['booking.rejected', 'booking.rejection_updated'].includes(eventType) && reason) fields.push(['Reason', reason]);
  return {
    subject: `CoolCare ${reference}: ${title}`,
    text: `Hi ${booking.full_name},\n\n${intro}\n\n${fields.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\nView the latest status in My Bookings.\nCoolCare`,
    html: `<div style="font:16px Arial,sans-serif;max-width:600px;color:#172b4d"><h1>${title}</h1><p>Hi ${escapeHtml(booking.full_name)},</p><p>${intro}</p><table style="width:100%;border-collapse:collapse">${fields.map(([label, value]) => `<tr><th style="padding:10px;text-align:left;vertical-align:top;border-bottom:1px solid #ddd">${escapeHtml(label)}</th><td style="padding:10px;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`).join('')}</table><p>View the latest status in My Bookings.</p><p>CoolCare</p></div>`,
  };
}

export function buildAssignedBookingMail(booking, technicianName) {
  const date = new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${booking.preferred_service_date}T00:00:00Z`));
  const reference = bookingReference(booking.booking_id, booking.created_at);
  const fields = [
    ['Booking reference', reference],
    ['Services', booking.services],
    ['Service date', date],
    ['Service time',booking.slot_start&&booking.slot_end?`${String(booking.slot_start).slice(0,5)} - ${String(booking.slot_end).slice(0,5)} (Singapore time)`:booking.preferred_time_slot],
    ...(booking.estimated_duration_minutes?[['Estimated duration',`${booking.estimated_duration_minutes} minutes`]]:[]),
    ['Service address', booking.address_line],
    ['Technician', technicianName],
  ];
  const intro = 'Your booking has been reviewed, confirmed and assigned to a technician.';
  return {
    subject: `CoolCare booking ${reference} confirmed`,
    text: `Hi ${booking.full_name},\n\n${intro}\n\n${fields.map(([name,value])=>`${name}: ${value}`).join('\n')}\n\nView the latest status in My Bookings.\nCoolCare`,
    html: `<div style="font:16px Arial,sans-serif;max-width:600px;color:#172b4d"><h1 style="color:#003f87">Booking confirmed and technician assigned</h1><p>Hi ${escapeHtml(booking.full_name)},</p><p>${escapeHtml(intro)}</p><table style="width:100%;border-collapse:collapse">${fields.map(([name,value])=>`<tr><th style="padding:10px;text-align:left;vertical-align:top;border-bottom:1px solid #ddd">${escapeHtml(name)}</th><td style="padding:10px;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`).join('')}</table><p>View the latest status in My Bookings.</p><p>CoolCare</p></div>`,
  };
}

async function enqueueMail(connection,{eventKey,eventType,bookingId=null,invitationId=null,recipient,subject,text,html}) {
  const [[existing]] = await connection.execute('SELECT recipient,status,delivery_mode FROM booking_email_outbox WHERE event_key=?',[eventKey]);
  if(existing)return {status:existing.status==='Sent'?'sent':existing.delivery_mode==='disabled'?'disabled':'queued',mode:existing.delivery_mode,recipient:existing.recipient};
  const mode=mailMode();
  await connection.execute(`INSERT INTO booking_email_outbox
    (booking_id,invitation_id,event_type,event_key,recipient,subject,body_text,body_html,message_id,delivery_mode)
    VALUES (?,?,?,?,?,?,?,?,?,?)`,[bookingId,invitationId,eventType,eventKey,recipient,subject,text,html,`<${randomUUID()}@coolcare.local>`,mode]);
  return {status:mode==='disabled'?'disabled':'queued',mode,recipient};
}

export async function enqueueBookingLifecycleEmail(connection,bookingId,eventType,options={}) {
  if(!bookingMailEventTypes.includes(eventType))throw new Error('Unsupported booking mail event.');
  if(eventType!=='booking.assigned' && !options.eventKey)throw new Error('A stable change event key is required.');
  const {technicianName='',eventKey=`${eventType}:${bookingId}`} = options;
  const [[booking]]=await connection.execute(`SELECT b.booking_id,b.created_at,b.booking_status,b.preferred_service_date,b.preferred_time_slot,b.slot_start,b.slot_end,b.estimated_duration_minutes,
    u.full_name,u.email,sa.address_line,COALESCE(GROUP_CONCAT(bs.service_name ORDER BY bs.service_id SEPARATOR ', '),MAX(sc.service_name)) AS services
    FROM booking b JOIN customer c ON c.customer_id=b.customer_id JOIN user_account u ON u.user_id=c.user_id
    JOIN service_address sa ON sa.address_id=b.address_id JOIN service_catalog sc ON sc.service_id=b.service_id
    LEFT JOIN booking_service bs ON bs.booking_id=b.booking_id WHERE b.booking_id=?
    GROUP BY b.booking_id,b.created_at,b.booking_status,b.preferred_service_date,b.preferred_time_slot,b.slot_start,b.slot_end,b.estimated_duration_minutes,u.full_name,u.email,sa.address_line`,[bookingId]);
  if(!booking)throw new Error('Cannot queue mail for a missing booking.');
  const mail=eventType==='booking.assigned' ? buildAssignedBookingMail(booking,technicianName) : buildBookingChangeMail(booking,eventType,options);
  return enqueueMail(connection,{eventKey,eventType,bookingId,recipient:booking.email,...mail});
}

export async function enqueueStaffInvitationEmail(connection,{invitationId,roleName,recipient,fullName,token,origin}) {
  const activationUrl=`${String(origin||'http://localhost:3000').replace(/\/$/,'')}/activate?token=${encodeURIComponent(token)}`;
  const subject=`Activate your CoolCare ${roleName} account`;
  const text=`Hi ${fullName},\n\nYou have been invited to join CoolCare as ${roleName}. Activate your account within 48 hours:\n${activationUrl}\n\nIf you did not expect this invitation, you can ignore this email.\nCoolCare`;
  const html=`<div style="font:16px Arial,sans-serif;max-width:600px;color:#172b4d"><h1 style="color:#003f87">Activate your CoolCare account</h1><p>Hi ${escapeHtml(fullName)},</p><p>You have been invited to join CoolCare as <strong>${escapeHtml(roleName)}</strong>.</p><p><a href="${escapeHtml(activationUrl)}" style="display:inline-block;padding:12px 18px;background:#003f87;color:white;text-decoration:none;border-radius:8px">Set your password</a></p><p>This single-use link expires in 48 hours.</p><p>If you did not expect this invitation, you can ignore this email.</p></div>`;
  return enqueueMail(connection,{eventKey:`staff.invited:${invitationId}`,eventType:'staff.invited',invitationId,recipient,subject,text,html});
}

export function createMailTransport(mode = mailMode()) {
  if (mode === 'disabled') return null;
  if (mode === 'local') return nodemailer.createTransport({ host: '127.0.0.1', port: Number(process.env.LOCAL_SMTP_PORT || 1025), secure: false, ignoreTLS: true, connectionTimeout: 5000, socketTimeout: 15000, disableFileAccess: true, disableUrlAccess: true });
  // Keep the existing external-mail queue mode; the provider selects its protocol.
  if (process.env.MAIL_PROVIDER === 'azure') return createAzureMailTransport();
  if (process.env.MAIL_PROVIDER && process.env.MAIL_PROVIDER !== 'smtp') throw Object.assign(new Error('Unsupported mail provider.'), { code: 'MAIL_PROVIDER_CONFIG' });
  if (!process.env.SMTP_HOST || !process.env.MAIL_FROM) throw new Error('Configure SMTP_HOST and MAIL_FROM for external mail.');
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true',
    requireTLS: process.env.SMTP_SECURE !== 'true',
    ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}),
    connectionTimeout: 10000, socketTimeout: 20000, disableFileAccess: true, disableUrlAccess: true,
  });
}

// Claim one committed message at a time, then release the DB lock before SMTP.
// SMTP reuses Message-ID. Neither provider guarantees exactly-once delivery after an ambiguous connection loss.
export async function deliverPendingBookingEmails(pool, { transport, mode = mailMode(), limit = 10 } = {}) {
  if (mode === 'disabled') return 0;
  const sender = transport || createMailTransport(mode);
  let delivered = 0;
  for (let i = 0; i < limit; i++) {
    const c = await pool.getConnection();
    let row;
    try {
      await c.beginTransaction();
      [[row]] = await c.execute(`SELECT * FROM booking_email_outbox WHERE delivery_mode=? AND
        ((status='Pending' AND next_attempt_at<=NOW()) OR (status='Sending' AND locked_at<DATE_SUB(NOW(),INTERVAL 5 MINUTE)))
        ORDER BY email_id LIMIT 1 FOR UPDATE SKIP LOCKED`, [mode]);
      if (row) await c.execute("UPDATE booking_email_outbox SET status='Sending',locked_at=NOW(),attempts=attempts+1 WHERE email_id=?", [row.email_id]);
      await c.commit();
    } catch (error) { await c.rollback(); throw error; }
    finally { c.release(); }
    if (!row) break;
    try {
      const info = await sender.sendMail({
        from: mode === 'local' ? 'CoolCare Demo <bookings@coolcare.test>' : process.env.MAIL_FROM,
        to: { address: row.recipient }, subject: row.subject, text: row.body_text, html: row.body_html, messageId: row.message_id,
      });
      if (!info.accepted?.length) throw Object.assign(new Error('Recipient not accepted.'), { code: 'RECIPIENT_REJECTED' });
      await pool.execute("UPDATE booking_email_outbox SET status='Sent',sent_at=NOW(),locked_at=NULL,last_error=NULL WHERE email_id=?", [row.email_id]);
      delivered++;
    } catch (error) {
      // Store a bounded error code, never SMTP credentials or server transcript.
      const errorCode = String(error.code || 'DELIVERY_FAILED').replace(/[^A-Z0-9_]/gi, '').slice(0, 80);
      const delay = Math.min(3600, 30 * 2 ** Math.min(Number(row.attempts), 7));
      await pool.execute("UPDATE booking_email_outbox SET status='Pending',locked_at=NULL,last_error=?,next_attempt_at=DATE_ADD(NOW(),INTERVAL ? SECOND) WHERE email_id=?", [errorCode, delay, row.email_id]);
    }
  }
  return delivered;
}

export function startBookingEmailWorker(pool) {
  let running = false;
  let stopped = false;
  let active = Promise.resolve();
  function tick() {
    if (running || stopped) return;
    running = true;
    active = deliverPendingBookingEmails(pool).catch(error => console.error('Booking mail worker:', error.code || error.name)).finally(() => { running = false; });
  }
  const interval = setInterval(tick, 5000);
  interval.unref();
  tick();
  return async () => { stopped = true; clearInterval(interval); await active; };
}
