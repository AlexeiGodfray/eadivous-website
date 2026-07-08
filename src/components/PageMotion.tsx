import { useEffect } from 'react';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function PageMotion() {
  useEffect(() => {
    const root = document.documentElement;

    let scrollFrame = 0;
    const applyScroll = () => {
      root.style.setProperty('--scroll', String(window.scrollY));
      scrollFrame = 0;
    };
    const onScroll = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(applyScroll);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    applyScroll();

    let pointerFrame = 0;
    const applyPointer = (x: number) => {
      const normalized = (x / window.innerWidth - 0.5) * 2;
      root.style.setProperty('--pointer-x', String(normalized));
      pointerFrame = 0;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (prefersReducedMotion()) return;
      if (pointerFrame) return;
      pointerFrame = window.requestAnimationFrame(() => applyPointer(event.clientX));
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointerMove);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
      root.style.removeProperty('--scroll');
      root.style.removeProperty('--pointer-x');
    };
  }, []);

  return null;
}
