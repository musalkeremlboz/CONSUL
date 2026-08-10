/** Sürüm ve manifest doğrulaması — güncelleme zincirinin "güven" katmanı.
 *
 *  electron-updater indirilen dosyanın sha512 özetini manifestle karşılaştırır;
 *  buradaki kontroller ONA EK savunmadır (talimat §40 "version validation"):
 *
 *   1. **Sürüm düşürme reddi:** sunulan sürüm mevcuttan yeni değilse güncelleme
 *      kabul edilmez. Ele geçirilmiş/eskitilmiş bir manifest kullanıcıyı eski,
 *      açığı bilinen bir sürüme geri döndüremez.
 *   2. **Manifest bütünlüğü:** sha512 alanı olmayan bir yayın "doğrulanamaz"
 *      demektir; böyle bir güncelleme reddedilir.
 *
 *  Saf fonksiyonlardır — Electron bağımlılığı yoktur, doğrudan test edilir. */

export interface ParsedVersion {
  major: number
  minor: number
  patch: number
  /** `1.2.0-beta.3` → `['beta', 3]`; kararlı sürümde boş dizi. */
  prerelease: (string | number)[]
}

const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

export function parseVersion(value: string): ParsedVersion | null {
  const match = VERSION_PATTERN.exec(String(value ?? '').trim())
  if (!match) return null
  const prerelease = match[4]
    ? match[4].split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part))
    : []
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
  }
}

function comparePrerelease(a: (string | number)[], b: (string | number)[]): number {
  // SemVer: ön-sürümü OLMAYAN, olandan büyüktür
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1
  if (b.length === 0) return -1

  const length = Math.max(a.length, b.length)
  for (let i = 0; i < length; i++) {
    const left = a[i]
    const right = b[i]
    if (left === undefined) return -1
    if (right === undefined) return 1
    if (left === right) continue
    const leftIsNumber = typeof left === 'number'
    const rightIsNumber = typeof right === 'number'
    if (leftIsNumber && rightIsNumber) return left < right ? -1 : 1
    // Sayısal tanımlayıcı, alfasayısal olandan küçüktür
    if (leftIsNumber) return -1
    if (rightIsNumber) return 1
    return String(left) < String(right) ? -1 : 1
  }
  return 0
}

/** SemVer karşılaştırması: a < b → -1, a === b → 0, a > b → 1.
 *  Ayrıştırılamayan sürüm daima "daha küçük" sayılır (güvenli taraf). */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a)
  const right = parseVersion(b)
  if (!left && !right) return 0
  if (!left) return -1
  if (!right) return 1
  if (left.major !== right.major) return left.major < right.major ? -1 : 1
  if (left.minor !== right.minor) return left.minor < right.minor ? -1 : 1
  if (left.patch !== right.patch) return left.patch < right.patch ? -1 : 1
  return comparePrerelease(left.prerelease, right.prerelease)
}

/** Sunulan sürüm, kurulu sürümden GERÇEKTEN yeni mi? */
export function isNewerVersion(offered: string, current: string): boolean {
  return compareVersions(offered, current) > 0
}

/** Ön-sürüm etiketi taşıyan yayınlar yalnız beta kanalına gider. */
export function isPrerelease(version: string): boolean {
  const parsed = parseVersion(version)
  return parsed !== null && parsed.prerelease.length > 0
}

export interface UpdateManifestFile {
  url: string
  sha512: string
  size?: number
}

export interface UpdateManifest {
  version: string
  files: UpdateManifestFile[]
  releaseDate?: string
}

export interface ManifestCheck {
  ok: boolean
  /** Türkçe, kullanıcıya gösterilebilir ret gerekçesi. */
  reason?: string
  manifest?: UpdateManifest
}

/**
 * electron-updater'ın verdiği yayın bilgisini doğrular.
 *
 * Reddedilen durumlar:
 *  - sürüm ayrıştırılamıyor
 *  - sürüm kuruludan yeni değil (düşürme girişimi)
 *  - hiç dosya yok ya da bir dosyanın sha512 özeti eksik
 *  - kararlı kanalda ön-sürüm sunuluyor
 */
export function validateUpdateManifest(
  raw: unknown,
  currentVersion: string,
  channel: 'stable' | 'beta'
): ManifestCheck {
  if (raw === null || typeof raw !== 'object') {
    return { ok: false, reason: 'Güncelleme bilgisi okunamadı.' }
  }
  const info = raw as { version?: unknown; files?: unknown; releaseDate?: unknown }
  const version = typeof info.version === 'string' ? info.version : ''
  if (!parseVersion(version)) {
    return { ok: false, reason: 'Güncelleme sürümü geçersiz.' }
  }
  if (!isNewerVersion(version, currentVersion)) {
    return { ok: false, reason: `Sunulan sürüm (${version}) kurulu sürümden yeni değil.` }
  }
  if (channel === 'stable' && isPrerelease(version)) {
    return { ok: false, reason: 'Kararlı kanalda ön-sürüm kurulmaz.' }
  }

  const rawFiles = Array.isArray(info.files) ? info.files : []
  if (rawFiles.length === 0) {
    return { ok: false, reason: 'Güncelleme dosyası bulunamadı.' }
  }

  const files: UpdateManifestFile[] = []
  for (const entry of rawFiles) {
    if (entry === null || typeof entry !== 'object') {
      return { ok: false, reason: 'Güncelleme dosya listesi bozuk.' }
    }
    const file = entry as { url?: unknown; sha512?: unknown; size?: unknown }
    if (typeof file.url !== 'string' || !file.url) {
      return { ok: false, reason: 'Güncelleme dosyasının adresi eksik.' }
    }
    if (typeof file.sha512 !== 'string' || file.sha512.length < 40) {
      return { ok: false, reason: 'Güncelleme dosyasının bütünlük özeti (sha512) eksik.' }
    }
    files.push({
      url: file.url,
      sha512: file.sha512,
      ...(typeof file.size === 'number' ? { size: file.size } : {}),
    })
  }

  return {
    ok: true,
    manifest: {
      version,
      files,
      ...(typeof info.releaseDate === 'string' ? { releaseDate: info.releaseDate } : {}),
    },
  }
}
