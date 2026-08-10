/** Renderer girişi. Fontlar yerel gömülüdür — çalışma zamanında CDN yok. */
import { createRoot } from 'react-dom/client'
import '@fontsource/anton/400.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/700.css'
import './styles/app.css'
import { App } from './App'

const container = document.getElementById('root')
if (!container) throw new Error('root elemanı bulunamadı')

createRoot(container).render(<App />)
