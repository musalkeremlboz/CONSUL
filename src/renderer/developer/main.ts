/** CONSUL Developer arayüzü — kasıtlı olarak tek bir terminal yüzeyi.
 *
 *  React yok, tema yok, sekme yok, animasyon yok, panel yok (talimat §25).
 *  Bu dosya bilinçli olarak küçüktür ve küçük kalmalıdır. */
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { ClipboardAddon } from '@xterm/addon-clipboard'
import '@xterm/xterm/css/xterm.css'
import './developer.css'
import type { ConsulDeveloperApi } from '../../preload/developer'

declare global {
  interface Window {
    consulDev: ConsulDeveloperApi
  }
}

const host = document.getElementById('terminal')
if (!host) throw new Error('terminal host bulunamadı')

const term = new Terminal({
  allowProposedApi: true,
  fontFamily: '"Cascadia Mono", "DejaVu Sans Mono", Menlo, Consolas, monospace',
  fontSize: 14,
  cursorBlink: true,
  scrollback: 20_000,
  theme: {
    background: '#000000',
    foreground: '#E6E6E6',
    cursor: '#E6E6E6',
    selectionBackground: 'rgba(255, 255, 255, 0.25)',
  },
})

const fit = new FitAddon()
term.loadAddon(new Unicode11Addon())
term.unicode.activeVersion = '11'
term.loadAddon(fit)
term.loadAddon(new ClipboardAddon())
term.open(host)

function safeFit(): void {
  const dims = fit.proposeDimensions()
  if (!dims || !Number.isFinite(dims.cols) || !Number.isFinite(dims.rows)) return
  if (dims.cols < 2 || dims.rows < 1) return
  fit.fit()
  window.consulDev.resize(term.cols, term.rows)
}

term.onData((data) => window.consulDev.write(data))

window.consulDev.onData(({ data }) => term.write(data))
window.consulDev.onExit(({ exitCode }) => {
  term.write(`\r\n\x1b[2m— oturum sona erdi (çıkış kodu ${exitCode}). Yeniden başlatmak için Ctrl+R —\x1b[0m\r\n`)
})

// Ctrl+R → oturumu yeniden başlat. Kalan her tuş terminale gider.
term.attachCustomKeyEventHandler((event) => {
  if (event.type !== 'keydown') return true
  const primary = event.ctrlKey || event.metaKey
  if (primary && event.shiftKey && event.key.toLowerCase() === 'c') {
    const selection = term.getSelection()
    if (selection) void navigator.clipboard.writeText(selection)
    event.preventDefault()
    return false
  }
  if (primary && event.shiftKey && event.key.toLowerCase() === 'v') {
    void navigator.clipboard.readText().then((text) => {
      if (text) term.paste(text)
    })
    event.preventDefault()
    return false
  }
  if (primary && !event.shiftKey && event.key.toLowerCase() === 'r') {
    event.preventDefault()
    term.reset()
    void start(true)
    return false
  }
  return true
})

async function start(restart = false): Promise<void> {
  try {
    const info = restart
      ? await window.consulDev.restart(term.cols, term.rows)
      : await window.consulDev.bootstrap(term.cols, term.rows)
    if (info.banner) term.write(info.banner.replace(/\n/g, '\r\n'))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    term.write(`\r\n\x1b[1;31mTerminal başlatılamadı:\x1b[0m ${message}\r\n`)
  }
}

const observer = new ResizeObserver(() => safeFit())
observer.observe(host)

void document.fonts.ready.then(async () => {
  safeFit()
  await start()
  term.focus()
})
