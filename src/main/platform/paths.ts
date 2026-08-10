/** Platforma özgü dizin çözümlemesi.
 *
 *  Belgeler dizini ASLA sabit "Documents" adıyla varsayılmaz: Electron'un
 *  `app.getPath('documents')` çağrısı Windows'ta Known Folder API'sini,
 *  macOS'ta NSSearchPathForDirectoriesInDomains'i, Linux'ta ise
 *  XDG_DOCUMENTS_DIR'i kullanır — yani yerelleştirilmiş ("Belgeler",
 *  "Dokumente") ve kullanıcı tarafından taşınmış dizinler de doğru bulunur. */
import { app } from 'electron'
import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { isWindows } from './os'

/** Kullanıcının Belgeler dizini; platform API'si başarısız olursa ~/Documents. */
export function documentsDir(): string {
  try {
    const p = app.getPath('documents')
    if (p) return p
  } catch {
    // Electron hazır değil ya da dizin tanımsız — yedeğe düş
  }
  return join(homedir(), 'Documents')
}

/** CONSUL proje hafızası kökü: <Belgeler>/CONSUL-MEMO */
export function memoRootDir(): string {
  return join(documentsDir(), 'CONSUL-MEMO')
}

/** CONSUL geliştirme çalışma alanı yedeği: <Belgeler>/CONSUL-DEV */
export function devWorkspaceFallbackDir(): string {
  return join(documentsDir(), 'CONSUL-DEV')
}

/** Uygulama verisi (ayarlar, gizli bilgiler, güncelleme durumu). */
export function userDataDir(): string {
  return app.getPath('userData')
}

export function ensureDir(path: string): string {
  mkdirSync(path, { recursive: true })
  return path
}

export function homeDir(): string {
  try {
    return app.getPath('home')
  } catch {
    return homedir()
  }
}

/** Klasör seçicide gösterilen hızlı erişim noktaları (platforma göre). */
export function quickAccessDirs(): { label: string; path: string }[] {
  const items: { label: string; path: string }[] = []
  const add = (label: string, path: string): void => {
    if (path && existsSync(path)) items.push({ label, path })
  }
  const safe = (name: Parameters<typeof app.getPath>[0]): string => {
    try {
      return app.getPath(name)
    } catch {
      return ''
    }
  }
  add('MASAÜSTÜ', safe('desktop'))
  add('BELGELER', safe('documents'))
  add('İNDİRİLENLER', safe('downloads'))
  add('KULLANICI', homeDir())
  if (isWindows) add('C:\\', 'C:\\')
  else add('/', '/')
  return items
}

/* Saf yol yardımcıları (Electron'suz, test edilebilir) tek kaynaktan gelir. */
export { isInside, joinInside, sanitizeSegment } from './pathUtils'
