'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

type Connection = { id: string; identifier: string; name: string };
type Job = { id: string; status: string; requestId?: string; message?: string; media?: { id: string; path: string } };
const pending = ['submitting', 'queued', 'in_progress'];
const labels: Record<string, string> = { submitting: 'Envoi de la demande', queued: 'Dans la file Higgsfield', in_progress: 'Création en cours', completed: 'Visuel prêt', failed: 'Création échouée', nsfw: 'Brief refusé par la modération', cancelled: 'Création annulée', unknown: 'État à vérifier chez Higgsfield' };
const field = 'w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#D5FF7A]';
const button = 'inline-flex items-center justify-center rounded-xl bg-[#D5FF7A] px-5 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40';

export function CreativeApps() {
  const api = useFetch();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [prompt, setPrompt] = useState('');
  const [resolution, setResolution] = useState('1k');
  const [ratio, setRatio] = useState('1:1');
  const [consent, setConsent] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [selected, setSelected] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const pollingStarted = useRef(Date.now());

  async function request(path: string, data?: unknown, method?: string) {
    const response = await api(path, { method: method || (data === undefined ? 'GET' : 'POST'), ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof body.message === 'string' ? body.message : 'La demande n’a pas abouti. Réessayez sans relancer de génération payante.');
    return body;
  }
  const { data: connections, mutate, error: loadError, isLoading } = useSWR<Connection[]>('third-party', () => request('/third-party'), { revalidateOnFocus: false });
  const higgsfield = (Array.isArray(connections) ? connections : []).filter(item => item.identifier === 'higgsfield');
  const active = higgsfield.find(item => item.id === selected) || higgsfield[0];
  const connectionId = active?.id;
  const storageKey = connectionId ? `caleonis:higgsfield:job:${connectionId}` : '';

  useEffect(() => {
    setJob(null); setError(''); pollingStarted.current = Date.now();
    if (!storageKey) return;
    try {
      const id = sessionStorage.getItem(storageKey);
      if (id && /^[a-f0-9-]{36}$/i.test(id)) setJob({ id, status: 'submitting' });
    } catch { /* Browser storage can be disabled. No credentials are stored here. */ }
  }, [storageKey]);

  async function refreshJob() {
    if (!connectionId || !job) return;
    try {
      const result = await request(`/third-party/function/${connectionId}/generationStatus`, { jobId: job.id });
      setJob(result); setError('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Impossible de lire le suivi.'); }
  }
  useEffect(() => {
    if (!connectionId || !job || !pending.includes(job.status) || Date.now() - pollingStarted.current > 15 * 60 * 1000) return;
    const timer = setTimeout(() => { void refreshJob(); }, 5000);
    return () => clearTimeout(timer);
  }, [connectionId, job]);

  function closeConnection() { dialog.current?.close(); setKeyId(''); setKeySecret(''); }
  async function connect(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await request('/third-party/higgsfield', { api: `${keyId.trim()}:${keySecret.trim()}` });
      closeConnection(); await mutate(); setNotice('Higgsfield connecté. Aucune génération payante n’a été lancée.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Connexion impossible.'); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    if (!connectionId || !window.confirm('Déconnecter ce compte Higgsfield ? Les tâches déjà acceptées chez Higgsfield ne seront pas annulées.')) return;
    setBusy(true); setError('');
    try { await request(`/third-party/${connectionId}`, undefined, 'DELETE'); setJob(null); await mutate(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Déconnexion impossible.'); }
    finally { setBusy(false); }
  }
  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (!connectionId || !consent || busy || job) return;
    const clientRequestId = crypto.randomUUID();
    setBusy(true); setError(''); setNotice(''); pollingStarted.current = Date.now();
    try { sessionStorage.setItem(storageKey, clientRequestId); } catch {}
    setJob({ id: clientRequestId, status: 'submitting' });
    try {
      setJob(await request(`/third-party/function/${connectionId}/startImage`, { clientRequestId, prompt, resolution, aspect_ratio: ratio, confirmPaidGeneration: consent }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Réponse non confirmée. Consultez le suivi avant de recréer.');
      setJob({ id: clientRequestId, status: 'unknown' });
    } finally { setBusy(false); }
  }
  async function importImage() {
    if (!connectionId || !job || busy) return;
    setBusy(true); setError('');
    try {
      const media = await request(`/third-party/${connectionId}/submit`, { jobId: job.id });
      setJob({ ...job, media }); setNotice('Le visuel est enregistré dans votre médiathèque. Aucune publication n’a été effectuée.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Import impossible. La génération n’a pas été relancée.'); }
    finally { setBusy(false); }
  }
  function resetJob() {
    if (job && pending.includes(job.status)) return;
    if (job?.status === 'unknown' && !window.confirm('Avez-vous vérifié votre console Higgsfield ? Une nouvelle création pourrait entraîner une deuxième facturation.')) return;
    try { sessionStorage.removeItem(storageKey); } catch {}
    setJob(null); setConsent(false); setError(''); setNotice('');
  }

  return (
    <main className="flex-1 min-w-0 overflow-auto bg-newBgColorInner p-6 text-textColor md:p-9">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="mb-2 text-xs uppercase tracking-[0.22em] text-[#D5FF7A]">Caléonis Marketing</p><h1 className="text-3xl font-semibold tracking-tight">Vos apps créatives</h1><p className="mt-3 max-w-2xl text-sm opacity-60">Votre studio intégré reste le point de départ. Connectez vos outils préférés lorsque votre campagne demande un rendu différent.</p></div>
          <Link href="/media" className="rounded-xl border border-white/15 px-5 py-3 text-sm">Ouvrir la médiathèque →</Link>
        </header>
        {(error || loadError) && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-300">{error || 'Impossible de charger vos connexions.'}<button type="button" className="ml-3 underline" onClick={() => void mutate()}>Réessayer</button></div>}
        {notice && <p role="status" className="rounded-xl border border-[#D5FF7A]/30 p-4 text-sm">{notice}</p>}
        <section className="grid gap-5 lg:grid-cols-2" aria-label="Moteurs créatifs">
          <article className="rounded-2xl border border-white/10 bg-black/10 p-6">
            <span className="rounded-full bg-[#D5FF7A]/10 px-3 py-1 text-xs text-[#D5FF7A]">Natif · Socle Postiz</span>
            <h2 className="mt-5 text-2xl font-medium">Studio intégré</h2>
            <p className="mt-3 min-h-14 text-sm opacity-60">Vos contenus, médias et outils de création existants. Les fonctions IA nécessitent la configuration de leurs fournisseurs et peuvent avoir un coût.</p>
            <div className="mt-6 flex flex-wrap gap-3"><Link className={button} href="/media">Créer et gérer mes médias</Link><Link href="/launches" className="rounded-xl border border-white/15 px-4 py-3 text-sm">Calendrier éditorial</Link></div>
          </article>
          <article className="rounded-2xl border border-white/10 bg-black/10 p-6">
            <div className="flex items-center justify-between gap-3"><span className="rounded-full border border-white/15 px-3 py-1 text-xs">App externe · Votre clé API</span><span className="text-xs opacity-70">{isLoading ? 'Vérification…' : active ? 'Connectée' : 'Non connectée'}</span></div>
            <h2 className="mt-5 text-2xl font-medium">Higgsfield</h2>
            <p className="mt-3 min-h-14 text-sm opacity-60">Générez un visuel de campagne avec Marketing Studio Image, puis importez-le dans Caléonis. Première version : images à partir d’un brief ; vidéo et retouche produit à venir.</p>
            <div className="mt-6 flex flex-wrap gap-3"><button type="button" disabled={isLoading || busy} className={button} onClick={() => dialog.current?.showModal()}>{active ? 'Ajouter / remplacer une clé' : 'Connecter Higgsfield'}</button>{active && <button type="button" className="text-sm underline opacity-70" disabled={busy} onClick={() => void disconnect()}>Déconnecter ce compte</button>}</div>
          </article>
        </section>
        {active && <section className="rounded-2xl border border-white/10 p-6" aria-label="Créer avec Higgsfield">
          <div className="mb-6"><h2 className="text-xl font-medium">Du brief au visuel</h2><p className="mt-2 text-sm opacity-60">Marketing Studio Image · Connexion et suivi ne lancent aucune génération. La création est facturée sur votre solde API Higgsfield, séparément de votre abonnement web.</p></div>
          {higgsfield.length > 1 && <label className="mb-4 block text-sm">Compte connecté<select className={field} disabled={busy || !!job} value={connectionId} onChange={e => setSelected(e.target.value)}>{higgsfield.map((c, i) => <option key={c.id} value={c.id}>Higgsfield — connexion {i + 1}</option>)}</select></label>}
          <div className="grid gap-7 lg:grid-cols-2">
            <form onSubmit={generate} className="space-y-4">
              <label className="block text-sm">Votre brief<textarea className={`${field} mt-2 min-h-36 resize-y`} required maxLength={4000} value={prompt} disabled={!!job} onChange={e => setPrompt(e.target.value)} placeholder="Ex. Un visuel pour une offre de rentrée, ambiance chaleureuse, composition épurée, espace libre pour le prix…" /></label>
              <div className="grid grid-cols-2 gap-4"><label className="text-sm">Format<select className={`${field} mt-2`} value={ratio} disabled={!!job} onChange={e => setRatio(e.target.value)}>{['1:1','9:16','16:9','4:3','3:4','3:2','2:3','21:9'].map(v => <option key={v}>{v}</option>)}</select></label><label className="text-sm">Résolution<select className={`${field} mt-2`} value={resolution} disabled={!!job} onChange={e => setResolution(e.target.value)}>{['1k','2k','4k'].map(v => <option key={v}>{v}</option>)}</select></label></div>
              <label className="flex items-start gap-3 text-xs leading-relaxed opacity-80"><input type="checkbox" className="mt-1" checked={consent} disabled={!!job} onChange={e => setConsent(e.target.checked)} />J’autorise l’envoi de ce brief à Higgsfield et la facturation de cette création sur mon compte API. Je dispose des droits nécessaires. Aucun montant exact n’est garanti par Caléonis.</label>
              <a href="https://open.higgsfield.ai/models/marketing-studio/image" target="_blank" rel="noopener noreferrer" className="inline-block text-xs underline opacity-60">Consulter les paramètres et tarifs Higgsfield ↗</a><br />
              <button className={button} disabled={!consent || !prompt.trim() || !!job || busy} type="submit">{busy && !job ? 'Envoi…' : 'Générer avec Higgsfield'}</button>
            </form>
            <div className="flex min-h-64 flex-col justify-center rounded-xl border border-dashed border-white/15 p-6">
              {!job ? <><p className="text-lg font-medium">Votre prochain visuel, ici.</p><p className="mt-3 text-sm opacity-60">Le résultat sera d’abord une création à contrôler. Il ne sera jamais publié automatiquement par cet écran.</p></> : <div className="space-y-4"><p role="status" className="text-lg font-medium">{labels[job.status] || job.status}</p>{job.message && <p className="text-sm opacity-75">{job.message}</p>}<p className="break-all text-xs opacity-50">Suivi Caléonis : {job.id}{job.requestId && <><br />Demande Higgsfield : {job.requestId}</>}</p>{job.media ? <><p className="text-sm text-[#D5FF7A]">Enregistré dans votre médiathèque.</p><Link className={button} href="/media">Voir et utiliser le visuel</Link></> : job.status === 'completed' ? <button className={button} type="button" disabled={busy} onClick={() => void importImage()}>{busy ? 'Import…' : 'Importer dans la médiathèque'}</button> : <button type="button" className="text-sm underline" onClick={() => void refreshJob()}>Actualiser le suivi</button>}{!pending.includes(job.status) && <button type="button" className="block text-xs underline opacity-60" disabled={busy} onClick={resetJob}>Préparer une nouvelle création</button>}<p className="text-xs opacity-45">Suivi conservé 7 jours côté serveur. Le dernier identifiant reste dans cet onglet, sans clé API. L’import ne relance pas de génération.</p></div>}
            </div>
          </div>
        </section>}
        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5 text-sm opacity-65"><p>Le studio natif fonctionne indépendamment de Higgsfield.</p><Link href="/third-party/other" className="underline">Autres intégrations Postiz : HeyGen, ReelFarm →</Link></footer>
      </div>
      <dialog ref={dialog} onCancel={closeConnection} className="w-[min(92vw,520px)] rounded-2xl border border-white/15 bg-[#1A1919] p-7 text-white backdrop:bg-black/65">
        <div className="mb-5 flex justify-between gap-4"><h2 className="text-xl font-semibold">Connecter Higgsfield</h2><button type="button" aria-label="Fermer" disabled={busy} onClick={closeConnection}>✕</button></div>
        <p className="mb-5 text-sm text-white/60">Utilisez les identifiants de votre compte API. Ils sont transmis à notre serveur pour vérifier la connexion, puis enregistrés chiffrés. Ils ne sont pas stockés dans votre navigateur.</p>
        <form className="space-y-4" onSubmit={connect}><label className="block text-sm">Key ID<input type="password" required maxLength={2048} autoComplete="off" spellCheck={false} className={`${field} mt-2`} value={keyId} onChange={e => setKeyId(e.target.value)} /></label><label className="block text-sm">Key Secret<input type="password" required maxLength={2048} autoComplete="new-password" spellCheck={false} className={`${field} mt-2`} value={keySecret} onChange={e => setKeySecret(e.target.value)} /></label>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}<button className={button} disabled={busy} type="submit">{busy ? 'Vérification…' : 'Vérifier et connecter'}</button><p className="text-xs text-white/50">Vérification du catalogue uniquement. Aucune image n’est générée lors de la connexion.</p></form>
      </dialog>
    </main>
  );
}
