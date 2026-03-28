import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { NotchView } from '@/components/NotchView/NotchView'
import '@/styles/index.css'

// Debug: add transparent body style for Electron transparent window
document.body.style.background = 'transparent'
document.body.style.margin = '0'
document.body.style.padding = '0'
document.body.style.overflow = 'hidden'
document.documentElement.style.background = 'transparent'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NotchView />
  </StrictMode>
)
