/** CONSUL uygulama kabuğu.
 *
 *  Sorumluluğu düzen ve orkestrasyondur: terminal verisi buradan GEÇMEZ
 *  (her tuş vuruşunda React render'ı olmaması için akış doğrudan xterm'e gider).
 *  Klavye kısayolları `state/shortcuts.ts` kayıt defterinden çözülür. */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { getTerminalScheme } from '../../shared/theme'
import type { BootFlags, ProjectInfo, Settings, UpdateStatus } from '../../shared/types'
import { CommandPalette } from './components/CommandPalette'
import { HomeView } from './components/HomeView'
import { SettingsPanel } from './components/SettingsPanel'
import { StatusBar } from './components/StatusBar'
import { TabBar } from './components/TabBar'
import { TerminalView } from './components/TerminalView'
import { TitleBar } from './components/TitleBar'
import { UpdateBanner } from './components/UpdateBanner'
import { DEFAULT_FONT, MAX_FONT, MIN_FONT } from './state/fontLimits'
import { matchCommand, type CommandId } from './state/shortcuts'
import { initialTabs, tabsReducer, titleForPath, type Tab } from './state/tabs'
import type { TerminalHandle } from './term/createTerminal'
import { ConfirmDialog, PromptDialog } from './ui/Dialogs'
import { applyUiTheme, watchSystemAppearance } from './ui/theme'

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [boot, setBoot] = useState<BootFlags | null>(null)
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [update, setUpdate] = useState<UpdateStatus | null>(null)
  const [memoRoot, setMemoRoot] = useState<string | null>(null)
  const [state, dispatch] = useReducer(tabsReducer, initialTabs)

  const [showHome, setShowHome] = useState(true)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [pendingClose, setPendingClose] = useState<Tab | null>(null)
  const [renaming, setRenaming] = useState<Tab | null>(null)
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const handles = useRef(new Map<string, TerminalHandle>())
  const stateRef = useRef(state)
  stateRef.current = state
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const projectRef = useRef(project)
  projectRef.current = project
  const bootRef = useRef(boot)
  bootRef.current = boot

  /* ── Yükleme ─────────────────────────────────────────────────── */

  useEffect(() => {
    void (async () => {
      const [loaded, flags, updateStatus] = await Promise.all([
        window.consul.app.getSettings(),
        window.consul.app.getBootFlags(),
        window.consul.update.status(),
      ])
      setSettings(loaded)
      setBoot(flags)
      setUpdate(updateStatus)
      applyUiTheme(loaded.uiTheme)

      const memo = await window.consul.memory.status(null)
      setMemoRoot(memo.root)

      // Başlangıç davranışı
      if (loaded.startupBehavior === 'new-terminal') {
        openTerminalRef.current(loaded.defaultShellId ?? flags.defaultShellId, null)
      } else if (loaded.startupBehavior === 'restore-last' && loaded.recentProjects[0]) {
        void openProjectRef.current(loaded.recentProjects[0])
      }
    })()

    const offSettings = window.consul.app.onSettingsChanged((next) => {
      setSettings(next)
      applyUiTheme(next.uiTheme)
    })
    const offUpdate = window.consul.update.onChanged((next) => {
      setUpdate(next)
      setUpdateDismissed(false)
    })
    return () => {
      offSettings()
      offUpdate()
    }
  }, [])

  useEffect(() => {
    if (settings?.uiTheme !== 'system') return
    return watchSystemAppearance(() => applyUiTheme('system'))
  }, [settings?.uiTheme])

  /* ── Eylemler ────────────────────────────────────────────────── */

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev))
    void window.consul.app.setSettings(patch).then(setSettings).catch(() => undefined)
  }, [])

  const openTerminal = useCallback((shellId: string, cwd: string | null) => {
    const current = settingsRef.current
    const flags = bootRef.current
    const target =
      cwd ?? projectRef.current?.path ?? current?.recentProjects[0] ?? current?.defaultProjectDir ?? ''
    if (!target) {
      setNotice('Önce bir proje klasörü açın.')
      return
    }
    const tab: Tab = {
      key: crypto.randomUUID(),
      title: titleForPath(target),
      renamed: false,
      cwd: target,
      shellId: shellId || current?.defaultShellId || flags?.defaultShellId || '',
      status: 'running',
    }
    dispatch({ type: 'add', tab })
    setShowHome(false)
  }, [])
  const openTerminalRef = useRef(openTerminal)
  openTerminalRef.current = openTerminal

  const openProjectPath = useCallback(async (path: string) => {
    try {
      const info = await window.consul.project.open(path)
      setProject(info)
      const current = settingsRef.current
      const flags = bootRef.current
      openTerminalRef.current(current?.defaultShellId ?? flags?.defaultShellId ?? '', info.path)
      const refreshed = await window.consul.app.getSettings()
      setSettings(refreshed)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Proje açılamadı.')
    }
  }, [])
  const openProjectRef = useRef(openProjectPath)
  openProjectRef.current = openProjectPath

  const pickFolder = useCallback(async () => {
    const path = await window.consul.app.pickFolder()
    if (path) await openProjectRef.current(path)
  }, [])

  const closeTab = useCallback((key: string) => {
    const tab = stateRef.current.tabs.find((t) => t.key === key)
    if (!tab) return
    if (tab.status === 'running') {
      setPendingClose(tab)
      return
    }
    handles.current.delete(key)
    dispatch({ type: 'close', key })
  }, [])

  const forceCloseTab = useCallback((key: string) => {
    handles.current.delete(key)
    dispatch({ type: 'close', key })
  }, [])

  const restartTab = useCallback((key: string) => {
    const tab = stateRef.current.tabs.find((t) => t.key === key)
    if (!tab) return
    handles.current.delete(key)
    dispatch({ type: 'close', key })
    openTerminalRef.current(tab.shellId, tab.cwd)
  }, [])

  const duplicateTab = useCallback((key: string) => {
    const tab = stateRef.current.tabs.find((t) => t.key === key)
    if (tab) openTerminalRef.current(tab.shellId, tab.cwd)
  }, [])

  const applyFontSize = useCallback(
    (next: number) => {
      patchSettings({ fontSize: Math.min(MAX_FONT, Math.max(MIN_FONT, Math.round(next))) })
    },
    [patchSettings]
  )

  const openMemo = useCallback(() => {
    const dir = projectRef.current?.memoDir ?? undefined
    void window.consul.memory.openFolder(dir).catch((err: unknown) => {
      setNotice(err instanceof Error ? err.message : 'Hafıza klasörü açılamadı.')
    })
  }, [])

  /* ── Komutlar ────────────────────────────────────────────────── */

  const runCommand = useCallback(
    (id: CommandId) => {
      const { tabs, activeKey } = stateRef.current
      const current = settingsRef.current
      switch (id) {
        case 'tab.new':
          openTerminalRef.current(current?.defaultShellId ?? bootRef.current?.defaultShellId ?? '', null)
          break
        case 'tab.close':
          if (activeKey) closeTab(activeKey)
          break
        case 'tab.next':
        case 'tab.prev': {
          if (tabs.length === 0) break
          const dir = id === 'tab.next' ? 1 : -1
          const index = tabs.findIndex((t) => t.key === activeKey)
          const next = tabs[(index + dir + tabs.length) % tabs.length]
          dispatch({ type: 'activate', key: next.key })
          setShowHome(false)
          break
        }
        case 'tab.duplicate':
          if (activeKey) duplicateTab(activeKey)
          break
        case 'tab.rename': {
          const tab = tabs.find((t) => t.key === activeKey)
          if (tab) setRenaming(tab)
          break
        }
        case 'terminal.clear':
          if (activeKey) handles.current.get(activeKey)?.clear()
          break
        case 'terminal.search':
          if (activeKey) setSearchOpen(true)
          break
        case 'palette.open':
          setPaletteOpen(true)
          break
        case 'settings.open':
          setSettingsOpen(true)
          break
        case 'home.show':
          setShowHome(true)
          break
        case 'project.open':
          void pickFolder()
          break
        case 'memory.open':
          openMemo()
          break
        case 'font.increase':
          applyFontSize((current?.fontSize ?? DEFAULT_FONT) + 1)
          break
        case 'font.decrease':
          applyFontSize((current?.fontSize ?? DEFAULT_FONT) - 1)
          break
        case 'font.reset':
          applyFontSize(DEFAULT_FONT)
          break
      }
    },
    [applyFontSize, closeTab, duplicateTab, openMemo, pickFolder]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      // Ctrl/⌘ + 1..9 → doğrudan sekmeye geç
      const primary = /mac/i.test(navigator.platform) ? event.metaKey : event.ctrlKey
      if (primary && !event.shiftKey && !event.altKey && /^[1-9]$/.test(event.key)) {
        event.preventDefault()
        const tab = stateRef.current.tabs[Number(event.key) - 1]
        if (tab) {
          dispatch({ type: 'activate', key: tab.key })
          setShowHome(false)
        }
        return
      }
      const command = matchCommand(event)
      if (!command) return
      event.preventDefault()
      runCommand(command)
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [runCommand])

  /* ── Türetilmiş değerler ─────────────────────────────────────── */

  const palette = useMemo(
    () => getTerminalScheme(settings?.terminalScheme ?? 'consul-dark').palette,
    [settings?.terminalScheme]
  )
  const activeTab = state.tabs.find((t) => t.key === state.activeKey) ?? null
  const hasRunningSessions = state.tabs.some((t) => t.status === 'running')

  if (!settings) return null

  return (
    <div className="c-app">
      <TitleBar
        project={project}
        onOpenProject={() => void pickFolder()}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {state.tabs.length > 0 && (
        <TabBar
          tabs={state.tabs}
          activeKey={showHome ? null : state.activeKey}
          onSelect={(key) => {
            dispatch({ type: 'activate', key })
            setShowHome(false)
          }}
          onClose={closeTab}
          onNew={() => runCommand('tab.new')}
          onMove={(from, to) => dispatch({ type: 'move', from, to })}
          onRename={(key) => {
            const tab = state.tabs.find((t) => t.key === key)
            if (tab) setRenaming(tab)
          }}
          onDuplicate={duplicateTab}
        />
      )}

      {update && !updateDismissed && (
        <UpdateBanner
          status={update}
          hasRunningSessions={hasRunningSessions}
          onDownload={() => void window.consul.update.download()}
          onInstall={() => void window.consul.update.install()}
          onDismiss={() => setUpdateDismissed(true)}
        />
      )}

      <main className="c-app__body">
        {state.tabs.map((tab) => (
          <TerminalView
            key={tab.key}
            tabKey={tab.key}
            cwd={tab.cwd}
            shellId={tab.shellId}
            active={!showHome && state.activeKey === tab.key}
            fontFamily={settings.fontFamily}
            fontSize={settings.fontSize}
            lineHeight={settings.lineHeight}
            cursorStyle={settings.cursorStyle}
            cursorBlink={settings.cursorBlink}
            scrollback={settings.scrollback}
            palette={palette}
            glitchHighlights={settings.glitchHighlights}
            status={tab.status}
            exitCode={tab.exitCode}
            searchOpen={searchOpen}
            onSearchClose={() => setSearchOpen(false)}
            onExited={(key, code) => dispatch({ type: 'exit', key, exitCode: code })}
            onCloseRequest={forceCloseTab}
            onRestart={restartTab}
            onReady={(key, handle) => handles.current.set(key, handle)}
          />
        ))}

        {(showHome || state.tabs.length === 0) && (
          <HomeView
            boot={boot}
            recents={settings.recentProjects}
            defaultShellId={settings.defaultShellId ?? boot?.defaultShellId ?? ''}
            onPickFolder={() => void pickFolder()}
            onOpenRecent={(path) => void openProjectRef.current(path)}
            onNewTerminal={(shellId) => openTerminalRef.current(shellId, null)}
          />
        )}
      </main>

      <StatusBar
        project={project}
        tab={showHome ? null : activeTab}
        shells={boot?.shells ?? []}
        memoDir={project?.memoDir ?? null}
        onOpenMemo={openMemo}
      />

      {paletteOpen && (
        <CommandPalette
          recents={settings.recentProjects}
          onCommand={runCommand}
          onOpenRecent={(path) => void openProjectRef.current(path)}
          onDismiss={() => setPaletteOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          boot={boot}
          update={update}
          memoRoot={memoRoot}
          onPatch={patchSettings}
          onCheckUpdate={() => void window.consul.update.check()}
          onDownloadUpdate={() => void window.consul.update.download()}
          onInstallUpdate={() => void window.consul.update.install()}
          onOpenMemoRoot={() => void window.consul.memory.openFolder().catch(() => setNotice('Hafıza klasörü henüz oluşturulmadı.'))}
          onDismiss={() => setSettingsOpen(false)}
        />
      )}

      {pendingClose && (
        <ConfirmDialog
          title="OTURUMU KAPAT"
          message={`"${pendingClose.title}" sekmesinde çalışan bir oturum var. Kapatılsın mı?`}
          confirmLabel="KAPAT"
          danger
          onConfirm={() => {
            forceCloseTab(pendingClose.key)
            setPendingClose(null)
          }}
          onCancel={() => setPendingClose(null)}
        />
      )}

      {renaming && (
        <PromptDialog
          title="SEKMEYİ YENİDEN ADLANDIR"
          label="Sekme adı"
          initialValue={renaming.title}
          onSubmit={(title) => {
            dispatch({ type: 'rename', key: renaming.key, title })
            setRenaming(null)
          }}
          onCancel={() => setRenaming(null)}
        />
      )}

      {notice && (
        <div className="c-notice" role="alert">
          <span>{notice}</span>
          <button type="button" className="c-notice__close" onClick={() => setNotice(null)} aria-label="Kapat">
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
