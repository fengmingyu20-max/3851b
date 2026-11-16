import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { AppError, idSchema } from './inventory.mjs';
import { sessionUser } from './public-site.mjs';
import { memberSql } from './teams.mjs';

export async function normalizeReceipt(image) {
  const match = typeof image === 'string' && /^data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match || match[1].length > 7_000_000) throw new AppError('Choose a JPG or PNG receipt up to 5 MB.', 400);
  const bytes = Buffer.from(match[1], 'base64');
  if (bytes.length > 5 * 1024 * 1024 || bytes.length < 20) throw new AppError('Choose a JPG or PNG receipt up to 5 MB.', 400);
  try {
    const instance = sharp(bytes, { limitInputPixels: 20_000_000, failOn: 'warning' });
    const meta = await instance.metadata();
    if (!['png', 'jpeg'].includes(meta.format) || (meta.pages || 1) !== 1 || meta.width < 32 || meta.height < 32) throw new Error('Invalid image');
    // Decode and re-encode, discarding metadata and active/non-image content.
    const png = await instance.rotate().resize({ width: 2400, height: 3600, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#fff' }).png().toBuffer();
    if (png.length > 5 * 1024 * 1024) throw new Error('Image too large');
    return png;
  } catch { throw new AppError('Use a valid JPG/PNG receipt up to 5 MB and 20 megapixels.', 400); }
}

async function canReadBooking(pool, user, bookingId) {
  const [[booking]] = await pool.execute(`SELECT b.booking_id FROM booking b JOIN customer c ON c.customer_id=b.customer_id
    WHERE b.booking_id=? AND (?='Admin' OR (?='Customer' AND c.user_id=?) OR (?='Technician' AND EXISTS(
      SELECT 1 FROM work_order w JOIN assignment a ON a.assignment_id=w.assignment_id AND a.booking_id=w.booking_id
      JOIN technician t ON ${memberSql('a','t.technician_id')} WHERE w.booking_id=b.booking_id AND t.user_id=?
      AND a.assignment_status NOT IN ('Declined','Cancelled','Reassigned'))))`, [bookingId, user.role, user.role, user.id, user.role, user.id]);
  if (!booking) throw new AppError('Receipt not found.', 404);
}

export async function listServiceReceipts(pool, user, bookingId) {
  await canReadBooking(pool, user, bookingId);
  const [receipts] = await pool.execute('SELECT receipt_id AS receiptId,UNIX_TIMESTAMP(created_at) AS createdAtEpoch FROM service_receipt WHERE booking_id=? ORDER BY receipt_id DESC LIMIT 20', [bookingId]);
  return { receipts: receipts.map(r => ({ receiptId: r.receiptId, createdAt: new Date(Number(r.createdAtEpoch) * 1000).toISOString(), url: `/api/service-receipts/${r.receiptId}/image` })) };
}

export async function uploadServiceReceipt(pool, user, jobId, raw) {
  if (user.role !== 'Technician') throw new AppError('Technician access required.', 403);
  const data = z.object({ requestId: z.uuid(), image: z.string().max(7_000_100) }).strict().parse(raw);
  // Check access before decoding an expensive image; recheck under locks below.
  const [[identity]] = await pool.execute(`SELECT w.booking_id FROM work_order w JOIN assignment a ON a.assignment_id=w.assignment_id AND a.booking_id=w.booking_id
    JOIN technician t ON t.technician_id=a.technician_id WHERE w.job_id=? AND t.user_id=? AND a.assignment_status NOT IN ('Declined','Cancelled','Reassigned')`, [jobId, user.id]);
  if (!identity) throw new AppError('Work order not found.', 404);
  const png = await normalizeReceipt(data.image);
  const hash = createHash('sha256').update(`${user.id}:${jobId}:`).update(png).digest('hex');
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [[booking]] = await c.execute('SELECT booking_status FROM booking WHERE booking_id=? FOR UPDATE', [identity.booking_id]);
    const [[work]] = await c.execute(`SELECT w.current_status FROM work_order w JOIN assignment a ON a.assignment_id=w.assignment_id AND a.booking_id=w.booking_id
      JOIN technician t ON t.technician_id=a.technician_id WHERE w.job_id=? AND w.booking_id=? AND t.user_id=?
      AND a.assignment_status NOT IN ('Declined','Cancelled','Reassigned') FOR UPDATE`, [jobId, identity.booking_id, user.id]);
    if (!work) throw new AppError('Work order not found.', 404);
    const [[saved]] = await c.execute('SELECT receipt_id,payload_hash FROM service_receipt WHERE request_id=? FOR SHARE', [data.requestId]);
    if (saved) {
      if (saved.payload_hash !== hash) throw new AppError('This upload request was used for different content.', 409);
      await c.commit(); return { receiptId: saved.receipt_id, replayed: true };
    }
    if (booking?.booking_status !== 'Completed' || work.current_status !== 'Completed') throw new AppError('End the service before uploading its receipt.', 409);
    const [insert] = await c.execute('INSERT INTO service_receipt(booking_id,job_id,uploaded_by_user_id,request_id,payload_hash,image_bytes) VALUES (?,?,?,?,?,?)', [identity.booking_id, jobId, user.id, data.requestId, hash, png]);
    await c.commit(); return { receiptId: insert.insertId, replayed: false };
  } catch (error) { await c.rollback(); throw error; } finally { c.release(); }
}

export function registerServiceReceipts(app, pool) {
  app.get('/api/service-receipts/booking/:bookingId', async (req, res) => res.json(await listServiceReceipts(pool, await sessionUser(pool, req), idSchema.parse(req.params.bookingId))));
  app.post('/api/technician/jobs/:jobId/receipt', async (req, res) => res.status(201).json(await uploadServiceReceipt(pool, await sessionUser(pool, req), idSchema.parse(req.params.jobId), req.body)));
  app.get('/api/service-receipts/:receiptId/image', async (req, res) => {
    const user = await sessionUser(pool, req), receiptId = idSchema.parse(req.params.receiptId);
    const [[identity]] = await pool.execute('SELECT booking_id FROM service_receipt WHERE receipt_id=?', [receiptId]);
    if (!identity) throw new AppError('Receipt not found.', 404);
    await canReadBooking(pool, user, identity.booking_id);
    const [[receipt]] = await pool.execute('SELECT image_bytes FROM service_receipt WHERE receipt_id=?', [receiptId]);
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="CoolCare-receipt-${receiptId}.png"` });
    res.send(receipt.image_bytes);
  });
}
