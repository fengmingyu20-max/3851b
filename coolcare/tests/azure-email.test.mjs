import test from 'node:test';
import assert from 'node:assert/strict';
import { createAzureMailTransport } from '../server/azure-email.mjs';
const config = { connectionString: 'private-test-value', senderAddress: 'sender@example.invalid' };
const message = { to: { address: 'recipient@example.invalid' }, subject: 'Booking', text: 'Plain', html: '<p>HTML</p>' };
test('Azure adapter maps both bodies and requires successful operation', async () => {
  let captured;
  const transport = createAzureMailTransport({ ...config, clientFactory: async () => ({ beginSend: async payload => { captured = payload; return { pollUntilDone: async () => ({ status: 'Succeeded' }) }; } }) });
  assert.deepEqual(await transport.sendMail(message), { accepted: ['recipient@example.invalid'] });
  assert.equal(captured.senderAddress, config.senderAddress);
  assert.deepEqual(captured.content, { subject: 'Booking', plainText: 'Plain', html: '<p>HTML</p>' });
  assert.deepEqual(captured.recipients.to, [message.to]);
});
for (const status of ['Running', 'Failed', 'Canceled']) test(`Azure ${status} does not mark email accepted`, async () => {
  const transport = createAzureMailTransport({ ...config, clientFactory: () => ({ beginSend: async () => ({ pollUntilDone: async () => ({ status }) }) }) });
  await assert.rejects(transport.sendMail(message), { code: 'AZURE_MAIL_FAILED' });
});
test('Azure errors never expose credentials or provider response', async () => {
  const transport = createAzureMailTransport({ ...config, clientFactory: () => { throw new Error(config.connectionString); } });
  await assert.rejects(transport.sendMail(message), error => error.code === 'AZURE_MAIL_FAILED' && !error.message.includes(config.connectionString));
});
test('Azure requires explicit verified sender and connection string', () => {
  assert.throws(() => createAzureMailTransport({ connectionString: '', senderAddress: '' }), { code: 'AZURE_MAIL_CONFIG' });
});
