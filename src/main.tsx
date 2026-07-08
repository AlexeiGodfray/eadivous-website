import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CursorBall } from './components/CursorBall'
import { Home } from './components/Home'
import { SiteShell } from './components/SiteShell'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CursorBall />
    <SiteShell>
      <Home />
    </SiteShell>
  </StrictMode>,
)
