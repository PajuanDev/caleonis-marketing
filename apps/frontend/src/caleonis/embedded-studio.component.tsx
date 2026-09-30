'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { STUDIO_CHANNEL, isStudioMessage, handleStudioOperation } from './studio-channel.mjs';

export function EmbeddedStudio({ projectId }: { projectId: string }) {
  const user = useUser(); const api = useFetch(); const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (!user?.orgId) return;
    let active = true;
    const pending = new Set<string>();
    async function request(path:string, options?:RequestInit) {
      const response = await api(path, options);
      if (!response.ok) throw new Error(response.status === 409 ? 'Une version plus récente existe. Rouvrez le projet avant de sauvegarder.' : 'Accès refusé ou service indisponible.');
      return response.json();
    }
    async function receive(event:MessageEvent) {
      if (!isStudioMessage(event, frame.current?.contentWindow, window.location.origin)) return;
      const {id, operation, payload} = event.data;
      if (pending.has(id)) return;
      pending.add(id);
      try {
        const result = await handleStudioOperation(projectId, operation, payload, request);
        if (active) frame.current?.contentWindow?.postMessage({channel:STUDIO_CHANNEL,type:'response',id,result}, window.location.origin);
      } catch (error) {
        if (active) frame.current?.contentWindow?.postMessage({channel:STUDIO_CHANNEL,type:'response',id,error:error instanceof Error ? error.message : 'Action non confirmée.'}, window.location.origin);
      } finally {pending.delete(id);}
    }
    window.addEventListener('message', receive);
    return () => {active=false; window.removeEventListener('message',receive);};
  }, [api, projectId, user?.orgId]);
  if (!user?.orgId) return <p role="status">Chargement de votre espace…</p>;
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-newBgColorInner" aria-label="Studio créatif Caléonis">
      <nav className="flex shrink-0 flex-wrap items-center gap-4 border-b border-white/10 px-5 py-3 text-sm">
        <Link href="/media">← Médias</Link><Link href="/media/studio">Projets créatifs</Link><Link href="/campaigns">Campagnes</Link><Link href="/third-party">Intégrations</Link>
      </nav>
      <iframe ref={frame} key={`${user.orgId}:${projectId}`} title="Studio créatif — Caléonis Marketing" src="/caleonis-studio/index.html"
        className="min-h-[650px] w-full flex-1 border-0" referrerPolicy="same-origin" />
    </section>
  );
}
