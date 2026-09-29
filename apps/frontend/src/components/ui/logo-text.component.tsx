import React from 'react';
import { CALEONIS_BRAND } from '@gitroom/frontend/caleonis/brand';

export const LogoTextComponent = () => (
  <div className="inline-flex items-center gap-3" aria-label={CALEONIS_BRAND.name}>
    <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D5FF7A] text-[28px] font-semibold text-[#15200A]">C</span>
    <span className="flex flex-col leading-none">
      <span className="text-[25px] font-semibold tracking-[-0.04em]">Caléonis</span>
      <span className="mt-1.5 text-[10px] uppercase tracking-[0.28em] opacity-65">Marketing</span>
    </span>
  </div>
);
