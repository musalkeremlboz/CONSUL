/** AtomicStore — CONSUL'un kalıcılık sözleşmesi.
 *
 *  Garantiler:
 *   1. Atomik yazım: tmp + fsync + rename — yarım yazılmış dosya asla görünmez.
 *   2. İki nesil yedek: her başarılı yazımdan önce mevcut dosya `.bak1`'e, eski
 *      `.bak1` `.bak2`'ye döner (kopya ile — ana dosya hiçbir anda kaybolmaz).
 *   3. Bozulma kurtarması: ana dosya parse/normalize edilemezse `.corrupt-<zaman>`
 *      olarak karantinaya alınır, `.bak1` → `.bak2` sırayla denenir; kurtarılan
 *      sürüm ana dosyaya geri yazılır. Hiçbiri kurtarılamazsa `defaults` döner.
 *   4. Geçici IO hatası (EBUSY/EPERM…) veri bozukluğu DEĞİLDİR: dosyaya dokunulmaz,
 *      `TransientReadError` fırlatılır — çağıran sessiz reset yerine hatayı gösterir.
 *   5. `schemaVersion` + `migrate`: eski sürüm veri tek noktadan göç eder.
 *
 *  YALNIZ main süreçten import edilir. Not: süreçler arası kilit İÇERMEZ — tek-yazar
 *  (uygulama başına tek main süreç) varsayar. Çok yazarlı dosyalar için `file-lock.ts`
 *  ile sarmalanır (bkz. memory/memoDirectory.ts). */
import { closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, openSync, renameSync, writeSync } from 'node:fs'
import { dirname } from 'node:path'
import { readWithRetry, TransientReadError } from './store'

/** Geçici IO okuma hatası. Tek tanım `store.ts`'dedir (tek sınıf kimliği → `instanceof`
 *  hem AtomicStore hem readJsonStrict yollarında çalışır); buradan yeniden dışa verilir. */
export { TransientReadError } from './store'

export interface AtomicStoreOptions<T> {
  path: string
  schemaVersion: number
  /** Boş/kurtarılamaz durumda dönen taze varsayılan. Her çağrıda YENİ nesne üretmeli. */
  defaults: () => T
  /** Ham JSON'u doğrula + normalize et; geçersiz yapıda THROW et (kurtarma zinciri devralır).
   *  `version` diskte bulunan schemaVersion'dur (yoksa 0) — göç mantığı burada uygulanır. */
  normalize: (raw: unknown, version: number) => T
}

interface Envelope {
  schemaVersion: number
  data: unknown
}

export interface AtomicStore<T> {
  /** Oku + normalize + gerekirse yedekten kurtar. Geçici IO hatasında TransientReadError fırlatır. */
  read(): T
  /** Atomik yaz (tmp+fsync+rename) — öncesinde iki nesil yedek döndürülür. */
  write(data: T): void
  /** read → fn → write kısayolu; yazılan değeri döndürür. */
  update(fn: (current: T) => T): T
  readonly path: string
}

export function createAtomicStore<T>(options: AtomicStoreOptions<T>): AtomicStore<T> {
  const { path, schemaVersion, defaults, normalize } = options
  const bak1 = `${path}.bak1`
  const bak2 = `${path}.bak2`

  /** Tek dosyayı parse+normalize et. ENOENT → null; geçici IO → TransientReadError; bozuk → throw. */
  function tryLoad(file: string): T | null {
    const raw = readWithRetry(file) // sınırlı retry; tükenirse TransientReadError fırlar
    if (raw === null) return null // ENOENT
    const parsed: unknown = JSON.parse(raw) // bozuksa throw — çağıran karantinaya alır
    const envelope = parsed as Partial<Envelope> | null
    const isEnvelope = envelope !== null && typeof envelope === 'object' && typeof envelope.schemaVersion === 'number' && 'data' in envelope
    const version = isEnvelope ? (envelope.schemaVersion as number) : 0
    const payload = isEnvelope ? envelope.data : parsed
    return normalize(payload, version)
  }

  function quarantine(file: string): void {
    try {
      renameSync(file, `${file}.corrupt-${Date.now()}`)
    } catch {
      // best-effort — yeniden adlandırılamazsa sonraki yazım üstüne yazar
    }
  }

  function writeRaw(data: T): void {
    mkdirSync(dirname(path), { recursive: true })
    // İki nesil yedek: mevcut ana dosya kopyalanır (ana dosya hiç kaybolmaz).
    try {
      if (existsSync(path)) {
        if (existsSync(bak1)) copyFileSync(bak1, bak2)
        copyFileSync(path, bak1)
      }
    } catch {
      // yedek rotasyonu best-effort — asıl yazımı engellemez
    }
    const envelope: Envelope = { schemaVersion, data }
    const tmp = `${path}.${process.pid}.tmp`
    const fd = openSync(tmp, 'w')
    try {
      writeSync(fd, JSON.stringify(envelope, null, 2))
      fsyncSync(fd) // elektrik kesintisinde tmp içeriği diske inmiş olsun
    } finally {
      closeSync(fd)
    }
    renameSync(tmp, path)
  }

  function read(): T {
    // 1) Ana dosya
    try {
      const main = tryLoad(path)
      if (main !== null) return main
      // ENOENT → yedek denenmez (hiç veri yazılmamış olabilir; bak varsa yetim kurtarma):
      if (!existsSync(bak1) && !existsSync(bak2)) return defaults()
    } catch (error) {
      if (error instanceof TransientReadError) throw error
      quarantine(path)
    }
    // 2) Yedek zinciri (yeniden eskiye); kurtarılan ana dosyaya geri yazılır.
    for (const candidate of [bak1, bak2]) {
      try {
        const recovered = tryLoad(candidate)
        if (recovered !== null) {
          try {
            writeRaw(recovered)
          } catch {
            // geri yazım başarısız olsa da kurtarılan veri döner
          }
          return recovered
        }
      } catch (error) {
        if (error instanceof TransientReadError) throw error
        quarantine(candidate)
      }
    }
    return defaults()
  }

  return {
    path,
    read,
    write: writeRaw,
    update(fn) {
      const next = fn(read())
      writeRaw(next)
      return next
    },
  }
}

/** Testler için: bir deponun yardımcı dosya adları. */
export function atomicStorePaths(path: string): { bak1: string; bak2: string } {
  return { bak1: `${path}.bak1`, bak2: `${path}.bak2` }
}
