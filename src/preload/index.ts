/** CONSUL preload — renderer'a açılan TEK yüzey.
 *
 *  `ipcRenderer` doğrudan verilmez; yalnız burada tanımlı, tipli fonksiyonlar
 *  görünür. Renderer'ın Node'a, dosya sistemine veya keyfi IPC kanallarına
 *  erişimi yoktur (en az yetki ilkesi). */
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  BootFlags,
  GitInfo,
  ListDirResult,
  MemoryStatus,
  ProjectInfo,
  PtyCreateRequest,
  PtyCreateResponse,
  PtyDataEvent,
  PtyExitEvent,
  Settings,
  UpdateStatus,
} from '../shared/types'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: unknown, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api = {
  pty: {
    create: (req: PtyCreateRequest): Promise<PtyCreateResponse> => ipcRenderer.invoke(IPC.ptyCreate, req),
    write: (id: string, data: string): void => {
      ipcRenderer.send(IPC.ptyWrite, { id, data })
    },
    resize: (id: string, cols: number, rows: number): void => {
      ipcRenderer.send(IPC.ptyResize, { id, cols, rows })
    },
    ack: (id: string, bytes: number): void => {
      ipcRenderer.send(IPC.ptyAck, { id, bytes })
    },
    kill: (id: string): void => {
      ipcRenderer.send(IPC.ptyKill, { id })
    },
    onData: (cb: (event: PtyDataEvent) => void): (() => void) => subscribe(IPC.ptyData, cb),
    onExit: (cb: (event: PtyExitEvent) => void): (() => void) => subscribe(IPC.ptyExit, cb),
  },

  app: {
    getBootFlags: (): Promise<BootFlags> => ipcRenderer.invoke(IPC.appGetBootFlags),
    getSettings: (): Promise<Settings> => ipcRenderer.invoke(IPC.appGetSettings),
    setSettings: (patch: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke(IPC.appSetSettings, patch),
    onSettingsChanged: (cb: (settings: Settings) => void): (() => void) =>
      subscribe(IPC.appSettingsChanged, cb),
    addRecent: (path: string): Promise<Settings> => ipcRenderer.invoke(IPC.appAddRecent, path),
    pickFolder: (): Promise<string | null> => ipcRenderer.invoke(IPC.appPickFolder),
    openExternal: (url: string): void => {
      ipcRenderer.send(IPC.appOpenExternal, url)
    },
    openPath: (path: string): Promise<boolean> => ipcRenderer.invoke(IPC.appOpenPath, path),
  },

  project: {
    open: (path: string): Promise<ProjectInfo> => ipcRenderer.invoke(IPC.projectOpen, path),
    refresh: (path: string): Promise<GitInfo> => ipcRenderer.invoke(IPC.projectRefresh, path),
  },

  memory: {
    status: (projectPath: string | null): Promise<MemoryStatus> =>
      ipcRenderer.invoke(IPC.memoryStatus, projectPath),
    ensure: (projectPath: string): Promise<MemoryStatus> => ipcRenderer.invoke(IPC.memoryEnsure, projectPath),
    appendChangelog: (input: {
      projectPath: string
      title: string
      entries: string[]
      files?: string[]
    }): Promise<MemoryStatus> => ipcRenderer.invoke(IPC.memoryAppendChangelog, input),
    openFolder: (path?: string): Promise<boolean> => ipcRenderer.invoke(IPC.memoryOpenFolder, path ?? null),
  },

  update: {
    status: (): Promise<UpdateStatus> => ipcRenderer.invoke(IPC.updateStatus),
    check: (): Promise<UpdateStatus> => ipcRenderer.invoke(IPC.updateCheck),
    download: (): Promise<UpdateStatus> => ipcRenderer.invoke(IPC.updateDownload),
    install: (): Promise<UpdateStatus> => ipcRenderer.invoke(IPC.updateInstall),
    onChanged: (cb: (status: UpdateStatus) => void): (() => void) => subscribe(IPC.updateChanged, cb),
  },

  fs: {
    listDir: (path?: string): Promise<ListDirResult> => ipcRenderer.invoke(IPC.fsListDir, path),
    mkdir: (parent: string, name: string): Promise<{ ok: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke(IPC.fsMkdir, { parent, name }),
  },

  win: {
    minimize: (): void => {
      ipcRenderer.send(IPC.winMinimize)
    },
    maximizeToggle: (): void => {
      ipcRenderer.send(IPC.winMaximizeToggle)
    },
    close: (): void => {
      ipcRenderer.send(IPC.winClose)
    },
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC.winIsMaximized),
    onMaximizedChange: (cb: (maximized: boolean) => void): (() => void) => subscribe(IPC.winMaximized, cb),
  },
}

export type ConsulApi = typeof api

contextBridge.exposeInMainWorld('consul', api)
