/** Terminal içi arama çubuğu (xterm search addon üstünde). */
import { useEffect, useRef, useState } from 'react'

interface Props {
  onSearch: (query: string, forward: boolean) => boolean
  onClose: () => void
}

export function TerminalSearch({ onSearch, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [miss, setMiss] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const run = (forward: boolean): void => {
    if (!query) return
    setMiss(!onSearch(query, forward))
  }

  return (
    <div className="c-search" role="search">
      <input
        ref={inputRef}
        className={'c-search__input' + (miss ? ' is-miss' : '')}
        value={query}
        placeholder="Terminalde ara…"
        aria-label="Terminalde ara"
        onChange={(event) => {
          setQuery(event.target.value)
          setMiss(false)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            run(!event.shiftKey)
          } else if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          }
        }}
      />
      <button type="button" className="c-search__btn" onClick={() => run(false)} aria-label="Önceki eşleşme">
        ↑
      </button>
      <button type="button" className="c-search__btn" onClick={() => run(true)} aria-label="Sonraki eşleşme">
        ↓
      </button>
      <button type="button" className="c-search__btn" onClick={onClose} aria-label="Aramayı kapat">
        ✕
      </button>
    </div>
  )
}
