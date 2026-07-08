import type { ReactNode } from 'react';
import { SceneLoadingProvider } from '../context/SceneLoadingContext';
import { Footer } from './Footer';
import { PageMotion } from './PageMotion';
import { SiteHeader } from './SiteHeader';

type SiteShellProps = {
  children: ReactNode;
};

export function SiteShell({ children }: SiteShellProps) {
  return (
    <SceneLoadingProvider>
      <div className="hero">
        <PageMotion />
        <SiteHeader />
        {children}
        <Footer />
      </div>
    </SceneLoadingProvider>
  );
}
