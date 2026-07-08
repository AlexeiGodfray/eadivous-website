import { useEffect, useRef, useState } from 'react';

function pickCenteredStep(steps: HTMLElement[]): number {
  const viewportCenter = window.innerHeight * 0.5;
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i < steps.length; i++) {
    const rect = steps[i].getBoundingClientRect();
    const stepCenter = rect.top + rect.height * 0.5;
    const dist = Math.abs(stepCenter - viewportCenter);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  return bestIdx;
}

export function useScrollyStep(stepCount: number) {
  const [activeStep, setActiveStep] = useState(0);
  const stepRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const steps = stepRefs.current.filter((el): el is HTMLElement => el !== null);
    if (steps.length === 0) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setActiveStep(0);
      return;
    }

    let frame = 0;

    const update = () => {
      frame = 0;
      const next = pickCenteredStep(steps);
      setActiveStep((prev) => (prev === next ? prev : next));
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [stepCount]);

  const setStepRef = (index: number) => (el: HTMLElement | null) => {
    stepRefs.current[index] = el;
  };

  return { activeStep, setStepRef };
}
