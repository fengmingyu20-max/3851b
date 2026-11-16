import test from 'node:test';
import assert from 'node:assert/strict';
import { annualExpiryDue, annualExpiryKey } from '../server/annual-expiry-policy.mjs';
import { buildAnnualExpiryMail } from '../server/annual-expiry-reminders.mjs';
const plan = { seriesId: 42, name: '<script>Annual cleaning</script>', customerName: 'Customer <img>', email: 'customer@example.test', status: 'Active', canRenew: true, validUntil: '2026-11-20', visits: [{}, {}, {}, {}] };
test('expiry reminders cover the final seven Singapore calendar days without reminding renewed or closed plans', () => {
  assert.equal(annualExpiryDue(plan, new Date('2026-11-12T01:00:00Z')), false);
  assert.equal(annualExpiryDue(plan, new Date('2026-11-13T01:00:00Z')), true);
  assert.equal(annualExpiryDue(plan, new Date('2026-11-19T15:59:59Z')), true);
  assert.equal(annualExpiryDue(plan, new Date('2026-11-19T16:00:00Z')), false);
  for (const patch of [{ status: 'Cancelled' }, { status: 'Expired' }, { existingRenewalSeriesId: 43 }, { canRenew: false }, { visits: [] }]) assert.equal(annualExpiryDue({ ...plan, ...patch }, new Date('2026-11-13T01:00:00Z')), false);
  assert.equal(annualExpiryDue({ ...plan, status: 'Completed' }, new Date('2026-11-13T01:00:00Z')), true);
});
test('expiry snapshot identity and email reflect the real plan term without promising a charge or promotion', () => {
  assert.equal(annualExpiryKey(plan), annualExpiryKey({ ...plan }));
  assert.notEqual(annualExpiryKey(plan), annualExpiryKey({ ...plan, validUntil: '2026-11-21' }));
  assert.notEqual(annualExpiryKey(plan), annualExpiryKey({ ...plan, email: 'new@example.test' }));
  const mail = buildAnnualExpiryMail(plan);
  assert.match(mail.text, /20 Nov 2026/); assert.match(mail.text, /no automatic renewal or charge/);
  assert.doesNotMatch(mail.html, /<script>|<img>/);
});
