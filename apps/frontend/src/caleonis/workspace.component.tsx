'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import type { DocumentKind } from '@gitroom/helpers/caleonis/workspace.domain';
import { higgsfieldImage } from '@gitroom/helpers/caleonis/upstream/model-capabilities';

type Doc = { id: string; kind: DocumentKind; title: string; data: Record<string, any>; revision: number; updatedAt: string };
type Media = { id: string; name: string; path: string; type?: string };
type Run = { id: string; status: string; projectRevision: number; media?: Media; snapshot: Record<string, any> };
const routes = { brand: '/settings/company', campaign: '/campaigns', project: '/media/studio' };
const titles = { brand: 'Entreprise & marque', campaign: 'Campagnes', project: 'Studio créatif' };
const singular = { brand: 'profil de marque', campaign: 'campagne', project: 'projet créatif' };
const descriptions = {
  brand: 'Donnez à votre marketing une base commune : activité, offres, audience et règles de marque.',
  campaign: 'Reliez votre objectif, votre offre et vos créations dans un même dossier de campagne.',
  project: 'Préparez, versionnez et retrouvez vos créations. La médiathèque reste commune à toute votre entreprise.',
};
const fields: Record<DocumentKind, Array<[string, string, number]>> = {
  brand: [['activity', 'Votre activité', 2000], ['audience', 'Vos clients et votre audience', 2000], ['offers', 'Vos offres', 4000], ['tone', 'Ton de la marque', 1000], ['guidelines', 'Règles et éléments à respecter', 4000], ['website', 'Site web HTTPS', 500]],
  campaign: [['objective', 'Objectif commercial', 2000], ['offer', 'Offre à promouvoir', 2000], ['audience', 'Audience', 2000], ['brief', 'Brief de campagne', 4000], ['cta', 'Action attendue', 500]],
  project: [['prompt', 'Brief créatif', 4000]],
};
const inputClass = 'mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm outline-none focus:border-[#D5FF7A]';
const primary = 'rounded-xl bg-[#D5FF7A] px-5 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40';
const secondary = 'rounded-xl border border-white/15 px-4 py-3 text-sm disabled:opacity-40';
const pending = ['submitting', 'queued', 'in_progress'];
const statusNames: Record<string, string> = { submitting: 'Demande réservée', queued: 'En file', in_progress: 'Génération en cours', completed: 'Création terminée', failed: 'Échec', nsfw: 'Refus du fournisseur', cancelled: 'Annulée', unknown: 'État à vérifier chez le fournisseur' };

export function MarketingWorkspace({ kind, documentId }: { kind: DocumentKind; documentId?: string }) {
  const api = useFetch(); const user = useUser(); const router = useRouter();
  const newDialog = useRef<HTMLDialogElement>(null); const mediaDialog = useRef<HTMLDialogElement>(null);
  const [newTitle, setNewTitle] = useState(''); const [draft, setDraft] = useState<Doc | null>(null);
  const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [showVersions, setShowVersions] = useState(false); const [mediaSearch, setMediaSearch] = useState('');
  async function request(path: string, method = 'GET', body?: unknown) {
    const response = await api(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Opération non confirmée. Vos modifications ne sont pas annoncées comme enregistrées.');
    return data;
  }
  const documents = useSWR<Doc[]>([user?.orgId, 'workspace', kind], () => request(`/workspace/documents?kind=${kind}`));
  const currentId = documentId || documents.data?.[0]?.id;
  const current = useSWR<Doc>(currentId ? [user?.orgId, 'workspace-document', currentId] : null, () => request(`/workspace/documents/${currentId}`));
  const versions = useSWR<Doc[]>(showVersions && currentId ? [user?.orgId, 'workspace-versions', currentId, draft?.revision] : null, () => request(`/workspace/documents/${currentId}/versions`));
  const brands = useSWR<Doc[]>(kind === 'campaign' ? [user?.orgId, 'workspace', 'brand'] : null, () => request('/workspace/documents?kind=brand'));
  const campaigns = useSWR<Doc[]>(kind === 'project' ? [user?.orgId, 'workspace', 'campaign'] : null, () => request('/workspace/documents?kind=campaign'));
  const connections = useSWR<Array<{ id: string; identifier: string; name: string }>>(kind === 'project' ? [user?.orgId, 'studio-connections'] : null, () => request('/third-party'));
  const mediaList = useSWR<Media[]>(kind === 'project' ? [user?.orgId, 'workspace-media', mediaSearch] : null, () => request(`/workspace/media?search=${encodeURIComponent(mediaSearch)}`));
  const canEdit = kind !== 'brand' || ['ADMIN', 'SUPERADMIN'].includes(user?.role || '');
  useEffect(() => {
    setDraft(current.data || null); setDirty(false); setError(''); setNotice(''); setShowVersions(false);
  }, [current.data?.id, user?.orgId]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', prevent); return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  function allowNavigation() { return !dirty || window.confirm('Des modifications ne sont pas enregistrées. Quitter ce document ?'); }
  function change(key: string, value: any) { if (!draft) return; setDraft({ ...draft, data: { ...draft.data, [key]: value } }); setDirty(true); setNotice(''); }
  async function create(event: React.FormEvent) {
    event.preventDefault(); if (busy || !newTitle.trim()) return; setBusy(true); setError('');
    try {
      const saved = await request('/workspace/documents', 'POST', { kind, title: newTitle, data: {} });
      newDialog.current?.close(); setNewTitle(''); await documents.mutate(); router.push(`${routes[kind]}/${saved.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Création impossible.'); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!draft || busy) return; setBusy(true); setError(''); setNotice('');
    try {
      const saved = await request(`/workspace/documents/${draft.id}`, 'PUT', { kind, title: draft.title, data: draft.data, revision: draft.revision });
      setDraft(saved); setDirty(false); await current.mutate(saved, false); await documents.mutate(); setNotice(`Version ${saved.revision} enregistrée.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Sauvegarde impossible.'); }
    finally { setBusy(false); }
  }
  async function reload() {
    if (!allowNavigation()) return;
    const result = await current.mutate(); setDraft(result || null); setDirty(false);
  }
  async function derive() {
    if (!draft || dirty || busy) return; setBusy(true); setError('');
    const target = kind === 'brand' ? 'campaign' : 'project';
    const data = kind === 'brand' ? { brandId: draft.id, audience: draft.data.audience || '' } : { campaignId: draft.id, prompt: draft.data.brief || '' };
    try {
      const result = await request('/workspace/documents', 'POST', { kind: target, title: draft.title.slice(0, 110), data }); router.push(`${routes[target]}/${result.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Création impossible.'); }
    finally { setBusy(false); }
  }
  return <main className="flex-1 min-w-0 overflow-auto bg-newBgColorInner p-5 text-textColor md:p-8">
    <div className="mx-auto max-w-[1500px] space-y-7">
      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Espace marketing">{([['Entreprise', '/settings/company'], ['Campagnes', '/campaigns'], ['Studio créatif', '/media/studio'], ['Médias', '/media'], ['Intégrations', '/third-party']] as const).map(([label, url]) => <Link key={url} href={url} onClick={event => { if (!allowNavigation()) event.preventDefault(); }} className={`rounded-xl px-4 py-2 ${url === routes[kind] ? 'bg-[#D5FF7A] text-black' : 'border border-white/10 opacity-70'}`}>{label}</Link>)}</nav>
      <header className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs uppercase tracking-[.2em] text-[#D5FF7A]">Caléonis Marketing</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">{titles[kind]}</h1><p className="mt-3 max-w-3xl text-sm opacity-60">{descriptions[kind]}</p></div><button type="button" className={primary} disabled={!canEdit || busy} onClick={() => { if (allowNavigation()) newDialog.current?.showModal(); }}>+ Nouveau {singular[kind]}</button></header>
      {(error || documents.error || current.error) && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/5 p-4 text-sm">{error || 'Impossible de charger ce document.'}<button type="button" onClick={() => void reload()} className="ml-3 underline">Recharger la version serveur</button></div>}
      {notice && <p role="status" className="text-sm text-[#D5FF7A]">{notice}</p>}
      {!canEdit && <p className="text-sm opacity-65">Les profils de marque sont modifiables par les administrateurs de l’entreprise.</p>}
      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-white/10 p-3"><h2 className="px-3 py-2 text-xs uppercase tracking-wider opacity-50">Vos {kind === 'brand' ? 'marques' : kind === 'campaign' ? 'campagnes' : 'projets'}</h2>
          {documents.isLoading ? <p role="status" className="p-3 text-sm">Chargement…</p> : !documents.data?.length ? <p className="p-3 text-sm opacity-60">Aucun document pour le moment.</p> : documents.data.map(item => <Link key={item.id} href={`${routes[kind]}/${item.id}`} onClick={event => { if (!allowNavigation()) event.preventDefault(); }} className={`my-1 block rounded-xl p-3 ${currentId === item.id ? 'bg-white/10' : 'hover:bg-white/5'}`}><span className="block truncate text-sm font-medium">{item.title}</span><span className="mt-1 block text-xs opacity-45">Version {item.revision}</span></Link>)}
        </aside>
        <section className="min-w-0 space-y-5">
          {draft ? <>
            <div className="rounded-2xl border border-white/10 p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs opacity-55">{dirty ? 'Modifications non enregistrées' : `Version ${draft.revision} sauvegardée`}</span><div className="flex flex-wrap gap-2"><button type="button" className={secondary} onClick={() => setShowVersions(!showVersions)}>Historique</button><button type="button" disabled={busy || !canEdit || !dirty} className={primary} onClick={() => void save()}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button></div></div>
              <label className="mt-5 block text-sm">Nom<input className={inputClass} value={draft.title} maxLength={120} disabled={!canEdit || busy} onChange={event => { setDraft({ ...draft, title: event.target.value }); setDirty(true); }} /></label>
              <div className={`mt-5 grid gap-5 ${kind === 'brand' ? 'xl:grid-cols-2' : ''}`}>{fields[kind].map(([key, label, max]) => <label key={key} className="block text-sm">{label}{key === 'website' ? <input type="url" className={inputClass} value={draft.data[key] || ''} maxLength={max} disabled={!canEdit || busy} onChange={event => change(key, event.target.value)} /> : <textarea className={`${inputClass} ${key === 'prompt' || key === 'brief' ? 'min-h-40' : 'min-h-24'} resize-y`} value={draft.data[key] || ''} maxLength={max} disabled={!canEdit || busy} onChange={event => change(key, event.target.value)} />}</label>)}</div>
              {kind === 'campaign' && <label className="mt-5 block text-sm">Marque associée<select className={inputClass} value={draft.data.brandId || ''} onChange={event => change('brandId', event.target.value)}><option value="">Sans marque associée</option>{brands.data?.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
              {kind === 'project' && <>
                <div className="mt-5 grid gap-4 sm:grid-cols-3"><label className="text-sm">Type de projet<select className={inputClass} value={draft.data.mode || 'image'} onChange={event => change('mode', event.target.value)}><option value="image">Image</option><option value="video">Vidéo · préparation</option></select></label><label className="text-sm">Format<select className={inputClass} value={draft.data.aspectRatio || '1:1'} onChange={event => change('aspectRatio', event.target.value)}>{higgsfieldImage.aspect_ratio && higgsfieldImage.aspect_ratio.options?.map(([label, value]) => <option key={value} value={value}>{label} · {value}</option>)}</select></label><label className="text-sm">Résolution<select className={inputClass} value={draft.data.resolution || '1k'} onChange={event => change('resolution', event.target.value)}>{higgsfieldImage.resolution_variant && higgsfieldImage.resolution_variant.options?.map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></label></div>
                <label className="mt-5 block text-sm">Campagne associée<select className={inputClass} value={draft.data.campaignId || ''} onChange={event => change('campaignId', event.target.value)}><option value="">Projet indépendant</option>{campaigns.data?.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
                <label className="mt-5 block text-sm">Moteur image connecté<select className={inputClass} value={draft.data.connectionId || ''} onChange={event => change('connectionId', event.target.value)}><option value="">Choisir une connexion dans Intégrations</option>{connections.data?.filter(item => item.identifier === 'higgsfield').map((item, index) => <option key={item.id} value={item.id}>Higgsfield · {item.name || index + 1}</option>)}</select></label>
                <div className="mt-5 flex flex-wrap items-center gap-4"><button type="button" className={secondary} onClick={() => mediaDialog.current?.showModal()}>Références de travail · {draft.data.referenceIds?.length || 0}/8</button><span className="max-w-xl text-xs leading-relaxed opacity-55">Les références sont sauvegardées dans le projet. Leur envoi au moteur sera ajouté avec les adaptateurs compatibles ; ce connecteur reste limité au texte.</span></div>
                {!!draft.data.referenceIds?.length && <div className="mt-3 flex flex-wrap gap-2">{draft.data.referenceIds.map((id: string, index: number) => <button type="button" key={id} className="rounded-lg border border-white/15 px-3 py-2 text-xs" onClick={() => change('referenceIds', draft.data.referenceIds.filter((value: string) => value !== id))}>Référence {index + 1} · Retirer ×</button>)}</div>}
              </>}
              {kind !== 'project' && <div className="mt-6 border-t border-white/10 pt-5"><button className={secondary} type="button" disabled={dirty || busy} onClick={() => void derive()}>{kind === 'brand' ? 'Préparer une campagne avec cette marque →' : 'Créer un projet créatif pour cette campagne →'}</button><p className="mt-3 text-xs opacity-50">Ce dossier prépare le travail. Il ne lance ni publicité, ni publication automatique.</p></div>}
            </div>
            {showVersions && <section className="rounded-2xl border border-white/10 p-5"><h2 className="font-semibold">Versions sauvegardées</h2><p className="mt-2 text-xs opacity-55">Restaurer prépare un brouillon. Enregistrez ensuite pour créer une nouvelle version, sans effacer l’historique.</p>{versions.error && <p role="alert">Historique indisponible.</p>}{versions.data?.map(version => <div key={version.revision} className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-sm"><span>Version {version.revision} · {version.title}</span><button className="underline" type="button" disabled={!canEdit} onClick={() => { if (allowNavigation()) { setDraft({ ...draft, title: version.title, data: version.data }); setDirty(true); } }}>Restaurer en brouillon</button></div>)}</section>}
            {kind === 'project' && <StudioGenerations key={`${user?.orgId}:${draft.id}`} document={draft} dirty={dirty} request={request} administrator={['ADMIN', 'SUPERADMIN'].includes(user?.role || '')} orgId={user?.orgId || ''} />}
          </> : <div className="flex min-h-96 flex-col justify-center rounded-2xl border border-dashed border-white/15 p-10"><span className="text-xs uppercase tracking-[.2em] text-[#D5FF7A]">Un espace de travail, pas une carte de raccourci</span><h2 className="mt-5 max-w-xl text-4xl font-medium leading-tight">{kind === 'project' ? 'Vos prochaines créations commencent ici.' : kind === 'campaign' ? 'Une intention. Une campagne structurée.' : 'Toute votre marque, au même endroit.'}</h2><p className="mt-5 max-w-xl text-sm leading-relaxed opacity-60">{current.isLoading ? 'Chargement du document…' : `Créez votre premier ${singular[kind]}. Les brouillons et leurs versions sont conservés côté serveur, dans votre entreprise.`}</p></div>}
        </section>
      </div>
    </div>
    <dialog ref={newDialog} aria-labelledby="workspace-new-title" className="w-[min(92vw,520px)] rounded-2xl border border-white/15 bg-[#1A1919] p-7 text-white backdrop:bg-black/65"><form onSubmit={create}><div className="flex items-center justify-between gap-3"><h2 id="workspace-new-title" className="text-xl font-semibold">Nouveau {singular[kind]}</h2><button type="button" aria-label="Fermer" disabled={busy} onClick={() => newDialog.current?.close()}>✕</button></div><label className="mt-5 block text-sm">Nom<input required maxLength={120} value={newTitle} onChange={event => setNewTitle(event.target.value)} className={inputClass} /></label>{error && <p role="alert" className="mt-3 text-sm">{error}</p>}<button className={`${primary} mt-5 w-full`} type="submit" disabled={busy}>Créer le brouillon</button></form></dialog>
    <dialog ref={mediaDialog} aria-labelledby="workspace-media-title" className="max-h-[85vh] w-[min(94vw,900px)] overflow-auto rounded-2xl border border-white/15 bg-[#1A1919] p-6 text-white backdrop:bg-black/65"><div className="flex justify-between gap-4"><h2 id="workspace-media-title" className="text-xl">Références de la médiathèque</h2><button aria-label="Fermer" type="button" onClick={() => mediaDialog.current?.close()}>✕</button></div><input aria-label="Rechercher un média" className={inputClass} maxLength={120} value={mediaSearch} onChange={event => setMediaSearch(event.target.value)} placeholder="Rechercher par nom…" />{mediaList.error && <p role="alert">La médiathèque est indisponible.</p>}<div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">{mediaList.data?.map(item => { const checked = draft?.data.referenceIds?.includes(item.id); return <button key={item.id} type="button" aria-pressed={!!checked} className={`overflow-hidden rounded-xl border p-2 ${checked ? 'border-[#D5FF7A]' : 'border-white/15'}`} onClick={() => { const ids: string[] = draft?.data.referenceIds || []; if (checked) change('referenceIds', ids.filter(id => id !== item.id)); else if (ids.length < 8) change('referenceIds', [...ids, item.id]); }}><div className="relative aspect-square bg-black/20">{item.type !== 'video' ? <Image src={item.path} alt={item.name} fill unoptimized sizes="200px" className="object-contain" /> : <span className="flex h-full items-center justify-center text-xs">Vidéo</span>}</div><span className="mt-2 block truncate text-xs">{checked ? '✓ ' : ''}{item.name}</span></button>; })}</div><p className="mt-5 text-xs opacity-50">Les 40 médias récents correspondant à la recherche sont affichés. Enregistrez le projet après sélection.</p></dialog>
  </main>;
}

function StudioGenerations({ document, dirty, request, administrator, orgId }: { document: Doc; dirty: boolean; request: (path: string, method?: string, body?: unknown) => Promise<any>; administrator: boolean; orgId: string }) {
  const [consent, setConsent] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const pollingStart = useRef(Date.now());
  const base = `/workspace/projects/${document.id}/runs`;
  const runs = useSWR<Run[]>([orgId, 'studio-runs', document.id], () => request(base), { revalidateOnFocus: true });
  const capabilities = useSWR<{ dailyLimit: number }>([orgId, 'studio-capabilities'], () => request('/workspace/studio-capabilities'));
  const active = runs.data?.find(run => pending.includes(run.status));
  useEffect(() => {
    if (!active || Date.now() - pollingStart.current > 15 * 60 * 1000) return;
    const timer = setTimeout(() => { void request(`${base}/${active.id}/sync`, 'POST').then(() => runs.mutate()).catch(() => setError('Suivi momentanément indisponible. Aucune génération n’est relancée.')); }, 5000);
    return () => clearTimeout(timer);
  }, [active, document.id]);
  async function start() {
    if (busy || dirty || !consent) return; setBusy(true); setError(''); pollingStart.current = Date.now();
    try { await request(base, 'POST', { revision: document.revision, clientRequestId: crypto.randomUUID(), confirmPaidGeneration: true }); setConsent(false); await runs.mutate(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Réponse non confirmée. Consultez le suivi avant toute nouvelle création.'); await runs.mutate(); }
    finally { setBusy(false); }
  }
  async function action(run: Run, operation: 'sync' | 'import') {
    if (busy) return; setBusy(true); setError('');
    try { await request(`${base}/${run.id}/${operation}`, 'POST'); await runs.mutate(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Opération indisponible.'); }
    finally { setBusy(false); }
  }
  const blocked = dirty || !administrator || !document.data.connectionId || document.data.mode !== 'image' || !!document.data.referenceIds?.length || !capabilities.data?.dailyLimit || !!runs.data?.some(run => pending.includes(run.status) || run.status === 'unknown');
  return <section className="rounded-2xl border border-white/10 p-5 md:p-6">
    <header><h2 className="text-xl font-semibold">Créations & résultats</h2><p className="mt-2 text-sm leading-relaxed opacity-60">Premier moteur relié : Higgsfield Marketing Studio Image. La génération native multi-fournisseurs, les références envoyées au modèle et la production vidéo seront intégrées dans les lots suivants. Les fonctions existantes de l’agent restent distinctes.</p></header>
    {(error || runs.error) && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 p-4 text-sm">{error || 'Historique des créations indisponible.'}</p>}
    <div className="mt-5 rounded-xl border border-white/10 bg-black/10 p-4"><label className="flex gap-3 text-sm leading-relaxed"><input type="checkbox" className="mt-1" checked={consent} disabled={busy || blocked} onChange={event => setConsent(event.target.checked)} />J’autorise l’envoi du brief sauvegardé à Higgsfield et la facturation de cette image sur le compte API connecté. J’ai les droits nécessaires sur ce contenu.</label><div className="mt-4 flex flex-wrap items-center gap-4"><button type="button" className={primary} disabled={busy || blocked || !consent || !document.data.prompt?.trim()} onClick={() => void start()}>{busy ? 'Traitement…' : 'Générer cette version'}</button><span className="text-xs opacity-50">{!capabilities.data?.dailyLimit ? 'Plafond de créations à configurer avant activation.' : `Limite : ${capabilities.data.dailyLimit} demandes / 24 h. Ce nombre n’est pas un plafond monétaire.`}</span></div>{dirty && <p className="mt-3 text-xs opacity-60">Enregistrez les modifications avant de générer.</p>}<p className="mt-3 text-xs opacity-50">Aucune publication automatique. Une demande à l’état incertain doit être vérifiée, jamais rachetée automatiquement.</p></div>
    <div className="mt-5 grid gap-4 md:grid-cols-2">{runs.isLoading ? <p role="status" className="text-sm">Chargement des créations…</p> : !runs.data?.length ? <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-white/15 p-5 text-center text-sm opacity-50">Les résultats et leur version de brief apparaîtront ici.</div> : runs.data.map(run => <article key={run.id} className="overflow-hidden rounded-xl border border-white/10"><div className="relative flex aspect-video items-center justify-center bg-black/15">{run.media ? <Image src={run.media.path} alt={run.media.name} fill unoptimized sizes="500px" className="object-contain" /> : <span className="p-5 text-center text-sm opacity-60">{statusNames[run.status] || 'Suivi indisponible'}</span>}</div><div className="space-y-3 p-4"><p className="text-sm font-medium">Version {run.projectRevision} · {statusNames[run.status] || run.status}</p><p className="line-clamp-3 text-xs leading-relaxed opacity-60">{run.snapshot.prompt}</p><div className="flex flex-wrap gap-3">{run.media ? <Link href="/media" className={secondary}>Ouvrir dans Médias →</Link> : run.status === 'completed' ? <button className={primary} type="button" disabled={busy} onClick={() => void action(run, 'import')}>Importer en médiathèque</button> : <button className={secondary} type="button" disabled={busy} onClick={() => void action(run, 'sync')}>Actualiser le suivi</button>}</div></div></article>)}</div>
  </section>;
}
