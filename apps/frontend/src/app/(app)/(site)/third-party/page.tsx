import type { Metadata } from 'next';
import { CreativeApps } from '@gitroom/frontend/caleonis/creative-apps.component';
import { CALEONIS_BRAND } from '@gitroom/frontend/caleonis/brand';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: `Apps créatives — ${CALEONIS_BRAND.name}`,
  description: 'Studio intégré et applications créatives optionnelles de votre entreprise.',
  robots: { index: false, follow: false },
};
export default function Page() { return <CreativeApps />; }
