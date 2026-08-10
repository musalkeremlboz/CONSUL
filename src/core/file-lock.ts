/**
 * Süreçler arası senkron dosya kilidi.
 *
 * Sabit bir `.lock` dosyasını stale iken silmek TOCTOU üretir: iki contender aynı
 * stale dosyayı okuyup biri yeni sahibin kilidini silebilir. Bu uygulama bunun
 * yerine her contender için yeniden kullanılamayan benzersiz claim dosyası
 * oluşturur. Ölü claim yalnız kendi exact path'i üzerinden silinir; başka sahibin
 * claim'i aynı adla hiçbir zaman yeniden yaratılamaz.
 */
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from 'node:fs'
import { randomUUID } from 'node:crypto'
import { basename, resolve } from 'node:path'

export interface FileLockOptions {
  timeoutMs?: number
  retryMs?: number
  staleMs?: number
}

export class FileLockError extends Error {
  readonly code = 'COUNCIL_FILE_LOCK_TIMEOUT'
  constructor(targetPath: string) {
    super(`Paylaşılan dosya kilidi alınamadı: ${basename(targetPath)}`)
    this.name = 'FileLockError'
  }
}

interface ClaimRecord {
  pid: number
  createdAt: number
  state: 'waiting' | 'entered'
  nonce: string
}

interface ClaimInfo extends ClaimRecord {
  name: string
  path: string
  mtimeMs: number
}

const sleepArray = new Int32Array(new SharedArrayBuffer(4))
const CLAIM_SETTLE_MS = 5
const activeLocks = new Set<string>()

function sleepSync(ms: number): void {
  Atomics.wait(sleepArray, 0, 0, Math.max(1, ms))
}

function processIsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

function writeClaim(path: string, record: ClaimRecord): void {
  writeFileSync(path, JSON.stringify(record), { encoding: 'utf8', flag: 'w' })
}

function readClaims(lockDir: string, staleMs: number, hardStaleMs: number): ClaimInfo[] {
  const now = Date.now()
  let names: string[]
  try {
    names = readdirSync(lockDir).filter((name) => name.endsWith('.claim'))
  } catch {
    return []
  }

  const claims: ClaimInfo[] = []
  for (const name of names) {
    const path = `${lockDir}/${name}`
    try {
      const stat = statSync(path)
      let parsed: Partial<ClaimRecord> = {}
      try {
        parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<ClaimRecord>
      } catch {
        // Claim yazılırken çok kısa süre boş görülebilir; stat zamanı ile sıraya girer.
      }
      const namePid = Number.parseInt(name.split('-', 1)[0] ?? '', 10)
      const pid = Number.isInteger(parsed.pid) && Number(parsed.pid) === namePid ? Number(parsed.pid) : 0
      const birthtime = stat.birthtimeMs || stat.ctimeMs
      const candidateCreatedAt = Number.isFinite(parsed.createdAt) ? Number(parsed.createdAt) : birthtime
      const createdAt = Math.abs(candidateCreatedAt - birthtime) <= 60_000 ? candidateCreatedAt : birthtime
      const state = parsed.state === 'entered' ? 'entered' : 'waiting'
      const nonce = typeof parsed.nonce === 'string' ? parsed.nonce : name

      // Ölü PID stale eşiğinde; PID yeniden kullanılmışsa hard stale eşiğinde kırılır.
      // Claim adı benzersizdir; exact path hiçbir yeni sahip tarafından yeniden kullanılmaz.
      const age = now - stat.mtimeMs
      if (age > staleMs && (!processIsAlive(pid) || age > hardStaleMs)) {
        try { rmSync(path, { force: true }) } catch { /* sonraki tur yeniden dener */ }
        continue
      }
      claims.push({ name, path, pid, createdAt, state, nonce, mtimeMs: stat.mtimeMs })
    } catch {
      // Claim tur arasında sahibince kaldırılmış olabilir.
    }
  }
  return claims.sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name))
}

function createClaim(lockDir: string): ClaimInfo {
  const nonce = randomUUID()
  const name = `${process.pid}-${nonce}.claim`
  const path = `${lockDir}/${name}`
  let fd: number | null = null
  const createdAt = Date.now()
  const record: ClaimRecord = { pid: process.pid, createdAt, state: 'waiting', nonce }
  try {
    fd = openSync(path, 'wx')
    writeSync(fd, JSON.stringify(record))
    closeSync(fd); fd = null
    const stat = statSync(path)
    return { ...record, name, path, mtimeMs: stat.mtimeMs }
  } catch (error) {
    if (fd !== null) try { closeSync(fd) } catch { /* kapatılamadı — süreç sonunda düşer */ }
    try { rmSync(path, { force: true }) } catch { /* yarım claim dosyası sonraki turda stale sayılır */ }
    throw error
  }
}

/**
 * fn senkron çalışır; kilit yalnız fn döndükten/fırlattıktan sonra bırakılır.
 * Timeout halinde fn ASLA çalıştırılmaz.
 */
export function withFileLock<T>(targetPath: string, fn: () => T, opts: FileLockOptions = {}): T {
  const timeoutMs = opts.timeoutMs ?? 3_000
  const retryMs = opts.retryMs ?? 5
  const staleMs = opts.staleMs ?? 1_000
  if (timeoutMs < 1 || retryMs < 1 || staleMs < 1) throw new Error('Kilit süreleri pozitif olmalıdır.')
  const lockDir = `${targetPath}.lock`
  const canonical = process.platform === 'win32' ? resolve(targetPath).toLowerCase() : resolve(targetPath)
  if (activeLocks.has(canonical)) throw new Error(`Aynı süreçte iç içe dosya kilidi alınamaz: ${basename(targetPath)}`)
  activeLocks.add(canonical)
  const started = performance.now()
  const hardStaleMs = Math.max(30_000, staleMs * 10)
  let own: ClaimInfo | null = null
  let ownCreatedAt = 0

  try {
    while (!own) {
      try {
        mkdirSync(lockDir, { recursive: true })
        own = createClaim(lockDir)
        ownCreatedAt = performance.now()
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code !== 'ENOENT' && code !== 'EEXIST') throw error
        if (performance.now() - started >= timeoutMs) throw new FileLockError(targetPath)
        sleepSync(retryMs)
      }
    }

    while (performance.now() - started < timeoutMs) {
      const claims = readClaims(lockDir, staleMs, hardStaleMs)
      const mine = claims.find((claim) => claim.name === own!.name)
      if (!mine) { sleepSync(retryMs); continue }

      const entered = claims.filter((claim) => claim.state === 'entered')
      if (entered.length === 0) {
        if (claims[0]?.name === own.name && performance.now() - ownCreatedAt >= CLAIM_SETTLE_MS) {
          writeClaim(own.path, { pid: own.pid, createdAt: own.createdAt, state: 'entered', nonce: own.nonce })
          own = { ...own, state: 'entered', mtimeMs: Date.now() }
          continue
        }
      } else {
        // Olası aynı-an yarışında deterministik ilk entered claim kazanır.
        const winner = entered[0]!
        if (winner.name === own.name) return fn()
      }
      sleepSync(retryMs)
    }
    throw new FileLockError(targetPath)
  } finally {
    if (own) try { rmSync(own.path, { force: true }) } catch { /* dead claim TTL ile temizlenir */ }
    try { rmdirSync(lockDir) } catch { /* başka contender var */ }
    activeLocks.delete(canonical)
  }
}
