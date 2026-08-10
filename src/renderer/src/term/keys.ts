/** Terminal klavye kuralları.
 *
 *  Uygulama kısayolları (yeni sekme, sekme değiştirme, komut paleti, arama…)
 *  xterm'e yutturulmaz — `App` bunları yakalar. Geri kalan HER ŞEY terminale
 *  gider; Ctrl+C dahil (çalışan süreci kesmek kullanıcının hakkıdır). */
import type { Terminal } from '@xterm/xterm'
import { isAppShortcut } from '../state/shortcuts'

export function attachKeyHandling(term: Terminal, ptyId: string): void {
  term.attachCustomKeyEventHandler((event) => {
    if (event.type !== 'keydown') return true

    // Shift+Enter → satır atlama dizisi (TUI ajanlarının beklediği biçim)
    if (event.key === 'Enter' && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      window.consul.pty.write(ptyId, '\x1b\r')
      event.preventDefault()
      return false
    }

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

    // Uygulamaya ait kısayollar terminale GİTMEZ
    if (isAppShortcut(event)) return false

    return true
  })
}
