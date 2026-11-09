import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '../api';

export function ForgotPasswordDialog({ initialEmail = '', onClose }: { initialEmail?: string; onClose: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const update = () => setSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    update();
    if (!resendAt) return;
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [resendAt]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSending(true); setMessage(''); setError('');
    try {
      const response = await apiFetch('/api/public/account/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        setError(data?.error || 'Unable to request a reset link. Please try again shortly.');
        if (response.status === 429) setResendAt(Date.now() + 60000);
        return;
      }
      setMessage(data.message);
      setResendAt(Date.now() + data.resendAfter * 1000);
    } catch { setError('Unable to connect. Check your connection and try again.'); }
    finally { setSending(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="ac-site max-h-[85dvh] overflow-y-auto rounded-2xl bg-ac-surface p-6" aria-describedby="forgot-password-help">
      <DialogTitle className="pr-6 text-lg font-bold text-ac-on-background">Forgot your password?</DialogTitle>
      <p id="forgot-password-help" className="text-sm leading-6 text-ac-on-surface-variant">Enter your account email to request a reset link. The link expires in 30 minutes and works once.</p>
      {error && <p role="alert" className="rounded-lg bg-ac-error-container p-3 text-sm text-ac-on-error-container">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-ac-primary-fixed/40 p-3 text-sm leading-6 text-ac-on-surface">{message}</p>}
      <form onSubmit={submit}>
        <fieldset disabled={sending} className="min-w-0 space-y-4">
          <div className="space-y-2">
            <label htmlFor="forgot-email" className="text-sm font-medium">Account email</label>
            <Input id="forgot-email" type="email" autoComplete="email" required maxLength={255} value={email}
              onChange={event => { setEmail(event.target.value); setMessage(''); setError(''); }} placeholder="name@example.com" className="min-h-11" />
          </div>
          <Button type="submit" disabled={sending || seconds > 0} className="min-h-11 w-full whitespace-normal bg-ac-primary text-ac-on-primary">
            {sending ? 'Requesting link��' : seconds > 0 ? `Request again in ${seconds}s` : 'Send reset link'}
          </Button>
        </fieldset>
      </form>
      <Button variant="outline" type="button" onClick={onClose} className="min-h-11">Back to sign in</Button>
    </DialogContent>
  </Dialog>;
}
