import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const INTERACTIVE_SELECTOR = 'a, button, [data-cursor-hide]';
const CANVAS_SELECTOR = '.topology-scene-canvas';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function hasFinePointer(): boolean {
  return window.matchMedia('(pointer: fine)').matches;
}

function readLerp(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--cursor-ball-lerp');
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0.38;
}

export function CursorBall() {
  const [mounted, setMounted] = useState(false);
  const ballRef = useRef<HTMLDivElement>(null);
  const position = useRef({ x: -100, y: -100 });
  const target = useRef({ x: -100, y: -100 });
  const isVisible = useRef(false);
  const isHidden = useRef(false);
  const snapToPointer = useRef(false);

  useEffect(() => {
    if (!hasFinePointer() || prefersReducedMotion()) return;

    document.body.classList.add('has-custom-cursor');
    setMounted(true);

    const lerp = readLerp();
    let frameId = 0;

    const syncBallClasses = () => {
      const ball = ballRef.current;
      if (!ball) return;

      ball.classList.toggle('cursor-ball--visible', isVisible.current && !isHidden.current);
    };

    const updateHidden = (x: number, y: number) => {
      const hit = document.elementFromPoint(x, y);
      isHidden.current = Boolean(hit?.closest(INTERACTIVE_SELECTOR));
      syncBallClasses();
    };

    const onPointerMove = (event: PointerEvent) => {
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const onCanvas = Boolean(hit?.closest(CANVAS_SELECTOR));

      snapToPointer.current = onCanvas;
      target.current = { x: event.clientX, y: event.clientY };

      if (onCanvas) {
        position.current.x = event.clientX;
        position.current.y = event.clientY;
      }

      isVisible.current = true;
      updateHidden(event.clientX, event.clientY);
      syncBallClasses();
    };

    const onPointerLeaveWindow = (event: PointerEvent) => {
      if (event.relatedTarget !== null) return;
      isVisible.current = false;
      snapToPointer.current = false;
      syncBallClasses();
    };

    const tick = () => {
      if (!snapToPointer.current) {
        position.current.x += (target.current.x - position.current.x) * lerp;
        position.current.y += (target.current.y - position.current.y) * lerp;
      }

      const ball = ballRef.current;
      if (ball) {
        ball.style.transform = `translate3d(${position.current.x}px, ${position.current.y}px, 0) translate(-50%, -50%)`;
      }

      frameId = requestAnimationFrame(tick);
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerout', onPointerLeaveWindow);
    frameId = requestAnimationFrame(tick);

    return () => {
      document.body.classList.remove('has-custom-cursor');
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerout', onPointerLeaveWindow);
      cancelAnimationFrame(frameId);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="cursor-ball-layer" aria-hidden>
      <div ref={ballRef} className="cursor-ball" />
    </div>,
    document.body,
  );
}
