import logoGifUrl from '../assets/Logo 1 Transparent.gif?url';
import { logoFrozenAssetUrl } from '../hooks/logoAnimationState';
import { useFrozenGif } from '../hooks/useFrozenGif';

type LogoProps = {
  className?: string;
};

export function Logo({ className }: LogoProps) {
  const { frozen, gifRef } = useFrozenGif();

  return (
    <span
      className={['hero-logo-stack', frozen && 'is-frozen', className].filter(Boolean).join(' ')}
    >
      <img
        ref={gifRef}
        className="hero-logo-img hero-logo-img--anim"
        src={logoGifUrl}
        alt=""
        aria-hidden
        draggable={false}
      />
      <img
        className="hero-logo-img hero-logo-img--still"
        src={logoFrozenAssetUrl}
        alt="Eadivous Technologies"
        draggable={false}
      />
    </span>
  );
}
