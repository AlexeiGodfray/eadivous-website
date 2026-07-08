import { useEffect, useRef, useState } from 'react';
import { isLogoFrozen, startLogoPlayback, subscribeLogoFreeze } from './logoAnimationState';

export function useFrozenGif() {
  const gifRef = useRef<HTMLImageElement>(null);
  const [frozen, setFrozen] = useState(() => isLogoFrozen());

  useEffect(() => {
    const applyFrozen = () => {
      if (isLogoFrozen()) setFrozen(true);
    };

    applyFrozen();
    const unsubscribe = subscribeLogoFreeze(applyFrozen);
    const stopPlayback = startLogoPlayback(applyFrozen);

    return () => {
      unsubscribe();
      stopPlayback();
    };
  }, []);

  return { frozen, gifRef };
}
