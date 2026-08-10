/** CONSUL Developer preload — kasıtlı olarak minimum yüzey.
 *
 *  Yalnız tek bir terminali besleyecek kadar API vardır: önyükleme, girdi,
 *  boyutlandırma ve yeniden başlatma. Ayar, dosya sistemi, proje veya
 *  güncelleme kanalı BURADA YOKTUR. */
import { contextBridge, ipcRenderer } from 'electron'
import { DEV_IPC } from '../shared/ipc'
import type { PtyDataEvent, PtyExitEvent } from '../shared/types'

export interface DeveloperBootstrapView {
  workspace: string
  origin: string
  isConsulSource: boolean
  claudeFound: boolean
  banner: string
}

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: unknown, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api = {
  bootstrap: (cols: number, rows: number): Promise<DeveloperBootstrapView> =>
    ipcRenderer.invoke(DEV_IPC.bootstrap, { cols, rows }),
  restart: (cols: number, rows: number): Promise<DeveloperBootstrapView> =>
    ipcRenderer.invoke(DEV_IPC.restart, { cols, rows }),
  write: (data: string): void => {
    ipcRenderer.send(DEV_IPC.ptyWrite, { data })
  },
  resize: (cols: number, rows: number): void => {
    ipcRenderer.send(DEV_IPC.ptyResize, { cols, rows })
  },
  onData: (cb: (event: PtyDataEvent) => void): (() => void) => subscribe(DEV_IPC.ptyData, cb),
  onExit: (cb: (event: PtyExitEvent) => void): (() => void) => subscribe(DEV_IPC.ptyExit, cb),
}

export type ConsulDeveloperApi = typeof api

contextBridge.exposeInMainWorld('consulDev', api)
