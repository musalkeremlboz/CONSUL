/** Dayanıklı dosya izleyicisi. YALNIZ main süreçten.
 *
 *  `fs.watch` tek başına yeterli değildir:
 *   · İzlenen dizin silinip yeniden oluşturulursa (kurulum, senkron aracı, elle temizlik)
 *     watcher ÖLÜR ve bir daha olay üretmez; kök neden hiçbir yerde görünmez.
 *   · Watcher `error` olayı ve callback içinde fırlayan hata eskiden SESSİZCE yutuluyordu.
 *
 *  Bu sarmalayıcı: hatayı bildirir (yutmaz), izlemeyi artan gecikmeyle YENİDEN KURAR ve
 *  yeniden bağlandığında bir kez callback çağırır — kopukluk sırasında kaçan değişiklik
 *  yakalanır. Debounce 150 ms (aynı yazımın birden çok olayı tek çağrıya iner). */
import { mkdirSync, statSync, watch, type FSWatcher } from 'node:fs'

export interface ResilientWatchOptions {
  /** İzlenecek dizin. */
  dir: string
  /** Yalnız bu dosya adı için tetikle (verilmezse dizindeki her değişiklik). */
  filename?: string
  /** Günlük/hata mesajlarında görünen etiket. */
  label: string
  debounceMs?: number
  /** Hata bildirimi — verilmezse stderr'e yazılır. ASLA sessiz kalmaz. */
  onError?: (err: unknown) => void
}

const RECONNECT_DELAYS_MS = [200, 500, 1_000, 2_000, 5_000] // sonra 5 sn'de sabit

export function watchResilient(opts: ResilientWatchOptions, cb: () => void): () => void {
  const debounceMs = opts.debounceMs ?? 150
  const report = (err: unknown): void => {
    if (opts.onError) opts.onError(err)
    else console.error(`[council/watch] ${opts.label}:`, err)
  }

  let watcher: FSWatcher | null = null
  let debounce: ReturnType<typeof setTimeout> | null = null
  let reconnect: ReturnType<typeof setTimeout> | null = null
  let healthCheck: ReturnType<typeof setInterval> | null = null
  let watchedIdentity: string | null = null
  let attempt = 0
  let closed = false

  const fire = (): void => {
    try {
      cb()
    } catch (err) {
      report(err) // tüketici hatası izlemeyi durdurmaz; sonraki değişiklikte yeniden denenir
    }
  }

  const schedule = (): void => {
    if (closed) return
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(fire, debounceMs)
  }

  const scheduleReconnect = (): void => {
    if (closed || reconnect) return
    const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)]
    attempt++
    reconnect = setTimeout(() => {
      reconnect = null
      start(true) // yeniden bağlanınca bir kez tetikle: kopuklukta kaçan değişikliği yakala
    }, delay)
  }

  const start = (fireAfter: boolean): void => {
    if (closed) return
    try {
      mkdirSync(opts.dir, { recursive: true })
      const stat = statSync(opts.dir)
      watchedIdentity = `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`
      const active = watch(opts.dir, (_event, name) => {
        if (closed) return
        if (opts.filename && name && name !== opts.filename) return
        schedule()
      })
      watcher = active
      active.on('error', (err) => {
        report(err)
        try {
          active.close()
        } catch {
          // zaten kapalı
        }
        if (watcher === active) watcher = null
        scheduleReconnect() // dizin silindi/yeniden oluşturuldu → izlemeyi yeniden kur
      })
      // Windows'ta dizin silinmesi her zaman `error` üretmez; watcher yalnız `close`
      // olabilir. Manuel stop'ta `closed` true olduğu için burada yeniden bağlanılmaz.
      active.on('close', () => {
        if (closed) return
        if (watcher === active) watcher = null
        scheduleReconnect()
      })
      attempt = 0 // başarılı bağlantı geri sayımı sıfırlar
      if (fireAfter) schedule()
    } catch (err) {
      report(err)
      scheduleReconnect()
    }
  }

  start(false)
  // Bazı Windows fs.watch uygulamaları dizin silme/yeniden yaratmada ne error ne close
  // üretir. Dizin kimliğini seyrek kontrol ederek sessiz ölü watcher'ı toparla.
  healthCheck = setInterval(() => {
    if (closed || reconnect) return
    let identity: string | null = null
    try {
      const stat = statSync(opts.dir)
      identity = `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`
    } catch {
      // dizin şu an yok
    }
    if (identity === watchedIdentity && watcher) return
    try {
      watcher?.close()
    } catch {
      // zaten kapalı
    }
    watcher = null
    watchedIdentity = identity
    scheduleReconnect()
  }, 500)
  healthCheck.unref()

  return () => {
    closed = true
    if (debounce) clearTimeout(debounce)
    if (reconnect) clearTimeout(reconnect)
    if (healthCheck) clearInterval(healthCheck)
    try {
      watcher?.close()
    } catch {
      // zaten kapalı
    }
  }
}
