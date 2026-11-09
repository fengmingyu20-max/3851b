import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AppError } from './inventory.mjs';
import { credentialFingerprint, newPasswordSchema } from './account-password.mjs';
import { createMailTransport, mailMode } from './booking-email.mjs';

export const resetRequestSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email().max(255)) }).strict();
export const resetPasswordSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, 'This reset link is invalid. Request a new one.'),
  newPassword: newPasswordSchema, confirmPassword: z.string() }).strict()
  .refine(v => v.newPassword === v.confirmPassword, 'Passwords do not match.');
export const resetRequestMessage = 'If an active account uses this email, a password reset link will be sent. Check your inbox and spam folder.';
const tokenHash = value => createHash('sha256').update(value).digest('hex');
const invalidLink = () => new AppError('This reset link is invalid, expired or already used. Request a new link from the sign-in page.', 400);
export function resetLink(origin, token) {
  const url = new URL('/reset-password', origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid reset origin');
  // A fragment is not sent in HTTP requests or Referer headers.
  url.hash = token;
  return url.href;
}

export function createPasswordResetService(pool, { origin = 'http://localhost:3000', now = Date.now, transportFactory = createMailTransport, getMode = mailMode } = {}) {
  const pending = new Set();
  async function deliver(userId, hash, email, token, mode) {
    try {
      const url = resetLink(origin, token);
      const sender = transportFactory(mode);
      const info = await sender.sendMail({
        from: mode === 'local' ? 'CoolCare Demo <bookings@coolcare.test>' : process.env.MAIL_FROM,
        to: { address: email }, subject: 'Reset your CoolCare password',
        text: `A password reset was requested for your CoolCare account.\n\nSet a new password using this link within 30 minutes:\n${url}\n\nThis link works once. If you did not request this, ignore this email. Your current password has not changed. Never share this link.`,
        html: `<div style="font:16px Arial,sans-serif;color:#172b4d;max-width:600px"><h1>Reset your CoolCare password</h1><p>A password reset was requested for your account.</p><p><a href="${url}" style="display:inline-block;padding:12px 18px;background:#003f87;color:white;border-radius:8px">Set a new password</a></p><p>This link expires in 30 minutes and works once.</p><p>If you did not request this, ignore this email. Your current password has not changed. Never share this link.</p></div>`,
      });
      if (!info?.accepted?.includes(email)) throw new Error('Email not accepted');
      await pool.execute("UPDATE password_reset_token SET delivery_status='Ready' WHERE user_id=? AND token_hash=? AND delivery_status='Sending'", [userId, hash]);
    } catch {
      try { await pool.execute("UPDATE password_reset_token SET delivery_status='Failed',token_hash=NULL WHERE user_id=? AND token_hash=?", [userId, hash]); }
      catch { /* No credentials, tokens or recipient addresses in logs. */ }
      console.error('Password reset mail delivery failed.');
    }
  }
  return {
    async request(raw) {
      const { email } = resetRequestSchema.parse(raw);
      const response = { success: true, message: resetRequestMessage, resendAfter: 60 };
      const mode = getMode();
      if (mode === 'disabled') return response;
      let c;
      try {
        const [[account]] = await pool.execute("SELECT user_id,password_hash FROM user_account WHERE email=? AND status='Active'", [email]);
        if (!account) return response;
        const timestamp = now(), token = randomBytes(32).toString('hex'), hash = tokenHash(token);
        c = await pool.getConnection(); await c.beginTransaction();
        await c.execute(`INSERT IGNORE INTO password_reset_token(user_id,email,credential_fingerprint) VALUES (?,?,?)`, [account.user_id, email, credentialFingerprint(account.password_hash)]);
        const [[row]] = await c.execute('SELECT * FROM password_reset_token WHERE user_id=? FOR UPDATE', [account.user_id]);
        const newWindow = timestamp - Number(row.window_started_at) >= 3600000;
        if (Number(row.next_send_at) > timestamp || (!newWindow && Number(row.send_count) >= 5)) {
          await c.rollback(); return response;
        }
        await c.execute(`UPDATE password_reset_token SET email=?,token_hash=?,credential_fingerprint=?,expires_at=?,window_started_at=?,send_count=?,next_send_at=?,delivery_status='Sending' WHERE user_id=?`,
          [email, hash, credentialFingerprint(account.password_hash), timestamp + 1800000, newWindow ? timestamp : Number(row.window_started_at),
            newWindow ? 1 : Number(row.send_count) + 1, timestamp + 60000, account.user_id]);
        await c.commit();
        // Send after committing, without waiting for provider timing in the public response.
        // Raw tokens exist only in this short-lived task and the email, not in the outbox.
        const task = Promise.resolve().then(() => deliver(account.user_id, hash, email, token, mode));
        pending.add(task); void task.finally(() => pending.delete(task));
      } catch {
        if (c) await c.rollback().catch(() => {});
        console.error('Password reset request could not be prepared.');
        // Existing/unknown/inactive/throttled/failed requests all use the same response.
      } finally { c?.release(); }
      return response;
    },
    async reset(raw) {
      const d = resetPasswordSchema.parse(raw), c = await pool.getConnection();
      try {
        await c.beginTransaction();
        const hash = tokenHash(d.token);
        const [[row]] = await c.execute('SELECT * FROM password_reset_token WHERE token_hash=? FOR UPDATE', [hash]);
        if (!row || row.delivery_status !== 'Ready' || Number(row.expires_at) <= now()) throw invalidLink();
        const [[account]] = await c.execute("SELECT password_hash,email FROM user_account WHERE user_id=? AND status='Active' FOR UPDATE", [row.user_id]);
        if (!account || account.email.toLowerCase() !== row.email || credentialFingerprint(account.password_hash) !== row.credential_fingerprint) throw invalidLink();
        if (await bcrypt.compare(d.newPassword, account.password_hash)) throw new AppError('Choose a different password.', 400);
        const nextHash = await bcrypt.hash(d.newPassword, 12);
        const [updated] = await c.execute("UPDATE user_account SET password_hash=? WHERE user_id=? AND password_hash=? AND status='Active'", [nextHash, row.user_id, account.password_hash]);
        if (updated.affectedRows !== 1) throw invalidLink();
        await c.execute("UPDATE password_reset_token SET delivery_status='Consumed',token_hash=NULL WHERE user_id=?", [row.user_id]);
        await c.commit();
        return { userId: row.user_id };
      } catch (error) { await c.rollback(); throw error; }
      finally { c.release(); }
    },
    async drain() { await Promise.allSettled([...pending]); },
  };
}
