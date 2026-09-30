import { MarketingWorkspace } from '@gitroom/frontend/caleonis/workspace.component';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Projet créatif — Caléonis Marketing' };
export default async function Page({ params }: { params: Promise<{ documentId: string }> }) { const { documentId } = await params; return <MarketingWorkspace key={documentId} kind="project" documentId={documentId} />; }
