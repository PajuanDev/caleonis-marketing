'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GenerationControls } from '@/caleonis/GenerationControls';
import { CommandBar } from '@/components/command-bar/CommandBar';
import { ResultsGrid } from '@/components/tasks/ResultsGrid';
import { studioRequest, type StudioDraft } from '@/caleonis/client';

type Project = {id:string; title:string; revision:number; data:Record<string, string | string[]>};
type Bootstrap = {project:Project; campaign:{title:string}|null; generationEnabled:boolean;upstream?:{enabled:boolean;provider:string;models:Array<{id:string;kind:string;label:string;maxReferences:number}>}};
type Media = {id:string; name:string; path:string; type?:string};

function settings(draft:StudioDraft) {
  const {prompt, mode, ...values} = draft;
  return values;
}
function signature(draft:StudioDraft, references:string[]) {
  const normalize = (value:unknown):unknown => Array.isArray(value) ? value.map(normalize) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,normalize(v)])) : value;
  return JSON.stringify(normalize({draft, references}));
}
function restore(project:Project):StudioDraft|undefined {
  if (!project.data.studioSettings) return undefined;
  try {
    const data = JSON.parse(String(project.data.studioSettings));
    if (data.schemaVersion !== 1) return undefined;
    return {...data, prompt:String(project.data.prompt || ''), mode:project.data.mode === 'video' ? 'video' : 'image'};
  } catch { return undefined; }
}
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
  const [initialDraft] = useState<StudioDraft|undefined>(() => restore(initial.project));
  const [mode, setMode] = useState<'image'|'video'>(initialDraft?.mode || (initial.project.data.mode === 'video' ? 'video' : 'image'));
  const [draft, setDraft] = useState<StudioDraft|null>(null);
  const initialReferences = useRef<string[]>(Array.isArray(initial.project.data.referenceIds) ? initial.project.data.referenceIds : []);
  const [references, setReferences] = useState<string[]>(initialReferences.current);
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
    setSavedSignature(previous => previous || signature(next, initialReferences.current));
  }, []);
  const [blocked,setBlocked]=useState(true);
  const [confirmGeneration,setConfirmGeneration]=useState(false);
  const closeGeneration=useCallback(()=>setConfirmGeneration(false),[]);
  const dirty = !!draft && signature(draft, references) !== savedSignature;
  useEffect(() => {
    if (!dirty && !hasLocalFiles) return;
    const guard = (event:BeforeUnloadEvent) => {event.preventDefault(); event.returnValue = '';};
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, hasLocalFiles]);
  const selectedModel=initial.upstream?.models.find(item=>item.id===(mode==='image'?draft?.imageModelId:draft?.videoModelId)&&item.kind===mode);
  const ready=initial.generationEnabled&&!!selectedModel&&!dirty&&!hasLocalFiles&&!blocked&&!saving&&!!draft?.prompt.trim()&&references.length<=(selectedModel?.maxReferences||0);
  async function save() {
    if (!draft || savingRef.current) return;
    savingRef.current = true; setSaving(true); setError(''); setNotice('');
    const snapshot = draft; const selected = [...references];
    try {
      const result = await studioRequest('saveDraft', {revision:project.revision, prompt:snapshot.prompt, mode:snapshot.mode, studioSettings:JSON.stringify(settings(snapshot)), referenceIds:selected});
      setProject(result.project); setSavedSignature(signature(snapshot, selected)); setNotice(`Version ${result.project.revision} enregistrée : brief, réglages et références du projet.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Sauvegarde non confirmée.'); }
    finally { savingRef.current = false; setSaving(false); }
  }
  async function openLibrary() {
    dialog.current?.showModal(); setMediaStatus('Chargement…');
    try { setMedia(await studioRequest('media')); setMediaStatus(''); }
    catch (err) { setMediaStatus(err instanceof Error ? err.message : 'Médiathèque indisponible.'); }
  }
  function toggleReference(id:string) {
    setNotice('');
    setReferences(previous => previous.includes(id) ? previous.filter(item => item !== id) : previous.length < 8 ? [...previous, id] : previous);
  }
  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="relative z-30 flex max-h-[48vh] shrink-0 flex-wrap overflow-auto items-center justify-between gap-3 border-b border-white/10 bg-background/95 px-5 py-3">
        <div className="min-w-0"><p className="text-[10px] uppercase tracking-[.2em] text-primary">Caléonis · Studio créatif</p><h1 className="max-w-[50vw] truncate text-sm font-bold">{project.title}</h1><p className="text-[10px] text-muted-foreground">{initial.campaign ? `Campagne : ${initial.campaign.title} · ` : ''}Version {project.revision}{dirty ? ' · Modifications non enregistrées' : ''}</p></div>
        <div className="flex items-center gap-2"><button type="button" className="rounded-xl border border-white/15 px-3 py-2 text-xs" onClick={() => void openLibrary()}>Médiathèque</button><button type="button" className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-black disabled:opacity-40" disabled={!dirty || saving} onClick={() => void save()}>{saving ? 'Enregistrement…' : 'Enregistrer le projet'}</button></div>
        <p className="w-full text-[11px] text-muted-foreground">{references.length} référence(s) liée(s) · {initial.generationEnabled ? 'Compte API configuré. Sélectionnez FLUX 2 Pro ou LTX 2.0 Pro ; les autres modèles du catalogue restent indisponibles.' : 'Génération désactivée : configuration du compte API et du plafond requise.'}</p>
        {hasLocalFiles && <p role="status" className="w-full text-xs text-amber-200">Les fichiers déposés dans les contrôles du modèle restent temporaires. Pour conserver une référence, sélectionnez un média déjà enregistré dans Médiathèque.</p>}
        {(error || notice) && <p role={error ? 'alert' : 'status'} className={`w-full text-xs ${error ? 'text-red-300' : 'text-primary'}`}>{error || notice}</p>}
        <GenerationControls open={confirmGeneration} onClose={closeGeneration} onBlocking={setBlocked} revision={project.revision} fingerprint={draft?signature(draft,references):''} valid={!!ready} model={selectedModel?.label||''} references={references.length} provider={initial.upstream?.provider||'Magnific'}/>
      </header>
      <div className="min-h-0 flex-1"><ResultsGrid mode={mode} /></div>
      <CommandBar mode={mode} onModeChange={setMode} initialDraft={initialDraft} initialPrompt={String(project.data.prompt || '')} onDraftChange={receiveDraft} generationEnabled={!!ready} onGenerate={()=>setConfirmGeneration(true)} />
      <dialog ref={dialog} className="m-auto max-h-[80vh] w-[min(860px,92vw)] overflow-auto rounded-2xl border border-white/15 bg-background p-5 text-foreground backdrop:bg-black/70">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-bold">Médiathèque de votre entreprise</h2><button type="button" onClick={() => dialog.current?.close()}>Terminer</button></div>
        <p className="mb-4 text-xs text-muted-foreground">Choisissez jusqu’à 8 références, puis enregistrez le projet. Les 40 médias les plus récents sont proposés. FLUX 2 Pro accepte jusqu’à 4 images ; LTX utilise une seule première image. Les médias ne sont envoyés qu’après confirmation de génération.</p>
        <p className="mb-3 text-xs">{references.length}/8 sélectionnée(s)</p>
        {mediaStatus ? <p role="status">{mediaStatus}</p> : !media.length ? <p>Aucun média disponible.</p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{media.map(item => <label key={item.id} className={`cursor-pointer overflow-hidden rounded-xl border ${references.includes(item.id) ? 'border-primary' : 'border-white/10'}`}>
          {item.type === 'video' ? <video src={item.path} className="h-36 w-full object-contain" preload="metadata"/> : <img src={item.path} alt="" className="h-36 w-full object-contain" loading="lazy"/>}
          <span className="flex items-center gap-2 p-3 text-xs"><input type="checkbox" checked={references.includes(item.id)} disabled={!references.includes(item.id) && references.length >= 8} onChange={() => toggleReference(item.id)}/><span className="truncate">{item.name}</span></span>
        </label>)}</div>}
      </dialog>
    </div>
  );
}
