import { Clock } from './Clock';
import { Logo } from './Logo';
import { SectionProgress } from './SectionProgress';

export function SiteHeader() {
  return (
    <header className="hero-topbar">
      <a href="/" className="hero-logo" aria-label="Eadivous Technologies home">
        <span className="hero-logo-slot">
          <Logo className="hero-logo-slot-img" />
        </span>
      </a>
      <div className="hero-topbar-end">
        <SectionProgress />
        <Clock />
      </div>
    </header>
  );
}
