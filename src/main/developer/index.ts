/** CONSUL Developer — CONSUL'un kendi kaynak kodu üzerinde çalışan,
 *  TEK terminalden ibaret yardımcı uygulama (talimat §24–§30).
 *
 *  Ana CONSUL ile paylaştığı tek şey terminal/PTY çekirdeğidir. Tema sistemi,
 *  sekmeler, animasyonlar, panel düzeni — hiçbiri buraya taşınmaz. Ayrı süreç
 *  ve ayrı `userData` kullandığı için çökmesi ana uygulamayı etkilemez. */
import { BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { v } from '../../core/schema'
import { DEV_IPC } from '../../shared/ipc'
import { resolveShell } from '../platform/shells'
import { buildPtyEnv } from '../terminal/env'
import { PtyError, PtyManager, type PtyLaunchSpec } from '../terminal/ptyManager'
import { claudeLaunchSpec, claudeMissingMessage, findClaude } from './claude'
import { rememberWorkspace, resolveDeveloperWorkspace, type DeveloperWorkspace } from './workspace'

export interface DeveloperBootstrap {
  workspace: string
  origin: DeveloperWorkspace['origin']
  isConsulSource: boolean
  claudeFound: boolean
  /** Terminale basılacak bilgilendirme metni (ANSI dizileri içerebilir). */
  banner: string
}

const SizeSchema = v.object({
  cols: v.number({ min: 2, max: 2000, int: true }),
  rows: v.number({ min: 1, max: 1000, int: true }),
})
const WriteSchema = v.object({ data: v.string({ max: 100_000 }) })

export function createDeveloperWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1000,
    height: 680,
    minWidth: 420,
    minHeight: 260,
    show: false,
    backgroundColor: '#000000',
    title: 'CONSUL Developer',
    // Sade tutulur: işletim sisteminin kendi pencere çerçevesi kullanılır
    webPreferences: {
      preload: join(__dirname, '../preload/developer.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/developer.html`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/developer.html'))
  }
  return win
}

function banner(workspace: DeveloperWorkspace, claudeFound: boolean): string {
  const lines = [
    '',
    '  \x1b[1mCONSUL DEVELOPER\x1b[0m',
    `  \x1b[2mçalışma alanı:\x1b[0m ${workspace.path}`,
  ]
  if (!workspace.isConsulSource) {
    lines.push('', `  \x1b[33m${workspace.note ?? 'Bu klasör bir CONSUL kaynak ağacı değil.'}\x1b[0m`)
  }
  lines.push('')
  return lines.join('\r\n') + (claudeFound ? '' : claudeMissingMessage())
}

export function registerDeveloperIpc(win: BrowserWindow): () => void {
  const wc = win.webContents
  const ptys = new PtyManager({ data: DEV_IPC.ptyData, exit: DEV_IPC.ptyExit })
  let activeId: string | null = null

  const fromWindow = (event: IpcMainEvent | IpcMainInvokeEvent): boolean => event.sender === wc

  /** Claude Code varsa onu, yoksa kullanıcının kabuğunu çalışma alanında başlatır. */
  async function startSession(cols: number, rows: number): Promise<DeveloperBootstrap> {
    const workspace = resolveDeveloperWorkspace()
    if (workspace.isConsulSource) rememberWorkspace(workspace.path)

    const claude = findClaude()
    let spec: PtyLaunchSpec
    if (claude.found && claude.path) {
      spec = claudeLaunchSpec({ executable: claude.path, cwd: workspace.path, cols, rows })
    } else {
      // Sahte terminal göstermeyiz: gerçek kabuk açılır, uyarı ayrıca basılır
      const shell = await resolveShell(null)
      spec = { file: shell.file, args: [...shell.args], cwd: workspace.path, cols, rows, env: buildPtyEnv() }
    }

    if (activeId) {
      ptys.kill(activeId)
      activeId = null
    }
    activeId = ptys.create(wc, spec)

    return {
      workspace: workspace.path,
      origin: workspace.origin,
      isConsulSource: workspace.isConsulSource,
      claudeFound: claude.found,
      banner: banner(workspace, claude.found),
    }
  }

  ipcMain.handle(DEV_IPC.bootstrap, async (event, raw: unknown): Promise<DeveloperBootstrap> => {
    if (!fromWindow(event)) throw new Error('unauthorized')
    try {
      const { cols, rows } = SizeSchema.parse(raw)
      return await startSession(cols, rows)
    } catch (err) {
      if (err instanceof PtyError) throw new Error(err.message)
      throw err instanceof Error ? err : new Error('Terminal başlatılamadı.')
    }
  })

  ipcMain.handle(DEV_IPC.restart, async (event, raw: unknown): Promise<DeveloperBootstrap> => {
    if (!fromWindow(event)) throw new Error('unauthorized')
    const { cols, rows } = SizeSchema.parse(raw)
    return startSession(cols, rows)
  })

  ipcMain.on(DEV_IPC.ptyWrite, (event, raw: unknown) => {
    if (!fromWindow(event) || !activeId) return
    try {
      ptys.write(activeId, WriteSchema.parse(raw).data)
    } catch {
      // yoksay
    }
  })

  ipcMain.on(DEV_IPC.ptyResize, (event, raw: unknown) => {
    if (!fromWindow(event) || !activeId) return
    try {
      const { cols, rows } = SizeSchema.parse(raw)
      ptys.resize(activeId, cols, rows)
    } catch {
      // yoksay
    }
  })

  return () => ptys.killAll()
}
