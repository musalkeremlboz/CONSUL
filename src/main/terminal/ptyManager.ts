/** PTY oturum yöneticisi.
 *
 *  Tasarım ilkeleri:
 *  - **İzolasyon:** bir oturumun çökmesi ne diğer oturumları ne de uygulamayı
 *    düşürür; spawn hataları tipli `PtyError` olarak çağırana döner.
 *  - **Akış kontrolü:** renderer'ın onayladığı bayt sayısı takip edilir; 1 MiB
 *    onaylanmamış veriye ulaşınca PTY duraklatılır, 256 KiB'ın altına inince
 *    devam eder. Böylece `yes` gibi sonsuz çıktılar arayüzü boğmaz.
 *  - **Tamponlama:** her `onData` olayında IPC mesajı göndermek yerine çıktı
 *    ~6 ms'lik pencerelerde birleştirilir (§16 — düşük gecikme + az IPC trafiği). */
import { spawn, type IPty } from '@lydell/node-pty'
import type { WebContents } from 'electron'
import { isWindows } from '../platform/os'
import { IPC } from '../../shared/ipc'

const PAUSE_THRESHOLD = 1_048_576
const RESUME_THRESHOLD = 262_144
/** Çıktı birleştirme penceresi — gecikme ile IPC yükü arasındaki denge. */
const FLUSH_INTERVAL_MS = 6
/** Tampon bu boyutu aşarsa pencereyi beklemeden gönder. */
const FLUSH_BYTES = 32_768

export class PtyError extends Error {
  readonly code: 'spawn-failed' | 'not-found' | 'cwd-invalid'
  constructor(code: PtyError['code'], message: string) {
    super(message)
    this.name = 'PtyError'
    this.code = code
  }
}

export interface PtyLaunchSpec {
  file: string
  args: string[]
  cwd: string
  cols: number
  rows: number
  env: Record<string, string>
}

interface PtySession {
  pty: IPty
  unacked: number
  paused: boolean
  buffer: string[]
  bufferBytes: number
  flushTimer: NodeJS.Timeout | null
  disposables: { dispose(): void }[]
  exited: boolean
}

/** Veri/çıkış olaylarının gönderileceği IPC kanalları.
 *  CONSUL ve CONSUL Developer farklı kanal kümeleri kullanır. */
export interface PtyChannels {
  data: string
  exit: string
}

export class PtyManager {
  private sessions = new Map<string, PtySession>()
  private nextId = 1
  private readonly channels: PtyChannels

  constructor(channels: PtyChannels = { data: IPC.ptyData, exit: IPC.ptyExit }) {
    this.channels = channels
  }

  /** Oturum başlatır. Hata durumunda `PtyError` fırlatır; süreç düşmez. */
  create(target: WebContents, spec: PtyLaunchSpec): string {
    const id = String(this.nextId++)

    const base = {
      name: 'xterm-256color',
      cols: Math.max(2, Math.trunc(spec.cols)),
      rows: Math.max(1, Math.trunc(spec.rows)),
      cwd: spec.cwd,
      env: spec.env,
    }

    let pty: IPty
    try {
      pty = isWindows
        ? // Paketle gelen modern ConPTY (Windows Terminal'inki) — daha az resize artefaktı
          spawn(spec.file, spec.args, { ...base, useConpty: true, useConptyDll: true })
        : spawn(spec.file, spec.args, base)
    } catch (firstError) {
      if (isWindows) {
        try {
          pty = spawn(spec.file, spec.args, { ...base, useConpty: true, useConptyDll: false })
        } catch {
          throw toPtyError(firstError, spec)
        }
      } else {
        throw toPtyError(firstError, spec)
      }
    }

    const session: PtySession = {
      pty,
      unacked: 0,
      paused: false,
      buffer: [],
      bufferBytes: 0,
      flushTimer: null,
      disposables: [],
      exited: false,
    }

    const flush = (): void => {
      if (session.flushTimer) {
        clearTimeout(session.flushTimer)
        session.flushTimer = null
      }
      if (session.buffer.length === 0) return
      const data = session.buffer.join('')
      session.buffer = []
      session.bufferBytes = 0
      if (!target.isDestroyed()) target.send(this.channels.data, { id, data })
    }

    session.disposables.push(
      pty.onData((data) => {
        session.unacked += data.length
        if (!session.paused && session.unacked > PAUSE_THRESHOLD) {
          try {
            pty.pause()
            session.paused = true
          } catch {
            // duraklatma desteklenmiyor olabilir — akış kontrolü devre dışı kalır
          }
        }
        session.buffer.push(data)
        session.bufferBytes += data.length
        if (session.bufferBytes >= FLUSH_BYTES) {
          flush()
          return
        }
        if (!session.flushTimer) session.flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS)
      }),
      pty.onExit(({ exitCode, signal }) => {
        session.exited = true
        flush()
        if (!target.isDestroyed()) target.send(this.channels.exit, { id, exitCode, signal: signal ?? null })
        this.dispose(id)
      })
    )

    this.sessions.set(id, session)
    return id
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id)
    if (!session || session.exited) return
    try {
      session.pty.write(data)
    } catch {
      // Süreç yeni öldüyse yazma başarısız olur — oturumun kendi sorunu, uygulama etkilenmez
    }
  }

  resize(id: string, cols: number, rows: number): void {
    if (!Number.isFinite(cols) || !Number.isFinite(rows) || cols < 2 || rows < 1) return
    const session = this.sessions.get(id)
    if (!session || session.exited) return
    try {
      session.pty.resize(Math.trunc(cols), Math.trunc(rows))
    } catch {
      // kapanış yarışları — önemsiz
    }
  }

  ack(id: string, bytes: number): void {
    const session = this.sessions.get(id)
    if (!session || !Number.isFinite(bytes) || bytes < 0) return
    session.unacked = Math.max(0, session.unacked - bytes)
    if (session.paused && session.unacked < RESUME_THRESHOLD) {
      try {
        session.pty.resume()
        session.paused = false
      } catch {
        // yoksay
      }
    }
  }

  kill(id: string): void {
    const session = this.sessions.get(id)
    if (!session) return
    try {
      session.pty.kill()
    } catch {
      // zaten ölmüş olabilir
    }
    this.dispose(id)
  }

  killAll(): void {
    for (const id of [...this.sessions.keys()]) this.kill(id)
  }

  get size(): number {
    return this.sessions.size
  }

  /** Çalışan (henüz çıkmamış) oturum var mı — güncelleme yeniden başlatması bunu sorar. */
  hasLiveSessions(): boolean {
    for (const session of this.sessions.values()) {
      if (!session.exited) return true
    }
    return false
  }

  private dispose(id: string): void {
    const session = this.sessions.get(id)
    if (!session) return
    this.sessions.delete(id)
    if (session.flushTimer) clearTimeout(session.flushTimer)
    for (const d of session.disposables) {
      try {
        d.dispose()
      } catch {
        // yoksay
      }
    }
  }
}

function toPtyError(error: unknown, spec: PtyLaunchSpec): PtyError {
  const message = error instanceof Error ? error.message : String(error)
  if (/ENOENT|not found|cannot find/i.test(message)) {
    return new PtyError('not-found', `Kabuk bulunamadı: ${spec.file}`)
  }
  if (/ENOTDIR|ENOENT.*cwd|chdir/i.test(message)) {
    return new PtyError('cwd-invalid', `Çalışma dizini açılamadı: ${spec.cwd}`)
  }
  return new PtyError('spawn-failed', `Terminal oturumu başlatılamadı: ${message}`)
}
