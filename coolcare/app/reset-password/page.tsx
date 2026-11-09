'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { KeyRound, Snowflake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/components/public-site/api';

export default function ResetPasswordPage() {
  const token = useRef('');
  const initialized = useRef(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const fragment = window.location.hash.slice(1);
    if (/^[a-f0-9]{64}$/.test(fragment)) token.current = fragment;
    else setError('This reset link is incomplete. Request a new link from the sign-in page.');
    // Keep the token in memory only, removing it from the address bar/history.
    window.history.replaceState(window.history.state, '', window.location.pathname);
    setReady(true);
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (password !== confirmation) { setError('Passwords do not match.'); return; }
    setSaving(true);
    try {
      const response = await apiFetch('/api/public/account/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.current, newPassword: password, confirmPassword: confirmation }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) { setError(data?.error || 'Unable to reset your password. Please try again.'); return; }
      token.current = ''; setPassword(''); setConfirmation(''); setSuccess(true);
    } catch { setError('Unable to connect. Check your connection and try again.'); }
    finally { setSaving(false); }
  }
  return <main className="min-h-screen bg-[linear-gradient(145deg,#eef5ff,#f3fffd)] px-4 py-10 sm:py-16">
    <div className="mx-auto max-w-lg">
      <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-2xl font-bold text-primary"><Snowflake aria-hidden />CoolCare</Link>
      <Card className="rounded-3xl shadow-xl">
        <CardHeader className="space-y-3">
          <KeyRound className="size-8 text-primary" aria-hidden />
          <CardTitle className="text-2xl">{success ? 'Password reset successfully' : 'Set a new password'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {!ready && <p role="status">Opening your reset link��</p>}
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-800">{error}</p>}
          {success ? <p role="status" className="text-sm leading-6">Your password has been updated and previous sign-in sessions have been signed out. Sign in again using your new password.</p> : ready && token.current && <>
            <p className="text-sm leading-6 text-muted-foreground">Use at least 8 characters. Your reset link expires 30 minutes after it was requested and works once.</p>
            <form onSubmit={submit}>
              <fieldset disabled={saving} className="min-w-0 space-y-4">
                <div className="space-y-2"><label htmlFor="reset-new-password" className="text-sm font-medium">New password</label>
                  <Input id="reset-new-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={password} onChange={event => setPassword(event.target.value)} className="min-h-11" /></div>
                <div className="space-y-2"><label htmlFor="reset-confirm-password" className="text-sm font-medium">Confirm new password</label>
                  <Input id="reset-confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={confirmation} onChange={event => setConfirmation(event.target.value)} className="min-h-11" /></div>
                <Button type="submit" className="min-h-11 w-full" disabled={saving}>{saving ? 'Saving��' : 'Reset password'}</Button>
              </fieldset>
            </form>
          </>}
          <Link href="/#/login" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4">Back to sign in</Link>
        </CardContent>
      </Card>
    </div>
  </main>;
}
