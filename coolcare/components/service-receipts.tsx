'use client';
import { useEffect, useRef, useState } from 'react';
import { Receipt, Upload, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

type Item = { receiptId: number; url: string; createdAt: string };
export function ServiceReceipts({ bookingId, jobId, canUpload = false, onBusy }: { bookingId: number; jobId?: number; canUpload?: boolean; onBusy?: (busy: boolean) => void }) {
  const [items, setItems] = useState<Item[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<Item | null>(null), [image, setImage] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null), pending = useRef<{ requestId: string; image: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch(`/api/service-receipts/booking/${bookingId}`, { signal: controller.signal, credentials: 'include' })
      .then(async response => { const data = await response.json() as { receipts: Item[]; error?: string }; if (!response.ok) throw new Error(data.error || 'Unable to load receipts.'); return data; })
      .then(data => { if (!controller.signal.aborted) setItems(data.receipts); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [bookingId, reload]);
  async function choose(file?: File) {
    setError(''); setNotice(''); setImage(''); pending.current = null;
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Choose a JPG or PNG receipt up to 5 MB.'); return; }
    setBusy(true); onBusy?.(true);
    try {
      const value = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Unable to read this file.')); reader.readAsDataURL(file); });
      setImage(value); pending.current = { requestId: crypto.randomUUID(), image: value };
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to read this file.'); }
    finally { setBusy(false); onBusy?.(false); }
  }
  async function upload() {
    if (!pending.current || !jobId) return;
    setBusy(true); onBusy?.(true); setError(''); setNotice('');
    try {
      const sessionResponse = await fetch('/api/session', { credentials: 'include' });
      if (!sessionResponse.ok) throw new Error('Unable to start a session. Sign in and retry.');
      const session = await sessionResponse.json() as { csrf: string };
      const response = await fetch(`/api/technician/jobs/${jobId}/receipt`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf }, body: JSON.stringify(pending.current) });
      const data = await response.json() as { error?: string }; if (!response.ok) throw new Error(data.error || 'Unable to upload receipt.');
      pending.current = null; setImage(''); if (fileInput.current) fileInput.current.value = '';
      setNotice('Receipt uploaded. The customer can now view and download it.'); setReload(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed. Retry with the same file.'); }
    finally { setBusy(false); onBusy?.(false); }
  }
  return <section className="my-5 rounded-xl border border-border bg-card p-4" aria-label="Bills and receipts">
    <h3 className="mb-2 flex items-center gap-2 font-semibold"><Receipt className="size-5" />Bills &amp; receipts</h3>
    <p className="mb-3 text-sm text-muted-foreground">Receipts for payments made offline. Uploading a receipt does not verify payment or change the order amount.</p>
    {loading ? <p role="status">Loading receipts��</p> : items.length ? <div className="space-y-2">{items.map((item, index) => <div key={item.receiptId} className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={() => setSelected(item)}>{index === 0 ? 'View bill / receipt' : `View earlier receipt #${item.receiptId}`}</Button>
      <span className="text-xs text-muted-foreground">{new Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))} SGT</span>
    </div>)}</div> : <p className="text-sm text-muted-foreground">No receipt has been uploaded yet.</p>}
    {canUpload && <div className="mt-4 space-y-2"><label className="block text-sm font-medium">Upload receipt photo (JPG/PNG, up to 5 MB)<Input ref={fileInput} className="mt-1" type="file" accept="image/jpeg,image/png" disabled={busy} onChange={event => void choose(event.target.files?.[0])} /></label>
      {items.length > 0 && <p className="text-xs text-muted-foreground">A new upload becomes the latest receipt. Earlier receipts remain available.</p>}
      <Button onClick={() => void upload()} disabled={busy || !image}><Upload className="size-4" />{busy ? 'Uploading��' : 'Upload receipt'}</Button></div>}
    {notice && <p role="status" className="mt-3 text-sm">{notice}</p>}
    {error && <div className="mt-3"><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="ghost" disabled={busy} onClick={() => setReload(v => v + 1)}>Reload receipts</Button></div>}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogTitle>Bill / receipt</DialogTitle><DialogDescription>Uploaded receipt for this booking. Payments are handled offline.</DialogDescription>
      {selected && <><img src={selected.url} alt={`Uploaded receipt ${selected.receiptId}`} className="h-auto w-full rounded-lg border" /><Button nativeButton={false} render={<a href={`${selected.url}?download=1`} />} variant="outline"><Download className="size-4" />Download receipt</Button></>}
    </DialogContent></Dialog>
  </section>;
}
