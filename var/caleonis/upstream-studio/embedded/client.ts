export type StudioDraft = {
  schemaVersion: 1; mode: 'image' | 'video'; prompt: string;
  imageModelId: string; videoModelId: string; videoVariantId: string;
  sizeAspect: string; sizeResolution: string;
  imageFieldValues: Record<string, unknown>; videoSettings: Record<string, unknown>;
};
const channel = 'caleonis-studio-v1';
export function studioRequest(operation:string, payload?:unknown):Promise<any> {
  return new Promise((resolve,reject)=>{
    if (window.parent===window) {reject(new Error('Ouvrez le studio depuis Médias dans Caléonis Marketing.'));return;}
    const id=crypto.randomUUID();
    const listener=(event:MessageEvent)=>{
      if(event.source!==window.parent || event.origin!==window.location.origin || event.data?.channel!==channel || event.data?.type!=='response' || event.data?.id!==id)return;
      cleanup(); if(event.data.error) reject(new Error(String(event.data.error)));else resolve(event.data.result);
    };
    const timer=window.setTimeout(()=>{cleanup();reject(new Error('Action non confirmée. Revenez aux projets pour rouvrir le studio.'));},15000);
    const cleanup=()=>{window.clearTimeout(timer);window.removeEventListener('message',listener);};
    window.addEventListener('message',listener);
    window.parent.postMessage({channel,type:'request',id,operation,payload},window.location.origin);
  });
}
/** Only the two read-only upstream feeds have a mapping; generation is never forwarded. */
export async function studioFetch(input:string, init?:RequestInit):Promise<Response> {
  if(init?.method && init.method!=='GET') return Response.json({error:'CALEONIS_NOT_READY'},{status:503});
  const operation=input==='/api/image-tasks'?'images':input==='/api/tasks'?'videos':null;
  if(!operation)return Response.json({error:'CALEONIS_NOT_READY'},{status:503});
  try{return Response.json(await studioRequest(operation));}
  catch{return Response.json({error:'Session du studio indisponible.'},{status:403});}
}
