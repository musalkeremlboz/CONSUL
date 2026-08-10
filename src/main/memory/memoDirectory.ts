/** CONSUL-MEMO klasör çözümleyicisi.
 *
 *  Görev: bir proje yoluna KARARLI bir hafıza klasörü eşlemek ve repository
 *  yeniden adlandırıldığında hafızayı KAYBETMEDEN, ÇOĞALTMADAN taşımak.
 *
 *  İki kayıt tutulur:
 *   - `<CONSUL-MEMO>/.consul-index.json` — proje yolu → klasör eşlemesi
 *   - `<klasör>/.consul-memo.json`       — klasörün kalıcı kimliği + bilinen yollar
 *
 *  Kullanıcının repository'sine HİÇBİR ŞEY yazılmaz; tüm defter hafıza kökünde
 *  yaşar. Çok pencereli kullanımda indeks `withFileLock` altında güncellenir. */
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { readJsonStrict, writeJsonAtomic } from '../../core/store'
import { withFileLock } from '../../core/file-lock'
import { isWindows } from '../platform/os'
import { isInside, sanitizeSegment } from '../platform/pathUtils'

const INDEX_FILE = '.consul-index.json'
const IDENTITY_FILE = '.consul-memo.json'

interface IndexRecord {
  folder: string
  id: string
}

interface MemoIndex {
  version: number
  projects: Record<string, IndexRecord>
}

export interface MemoIdentity {
  id: string
  folder: string
  projectPaths: string[]
  repositoryName?: string
  createdAt: string
  updatedAt: string
}

export interface ResolvedMemo {
  /** Hafıza klasörünün tam yolu. */
  dir: string
  identity: MemoIdentity
  /** Bu çağrıda klasör yeni mi oluşturuldu. */
  created: boolean
  /** Repository yeniden adlandırıldığı için klasör taşındıysa eski adı. */
  renamedFrom?: string
}

function indexPath(root: string): string {
  return join(root, INDEX_FILE)
}

/** Proje yolu anahtarı — Windows'ta harf duyarsız, sondaki ayraç atılmış. */
export function projectKey(projectPath: string): string {
  const trimmed = String(projectPath ?? '').replace(/[/\\]+$/, '')
  return isWindows ? trimmed.toLowerCase() : trimmed
}

function emptyIndex(): MemoIndex {
  return { version: 1, projects: {} }
}

function readIndex(root: string): MemoIndex {
  const raw = readJsonStrict<MemoIndex>(indexPath(root), emptyIndex())
  if (!raw || typeof raw !== 'object' || typeof raw.projects !== 'object' || raw.projects === null) {
    return emptyIndex()
  }
  const projects: Record<string, IndexRecord> = {}
  for (const [key, value] of Object.entries(raw.projects)) {
    if (
      value &&
      typeof value === 'object' &&
      typeof (value as IndexRecord).folder === 'string' &&
      typeof (value as IndexRecord).id === 'string'
    ) {
      projects[key] = { folder: (value as IndexRecord).folder, id: (value as IndexRecord).id }
    }
  }
  return { version: 1, projects }
}

function readIdentity(dir: string): MemoIdentity | null {
  const file = join(dir, IDENTITY_FILE)
  if (!existsSync(file)) return null
  const value = readJsonStrict<MemoIdentity | null>(file, null)
  if (!value || typeof value.id !== 'string' || !value.id) return null
  return {
    id: value.id,
    folder: typeof value.folder === 'string' ? value.folder : '',
    projectPaths: Array.isArray(value.projectPaths) ? value.projectPaths.filter((p) => typeof p === 'string') : [],
    repositoryName: typeof value.repositoryName === 'string' ? value.repositoryName : undefined,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  }
}

function writeIdentity(dir: string, identity: MemoIdentity): void {
  writeJsonAtomic(join(dir, IDENTITY_FILE), identity)
}

/** `desired`, `desired-2`, `desired-3` … — boş olan ilk adı döndürür. */
function uniqueFolderName(root: string, desired: string): string {
  if (!existsSync(join(root, desired))) return desired
  for (let n = 2; n < 1000; n++) {
    const candidate = `${desired}-${n}`
    if (!existsSync(join(root, candidate))) return candidate
  }
  return `${desired}-${randomUUID().slice(0, 8)}`
}

/** Hafıza kökündeki gerçek klasörler (nokta ile başlayanlar hariç). */
function listMemoFolders(root: string): string[] {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
  } catch {
    return []
  }
}

/**
 * Proje için hafıza klasörünü çözer ve gerekiyorsa oluşturur/taşır.
 *
 * Sıra:
 *  1. Proje yolu indekste kayıtlıysa o klasör kullanılır. Repository adı
 *     değişmişse ve yeni ad boştaysa klasör YENİDEN ADLANDIRILIR (taşınır) —
 *     içerik korunur, kopya oluşmaz.
 *  2. Yol kayıtlı değilse, istenen adda bir klasör varsa o BENİMSENİR
 *     (proje başka bir yola taşınmış olabilir).
 *  3. Aksi hâlde yeni klasör oluşturulur (ad çakışırsa `-2` soneki).
 */
export function resolveMemoDir(input: {
  /** Hafıza kökü (`<Belgeler>/CONSUL-MEMO`). Testler geçici bir dizin verir. */
  root: string
  projectPath: string
  desiredName: string
  repositoryName?: string
}): ResolvedMemo {
  const root = input.root
  mkdirSync(root, { recursive: true })
  const desired = sanitizeSegment(input.desiredName)
  const key = projectKey(input.projectPath)
  const now = new Date().toISOString()

  return withFileLock(indexPath(root), () => {
    const index = readIndex(root)
    const record = index.projects[key]
    let folder: string | null = null
    let created = false
    let renamedFrom: string | undefined

    if (record && existsSync(join(root, record.folder))) {
      folder = record.folder
      // Repository yeniden adlandırılmış: klasörü taşı (yeni ad boşsa)
      if (folder !== desired && !existsSync(join(root, desired))) {
        const from = join(root, folder)
        const to = join(root, desired)
        if (!isInside(root, to)) throw new Error('Güvenlik: hafıza klasörü kökün dışına taşınamaz.')
        try {
          renameSync(from, to)
          renamedFrom = folder
          folder = desired
        } catch {
          // Taşıma başarısız (dosya kilitli olabilir) — eski adla devam et, veri güvende
        }
      }
    }

    if (!folder) {
      const existing = listMemoFolders(root).find((name) => name === desired)
      if (existing) {
        folder = existing
      } else {
        folder = uniqueFolderName(root, desired)
        mkdirSync(join(root, folder), { recursive: true })
        created = true
      }
    }

    const dir = join(root, folder)
    if (!isInside(root, dir)) throw new Error('Güvenlik: hafıza klasörü kökün dışında.')
    mkdirSync(dir, { recursive: true })

    const previous = readIdentity(dir)
    const paths = new Set(previous?.projectPaths ?? [])
    paths.add(input.projectPath)
    const identity: MemoIdentity = {
      id: previous?.id ?? record?.id ?? randomUUID(),
      folder,
      projectPaths: [...paths].slice(-10),
      repositoryName: input.repositoryName ?? previous?.repositoryName,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    }
    writeIdentity(dir, identity)

    // Eski klasör adına işaret eden TÜM kayıtları güncelle (taşımadan sonra)
    if (renamedFrom) {
      for (const [k, value] of Object.entries(index.projects)) {
        if (value.folder === renamedFrom) index.projects[k] = { folder, id: value.id }
      }
    }
    index.projects[key] = { folder, id: identity.id }
    writeJsonAtomic(indexPath(root), index)

    const result: ResolvedMemo = { dir, identity, created }
    if (renamedFrom) result.renamedFrom = renamedFrom
    return result
  })
}
