/** Sekme çubuğu — sürükleyerek sıralama, çift tıkla yeniden adlandırma,
 *  orta tıkla kapatma, sağ tıkla bağlam menüsü. */
import { useRef, useState } from 'react'
import type { Tab } from '../state/tabs'
import { shortcutLabel } from '../state/shortcuts'

interface Props {
  tabs: Tab[]
  activeKey: string | null
  onSelect: (key: string) => void
  onClose: (key: string) => void
  onNew: () => void
  onMove: (from: number, to: number) => void
  onRename: (key: string) => void
  onDuplicate: (key: string) => void
}

interface MenuState {
  key: string
  x: number
  y: number
}

export function TabBar({ tabs, activeKey, onSelect, onClose, onNew, onMove, onRename, onDuplicate }: Props) {
  const dragIndex = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)

  return (
    <div className="c-tabs" role="tablist" aria-label="Terminal sekmeleri">
      <div className="c-tabs__list">
        {tabs.map((tab, index) => (
          <div
            key={tab.key}
            role="tab"
            tabIndex={0}
            aria-selected={tab.key === activeKey}
            className={
              'c-tab' +
              (tab.key === activeKey ? ' is-active' : '') +
              (tab.status === 'exited' ? ' is-exited' : '') +
              (dragOver === index ? ' is-dragover' : '')
            }
            draggable
            onDragStart={() => {
              dragIndex.current = index
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setDragOver(index)
            }}
            onDragLeave={() => setDragOver((current) => (current === index ? null : current))}
            onDrop={(event) => {
              event.preventDefault()
              setDragOver(null)
              const from = dragIndex.current
              dragIndex.current = null
              if (from !== null && from !== index) onMove(from, index)
            }}
            onDragEnd={() => {
              dragIndex.current = null
              setDragOver(null)
            }}
            onClick={() => onSelect(tab.key)}
            onDoubleClick={() => onRename(tab.key)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(tab.key)
              }
            }}
            onAuxClick={(event) => {
              if (event.button === 1) {
                event.preventDefault()
                onClose(tab.key)
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault()
              setMenu({ key: tab.key, x: event.clientX, y: event.clientY })
            }}
            title={tab.cwd}
          >
            <span className="c-tab__dot" aria-hidden="true" />
            <span className="c-tab__title">{tab.title}</span>
            <button
              type="button"
              className="c-tab__close"
              aria-label={`${tab.title} sekmesini kapat`}
              onClick={(event) => {
                event.stopPropagation()
                onClose(tab.key)
              }}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="c-tabs__new"
          onClick={onNew}
          title={`Yeni sekme (${shortcutLabel('tab.new')})`}
          aria-label="Yeni sekme"
        >
          +
        </button>
      </div>

      {menu && (
        <>
          <div className="c-menu__scrim" onMouseDown={() => setMenu(null)} />
          <div className="c-menu" style={{ left: menu.x, top: menu.y }} role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onRename(menu.key)
                setMenu(null)
              }}
            >
              Yeniden adlandır
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onDuplicate(menu.key)
                setMenu(null)
              }}
            >
              Sekmeyi çoğalt
            </button>
            <button
              type="button"
              role="menuitem"
              className="is-danger"
              onClick={() => {
                onClose(menu.key)
                setMenu(null)
              }}
            >
              Kapat
            </button>
          </div>
        </>
      )}
    </div>
  )
}
