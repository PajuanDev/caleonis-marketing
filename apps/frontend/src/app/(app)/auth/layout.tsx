export const dynamic = 'force-dynamic';
import { ReactNode } from 'react';
import loadDynamic from 'next/dynamic';
import { LogoTextComponent } from '@gitroom/frontend/components/ui/logo-text.component';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Toaster } from '@gitroom/react/toaster/toaster';
import { CALEONIS_BRAND } from '@gitroom/frontend/caleonis/brand';

const ReturnUrlComponent = loadDynamic(() => import('./return.url.component'));

export default async function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <MantineWrapper>
      <Toaster />
      <div className="flex min-h-screen w-full gap-3 bg-[#0E0E0E] p-3 text-white">
        <ReturnUrlComponent />
        <div className="flex min-w-0 flex-1 flex-col rounded-xl bg-[#1A1919] px-6 py-10 lg:w-[560px] lg:flex-none">
          <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center gap-9">
            <LogoTextComponent />
            <div className="flex min-w-0">{children}</div>
          </div>
          <footer className="mx-auto mt-10 w-full max-w-[440px] text-xs leading-relaxed text-white/60">
            Caléonis Marketing · Application indépendante de Caléonis OS.
            <br />
            <a href={CALEONIS_BRAND.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-white">Code source · AGPL-3.0</a>
            <span> · Basé sur Postiz.</span>
          </footer>
        </div>
        <aside className="hidden min-w-0 flex-1 flex-col justify-center rounded-xl border border-white/10 px-12 py-16 lg:flex xl:px-20" aria-label="Présentation de Caléonis Marketing">
          <p className="mb-7 text-xs uppercase tracking-[0.28em] text-[#D5FF7A]">Votre espace marketing</p>
          <h1 className="max-w-[740px] text-[48px] font-semibold leading-[1.08] tracking-[-0.04em] xl:text-[64px]">De vos idées<br />à votre prochaine<br /><span className="text-[#D5FF7A]">publication.</span></h1>
          <p className="mt-7 max-w-[490px] text-lg leading-relaxed text-white/60">Un même espace pour préparer vos contenus, organiser votre calendrier et programmer leur diffusion sur vos canaux connectés.</p>
          <div className="mt-12 grid max-w-[600px] grid-cols-3 gap-5 border-t border-white/15 pt-7">
            <div><p className="text-sm font-semibold">Créez</p><p className="mt-2 text-xs leading-relaxed text-white/55">Textes et médias réunis.</p></div>
            <div><p className="text-sm font-semibold">Organisez</p><p className="mt-2 text-xs leading-relaxed text-white/55">Votre calendrier éditorial.</p></div>
            <div><p className="text-sm font-semibold">Programmez</p><p className="mt-2 text-xs leading-relaxed text-white/55">Après votre validation.</p></div>
          </div>
          <p className="mt-9 text-xs leading-relaxed text-white/45">Les connexions aux réseaux et les fonctions IA nécessitent leur configuration. Aucune publication n’est créée par ce simple écran de connexion.</p>
        </aside>
      </div>
    </MantineWrapper>
  );
}
