'use client';
// Adapted from TechBeme/open-higgsfield, PillPopover.tsx, blob d5fb4de683ffbb88bc1aff0528dff295be3dabc9.
// MIT, copyright 2026 TechBe. See THIRD_PARTY_NOTICES_CALÉONIS.md.
// Caléonis: no animation dependency; Escape/focus handling and explicit ARIA labels.
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import styles from './studio.module.css';
export function PillPopover({ label, trigger, children }: { label: string; trigger: ReactNode; children: ReactNode }) {
  const [open,setOpen]=useState(false); const [offset,setOffset]=useState(0);
  const root=useRef<HTMLDivElement>(null); const popup=useRef<HTMLDivElement>(null); const button=useRef<HTMLButtonElement>(null); const id=useId();
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);button.current?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  useLayoutEffect(()=>{if(!open)return;setOffset(0);const clamp=()=>{const rect=popup.current?.getBoundingClientRect();if(rect)setOffset(value=>value+(rect.left<8?8-rect.left:rect.right>window.innerWidth-8?window.innerWidth-8-rect.right:0));};const timer=window.setTimeout(clamp,0);window.addEventListener('resize',clamp);return()=>{clearTimeout(timer);window.removeEventListener('resize',clamp);};},[open]);
  return <div ref={root} className={styles.pillRoot} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false);}}>
    <button ref={button} type="button" className={styles.pill} aria-label={label} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}>{trigger}<span aria-hidden="true">⌄</span></button>
    {open&&<div ref={popup} id={id} role="group" aria-label={label} className={styles.popover} style={{marginLeft:offset}}>{children}</div>}
  </div>;
}
