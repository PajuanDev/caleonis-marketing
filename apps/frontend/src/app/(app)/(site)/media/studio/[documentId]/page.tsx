import { notFound } from 'next/navigation';
import { EmbeddedStudio } from '@gitroom/frontend/caleonis/embedded-studio.component';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Studio créatif — Caléonis Marketing' };
export default async function Page({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(documentId)) notFound();
  return <EmbeddedStudio projectId={documentId} />;
}
