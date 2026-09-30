import { IntegrationsCatalog } from '@gitroom/frontend/caleonis/integrations.component';
import type { Metadata } from 'next';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Intégrations — Caléonis Marketing' };
export default function Page() { return <IntegrationsCatalog />; }
