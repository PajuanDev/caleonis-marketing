'use client';
import Link from 'next/link';
import { MediaBox } from '@gitroom/frontend/components/media/media.component';
export const MediaLayoutComponent = () => <div className="min-w-0 bg-newBgColorInner p-5 flex flex-1 flex-col gap-5">
  <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
    <div><h1 className="text-2xl font-semibold">Médias</h1><p className="mt-1 text-sm opacity-60">Vos fichiers et les créations de vos campagnes, réunis.</p></div>
    <Link href="/media/studio" className="rounded-xl bg-[#D5FF7A] px-5 py-3 text-sm font-semibold text-black">Ouvrir le Studio créatif →</Link>
  </header>
  <MediaBox setMedia={() => {}} closeModal={() => {}} standalone={true} />
</div>;
