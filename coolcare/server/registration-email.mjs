import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AppError } from './inventory.mjs';
import { createMailTransport, mailMode } from './booking-email.mjs';

export const registrationEmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(255));
export const registrationSchema = z.object({
  fullName: z.string().trim().min(1).max(120), email: registrationEmailSchema,
  phone: z.string().trim().min(3).max(30), propertyType: z.string().max(120).optional(),
  password: z.string().min(8).max(72).refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes.'), confirmPassword: z.string(),
  verificationId: z.string().regex(/^[a-f0-9]{48}$/, 'Request a new email verification code.'),
  emailCode: z.string().regex(/^\d{6}$/, 'Enter the six-digit email verification code.'),
}).refine(v => v.password === v.confirmPassword, 'Passwords do not match.');
const invalidCode = () => new AppError('The verification code is invalid, expired or already used. Request a new code if needed.', 400);
const sessionHash = sessionId => createHash('sha256').update(sessionId).digest('hex');
const digest = (secret, email, challengeId, code) => createHmac('sha256', secret).update(JSON.stringify([email, challengeId, code])).digest('hex');
export function matchesRegistrationCode(secret, row, email, code) {
  const hash = digest(secret, email, row.challenge_id, code);
  return typeof row.code_hash === 'string' && row.code_hash.length === hash.length &&
    timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(hash));
}

export function createRegistrationService(pool, { secret, now = Date.now, transportFactory = createMailTransport, getMode = mailMode } = {}) {
  if (!secret || secret.length < 32) throw new Error('Registration verification needs a server secret.');
  return {
    async requestCode(input, sessionId) {
      const { email } = z.object({ email: registrationEmailSchema }).parse(input);
      const mode = getMode();
      if (mode === 'disabled') throw new AppError('Email verification is temporarily unavailable. Please try again later.', 503);
      let sender;
      try { sender = transportFactory(mode); }
      catch { throw new AppError('Email verification is temporarily unavailable. Please try again later.', 503); }
      const timestamp = now(), challengeId = randomBytes(24).toString('hex');
      const code = String(randomInt(0, 1000000)).padStart(6, '0');
      const c = await pool.getConnection();
      try {
        await c.beginTransaction();
        // The unique email row serializes resends and limits across sessions/instances.
        await c.execute(`INSERT IGNORE INTO registration_email_verification(email,challenge_id,session_hash)
          VALUES (?,? ,?)`, [email, challengeId, sessionHash(sessionId)]);
        const [[row]] = await c.execute('SELECT * FROM registration_email_verification WHERE email=? FOR UPDATE', [email]);
        if (Number(row.next_send_at) > timestamp) throw new AppError('Please wait 60 seconds before requesting another code.', 429);
        const newWindow = timestamp - Number(row.window_started_at) >= 3600000;
        if (!newWindow && Number(row.send_count) >= 5) throw new AppError('Too many verification emails. Please try again in one hour.', 429);
        const [[existing]] = await c.execute('SELECT user_id FROM user_account WHERE email=?', [email]);
        if (existing) throw new AppError('An account with this email already exists. Please sign in.', 409);
        await c.execute(`UPDATE registration_email_verification SET challenge_id=?,session_hash=?,code_hash=?,expires_at=?,
          attempts=0,window_started_at=?,send_count=?,next_send_at=?,delivery_status='Sending' WHERE email=?`,
        [challengeId, sessionHash(sessionId), digest(secret, email, challengeId, code), timestamp + 600000,
          newWindow ? timestamp : Number(row.window_started_at), newWindow ? 1 : Number(row.send_count) + 1, timestamp + 60000, email]);
        await c.commit();
      } catch (error) { await c.rollback(); throw error; }
      finally { c.release(); }
      try {
        // Send directly: raw one-time codes must not be persisted in the mail outbox.
        const result = await sender.sendMail({
          from: mode === 'local' ? 'CoolCare Demo <bookings@coolcare.test>' : process.env.MAIL_FROM,
          to: { address: email }, subject: 'Verify your CoolCare email address',
          text: `Your CoolCare verification code is: ${code}\n\nIt expires in 10 minutes. Enter it on the registration page to create your account. Never share this code. If you did not request it, ignore this email.`,
          html: `<div style="font:16px Arial,sans-serif;color:#172b4d"><h1>Verify your CoolCare email</h1><p>Your verification code is:</p><p style="font-size:28px;letter-spacing:6px;font-weight:bold">${code}</p><p>It expires in 10 minutes. Enter it on the registration page to create your account.</p><p>Never share this code. If you did not request it, ignore this email.</p></div>`,
        });
        if (!result?.accepted?.includes(email)) throw new Error('Email not accepted');
        const [updated] = await pool.execute("UPDATE registration_email_verification SET delivery_status='Ready' WHERE email=? AND challenge_id=? AND delivery_status='Sending'", [email, challengeId]);
        if (updated.affectedRows !== 1) throw new Error('Challenge replaced');
      } catch {
        await pool.execute("UPDATE registration_email_verification SET delivery_status='Failed',code_hash=NULL WHERE email=? AND challenge_id=?", [email, challengeId]);
        throw new AppError('The verification email could not be sent. Please wait 60 seconds and try again.', 503);
      }
      // Opportunistic bounded removal; never delete an unexpired challenge or active rate window.
      try { await pool.execute('DELETE FROM registration_email_verification WHERE expires_at<? AND window_started_at<? LIMIT 100', [timestamp - 86400000, timestamp - 86400000]); }
      catch (error) { console.error('Registration cleanup:', error.code || error.name); }
      return { success: true, verificationId: challengeId, expiresIn: 600, resendAfter: 60 };
    },

    async register(input, sessionId) {
      const d = registrationSchema.parse(input), c = await pool.getConnection();
      let failure, user;
      try {
        await c.beginTransaction();
        const [[row]] = await c.execute('SELECT * FROM registration_email_verification WHERE email=? FOR UPDATE', [d.email]);
        if (!row || row.challenge_id !== d.verificationId || row.session_hash !== sessionHash(sessionId) ||
            row.delivery_status !== 'Ready' || Number(row.expires_at) <= now() || Number(row.attempts) >= 5) {
          throw invalidCode();
        }
        if (!matchesRegistrationCode(secret, row, d.email, d.emailCode)) {
          await c.execute('UPDATE registration_email_verification SET attempts=attempts+1 WHERE email=?', [d.email]);
          // Commit incorrect attempts; rolling them back would allow unlimited guessing.
          failure = invalidCode();
        } else {
          const hash = await bcrypt.hash(d.password, 12);
          const [[role]] = await c.query("SELECT role_id FROM role WHERE role_name='Customer'");
          const [created] = await c.execute('INSERT INTO user_account(role_id,full_name,email,password_hash,phone) VALUES (?,?,?,?,?)', [role.role_id, d.fullName, d.email, hash, d.phone]);
          await c.execute('INSERT INTO customer(user_id) VALUES (?)', [created.insertId]);
          await c.execute('INSERT INTO web_customer_profile(user_id,property_type) VALUES (?,?)', [created.insertId, d.propertyType || null]);
          await c.execute("UPDATE registration_email_verification SET delivery_status='Consumed',code_hash=NULL WHERE email=?", [d.email]);
          user = { id: created.insertId, fullName: d.fullName, email: d.email };
        }
        await c.commit();
      } catch (error) {
        await c.rollback();
        if (error.code === 'ER_DUP_ENTRY') throw new AppError('An account with this email already exists. Please sign in.', 409);
        throw error;
      } finally { c.release(); }
      if (failure) throw failure;
      return { success: true, user };
    },
  };
}
