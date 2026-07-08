import { Logo } from './Logo';
import { MagneticLink } from './MagneticLink';

const FOOTER_LINKS = [
  { label: 'GitHub', href: 'https://github.com/EadivousTechnologies' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/eadivous/' },
  { label: 'X', href: 'https://x.com/baruchintel' },
  { label: 'Contact', href: 'mailto:contact@eadivous.com' },
] as const;

const YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="site-footer">
      <a href={import.meta.env.BASE_URL} className="site-footer-logo" aria-label="Eadivous Technologies home">
        <Logo />
      </a>

      <div className="site-footer-meta">
        <p className="site-footer-made">Made with ❤️ in SF</p>
        <p className="site-footer-copy">© {YEAR} Eadivous Technologies</p>
      </div>

      <nav className="site-footer-nav" aria-label="Footer">
        {FOOTER_LINKS.map(({ label, href }) => {
          const isExternal = href.startsWith('http');
          return (
            <MagneticLink
              key={label}
              className="site-footer-link"
              href={href}
              {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {label}
            </MagneticLink>
          );
        })}
      </nav>
    </footer>
  );
}
