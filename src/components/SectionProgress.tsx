import { useEffect, useState } from 'react';

const SECTIONS = [
  { id: 'section-hero', num: '01' },
  { id: 'section-about', num: '02' },
  { id: 'section-connectivity', num: '03' },
] as const;

export function SectionProgress() {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const elements = SECTIONS.map(({ id }) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (elements.length === 0) return;

    const ratios = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }

        let bestId: (typeof SECTIONS)[number]['id'] = SECTIONS[0].id;
        let bestRatio = -1;
        for (const { id } of SECTIONS) {
          const ratio = ratios.get(id) ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }
        setActiveId(bestId);
      },
      { threshold: [0, 0.15, 0.35, 0.55, 0.75], rootMargin: '-18% 0px -52% 0px' },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="section-progress" aria-label="Page sections">
      {SECTIONS.map(({ id, num }, index) => (
        <span key={id} className="section-progress-item">
          {index > 0 && <span className="section-progress-sep" aria-hidden>·</span>}
          <a
            href={`#${id}`}
            className={`section-progress-link${activeId === id ? ' is-active' : ''}`}
            aria-current={activeId === id ? 'location' : undefined}
          >
            {num}
          </a>
        </span>
      ))}
    </nav>
  );
}
