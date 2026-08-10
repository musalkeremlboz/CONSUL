/** Modal kabuğu — işletim sistemi diyalogları KULLANILMAZ.
 *
 *  `window.confirm` / `window.prompt` Electron'da ya engellenir ya da pencereyi
 *  kilitler; ayrıca uygulamanın görsel kimliğiyle uyumsuzdur. Tüm onay ve giriş
 *  akışları bu bileşenin üstüne kurulur.
 *
 *  Erişilebilirlik: Esc kapatır, odak modalın içine hapsedilir, açılışta ilk
 *  odaklanabilir öğeye odak verilir. */
import { useCallback, useEffect, useRef, type ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
  onDismiss: () => void
  /** Alt aksiyon çubuğu. */
  footer?: ReactNode
  /** Geniş içerik (ayarlar) için. */
  wide?: boolean
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ title, children, onDismiss, footer, wide }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  const trapFocus = useCallback((event: KeyboardEvent) => {
    const panel = panelRef.current
    if (!panel || event.key !== 'Tab') return
    const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }, [])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onDismiss()
        return
      }
      trapFocus(event)
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
      previous?.focus?.()
    }
  }, [onDismiss, trapFocus])

  return (
    <div className="c-modal" role="presentation" onMouseDown={onDismiss}>
      <div
        ref={panelRef}
        className={'c-modal__panel' + (wide ? ' c-modal__panel--wide' : '')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="c-modal__head">
          <h2 className="c-modal__title">{title}</h2>
          <button type="button" className="c-modal__close" onClick={onDismiss} aria-label="Kapat">
            ✕
          </button>
        </header>
        <div className="c-modal__body">{children}</div>
        {footer && <footer className="c-modal__foot">{footer}</footer>}
      </div>
    </div>
  )
}
