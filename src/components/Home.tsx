import { AboutScrollySection } from './AboutScrollySection';
import { GlobeScrollySection } from './GlobeScrollySection';
import { MagneticLink } from './MagneticLink';

const TITLE_LINES = [
  { text: 'Eadivous', align: 'center' },
  { text: 'Technologies', align: 'center' },
  { text: 'Collecting', align: 'right' },
  { text: 'Analyzing', align: 'right' },
  { text: 'Autonomously', align: 'center' },
] as const;

const LINKS = [
  { num: '01', label: 'GitHub', href: 'https://github.com/EadivousTechnologies' },
  { num: '02', label: 'LinkedIn', href: 'https://www.linkedin.com/company/eadivous/' },
  { num: '03', label: 'X', href: 'https://x.com/baruchintel' },
  { num: '04', label: 'Contact', href: 'mailto:contact@eadivous.com' },
] as const;

export function Home() {
  return (
    <>
      <main className="hero-body">
        <div id="section-hero" className="hero-ledger">
          {TITLE_LINES.map((_, index) => (
            <div
              key={`rule-${index}`}
              className="ledger-rule"
              style={{ gridRow: index + 1 }}
              aria-hidden
            />
          ))}

          <nav className="index-list" aria-label="Channels">
            {LINKS.map((link, index) => {
              const isExternal = link.href.startsWith('http');
              return (
                <MagneticLink
                  key={link.label}
                  className="index-link"
                  href={link.href}
                  {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  <span className="index-num">{link.num}</span>
                  <span className="index-label">
                    <span
                      className="index-label-inner"
                      style={{ animationDelay: `${0.4 + index * 0.08}s` }}
                    >
                      {link.label}
                    </span>
                  </span>
                </MagneticLink>
              );
            })}
          </nav>

          <h1 className="hero-headline">
            {TITLE_LINES.map((line, index) => (
              <span
                key={line.text}
                className={`display-title-line display-title-line--${line.align}`}
                style={{ gridRow: index + 1 }}
              >
                <span
                  className="display-title-line-inner"
                  style={{ animationDelay: `${0.12 + index * 0.09}s` }}
                >
                  {line.text}
                </span>
              </span>
            ))}
          </h1>
        </div>
      </main>

      <AboutScrollySection />
      <GlobeScrollySection />
    </>
  );
}
