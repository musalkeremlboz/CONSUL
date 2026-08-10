/** IPC kayıt defteri — renderer ↔ main güven sınırı.
 *
 *  Her işleyicide iki savunma vardır:
 *   1. **Gönderen doğrulaması:** olay yalnız bu pencerenin `webContents`'inden
 *      geliyorsa işlenir (başka bir çerçeve/eklenti taklit edemez).
 *   2. **Şema doğrulaması:** yük `src/core/schema.ts` ile ayrıştırılır;
 *      bilinmeyen alanlar atılır, aralık dışı değerler Türkçe hata döndürür.
 *
 *  Bu dosyada keyfi komut çalıştıran bir kanal YOKTUR: PTY yalnız keşfedilmiş
 *  kabuk kayıtlarından üretilen tariflerle başlatılır. */
import { app, dialog, ipcMain, shell, type BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { existsSync } from 'node:fs'
import { v } from '../../core/schema'
import { IPC } from '../../shared/ipc'
import type { BootFlags, MemoryStatus, ProjectInfo, Settings } from '../../shared/types'
import { PLATFORM } from '../platform/os'
import { discoverShells, defaultShellId } from '../platform/shells'
import { documentsDir } from '../platform/paths'
import { buildLaunchSpec } from '../terminal/launcher'
import { PtyError, type PtyManager } from '../terminal/ptyManager'
import { addRecentProject, getSettings, onSettingsChanged, setSettings } from '../settings'
import { openProject, ProjectError } from '../projects'
import { readGitInfo } from '../projects/git'
import { appendProjectChangelog, openProjectMemory } from '../memory'
import { memoRootDir } from '../platform/paths'
import { listDir, makeDir } from '../fs/browse'
import { checkForUpdates, downloadUpdate, getUpdateStatus, installUpdate, onUpdateStatus } from '../updater'
import { openExternalSafely } from '../app/window'

/* ── Şemalar ───────────────────────────────────────────────────── */

const PtyCreateSchema = v.object({
  shellId: v.string({ min: 1, max: 128, trim: true }),
  cwd: v.string({ min: 1, max: 4096, trim: true }),
  cols: v.number({ min: 2, max: 2000, int: true }),
  rows: v.number({ min: 1, max: 1000, int: true }),
})

const PtyIdSchema = v.object({ id: v.string({ min: 1, max: 32 }) })
const PtyWriteSchema = v.object({ id: v.string({ min: 1, max: 32 }), data: v.string({ max: 100_000 }) })
const PtyResizeSchema = v.object({
  id: v.string({ min: 1, max: 32 }),
  cols: v.number({ min: 2, max: 2000, int: true }),
  rows: v.number({ min: 1, max: 1000, int: true }),
})
const PtyAckSchema = v.object({
  id: v.string({ min: 1, max: 32 }),
  bytes: v.number({ min: 0, max: 100_000_000, int: true }),
})

const PathSchema = v.string({ min: 1, max: 4096, trim: true })

const ChangelogSchema = v.object({
  projectPath: PathSchema,
  title: v.string({ min: 1, max: 200, trim: true }),
  entries: v.array(v.string({ min: 1, max: 2000 }), { max: 50 }),
  files: v.optional(v.array(v.string({ min: 1, max: 1024 }), { max: 100 })),
})

const MkdirSchema = v.object({
  parent: PathSchema,
  name: v.string({ min: 1, max: 200, trim: true }),
})

/** Türkçe, kullanıcıya gösterilebilir hata mesajına indirger. */
function toUserError(err: unknown): Error {
  if (err instanceof PtyError || err instanceof ProjectError) return new Error(err.message)
  if (err instanceof Error && err.name === 'SchemaError') return new Error(`Geçersiz istek — ${err.message}`)
  if (err instanceof Error) return new Error(err.message)
  return new Error('Beklenmeyen bir hata oluştu.')
}

export function registerIpc(win: BrowserWindow, ptys: PtyManager): void {
  const wc = win.webContents
  const fromWindow = (event: IpcMainEvent | IpcMainInvokeEvent): boolean => event.sender === wc
  const guard = (event: IpcMainInvokeEvent): void => {
    if (!fromWindow(event)) throw new Error('unauthorized')
  }

  /* ── PTY ─────────────────────────────────────────────────────── */

  ipcMain.handle(IPC.ptyCreate, async (event, raw: unknown) => {
    guard(event)
    try {
      const input = PtyCreateSchema.parse(raw)
      const spec = await buildLaunchSpec(input)
      return { id: ptys.create(wc, spec) }
    } catch (err) {
      throw toUserError(err)
    }
  })

  ipcMain.on(IPC.ptyWrite, (event, raw: unknown) => {
    if (!fromWindow(event)) return
    try {
      const { id, data } = PtyWriteSchema.parse(raw)
      ptys.write(id, data)
    } catch {
      // Geçersiz yük sessizce atılır — terminal girdisi akışını hata ile kesmeyiz
    }
  })

  ipcMain.on(IPC.ptyResize, (event, raw: unknown) => {
    if (!fromWindow(event)) return
    try {
      const { id, cols, rows } = PtyResizeSchema.parse(raw)
      ptys.resize(id, cols, rows)
    } catch {
      // yoksay
    }
  })

  ipcMain.on(IPC.ptyAck, (event, raw: unknown) => {
    if (!fromWindow(event)) return
    try {
      const { id, bytes } = PtyAckSchema.parse(raw)
      ptys.ack(id, bytes)
    } catch {
      // yoksay
    }
  })

  ipcMain.on(IPC.ptyKill, (event, raw: unknown) => {
    if (!fromWindow(event)) return
    try {
      ptys.kill(PtyIdSchema.parse(raw).id)
    } catch {
      // yoksay
    }
  })

  /* ── Uygulama ────────────────────────────────────────────────── */

  ipcMain.handle(IPC.appGetBootFlags, async (event): Promise<BootFlags> => {
    guard(event)
    const shells = await discoverShells()
    const settings = getSettings()
    const fallback = await defaultShellId()
    const flags: BootFlags = {
      version: app.getVersion(),
      platform: PLATFORM,
      shells: shells.map(({ id, label, kind }) => ({ id, label, kind })),
      defaultShellId: settings.defaultShellId ?? fallback,
    }
    return flags
  })

  ipcMain.handle(IPC.appGetSettings, (event): Settings => {
    guard(event)
    return getSettings()
  })

  ipcMain.handle(IPC.appSetSettings, (event, patch: unknown): Settings => {
    guard(event)
    try {
      return setSettings((patch ?? {}) as Partial<Settings>)
    } catch (err) {
      throw toUserError(err)
    }
  })

  ipcMain.handle(IPC.appAddRecent, (event, raw: unknown): Settings => {
    guard(event)
    try {
      return addRecentProject(PathSchema.parse(raw))
    } catch (err) {
      throw toUserError(err)
    }
  })

  ipcMain.handle(IPC.appPickFolder, async (event) => {
    guard(event)
    const settings = getSettings()
    const defaultPath =
      settings.defaultProjectDir && existsSync(settings.defaultProjectDir)
        ? settings.defaultProjectDir
        : documentsDir()
    const result = await dialog.showOpenDialog(win, {
      title: 'Proje klasörü seç',
      defaultPath,
      properties: ['openDirectory', 'createDirectory'],
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.on(IPC.appOpenExternal, (event, url: unknown) => {
    if (!fromWindow(event)) return
    if (typeof url === 'string') openExternalSafely(url)
  })

  ipcMain.handle(IPC.appOpenPath, async (event, raw: unknown) => {
    guard(event)
    const path = PathSchema.parse(raw)
    if (!existsSync(path)) throw new Error('Yol bulunamadı.')
    // Yalnız dosya gezgininde açar — çalıştırmaz
    await shell.openPath(path)
    return true
  })

  /* ── Proje / Git ─────────────────────────────────────────────── */

  ipcMain.handle(IPC.projectOpen, async (event, raw: unknown): Promise<ProjectInfo> => {
    guard(event)
    try {
      const path = PathSchema.parse(raw)
      const info = await openProject(path)
      addRecentProject(info.path)
      return info
    } catch (err) {
      throw toUserError(err)
    }
  })

  ipcMain.handle(IPC.projectRefresh, async (event, raw: unknown) => {
    guard(event)
    try {
      return await readGitInfo(PathSchema.parse(raw))
    } catch (err) {
      throw toUserError(err)
    }
  })

  /* ── CONSUL-MEMO ─────────────────────────────────────────────── */

  ipcMain.handle(IPC.memoryStatus, async (event, raw: unknown): Promise<MemoryStatus> => {
    guard(event)
    const settings = getSettings()
    const path = typeof raw === 'string' && raw ? raw : null
    if (!path) return { enabled: settings.memoryEnabled, root: memoRootDir(), projectDir: null, files: [] }
    const git = await readGitInfo(path)
    return openProjectMemory({ projectPath: path, git, enabled: settings.memoryEnabled })
  })

  ipcMain.handle(IPC.memoryEnsure, async (event, raw: unknown): Promise<MemoryStatus> => {
    guard(event)
    try {
      const path = PathSchema.parse(raw)
      const git = await readGitInfo(path)
      return openProjectMemory({ projectPath: path, git, enabled: getSettings().memoryEnabled })
    } catch (err) {
      throw toUserError(err)
    }
  })

  ipcMain.handle(IPC.memoryAppendChangelog, async (event, raw: unknown): Promise<MemoryStatus> => {
    guard(event)
    try {
      const input = ChangelogSchema.parse(raw)
      const git = await readGitInfo(input.projectPath)
      return appendProjectChangelog({
        projectPath: input.projectPath,
        git,
        enabled: getSettings().memoryEnabled,
        input: { title: input.title, entries: input.entries, files: input.files },
      })
    } catch (err) {
      throw toUserError(err)
    }
  })

  ipcMain.handle(IPC.memoryOpenFolder, async (event, raw: unknown) => {
    guard(event)
    const path = typeof raw === 'string' && raw ? raw : memoRootDir()
    if (!existsSync(path)) throw new Error('Hafıza klasörü henüz oluşturulmadı.')
    await shell.openPath(path)
    return true
  })

  /* ── Güncelleme ──────────────────────────────────────────────── */

  ipcMain.handle(IPC.updateStatus, (event) => {
    guard(event)
    return getUpdateStatus()
  })
  ipcMain.handle(IPC.updateCheck, (event) => {
    guard(event)
    return checkForUpdates()
  })
  ipcMain.handle(IPC.updateDownload, (event) => {
    guard(event)
    return downloadUpdate()
  })
  ipcMain.handle(IPC.updateInstall, (event) => {
    guard(event)
    return installUpdate()
  })

  /* ── Dosya sistemi ───────────────────────────────────────────── */

  ipcMain.handle(IPC.fsListDir, (event, raw: unknown) => {
    guard(event)
    return listDir(typeof raw === 'string' ? raw : undefined)
  })

  ipcMain.handle(IPC.fsMkdir, (event, raw: unknown) => {
    guard(event)
    try {
      const { parent, name } = MkdirSchema.parse(raw)
      return makeDir(parent, name)
    } catch (err) {
      throw toUserError(err)
    }
  })

  /* ── Pencere ─────────────────────────────────────────────────── */

  ipcMain.on(IPC.winMinimize, (event) => {
    if (fromWindow(event)) win.minimize()
  })
  ipcMain.on(IPC.winMaximizeToggle, (event) => {
    if (!fromWindow(event)) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on(IPC.winClose, (event) => {
    if (fromWindow(event)) win.close()
  })
  ipcMain.handle(IPC.winIsMaximized, (event) => {
    guard(event)
    return win.isMaximized()
  })

  const send = (channel: string, payload: unknown): void => {
    if (!wc.isDestroyed()) wc.send(channel, payload)
  }
  win.on('maximize', () => send(IPC.winMaximized, true))
  win.on('unmaximize', () => send(IPC.winMaximized, false))

  const offSettings = onSettingsChanged((settings) => send(IPC.appSettingsChanged, settings))
  const offUpdate = onUpdateStatus((status) => send(IPC.updateChanged, status))
  win.on('closed', () => {
    offSettings()
    offUpdate()
  })
}
