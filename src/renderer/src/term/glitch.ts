/** CONSUL imzası: ANSI-bold vurgu overlay'i.
 *
 *  Akış duraksayınca GÖRÜNÜR tampon satırları taranır (akıştan SGR ayrıştırmak
 *  yerine — TUI'lerin yeniden çizimleri bayt konumlarını geçersiz kılar), kalın
 *  hücre koşularına dekorasyon bindirilir; yeni veri gelince temizlenir.
 *
 *  Alternatif tamponda (tam ekran TUI) xterm dekorasyon desteklemez → kendini
 *  otomatik devre dışı bırakır. */
import type { IDecoration, IDisposable, Terminal } from '@xterm/xterm'

export interface GlitchOptions {
  /** Akış durduktan sonra tarama gecikmesi (ms). */
  idleMs?: number
  /** Aynı anda en fazla vurgu sayısı. */
  maxRuns?: number
  /** Vurgulanacak en kısa kalın koşu (hücre). */
  minRunWidth?: number
}

export function attachGlitchHighlights(term: Terminal, opts: GlitchOptions = {}): IDisposable {
  const idleMs = opts.idleMs ?? 500
  const maxRuns = opts.maxRuns ?? 40
  const minRunWidth = opts.minRunWidth ?? 2

  let timer: number | undefined
  let decorations: IDecoration[] = []
  let disposed = false

  const clear = (): void => {
    for (const deco of decorations) {
      try {
        deco.dispose()
      } catch {
        // zaten dispose edilmiş olabilir
      }
    }
    decorations = []
  }

  const scan = (): void => {
    if (disposed || term.buffer.active.type === 'alternate') return
    clear()
    const buffer = term.buffer.active
    const top = buffer.viewportY
    const cursorAbs = buffer.baseY + buffer.cursorY
    let runs = 0

    for (let vy = 0; vy < term.rows && runs < maxRuns; vy++) {
      const line = buffer.getLine(top + vy)
      if (!line) continue
      let x = 0
      while (x < line.length && runs < maxRuns) {
        const cell = line.getCell(x)
        if (cell && cell.isBold() !== 0 && cell.getChars().trim() !== '') {
          let end = x + 1
          while (end < line.length) {
            const next = line.getCell(end)
            if (!next || next.isBold() === 0) break
            end++
          }
          const width = end - x
          if (width >= minRunWidth) {
            const marker = term.registerMarker(top + vy - cursorAbs)
            if (marker) {
              const deco = term.registerDecoration({ marker, x, width, layer: 'top' })
              if (deco) {
                deco.onRender((el) => {
                  if (!el.classList.contains('c-glitch-run')) el.classList.add('c-glitch-run')
                })
                decorations.push(deco)
                runs++
              }
            }
          }
          x = end
        } else {
          x++
        }
      }
    }
  }

  const onWrite = term.onWriteParsed(() => {
    clear()
    if (timer !== undefined) window.clearTimeout(timer)
    timer = window.setTimeout(scan, idleMs)
  })
  const onBufferChange = term.buffer.onBufferChange(() => clear())

  return {
    dispose(): void {
      disposed = true
      if (timer !== undefined) window.clearTimeout(timer)
      clear()
      onWrite.dispose()
      onBufferChange.dispose()
    },
  }
}
