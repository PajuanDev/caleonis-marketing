import type { Metadata } from 'next';
import { ThirdPartyComponent } from '@gitroom/frontend/components/third-parties/third-party.component';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Autres intégrations — Caléonis Marketing', robots: { index: false, follow: false } };
export default function Page() { return <ThirdPartyComponent />; }
