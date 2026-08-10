/** Pencere düğmeleri (küçült / büyüt / kapat).
 *
 *  macOS'ta işletim sisteminin kendi trafik ışıkları kullanıldığı için bu
 *  bileşen çizilmez — platform geleneğine uyulur. */
import { useEffect, useState } from 'react'
import { IS_MAC } from '../state/shortcuts'

export function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.consul.win.isMaximized().then(setMaximized)
    return window.consul.win.onMaximizedChange(setMaximized)
  }, [])

  if (IS_MAC) return null

  return (
    <div className="c-wincontrols">
      <button
        type="button"
        className="c-wincontrols__btn"
        onClick={() => window.consul.win.minimize()}
        aria-label="Küçült"
        title="Küçült"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button
        type="button"
        className="c-wincontrols__btn"
        onClick={() => window.consul.win.maximizeToggle()}
        aria-label={maximized ? 'Önceki boyut' : 'Büyüt'}
        title={maximized ? 'Önceki boyut' : 'Büyüt'}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          {maximized ? (
            <>
              <rect x="0" y="2" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
              <path d="M2 2V0h8v8H8" fill="none" stroke="currentColor" strokeWidth="1" />
            </>
          ) : (
            <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
          )}
        </svg>
      </button>
      <button
        type="button"
        className="c-wincontrols__btn c-wincontrols__btn--close"
        onClick={() => window.consul.win.close()}
        aria-label="Kapat"
        title="Kapat"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M0 0l10 10M10 0L0 10" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
    </div>
  )
}
