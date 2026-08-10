/** Komut paleti — klavye odaklı kullanımın merkezi.
 *
 *  Girdiler `state/shortcuts.ts` kayıt defterinden gelir; yeni komut eklemek
 *  için palete ayrıca dokunmak gerekmez. Ek olarak son projeler de listelenir. */
import { useMemo, useState } from 'react'
import { COMMANDS, comboLabel, type CommandId } from '../state/shortcuts'
import { Modal } from '../ui/Modal'

interface Props {
  recents: string[]
  onCommand: (id: CommandId) => void
  onOpenRecent: (path: string) => void
  onDismiss: () => void
}

interface Row {
  key: string
  label: string
  group: string
  hint: string
  run: () => void
}

function normalize(text: string): string {
  return text.toLocaleLowerCase('tr')
}

export function CommandPalette({ recents, onCommand, onOpenRecent, onDismiss }: Props) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  const rows = useMemo<Row[]>(() => {
    const commandRows: Row[] = COMMANDS.map((command) => ({
      key: `cmd:${command.id}`,
      label: command.label,
      group: command.group,
      hint: command.combos[0] ? comboLabel(command.combos[0]) : '',
      run: () => onCommand(command.id),
    }))
    const recentRows: Row[] = recents.map((path) => ({
      key: `recent:${path}`,
      label: path.split(/[\\/]/).filter(Boolean).pop() ?? path,
      group: 'Son projeler',
      hint: path,
      run: () => onOpenRecent(path),
    }))
    return [...commandRows, ...recentRows]
  }, [recents, onCommand, onOpenRecent])

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return rows
    return rows.filter((row) => normalize(`${row.label} ${row.group} ${row.hint}`).includes(q))
  }, [rows, query])

  const active = filtered[Math.min(cursor, Math.max(0, filtered.length - 1))]

  return (
    <Modal title="KOMUT PALETİ" onDismiss={onDismiss} wide>
      <input
        className="c-input c-palette__input"
        value={query}
        autoFocus
        placeholder="Komut veya proje ara…"
        aria-label="Komut ara"
        onChange={(event) => {
          setQuery(event.target.value)
          setCursor(0)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setCursor((c) => Math.min(c + 1, filtered.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setCursor((c) => Math.max(c - 1, 0))
          } else if (event.key === 'Enter') {
            event.preventDefault()
            if (active) {
              onDismiss()
              active.run()
            }
          }
        }}
      />

      <ul className="c-palette__list" role="listbox" aria-label="Komutlar">
        {filtered.length === 0 && <li className="c-palette__empty">Eşleşen komut yok.</li>}
        {filtered.map((row, index) => (
          <li key={row.key}>
            <button
              type="button"
              role="option"
              aria-selected={row === active}
              className={'c-palette__row' + (row === active ? ' is-active' : '')}
              onMouseEnter={() => setCursor(index)}
              onClick={() => {
                onDismiss()
                row.run()
              }}
            >
              <span className="c-palette__group">{row.group}</span>
              <span className="c-palette__label">{row.label}</span>
              <span className="c-palette__hint" lang="en">
                {row.hint}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
