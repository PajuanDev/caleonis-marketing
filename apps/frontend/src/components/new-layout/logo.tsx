'use client';

import { CALEONIS_BRAND } from '@gitroom/frontend/caleonis/brand';

export const Logo = () => (
  <div className="mt-[8px] flex min-w-[60px] flex-col items-center gap-1">
    <div title={CALEONIS_BRAND.name} aria-label={CALEONIS_BRAND.name} className="flex h-[52px] w-[52px] items-center justify-center rounded-[16px] bg-[#D5FF7A] text-[34px] font-semibold text-[#15200A]">C</div>
    <a href={CALEONIS_BRAND.sourceUrl} target="_blank" rel="noopener noreferrer" className="rounded px-1 text-[10px] text-primary opacity-70 hover:opacity-100 focus-visible:outline focus-visible:outline-2" title="Code source de cette version — AGPL-3.0">Source</a>
  </div>
);
