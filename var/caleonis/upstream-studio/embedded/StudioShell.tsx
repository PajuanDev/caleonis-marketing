'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CommandBar } from '@/components/command-bar/CommandBar';
import { ResultsGrid } from '@/components/tasks/ResultsGrid';
import { studioRequest, type StudioDraft } from '@/caleonis/client';

type Project = {id:string; title:string; revision:number; data:Record<string, string | string[]>};
type Bootstrap = {project:Project; campaign:{title:string}|null; generationReason:string};
type Media = {id:string; name:string; path:string; type?:string};

export function StudioShell() {
  const [context, setContext] = useState<Bootstrap|null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    studioRequest('project').then(body => { if (active) setContext(body); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);
  if (error) return <main className="p-8 text-foreground"><h1 className="text-xl font-bold">Studio créatif Caléonis</h1><p role="alert" className="my-4">{error}</p><a href="/media/studio" target="_parent" className="underline">Retour aux projets</a></main>;
  if (!context) return <p role="status" className="p-8 text-foreground">Ouverture de votre projet…</p>;
  return <ProjectStudio key={context.project.id} initial={context} />;
}

function ProjectStudio({initial}: {initial:Bootstrap}) {
  const [project, setProject] = useState(initial.project);
  const [initialDraft] = useState<StudioDraft|undefined>(undefined);
  const [mode, setMode] = useState<'image'|'video'>(initialDraft?.mode || (initial.project.data.mode === 'video' ? 'video' : 'image'));
  const [draft, setDraft] = useState<StudioDraft|null>(null);
  const [hasLocalFiles, setHasLocalFiles] = useState(false);
  const [savedSignature, setSavedSignature] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [mediaStatus, setMediaStatus] = useState('');
  const receiveDraft = useCallback((next:StudioDraft, localFiles:boolean) => {
    setDraft(next); setHasLocalFiles(localFiles);
    setSavedSignature(previous => previous || JSON.stringify({mode:next.mode,prompt:next.prompt}));
  }, []);
  const dirty = !!draft && JSON.stringify({mode:draft.mode,prompt:draft.prompt}) !== savedSignature;
  useEffect(() => {
    if (!dirty && !hasLocalFiles) return;
    const guard = (event:BeforeUnloadEvent) => {event.preventDefault(); event.returnValue = '';};
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, hasLocalFiles]);
  async function save() {
    if (!draft || savingRef.current) return;
    savingRef.current = true; setSaving(true); setError(''); setNotice('');
    const snapshot = draft;
    try {
      const result = await studioRequest('saveBrief', {revision:project.revision, prompt:snapshot.prompt, mode:snapshot.mode});
      setProject(result.project); setSavedSignature(JSON.stringify({mode:snapshot.mode,prompt:snapshot.prompt})); setNotice(`Version ${result.project.revision} enregistrée (brief et type).`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Sauvegarde non confirmée.'); }
    finally { savingRef.current = false; setSaving(false); }
  }
  async function openLibrary() {
    dialog.current?.showModal(); setMediaStatus('Chargement…');
    try { setMedia(await studioRequest('media')); setMediaStatus(''); }
    catch (err) { setMediaStatus(err instanceof Error ? err.message : 'Médiathèque indisponible.'); }
  }
  return (
    <div className="relative h-screen overflow-hidden bg-background text-foreground">
      <header className="absolute left-0 right-0 top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-background/95 px-5 py-3">
        <div className="min-w-0"><p className="text-[10px] uppercase tracking-[.2em] text-primary">Caléonis · Studio créatif</p><h1 className="max-w-[50vw] truncate text-sm font-bold">{project.title}</h1><p className="text-[10px] text-muted-foreground">{initial.campaign ? `Campagne : ${initial.campaign.title} · ` : ''}Version {project.revision}{dirty ? ' · Modifications non enregistrées' : ''}</p></div>
        <div className="flex items-center gap-2"><button type="button" className="rounded-xl border border-white/15 px-3 py-2 text-xs" onClick={() => void openLibrary()}>Médiathèque</button><button type="button" className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-black disabled:opacity-40" disabled={!dirty || saving} onClick={() => void save()}>{saving ? 'Enregistrement…' : 'Enregistrer le brief'}</button></div>
        <p className="w-full text-[11px] text-muted-foreground">Catalogue image et vidéo conservé · Générations non raccordées, aucun appel payant possible. Les réglages avancés et les fichiers restent temporaires ; seul le brief et le type de projet sont sauvegardés dans ce lot.</p>
        {hasLocalFiles && <p role="status" className="w-full text-xs text-amber-200">Les fichiers temporaires ne seront pas enregistrés avec le brief. Conservez vos originaux.</p>}
        {(error || notice) && <p role={error ? 'alert' : 'status'} className={`w-full text-xs ${error ? 'text-red-300' : 'text-primary'}`}>{error || notice}</p>}
      </header>
      <div className="h-full pt-36"><ResultsGrid mode={mode} /></div>
      <CommandBar mode={mode} onModeChange={setMode} initialDraft={initialDraft} initialPrompt={String(project.data.prompt || '')} onDraftChange={receiveDraft} generationEnabled={false} />
      <dialog ref={dialog} className="m-auto max-h-[80vh] w-[min(860px,92vw)] overflow-auto rounded-2xl border border-white/15 bg-background p-5 text-foreground backdrop:bg-black/70">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-bold">Médiathèque de votre entreprise</h2><button type="button" onClick={() => dialog.current?.close()}>Fermer</button></div>
        <p className="mb-4 text-xs text-muted-foreground">Même bibliothèque que dans Caléonis. Consultation des 40 médias les plus récents ; l’attachement persistant au studio reste à raccorder.</p>
        {mediaStatus ? <p role="status">{mediaStatus}</p> : !media.length ? <p>Aucun média disponible.</p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{media.map(item => <figure key={item.id} className="overflow-hidden rounded-xl border border-white/10">{item.type === 'video' ? <video src={item.path} controls className="h-36 w-full object-contain" preload="metadata"/> : <img src={item.path} alt={item.name} className="h-36 w-full object-contain" loading="lazy"/>}<figcaption className="truncate p-2 text-xs">{item.name}</figcaption></figure>)}</div>}
      </dialog>
    </div>
  );
}
