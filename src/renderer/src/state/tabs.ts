/** Sekme durumu — saf reducer (React'e bağlı değil, test edilebilir).
 *
 *  Her sekmenin kendi kabuğu, kendi çalışma dizini, kendi süreç durumu ve kendi
 *  geçmişi vardır. Sekme kapanınca ilgili PTY'nin öldürülmesi `TerminalView`'un
 *  ömür döngüsüne bağlıdır (bileşen sökülünce oturum sonlanır). */

export type TabStatus = 'running' | 'exited'

export interface Tab {
  key: string
  /** Kullanıcı yeniden adlandırdıysa sabit başlık. */
  title: string
  /** Kullanıcı elle isim verdi mi (otomatik başlık artık ezilmez). */
  renamed: boolean
  cwd: string
  shellId: string
  status: TabStatus
  exitCode?: number
}

export interface TabsState {
  tabs: Tab[]
  activeKey: string | null
}

export const initialTabs: TabsState = { tabs: [], activeKey: null }

export type TabsAction =
  | { type: 'add'; tab: Tab }
  | { type: 'close'; key: string }
  | { type: 'activate'; key: string }
  | { type: 'exit'; key: string; exitCode: number }
  | { type: 'rename'; key: string; title: string }
  | { type: 'move'; from: number; to: number }
  | { type: 'setCwd'; key: string; cwd: string }

function nextActiveAfterClose(state: TabsState, closedIndex: number): string | null {
  const remaining = state.tabs.filter((_, i) => i !== closedIndex)
  if (remaining.length === 0) return null
  const fallback = remaining[Math.min(closedIndex, remaining.length - 1)]
  return fallback.key
}

export function tabsReducer(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case 'add':
      return { tabs: [...state.tabs, action.tab], activeKey: action.tab.key }

    case 'close': {
      const index = state.tabs.findIndex((t) => t.key === action.key)
      if (index === -1) return state
      const tabs = state.tabs.filter((_, i) => i !== index)
      const activeKey =
        state.activeKey === action.key ? nextActiveAfterClose(state, index) : state.activeKey
      return { tabs, activeKey }
    }

    case 'activate':
      return state.tabs.some((t) => t.key === action.key) ? { ...state, activeKey: action.key } : state

    case 'exit':
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.key === action.key ? { ...t, status: 'exited', exitCode: action.exitCode } : t
        ),
      }

    case 'rename': {
      const title = action.title.trim().slice(0, 60)
      if (!title) return state
      return {
        ...state,
        tabs: state.tabs.map((t) => (t.key === action.key ? { ...t, title, renamed: true } : t)),
      }
    }

    case 'move': {
      const { from, to } = action
      if (from === to) return state
      if (from < 0 || from >= state.tabs.length || to < 0 || to >= state.tabs.length) return state
      const tabs = [...state.tabs]
      const [moved] = tabs.splice(from, 1)
      tabs.splice(to, 0, moved)
      return { ...state, tabs }
    }

    case 'setCwd':
      return {
        ...state,
        tabs: state.tabs.map((t) => (t.key === action.key ? { ...t, cwd: action.cwd } : t)),
      }

    default:
      return state
  }
}

/** Klasör yolundan varsayılan sekme başlığı. */
export function titleForPath(cwd: string): string {
  const clean = cwd.replace(/[\\/]+$/, '')
  const name = clean.split(/[\\/]/).pop()
  return name || clean || 'terminal'
}
