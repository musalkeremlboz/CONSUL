/** DeveloperWorkspaceResolver — CONSUL kaynak kodunun nerede olduğunu belirleyen
 *  TEK yetkili servis (talimat §29).
 *
 *  Mutlak kural: **imzalı/salt-okunur uygulama paketinin içine asla yazılmaz.**
 *  macOS'ta `.app` bundle'ı, Windows'ta Program Files altındaki kurulum ve
 *  Linux'ta AppImage montaj noktası değiştirilemez; bu yüzden çözümlenen
 *  çalışma alanı her zaman kullanıcının yazabildiği bir dizindir.
 *
 *  Öncelik sırası:
 *   1. `--workspace <yol>` argümanı veya `CONSUL_DEV_WORKSPACE` ortam değişkeni
 *   2. Daha önce kullanılmış ve hâlâ geçerli olan çalışma alanı (kalıcı kayıt)
 *   3. Geliştirme modunda repository kökü
 *   4. Bilinen konumlarda bulunan bir CONSUL git checkout'u
 *   5. Yedek: `<Belgeler>/CONSUL-DEV/CONSUL` (yoksa oluşturulur) */
import { app } from 'electron'
import { accessSync, constants, existsSync, mkdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { readJsonSafe, writeJsonAtomic } from '../../core/store'
import { devWorkspaceFallbackDir, homeDir, userDataDir } from '../platform/paths'
import { isInside } from '../platform/pathUtils'
import { looksLikeConsulSource } from './sourceDetect'

export { looksLikeConsulSource }

export type WorkspaceOrigin = 'argument' | 'remembered' | 'development' | 'detected' | 'fallback'

export interface DeveloperWorkspace {
  path: string
  origin: WorkspaceOrigin
  /** Gerçekten CONSUL kaynak ağacı mı (package.json + src/main). */
  isConsulSource: boolean
  /** Klasör yazılabilir mi. */
  writable: boolean
  /** Kullanıcıya gösterilecek Türkçe not (ör. "kaynak bulunamadı, şu komutu çalıştırın"). */
  note?: string
}

interface RememberedState {
  workspace?: string
}

function stateFile(): string {
  return join(userDataDir(), 'developer-workspace.json')
}

function isWritableDir(path: string): boolean {
  try {
    if (!statSync(path).isDirectory()) return false
    accessSync(path, constants.W_OK)
    return true
  } catch {
    return false
  }
}

/** Yol, salt-okunur/imzalı uygulama paketinin içinde mi? */
export function isInsideAppBundle(path: string): boolean {
  const target = resolve(path)
  const candidates: string[] = []
  try {
    candidates.push(app.getAppPath())
  } catch {
    // Electron hazır değil
  }
  if (process.resourcesPath) candidates.push(process.resourcesPath)
  // macOS: /Applications/CONSUL.app/...
  const execDir = resolve(process.execPath, '..')
  const appBundle = /(.*\.app)([/\\]|$)/.exec(execDir)?.[1]
  if (appBundle) candidates.push(appBundle)
  // Linux AppImage montaj noktası
  if (process.env['APPIMAGE']) candidates.push(resolve(process.env['APPIMAGE'], '..'))
  if (process.env['APPDIR']) candidates.push(process.env['APPDIR'])

  return candidates.some((root) => root && isInside(root, target))
}

function argumentWorkspace(argv: string[]): string | null {
  const idx = argv.indexOf('--workspace')
  if (idx !== -1 && argv[idx + 1]) return argv[idx + 1]
  const inline = argv.find((a) => a.startsWith('--workspace='))
  if (inline) return inline.slice('--workspace='.length)
  return process.env['CONSUL_DEV_WORKSPACE'] ?? null
}

function rememberedWorkspace(): string | null {
  const state = readJsonSafe<RememberedState>(stateFile(), {})
  return state.workspace ?? null
}

export function rememberWorkspace(path: string): void {
  try {
    writeJsonAtomic(stateFile(), { workspace: path } satisfies RememberedState)
  } catch {
    // Kayıt yazılamadı — bir dahaki açılışta yeniden keşfedilir
  }
}

/** Geliştirme modunda repository kökü (out/main/index.js → ../../). */
function developmentRoot(): string | null {
  if (app.isPackaged) return null
  const root = resolve(app.getAppPath())
  return looksLikeConsulSource(root) ? root : null
}

/** Kullanıcının diskinde muhtemel CONSUL checkout konumları. */
function detectionCandidates(): string[] {
  const home = homeDir()
  return [
    join(home, 'Desktop', 'CONSUL'),
    join(home, 'CONSUL'),
    join(home, 'Documents', 'CONSUL'),
    join(home, 'source', 'CONSUL'),
    join(home, 'projects', 'CONSUL'),
    join(home, 'dev', 'CONSUL'),
    join(devWorkspaceFallbackDir(), 'CONSUL'),
  ]
}

const CLONE_HINT =
  'CONSUL kaynak kodu bulunamadı. Bu terminalde şunu çalıştırıp klasörü klonlayabilirsiniz:\n' +
  '  git clone <repository-url> .\n' +
  'Ardından CONSUL Developer\'ı yeniden başlatın.'

export function resolveDeveloperWorkspace(argv: string[] = process.argv): DeveloperWorkspace {
  const accept = (path: string, origin: WorkspaceOrigin): DeveloperWorkspace | null => {
    if (!path) return null
    const target = resolve(path)
    if (!existsSync(target)) return null
    // İmzalı/salt-okunur paket içine ASLA çalışma alanı açılmaz
    if (isInsideAppBundle(target)) return null
    if (!isWritableDir(target)) return null
    return {
      path: target,
      origin,
      isConsulSource: looksLikeConsulSource(target),
      writable: true,
    }
  }

  const fromArg = argumentWorkspace(argv)
  if (fromArg) {
    const found = accept(fromArg, 'argument')
    if (found) return found
  }

  const remembered = rememberedWorkspace()
  if (remembered) {
    const found = accept(remembered, 'remembered')
    if (found?.isConsulSource) return found
  }

  const dev = developmentRoot()
  if (dev) {
    const found = accept(dev, 'development')
    if (found) return found
  }

  for (const candidate of detectionCandidates()) {
    const found = accept(candidate, 'detected')
    if (found?.isConsulSource) return found
  }

  // Yedek: kullanıcının yazabildiği geliştirme klasörü (boş olabilir)
  const fallback = join(devWorkspaceFallbackDir(), 'CONSUL')
  try {
    mkdirSync(fallback, { recursive: true })
  } catch {
    // Oluşturulamadı — ana dizine düş
  }
  const usable = existsSync(fallback) && isWritableDir(fallback) ? fallback : homeDir()
  const isSource = looksLikeConsulSource(usable)
  return {
    path: usable,
    origin: 'fallback',
    isConsulSource: isSource,
    writable: isWritableDir(usable),
    ...(isSource ? {} : { note: CLONE_HINT }),
  }
}
