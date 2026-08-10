/** Tek bir terminal oturumunun görünümü.
 *
 *  PTY ömrü bileşen ömrüne bağlıdır: mount'ta doğar, unmount'ta ölür. Sekme
 *  gizlendiğinde bileşen SÖKÜLMEZ (yalnız CSS ile gizlenir) — böylece arka
 *  plandaki oturum çalışmaya devam eder ve geçmişi korunur. */
import { useEffect, useRef, useState } from 'react'
import type { TerminalPalette } from '../../../shared/theme'
import type { CursorStyle } from '../../../shared/types'
import { createTerminal, type TerminalHandle } from '../term/createTerminal'
import type { TabStatus } from '../state/tabs'
import { TerminalSearch } from './TerminalSearch'

interface Props {
  tabKey: string
  cwd: string
  shellId: string
  active: boolean
  fontFamily: string
  fontSize: number
  lineHeight: number
  cursorStyle: CursorStyle
  cursorBlink: boolean
  scrollback: number
  palette: TerminalPalette
  glitchHighlights: boolean
  status: TabStatus
  exitCode?: number
  searchOpen: boolean
  onSearchClose: () => void
  onExited: (tabKey: string, exitCode: number) => void
  onCloseRequest: (tabKey: string) => void
  onRestart: (tabKey: string) => void
  onReady: (tabKey: string, handle: TerminalHandle) => void
}

export function TerminalView(props: Props) {
  const {
    tabKey,
    cwd,
    shellId,
    active,
    fontFamily,
    fontSize,
    lineHeight,
    cursorStyle,
    cursorBlink,
    scrollback,
    palette,
    glitchHighlights,
    status,
    exitCode,
    searchOpen,
    onSearchClose,
    onExited,
    onCloseRequest,
    onRestart,
    onReady,
  } = props

  const hostRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<TerminalHandle | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Geri çağırımları ref'te tutarız: kimlikleri değişse de terminal yeniden kurulmaz
  const onExitedRef = useRef(onExited)
  onExitedRef.current = onExited
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useEffect(() => {
    let disposed = false
    let cleanup: (() => void) | null = null

    void (async () => {
      if (!hostRef.current) return
      try {
        const handle = await createTerminal({
          host: hostRef.current,
          cwd,
          shellId,
          fontFamily,
          fontSize,
          lineHeight,
          cursorStyle,
          cursorBlink,
          scrollback,
          palette,
          glitchHighlights,
          onExit: (code) => onExitedRef.current(tabKey, code),
        })
        if (disposed) {
          handle.dispose()
          return
        }
        handleRef.current = handle
        cleanup = () => handle.dispose()
        onReadyRef.current(tabKey, handle)
        if (active) handle.onShown()
      } catch (err) {
        if (!disposed) setError(err instanceof Error ? err.message : String(err))
      }
    })()

    return () => {
      disposed = true
      cleanup?.()
      handleRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bilinçli: yalnız mount/unmount
  }, [])

  useEffect(() => {
    if (active) handleRef.current?.onShown()
  }, [active])

  useEffect(() => {
    handleRef.current?.setFontSize(fontSize)
  }, [fontSize])

  useEffect(() => {
    handleRef.current?.setFontFamily(fontFamily)
  }, [fontFamily])

  useEffect(() => {
    handleRef.current?.setPalette(palette)
  }, [palette])

  useEffect(() => {
    handleRef.current?.setCursor(cursorStyle, cursorBlink)
  }, [cursorStyle, cursorBlink])

  useEffect(() => {
    handleRef.current?.setGlitch(glitchHighlights)
  }, [glitchHighlights])

  return (
    <div
      className={'c-terminal' + (active ? '' : ' is-hidden')}
      style={
        {
          '--term-bg': palette.background,
          '--term-fg': palette.foreground,
        } as React.CSSProperties
      }
    >
      <div ref={hostRef} className="c-terminal__host" />

      {searchOpen && active && (
        <TerminalSearch
          onSearch={(query, forward) => handleRef.current?.search(query, forward) ?? false}
          onClose={() => {
            handleRef.current?.clearSearch()
            onSearchClose()
          }}
        />
      )}

      {error && (
        <div className="c-terminal__overlay">
          <p className="c-terminal__overlay-title">TERMİNAL BAŞLATILAMADI</p>
          <p className="c-terminal__overlay-message">{error}</p>
          <div className="c-terminal__overlay-actions">
            <button type="button" className="c-btn c-btn--primary" onClick={() => onRestart(tabKey)}>
              YENİDEN DENE
            </button>
            <button type="button" className="c-btn" onClick={() => onCloseRequest(tabKey)}>
              SEKMEYİ KAPAT
            </button>
          </div>
        </div>
      )}

      {!error && status === 'exited' && (
        <div className="c-terminal__overlay">
          <p className="c-terminal__overlay-title">
            OTURUM SONA ERDİ{typeof exitCode === 'number' ? ` — ÇIKIŞ KODU ${exitCode}` : ''}
          </p>
          <div className="c-terminal__overlay-actions">
            <button type="button" className="c-btn c-btn--primary" onClick={() => onRestart(tabKey)}>
              YENİDEN BAŞLAT
            </button>
            <button type="button" className="c-btn" onClick={() => onCloseRequest(tabKey)}>
              SEKMEYİ KAPAT
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
