import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { normalizeReceipt, uploadServiceReceipt } from '../server/service-receipts.mjs';

test('receipts decode to safe PNG pixels and reject non-image uploads', async () => {
  const input = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#fff' } }).jpeg().toBuffer();
  const result = await normalizeReceipt('data:image/jpeg;base64,' + input.toString('base64'));
  assert.equal((await sharp(result).metadata()).format, 'png');
  for (const image of ['data:text/html;base64,PHNjcmlwdD4=', 'data:application/pdf;base64,JVBERg==', 'data:image/png;base64,PHNjcmlwdD4=', 'https://example.com/receipt.png']) {
    await assert.rejects(normalizeReceipt(image), e => e.status === 400);
  }
});
test('non-technicians and unassigned technicians cannot upload a receipt', async () => {
  await assert.rejects(uploadServiceReceipt({}, { role: 'Customer', id: 1 }, 1, {}), e => e.status === 403);
  await assert.rejects(uploadServiceReceipt({ execute: async () => [[]] }, { role: 'Technician', id: 1 }, 1, { requestId: '9d62b790-267d-4bdb-8464-8010f1cbf0c8', image: '' }), e => e.status === 404);
});
