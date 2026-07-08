import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react';

const MAGNET_RADIUS = 88;
const MAGNET_STRENGTH = 0.32;

function canMagnetize(): boolean {
  return (
    window.matchMedia('(pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

type MagneticLinkProps = ComponentPropsWithoutRef<'a'>;

export function MagneticLink({ className, style, onMouseLeave, ...props }: MagneticLinkProps) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!canMagnetize()) return;

    const el = ref.current;
    if (!el) return;

    const reset = () => {
      el.style.transform = '';
    };

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      const dist = Math.hypot(dx, dy);

      if (dist < MAGNET_RADIUS) {
        const pull = (1 - dist / MAGNET_RADIUS) * MAGNET_STRENGTH;
        el.style.transform = `translate3d(${dx * pull}px, ${dy * pull}px, 0)`;
      } else {
        reset();
      }
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', reset);

    return () => {
      document.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', reset);
      reset();
    };
  }, []);

  return (
    <a
      ref={ref}
      className={['magnetic-link', className].filter(Boolean).join(' ')}
      style={style}
      onMouseLeave={(event) => {
        if (ref.current) ref.current.style.transform = '';
        onMouseLeave?.(event);
      }}
      {...props}
    />
  );
}
