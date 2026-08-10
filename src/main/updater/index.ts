/** Otomatik güncelleme — GitHub Releases üzerinden (electron-updater).
 *
 *  Güvenlik (talimat §40):
 *   - İndirme yalnız HTTPS üzerinden, `electron-builder`'ın ürettiği imzalı
 *     `latest*.yml` manifesti üzerinden yapılır.
 *   - Her artefaktın **sha512** özeti manifestteki değerle karşılaştırılır;
 *     eşleşmezse kurulum reddedilir. Bu doğrulamayı electron-updater yapar ve
 *     BURADA DEVRE DIŞI BIRAKILMAZ.
 *   - Windows'ta uygulama kod imzalıysa updater yayıncı adını da doğrular.
 *     İmzasız dağıtımda bu katman yoktur — `docs/SIGNING.md` bunu açıkça yazar.
 *   - Hiçbir ikili kullanıcı onayı olmadan KURULMAZ; indirme bittiğinde yalnız
 *     "hazır" durumuna geçilir.
 *
 *  Kullanıcı deneyimi (talimat §41): çalışan terminal oturumu varken yeniden
 *  başlatma zorlanmaz; çağıran taraf `hasLiveSessions()` ile uyarı gösterir. */
import { app } from 'electron'
import type { AppUpdater } from 'electron-updater'
import type { UpdateStatus } from '../../shared/types'
import { friendlyUpdateError as friendlyError } from './errors'
import { validateUpdateManifest } from './version'

type Listener = (status: UpdateStatus) => void

let status: UpdateStatus = { phase: 'idle', currentVersion: '0.0.0' }
const listeners = new Set<Listener>()
let initialized = false
let updaterRef: AppUpdater | null = null

function emit(next: Partial<UpdateStatus>): void {
  status = { ...status, ...next }
  for (const listener of listeners) {
    try {
      listener(status)
    } catch {
      // dinleyici hatası güncelleme akışını bozmaz
    }
  }
}

/** electron-updater'ı yalnız gerektiğinde (paketli sürümde) yükler. */
async function getUpdater(): Promise<AppUpdater | null> {
  if (updaterRef) return updaterRef
  try {
    const mod = await import('electron-updater')
    // CJS/ESM birlikte çalışabilirliği: paket varsayılan dışa aktarım kullanır
    const updater = (mod as unknown as { default?: { autoUpdater: AppUpdater } }).default
      ?.autoUpdater ?? mod.autoUpdater
    updaterRef = updater
    return updater
  } catch {
    return null
  }
}

export interface UpdaterOptions {
  autoDownload: boolean
  channel: 'stable' | 'beta'
}

export function getUpdateStatus(): UpdateStatus {
  return status
}

export function onUpdateStatus(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function initUpdater(opts: UpdaterOptions): Promise<void> {
  status = { phase: 'idle', currentVersion: app.getVersion() }

  if (!app.isPackaged) {
    // Geliştirme modunda güncelleme akışı çalıştırılmaz (sahte davranış üretmeyiz)
    emit({ phase: 'unsupported', error: 'Güncelleme yalnızca kurulu sürümde çalışır.' })
    return
  }

  const updater = await getUpdater()
  if (!updater) {
    emit({ phase: 'unsupported', error: 'Güncelleme bileşeni yüklenemedi.' })
    return
  }

  if (initialized) return
  initialized = true

  updater.autoDownload = opts.autoDownload
  // Kurulum DAİMA kullanıcı onayıyla: çıkışta sessizce kurma
  updater.autoInstallOnAppQuit = false
  updater.allowPrerelease = opts.channel === 'beta'
  updater.channel = opts.channel === 'beta' ? 'beta' : 'latest'
  updater.logger = null

  updater.on('checking-for-update', () => emit({ phase: 'checking', error: undefined }))
  updater.on('update-not-available', () => emit({ phase: 'up-to-date', error: undefined }))
  updater.on('update-available', (info) => {
    // Ek savunma: sürüm düşürme ve özetsiz (doğrulanamaz) yayın reddedilir
    const check = validateUpdateManifest(info, app.getVersion(), opts.channel)
    if (!check.ok) {
      emit({ phase: 'error', error: check.reason ?? 'Güncelleme doğrulanamadı.' })
      return
    }
    emit({
      phase: 'available',
      newVersion: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes.slice(0, 4000) : undefined,
      error: undefined,
    })
  })
  updater.on('download-progress', (progress) => {
    emit({ phase: 'downloading', percent: Math.round(progress.percent) })
  })
  updater.on('update-downloaded', (info) => {
    emit({ phase: 'ready', newVersion: info.version, percent: 100 })
  })
  updater.on('error', (err) => emit({ phase: 'error', error: friendlyError(err) }))
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  const updater = await getUpdater()
  if (!app.isPackaged || !updater) return status
  try {
    await updater.checkForUpdates()
  } catch (err) {
    emit({ phase: 'error', error: friendlyError(err) })
  }
  return status
}

export async function downloadUpdate(): Promise<UpdateStatus> {
  const updater = await getUpdater()
  if (!app.isPackaged || !updater) return status
  try {
    emit({ phase: 'downloading', percent: 0, error: undefined })
    await updater.downloadUpdate()
  } catch (err) {
    emit({ phase: 'error', error: friendlyError(err) })
  }
  return status
}

/**
 * İndirilen güncellemeyi kurar ve uygulamayı yeniden başlatır.
 * YALNIZ kullanıcı açıkça onayladığında çağrılır ve yalnız `ready` fazında iş yapar.
 */
export async function installUpdate(): Promise<UpdateStatus> {
  const updater = await getUpdater()
  if (!app.isPackaged || !updater) return status
  if (status.phase !== 'ready') {
    emit({ error: 'Kurulacak indirilmiş bir güncelleme yok.' })
    return status
  }
  // isSilent=false → kurulum ilerlemesi kullanıcıya görünür
  setImmediate(() => updater.quitAndInstall(false, true))
  return status
}
