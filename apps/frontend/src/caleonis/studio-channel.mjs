/** Keyless UI channel. The existing Caléonis API remains the only authorization layer. */
export const STUDIO_CHANNEL = 'caleonis-studio-v1';
const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const operations = ['project', 'saveBrief', 'media', 'images', 'videos'];
export function isStudioMessage(event, frameWindow, origin) {
  const data = event.data;
  return Boolean(frameWindow && event.source === frameWindow && event.origin === origin && data && data.channel === STUDIO_CHANNEL && data.type === 'request' && idPattern.test(data.id || '') && operations.includes(data.operation));
}
export function validateBrief(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['revision','prompt','mode'].includes(key))) throw new Error('Modification non autorisée.');
  if (!Number.isSafeInteger(value.revision) || value.revision < 1 || typeof value.prompt !== 'string' || value.prompt.length > 2000 || !['image','video'].includes(value.mode)) throw new Error('Brief invalide.');
  return {revision:value.revision, prompt:value.prompt, mode:value.mode};
}
/** projectId comes from the host route, never from a message sent by the studio. */
export async function handleStudioOperation(projectId, operation, payload, callApi) {
  if (!idPattern.test(projectId) || !operations.includes(operation)) throw new Error('Action non autorisée.');
  const brief = operation === 'saveBrief' ? validateBrief(payload) : undefined;
  const project = await callApi(`/workspace/documents/${projectId}`);
  if (project?.id !== projectId || project.kind !== 'project') throw new Error('Projet créatif introuvable.');
  if (operation === 'project') {
    let campaign = null;
    if (idPattern.test(project.data?.campaignId || '')) {
      const linked = await callApi(`/workspace/documents/${project.data.campaignId}`);
      if (linked.kind === 'campaign') campaign = {title:linked.title};
    }
    return {project, campaign, generationEnabled:false};
  }
  if (operation === 'saveBrief') {
    if (brief.revision !== project.revision) throw new Error('Une version plus récente existe. Rouvrez le projet avant de sauvegarder.');
    const saved = await callApi(`/workspace/documents/${projectId}`, {method:'PUT',body:JSON.stringify({kind:'project',title:project.title,revision:brief.revision,data:{...project.data,prompt:brief.prompt,mode:brief.mode}})});
    return {project:saved};
  }
  if (operation === 'media') {
    const files = await callApi('/workspace/media');
    if (!Array.isArray(files)) throw new Error('Médiathèque indisponible.');
    return files.map(item=>({id:item.id,name:item.name,path:item.path,type:item.type}));
  }
  const runs = await callApi(`/workspace/projects/${projectId}/runs`);
  if (!Array.isArray(runs)) throw new Error('Historique indisponible.');
  const type = operation === 'images' ? 'image' : 'video';
  return runs.filter(run=>run.media && (run.snapshot?.mode || 'image')===type).map(run=>({
    task_id:run.id,status:'COMPLETED',_done:true,media_type:type,
    model_id:run.snapshot?.engine==='higgsfield'?'Higgsfield':'Caléonis',
    prompt:run.snapshot?.prompt||'',created_at:run.createdAt,
    result_urls:[run.media.path],...(type==='video'?{video_urls:[run.media.path]}:{}),
  }));
}
