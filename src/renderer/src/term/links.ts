/** Dosya yolu algılama — terminal çıktısındaki yolları tıklanabilir yapar.
 *
 *  URL'ler `@xterm/addon-web-links` tarafından ele alınır; bu sağlayıcı yalnız
 *  DOSYA YOLLARINI hedefler. Yanlış pozitifi sınırlamak için sadece mutlak
 *  yollar ve `./`, `../` ile başlayan göreli yollar eşleşir.
 *
 *  Tıklama dosyayı ÇALIŞTIRMAZ: main süreç `shell.openPath` ile işletim
 *  sisteminin varsayılan davranışını uygular ve yolun var olduğunu doğrular. */
import type { ILink, ILinkProvider, Terminal } from '@xterm/xterm'

/** Windows sürücü yolları, `./` göreli yollar ve POSIX mutlak yolları. */
const PATH_PATTERN =
  /(?:[A-Za-z]:[\\/][^\s"'`<>|*?]+)|(?:\.{1,2}[\\/][^\s"'`<>|*?]+)|(?:\/(?:[\w.\-@+]+\/)*[\w.\-@+]+)/g

/** Sondaki noktalama işaretleri ve `:satır:sütun` eki yola dahil edilmez. */
function normalizePath(text: string): string {
  return text.replace(/(?::\d+){1,2}$/, '').replace(/[),.;:'"\]]+$/, '')
}

export function createFilePathLinkProvider(term: Terminal, resolveBase: () => string): ILinkProvider {
  return {
    provideLinks(bufferLineNumber, callback) {
      const line = term.buffer.active.getLine(bufferLineNumber - 1)
      if (!line) {
        callback(undefined)
        return
      }
      const text = line.translateToString(true)
      const links: ILink[] = []

      PATH_PATTERN.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = PATH_PATTERN.exec(text)) !== null) {
        const raw = normalizePath(match[0])
        // Çok kısa eşleşmeler neredeyse her zaman yanlış pozitiftir
        if (raw.length < 4) continue
        const startX = match.index + 1
        links.push({
          range: {
            start: { x: startX, y: bufferLineNumber },
            end: { x: startX + raw.length - 1, y: bufferLineNumber },
          },
          text: raw,
          activate: () => {
            const isAbsolute = /^[A-Za-z]:[\\/]/.test(raw) || raw.startsWith('/')
            const base = resolveBase().replace(/[\\/]+$/, '')
            const absolute = isAbsolute ? raw : `${base}/${raw.replace(/^\.[\\/]/, '')}`
            void window.consul.app.openPath(absolute).catch(() => {
              // Yol yoksa sessiz kal — yanlış pozitif olabilir
            })
          },
        })
      }

      callback(links.length > 0 ? links : undefined)
    },
  }
}
