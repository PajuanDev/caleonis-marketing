export const dynamic = 'force-dynamic';
import { Login } from '@gitroom/frontend/components/auth/login';
import { Metadata } from 'next';
import { CALEONIS_BRAND } from '@gitroom/frontend/caleonis/brand';

export const metadata: Metadata = {
  title: `Connexion — ${CALEONIS_BRAND.name}`,
  description: CALEONIS_BRAND.description,
  robots: { index: false, follow: false },
};

export default async function Auth() {
  return <Login />;
}
