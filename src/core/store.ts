/** Atomik JSON deposu — CONSUL'un kalıcı dosyaları (ayarlar, hafıza indeksi) bu
 *  yardımcılarla okunur/yazılır. YALNIZ main süreçten import edilir (fs bağımlılığı).
 *  Renderer'a asla açılmaz. */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** Geçici IO okuma hatası — veri BOZUK DEĞİL, dosya şu an okunamıyor (EBUSY/EPERM/EMFILE…).
 *  Değişebilir (read–modify–write) depolarda bu durumu "dosya yok" saymak veri kaybıdır:
 *  çağıran boş fallback'i alıp üzerine yazarsa gerçek veri silinir. `readJsonStrict`
 *  bu hatayı fırlatır; salt-okunur/idempotent çağıranlar `readJsonSafe` kullanabilir. */
export class TransientReadError extends Error {
  readonly ioCause: unknown
  readonly path: string
  constructor(path: string, ioCause: unknown) {
    super(`Depo dosyası şu an okunamıyor (geçici IO hatası): ${path}`)
    this.name = 'TransientReadError'
    this.path = path
    this.ioCause = ioCause
  }
}

/** ENOENT dışındaki her errno geçicidir: dosya var ama şu an açılamıyor. */
function isTransientError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code
  return code !== undefined && code !== 'ENOENT'
}

/** Kısa, sınırlı bloklama — Windows'ta rename penceresindeki EBUSY genelde ms'ler içinde geçer. */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

const READ_RETRY_DELAYS_MS = [20, 50] // toplam ≤70 ms: 3 deneme

/** Dosyayı okur; geçici IO hatasında sınırlı sayıda yeniden dener.
 *  ENOENT → null döner. Diğer errno'lar tükendikten sonra `TransientReadError` fırlatır.
 *  AtomicStore da bu yardımcıyı kullanır — tek yeniden deneme politikası. */
export function readWithRetry(path: string): string | null {
  let lastError: unknown
  for (let attempt = 0; ; attempt++) {
    try {
      return readFileSync(path, 'utf8')
    } catch (error) {
      if (!isTransientError(error)) return null // ENOENT
      lastError = error
      if (attempt >= READ_RETRY_DELAYS_MS.length) break
      sleepSync(READ_RETRY_DELAYS_MS[attempt])
    }
  }
  throw new TransientReadError(path, lastError)
}

/** Bozuk dosyayı kenara alır (best-effort) — sonraki yazım kurtarılabilir veriyi ezmez. */
function quarantine(path: string): void {
  try {
    renameSync(path, `${path}.corrupt-${Date.now()}`)
  } catch {
    // yeniden adlandırma başarısızsa sessizce fallback'e düşülür
  }
}

/** Dosyayı okuyup ayrıştırır — ASLA throw etmez.
 *  - Dosya yoksa (ENOENT) `fallback` döner.
 *  - OKUMA hatası (EBUSY/EPERM gibi geçici IO) da `fallback` döner.
 *  - AYRIŞTIRMA başarısızsa bozuk dosya `<path>.corrupt-<zaman>` olarak kenara alınır.
 *
 *  ⚠ DEĞİŞEBİLİR DEPOLARDA KULLANMAYIN. Geçici IO hatasında dönen `fallback`'i okuyup
 *  üzerine yazan bir çağıran gerçek veriyi SİLER (read–modify–write yarışı). Böyle
 *  çağıranlar `readJsonStrict` veya `createAtomicStore` kullanmalıdır. */
export function readJsonSafe<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback
  let raw: string | null
  try {
    raw = readWithRetry(path)
  } catch {
    return fallback // TransientReadError — bu yardımcı bilerek yutar
  }
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    quarantine(path)
    return fallback
  }
}

/** `readJsonSafe`'in değişebilir depolar için güvenli sürümü: geçici IO hatasında
 *  `fallback` DÖNMEZ, `TransientReadError` fırlatır. Böylece çağıran "dosya boş"
 *  sanıp gerçek veriyi ezmez; bir sonraki turda yeniden dener.
 *  Yokluk (ENOENT) ve gerçek bozulma (parse hatası) yine `fallback` ile karşılanır —
 *  bunlar veri kaybı değil, kurtarma yollarıdır. */
export function readJsonStrict<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback
  const raw = readWithRetry(path) // geçici IO → TransientReadError (yutulmaz)
  if (raw === null) return fallback // yarışta silinmiş
  try {
    return JSON.parse(raw) as T
  } catch {
    quarantine(path)
    return fallback
  }
}

/** Veriyi atomik yazar: dizini oluşturur, `<path>.<pid>.tmp`'e yazıp hedefin üzerine
 *  renameSync eder — yarım-yazılmış dosya asla görünmez (yırtık okumaları engeller). */
export function writeJsonAtomic(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  renameSync(tmp, path)
}
