'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
type Project = {id:string; title:string; revision:number; data:{mode?:string}};
export function StudioProjects() {
  const api = useFetch(); const user = useUser(); const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const projects = useSWR<Project[]>(user?.orgId ? [user.orgId,'workspace','project'] : null, async () => {
    const response = await api('/workspace/documents?kind=project');
    if (!response.ok) throw new Error('Impossible de charger vos projets.');
    return response.json();
  });
  async function create(event:React.FormEvent) {
    event.preventDefault(); if (busy || !title.trim()) return;
    setBusy(true); setError('');
    try {
      const response = await api('/workspace/documents', {method:'POST',body:JSON.stringify({kind:'project',title:title.trim(),data:{mode:'image',engine:'native'}})});
      const body = await response.json().catch(()=>({}));
      if (!response.ok || !body.id) throw new Error(body.message || 'La création du projet n’est pas confirmée.');
      dialog.current?.close(); await projects.mutate(); router.push(`/media/studio/${body.id}`);
    } catch (err) {setError(err instanceof Error ? err.message : 'Création impossible.');}
    finally {setBusy(false);}
  }
  return <main className="flex-1 overflow-auto bg-newBgColorInner p-6 text-textColor md:p-9">
    <nav className="mb-7 flex gap-5 text-sm"><Link href="/media">← Médias</Link><Link href="/campaigns">Campagnes</Link><Link href="/third-party">Intégrations</Link></nav>
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 text-xs uppercase tracking-widest opacity-60">Caléonis Marketing</p><h1 className="text-3xl font-semibold">Studio créatif</h1><p className="mt-3 text-sm opacity-65">Ouvrez un projet dans le studio Image et Vidéo, avec son brief sauvegardé.</p></div><button type="button" className="rounded-xl bg-[#D5FF7A] px-5 py-3 font-semibold text-black" onClick={()=>dialog.current?.showModal()}>+ Nouveau projet</button></header>
    {(error || projects.error) && <p role="alert" className="mb-5">{error || 'Impossible de charger les projets.'}</p>}
    {projects.isLoading ? <p role="status">Chargement…</p> : !projects.data?.length ? <section className="rounded-2xl border border-dashed border-white/15 p-10"><h2 className="text-lg font-medium">Votre premier projet créatif</h2><p className="mt-2 opacity-65">Préparez un brief et vos formats. Aucun achat ni publication n’est lancé à la création d’un projet.</p></section> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.data.map(project=><Link key={project.id} href={`/media/studio/${project.id}`} className="rounded-2xl border border-white/10 p-6 transition hover:bg-white/5"><p className="mb-4 text-xs uppercase tracking-wider opacity-50">{project.data.mode==='video'?'Vidéo':'Image'} · version {project.revision}</p><h2 className="truncate text-lg font-medium">{project.title}</h2><p className="mt-5 text-sm">Ouvrir le studio →</p></Link>)}</div>}
    <dialog ref={dialog} className="m-auto w-[min(480px,90vw)] rounded-2xl bg-[#191919] p-6 text-white backdrop:bg-black/70"><form onSubmit={create}><h2 className="mb-4 text-xl">Nouveau projet créatif</h2><label htmlFor="studio-project-title" className="text-sm">Nom du projet</label><input id="studio-project-title" autoFocus required maxLength={120} value={title} onChange={event=>setTitle(event.target.value)} className="mb-5 mt-2 w-full rounded-xl border border-white/20 bg-black/20 p-3"/><div className="flex justify-end gap-4"><button type="button" onClick={()=>dialog.current?.close()}>Annuler</button><button type="submit" disabled={busy} className="rounded-xl bg-[#D5FF7A] px-4 py-2 text-black">{busy?'Création…':'Ouvrir le studio'}</button></div></form></dialog>
  </main>;
}
