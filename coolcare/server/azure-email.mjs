// Server-only adapter. Credentials and provider responses must never reach logs.
export function createAzureMailTransport({ connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING, senderAddress = process.env.MAIL_FROM, clientFactory } = {}) {
  if (!connectionString || !senderAddress || !/^[^\s<>@]+@[^\s<>@]+$/.test(senderAddress)) {
    throw Object.assign(new Error('Configure the Azure connection string and a bare verified MAIL_FROM address.'), { code: 'AZURE_MAIL_CONFIG' });
  }
  let client;
  return {
    async sendMail(message) {
      try {
        client ||= clientFactory ? await clientFactory(connectionString) : new (await import('@azure/communication-email')).EmailClient(connectionString, { retryOptions: { maxRetries: 0 } });
        const poller = await client.beginSend({
          senderAddress,
          recipients: { to: [{ address: message.to.address }] },
          content: { subject: message.subject, plainText: message.text, html: message.html },
        }, { abortSignal: AbortSignal.timeout(60000) });
        const result = await poller.pollUntilDone({ abortSignal: AbortSignal.timeout(60000) });
        if (result.status !== 'Succeeded') throw new Error('Send operation did not succeed.');
        return { accepted: [message.to.address] };
      } catch {
        throw Object.assign(new Error('Azure email operation failed.'), { code: 'AZURE_MAIL_FAILED' });
      }
    },
  };
}
