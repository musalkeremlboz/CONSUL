/** Terminal örneği kurulumu — xterm + eklentiler + PTY köprüsü.
 *
 *  Gecikme kritik olduğundan (talimat §16):
 *   - Çıktı main tarafında tamponlanır; burada yazım geri çağırısıyla ACK verilir
 *     (renderer yetişemezse main PTY'yi duraklatır).
 *   - Boyutlandırma 60 ms trailing debounce ile yapılır ve anlamsız ölçüler atlanır.
 *   - WebGL renderer denenir; bağlam kaybında DOM renderer devralır.
 *   - React durumu terminal çıktısıyla GÜNCELLENMEZ — her tuş vuruşunda yeniden
 *     render olmaması için tüm veri akışı doğrudan xterm'e gider. */
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebglAddon } from '@xterm/addon-webgl'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { ClipboardAddon } from '@xterm/addon-clipboard'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import type { TerminalPalette } from '../../../shared/theme'
import type { CursorStyle } from '../../../shared/types'
import { attachGlitchHighlights } from './glitch'
import { attachKeyHandling } from './keys'
import { createFilePathLinkProvider } from './links'

export interface TerminalOptions {
  host: HTMLElement
  cwd: string
  shellId: string
  fontFamily: string
  fontSize: number
  lineHeight: number
  cursorStyle: CursorStyle
  cursorBlink: boolean
  scrollback: number
  palette: TerminalPalette
  glitchHighlights: boolean
  onExit: (exitCode: number) => void
}

export interface TerminalHandle {
  term: Terminal
  ptyId: string
  onShown(): void
  setFontSize(size: number): void
  setFontFamily(family: string): void
  setPalette(palette: TerminalPalette): void
  setCursor(style: CursorStyle, blink: boolean): void
  setGlitch(enabled: boolean): void
  clear(): void
  search(query: string, forward: boolean): boolean
  clearSearch(): void
  dispose(): void
}

const FALLBACK_FONTS = '"IBM Plex Mono", "Cascadia Mono", "DejaVu Sans Mono", Menlo, Consolas, monospace'

function fontStack(family: string): string {
  const clean = family.trim()
  return clean ? `"${clean.replace(/"/g, '')}", ${FALLBACK_FONTS}` : FALLBACK_FONTS
}

export async function createTerminal(opts: TerminalOptions): Promise<TerminalHandle> {
  const term = new Terminal({
    allowProposedApi: true,
    fontFamily: fontStack(opts.fontFamily),
    fontSize: opts.fontSize,
    lineHeight: opts.lineHeight,
    fontWeightBold: '700',
    drawBoldTextInBrightColors: true,
    cursorBlink: opts.cursorBlink,
    cursorStyle: opts.cursorStyle,
    scrollback: opts.scrollback,
    minimumContrastRatio: 1,
    theme: opts.palette,
  })

  // Eklenti sırası önemli: unicode11 → fit → clipboard → search → links → open() → webgl
  const fit = new FitAddon()
  const search = new SearchAddon()
  term.loadAddon(new Unicode11Addon())
  term.unicode.activeVersion = '11'
  term.loadAddon(fit)
  term.loadAddon(new ClipboardAddon())
  term.loadAddon(search)
  term.loadAddon(
    new WebLinksAddon((event, uri) => {
      event.preventDefault()
      window.consul.app.openExternal(uri)
    })
  )

  term.open(opts.host)

  const currentCwd = opts.cwd
  const linkDisposable = term.registerLinkProvider(createFilePathLinkProvider(term, () => currentCwd))

  try {
    const webgl = new WebglAddon()
    webgl.onContextLoss(() => webgl.dispose())
    term.loadAddon(webgl)
  } catch {
    // DOM renderer ile devam — görsel olarak aynı, yalnız daha yavaş
  }

  // Font yüklenmeden ölçüm yapılırsa kolon genişliği yanlış hesaplanır
  await document.fonts.ready
  fit.fit()

  const { id: ptyId } = await window.consul.pty.create({
    shellId: opts.shellId,
    cwd: opts.cwd,
    cols: term.cols,
    rows: term.rows,
  })

  let alive = true

  const offData = window.consul.pty.onData(({ id, data }) => {
    if (id !== ptyId) return
    // ACK yazım tamamlandığında verilir → main akış kontrolünü buna göre yapar
    term.write(data, () => window.consul.pty.ack(ptyId, data.length))
  })

  const offExit = window.consul.pty.onExit(({ id, exitCode }) => {
    if (id !== ptyId) return
    alive = false
    opts.onExit(exitCode)
  })

  const inputDisposable = term.onData((data) => window.consul.pty.write(ptyId, data))
  attachKeyHandling(term, ptyId)

  let glitch = opts.glitchHighlights ? attachGlitchHighlights(term) : null

  let resizeTimer: number | undefined
  const doFit = (): void => {
    const dims = fit.proposeDimensions()
    if (!dims || !Number.isFinite(dims.cols) || !Number.isFinite(dims.rows)) return
    if (dims.cols < 2 || dims.rows < 1) return
    if (dims.cols === term.cols && dims.rows === term.rows) return
    fit.fit()
    window.consul.pty.resize(ptyId, term.cols, term.rows)
  }
  const observer = new ResizeObserver(() => {
    window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(doFit, 60)
  })
  observer.observe(opts.host)

  return {
    term,
    ptyId,
    onShown() {
      // Sekme gizliyken ölçüler geçersizdir; görünür olunca yeniden ölç
      window.setTimeout(() => {
        doFit()
        term.focus()
      }, 0)
    },
    setFontSize(size) {
      term.options.fontSize = size
      doFit()
    },
    setFontFamily(family) {
      term.options.fontFamily = fontStack(family)
      doFit()
    },
    setPalette(palette) {
      term.options.theme = palette
    },
    setCursor(style, blink) {
      term.options.cursorStyle = style
      term.options.cursorBlink = blink
    },
    setGlitch(enabled) {
      if (enabled && !glitch) glitch = attachGlitchHighlights(term)
      if (!enabled && glitch) {
        glitch.dispose()
        glitch = null
      }
    },
    clear() {
      term.clear()
    },
    search(query, forward) {
      if (!query) {
        search.clearDecorations()
        return false
      }
      const options = {
        decorations: {
          matchOverviewRuler: '#E63946',
          activeMatchColorOverviewRuler: '#FFFFFF',
          matchBackground: 'rgba(230, 57, 70, 0.35)',
          activeMatchBackground: 'rgba(230, 57, 70, 0.75)',
        },
      }
      return forward ? search.findNext(query, options) : search.findPrevious(query, options)
    },
    clearSearch() {
      search.clearDecorations()
    },
    dispose() {
      observer.disconnect()
      window.clearTimeout(resizeTimer)
      glitch?.dispose()
      linkDisposable.dispose()
      offData()
      offExit()
      inputDisposable.dispose()
      if (alive) window.consul.pty.kill(ptyId)
      term.dispose()
    },
  }
}
