'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';

type App = { identifier: string; title: string; description: string };
type Connection = { id: string; identifier: string; name: string };
const control = 'w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#D5FF7A]';
export function IntegrationsCatalog() {
  const api = useFetch(); const user = useUser(); const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<App | null>(null); const [keyId, setKeyId] = useState(''); const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  async function request(path: string, method = 'GET', body?: unknown) {
    const res = await api(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.message === 'string' ? data.message : 'La demande n’a pas abouti.');
    return data;
  }
  const apps = useSWR<App[]>([user?.orgId, 'creative-integrations-catalog'], () => request('/third-party/list'));
  const connections = useSWR<Connection[]>([user?.orgId, 'creative-integrations-connections'], () => request('/third-party'));
  function close() { dialog.current?.close(); setKeyId(''); setSecret(''); setSelected(null); }
  function open(app: App) { setSelected(app); setError(''); setKeyId(''); setSecret(''); dialog.current?.showModal(); }
  async function connect(event: React.FormEvent) {
    event.preventDefault(); if (!selected || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const apiKey = selected.identifier === 'higgsfield' ? `${keyId.trim()}:${secret.trim()}` : secret.trim();
      await request(`/third-party/${selected.identifier}`, 'POST', { api: apiKey });
      close(); await connections.mutate(); setNotice('Connexion enregistrée. Aucune création n’a été commandée.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Connexion impossible.'); }
    finally { setBusy(false); }
  }
  async function disconnect(item: Connection) {
    if (busy || !window.confirm('Déconnecter cette application ? Les médias sont conservés et les tâches déjà acceptées par le fournisseur ne sont pas annulées.')) return;
    setBusy(true); setError('');
    try { await request(`/third-party/${item.id}`, 'DELETE'); await connections.mutate(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Déconnexion impossible.'); }
    finally { setBusy(false); }
  }
  return <main className="min-w-0 flex-1 overflow-auto bg-newBgColorInner p-6 text-textColor md:p-9">
    <div className="mx-auto max-w-6xl space-y-8">
      <header><p className="text-xs uppercase tracking-[.22em] text-[#D5FF7A]">Caléonis Marketing</p><h1 className="mt-3 text-3xl font-semibold">Intégrations</h1><p className="mt-3 max-w-2xl text-sm opacity-65">Connectez vos applications. Les créations se préparent dans le Studio, accessible depuis Médias.</p></header>
      <nav className="flex flex-wrap gap-3 text-sm"><Link href="/media" className="rounded-xl border border-white/15 px-4 py-3">Médias</Link><Link href="/media/studio" className="rounded-xl border border-white/15 px-4 py-3">Ouvrir le Studio créatif →</Link><Link href="/launches" className="rounded-xl border border-white/15 px-4 py-3">Comptes sociaux et calendrier</Link></nav>
      {(error || apps.error || connections.error) && <p role="alert" className="rounded-xl border border-red-400/40 p-4 text-sm">{error || 'Chargement des intégrations impossible.'} <button className="underline" onClick={() => { void apps.mutate(); void connections.mutate(); }}>Réessayer</button></p>}
      {notice && <p role="status" className="text-sm text-[#D5FF7A]">{notice}</p>}
      {(apps.isLoading || connections.isLoading) && <p role="status">Chargement des applications…</p>}
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Catalogue des applications">
        {(Array.isArray(apps.data) ? apps.data : []).map(app => {
          const linked = (Array.isArray(connections.data) ? connections.data : []).filter(item => item.identifier === app.identifier);
          return <article key={app.identifier} className="flex flex-col rounded-2xl border border-white/10 bg-black/10 p-6">
            <div className="flex items-center justify-between"><span aria-hidden="true" className="flex size-11 items-center justify-center rounded-xl border border-white/15 text-xl">{app.title.slice(0, 1)}</span><span className="text-xs opacity-65">{linked.length ? `${linked.length} connexion${linked.length > 1 ? 's' : ''}` : 'Non connectée'}</span></div>
            <h2 className="mt-5 text-xl font-semibold">{app.title}</h2><p className="mt-3 flex-1 text-sm leading-relaxed opacity-65">{app.description}</p>
            <button type="button" onClick={() => open(app)} disabled={busy} className="mt-6 rounded-xl bg-[#D5FF7A] px-4 py-3 text-sm font-semibold text-black disabled:opacity-40">{linked.length ? 'Ajouter / remplacer une clé' : 'Connecter'}</button>
            {linked.map(item => <div key={item.id} className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs"><span className="truncate">{item.name}</span><button type="button" disabled={busy} className="underline" onClick={() => void disconnect(item)}>Déconnecter</button></div>)}
          </article>;
        })}
      </section>
      <p className="border-t border-white/10 pt-5 text-xs leading-relaxed opacity-55">Une connexion n’inclut pas l’abonnement ou les crédits API du fournisseur. Higgsfield est facultatif ; ses réglages de création ne sont pas placés dans cet écran.</p>
    </div>
    <dialog ref={dialog} onCancel={close} aria-labelledby="integration-title" className="w-[min(92vw,520px)] rounded-2xl border border-white/15 bg-[#1A1919] p-7 text-white backdrop:bg-black/65">
      <div className="flex items-center justify-between gap-4"><h2 id="integration-title" className="text-xl font-semibold">Connecter {selected?.title}</h2><button type="button" aria-label="Fermer" onClick={close} disabled={busy}>✕</button></div>
      <form onSubmit={connect} className="mt-6 space-y-5">
        {selected?.identifier === 'higgsfield' && <label className="block text-sm">Key ID<input autoComplete="off" required className={`${control} mt-2`} value={keyId} onChange={event => setKeyId(event.target.value)} maxLength={250} /></label>}
        <label className="block text-sm">{selected?.identifier === 'higgsfield' ? 'Key Secret' : 'Clé API'}<input type="password" autoComplete="new-password" required className={`${control} mt-2`} value={secret} onChange={event => setSecret(event.target.value)} maxLength={2000} /></label>
        <p className="text-xs leading-relaxed opacity-60">Les identifiants sont envoyés à notre serveur pour vérifier et enregistrer la connexion. Ne saisissez pas le mot de passe de votre compte web.</p>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <button disabled={busy} type="submit" className="w-full rounded-xl bg-[#D5FF7A] px-4 py-3 font-semibold text-black disabled:opacity-50">{busy ? 'Vérification…' : 'Enregistrer la connexion'}</button>
      </form>
    </dialog>
  </main>;
}
