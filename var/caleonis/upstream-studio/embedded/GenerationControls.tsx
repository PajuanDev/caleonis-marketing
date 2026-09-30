'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import {studioRequest} from '@/caleonis/client';
import {revalidateImageTasks} from '@/hooks/useImageTasks';
import {revalidateVideoTasks} from '@/hooks/useVideoTasks';
type Run={id:string;status:string;projectRevision:number;media?:{id:string};importState?:string;provider?:string;requestId?:string};
const statuses:Record<string,string>={submitting:'Envoi à vérifier',queued:'En file chez le fournisseur',in_progress:'Création en cours',completed:'Création terminée',unknown:'État à vérifier — aucun nouvel achat',failed:'Demande refusée ou interrompue'};
export function GenerationControls({open,onClose,onBlocking,revision,fingerprint,valid,model,references,provider}:{open:boolean;onClose:()=>void;onBlocking:(value:boolean)=>void;revision:number;fingerprint:string;valid:boolean;model:string;references:number;provider:string}) {
  const [runs,setRuns]=useState<Run[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[consent,setConsent]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null),lock=useRef(false);
  const refresh=useCallback(async()=>{
    const value=await studioRequest('runs');
    if(!Array.isArray(value))throw new Error('Suivi indisponible.');
    setRuns(value);onBlocking(value.some((r:Run)=>['submitting','queued','in_progress','unknown'].includes(r.status)));
  },[onBlocking]);
  useEffect(()=>{let active=true;refresh().catch(()=>{if(active){setError('Le suivi doit être rechargé avant toute création.');onBlocking(true);}});return()=>{active=false;};},[refresh,onBlocking]);
  useEffect(()=>{setConsent(false);},[fingerprint,revision]);
  useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();setConsent(false);},[open]);
  async function action(operation:'start'|'sync'|'import',id?:string) {
    if(lock.current||operation==='start'&&(!valid||!consent))return;
    lock.current=true;setBusy(true);setError('');
    if(operation==='start')onBlocking(true);
    try{
      const payload=operation==='start'?{revision,clientRequestId:crypto.randomUUID(),confirmPaidGeneration:true}:{runId:id};
      await studioRequest(operation,payload);
      if(operation==='start')onClose();
      await refresh();revalidateImageTasks();revalidateVideoTasks();
    }catch(err){setError(err instanceof Error?err.message:'Action non confirmée.');await refresh().catch(()=>onBlocking(true));}
    finally{lock.current=false;setBusy(false);}
  }
  return <div className="w-full text-xs">
    {error&&<p role="alert" className="my-2 text-red-300">{error}</p>}
    <details className="rounded-lg border border-white/10 p-2"><summary className="cursor-pointer">Suivi des créations · {runs.length}</summary>
      <button type="button" className="my-2 underline" disabled={busy} onClick={()=>void refresh().then(()=>setError('')).catch(()=>{setError('Suivi indisponible.');onBlocking(true);})}>Recharger le suivi</button>
      <div className="max-h-32 space-y-2 overflow-auto">{runs.map(run=><div key={run.id} className="flex flex-wrap items-center gap-2 border-t border-white/10 py-2">
        <span>{run.media?'Dans la médiathèque':statuses[run.status]||run.status} · version {run.projectRevision}</span>
        {['queued','in_progress'].includes(run.status)&&<button type="button" disabled={busy} className="underline" onClick={()=>void action('sync',run.id)}>Actualiser</button>}
        {run.status==='completed'&&!run.media&&!run.importState&&<button type="button" disabled={busy} className="underline" onClick={()=>void action('import',run.id)}>Importer dans Médias</button>}
        {run.importState&&!run.media&&<span>Import à vérifier ; aucun doublon automatique.</span>}
      </div>)}</div>
    </details>
    <dialog ref={dialog} onCancel={onClose} className="m-auto w-[min(520px,92vw)] rounded-2xl border border-white/15 bg-background p-6 text-foreground backdrop:bg-black/80">
      <h2 className="text-lg font-semibold">Confirmer cette création</h2>
      <p className="my-4 text-sm">{model} · version {revision} · {references} référence(s).</p>
      <p className="text-sm text-muted-foreground">Le brief et les références seront transmis à {provider}. La génération est facturée au compte API configuré. Le prix dépend du modèle et des réglages ; aucun tarif exact n’est affiché ici.</p>
      <label className="my-5 flex items-start gap-3 text-sm"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>J’autorise cet envoi et la génération payante pour cette version du projet.</span></label>
      {!valid&&!busy&&<p role="status" className="my-2 text-amber-200">Le projet ou les réglages ont changé, ou une création est déjà en cours. Fermez cette fenêtre et vérifiez le projet.</p>}
      <div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={onClose}>Annuler</button><button type="button" className="rounded-xl bg-primary px-4 py-3 font-semibold text-black disabled:opacity-40" disabled={!consent||!valid||busy} onClick={()=>void action('start')}>{busy?'Envoi…':'Confirmer la génération payante'}</button></div>
    </dialog>
  </div>;
}
