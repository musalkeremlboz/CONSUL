/** Ana pencere.
 *
 *  Güvenlik duruşu (talimat §15):
 *   - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
 *   - Renderer'dan gezinme ve yeni pencere açma ENGELLİ; http(s) bağlantıları
 *     kullanıcının varsayılan tarayıcısına devredilir.
 *   - Preload dışında hiçbir Node yeteneği renderer'a sızmaz. */
import { BrowserWindow, nativeTheme, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { windowBackgroundFor, type Appearance } from '../../shared/theme'
import { getSettings } from '../settings'

/** Ayarlardaki tercih + sistem tercihinden etkin görünümü hesaplar. */
export function effectiveAppearance(): Appearance {
  const mode = getSettings().uiTheme
  if (mode === 'system') return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  return mode
}

function iconPath(): string | undefined {
  // Paketli sürümde exe'nin gömülü ikonu geçerlidir; dev'de dosyadan veririz.
  const dev = join(__dirname, '../../build/icon-256.png')
  return existsSync(dev) ? dev : undefined
}

export function createMainWindow(): BrowserWindow {
  const icon = iconPath()
  const win = new BrowserWindow({
    ...(icon ? { icon } : {}),
    width: 1200,
    height: 780,
    // Terminal + sekme çubuğu + durum çubuğu işlevini kaybetmeden küçülebilir
    minWidth: 640,
    minHeight: 420,
    show: false,
    backgroundColor: windowBackgroundFor(effectiveAppearance()),
    title: 'CONSUL',
    titleBarStyle: 'hidden',
    // macOS'ta yerel trafik ışıkları gömülü başlık çubuğunda kalsın
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 14, y: 14 } } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

/** Yalnız http/https şemalarını dış tarayıcıya açar (file:, javascript: reddedilir). */
export function openExternalSafely(url: string): void {
  try {
    const parsed = new URL(String(url))
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      void shell.openExternal(parsed.href)
    }
  } catch {
    // geçersiz URL — yoksay
  }
}
