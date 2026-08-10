/** PTY ortam değişkenleri.
 *
 *  Electron, alt süreçlere kendi çalışma zamanı değişkenlerini miras bırakır;
 *  bunlar Node tabanlı CLI'ları (npm, claude, codex) bozar. Burada ortam
 *  temizlenir, terminal kimliği eklenir ve kullanıcı araçlarının bulunabilmesi
 *  için PATH platforma uygun biçimde zenginleştirilir.
 *
 *  Gizlilik: hiçbir ortam değişkeni DEĞERİ loglanmaz. */
import { existsSync } from 'node:fs'
import { delimiter } from 'node:path'
import { PATH_SEPARATOR, envKey, isWindows } from '../platform/os'
import { extraSearchDirs } from '../platform/executables'
import { findGitBash } from '../platform/shells'

/** Electron'un alt süreçlere sızdırdığı, temizlenmesi gereken değişkenler. */
const ELECTRON_LEAKS = [
  'ELECTRON_RUN_AS_NODE',
  'ELECTRON_NO_ATTACH_CONSOLE',
  'ELECTRON_FORCE_IS_PACKAGED',
  'NODE_OPTIONS',
  'NODE_ENV',
]

/** Electron kalıntılarından arınmış, anahtarları tekilleştirilmiş temel ortam. */
export function cleanEnv(source: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue
    if (isWindows) {
      // Çift `Path`/`PATH` ConPTY spawn'ını bozar — harf duyarsız tekilleştir
      const existing = Object.keys(merged).find((k) => k.toLowerCase() === key.toLowerCase())
      if (existing !== undefined) {
        merged[existing] = value
        continue
      }
    }
    merged[key] = value
  }
  for (const key of ELECTRON_LEAKS) {
    const actual = envKey(merged, key)
    delete merged[actual]
  }
  return merged
}

function appendToPath(env: Record<string, string>, dirs: string[]): void {
  const key = envKey(env, 'PATH')
  let current = env[key] ?? ''
  const known = new Set(
    current.split(delimiter).filter(Boolean).map((d) => (isWindows ? d.toLowerCase() : d))
  )
  for (const dir of dirs) {
    if (!dir || !existsSync(dir)) continue
    const probe = isWindows ? dir.toLowerCase() : dir
    if (known.has(probe)) continue
    known.add(probe)
    current = current ? `${current}${PATH_SEPARATOR}${dir}` : dir
  }
  env[key] = current
}

export interface PtyEnvOptions {
  /** Çağıranın eklemek istediği değişkenler (asla diske yazılmaz). */
  extra?: Record<string, string>
}

/** PTY oturumları için hazırlanmış ortam. */
export function buildPtyEnv(opts: PtyEnvOptions = {}): Record<string, string> {
  const env = cleanEnv()

  env['TERM'] = 'xterm-256color'
  env['COLORTERM'] = 'truecolor'
  env['TERM_PROGRAM'] = 'CONSUL'

  // Windows'ta `bash` PATH'te olmayabilir; Claude Code'un Bash aracı bu değişkene bakar.
  if (isWindows && !env['CLAUDE_CODE_GIT_BASH_PATH']) {
    const bash = findGitBash()
    if (bash) env['CLAUDE_CODE_GIT_BASH_PATH'] = bash
  }

  // Uygulama bayat bir PATH ile başlatılmış olsa da kullanıcı araçları bulunsun
  appendToPath(env, extraSearchDirs())

  if (opts.extra) {
    for (const [key, value] of Object.entries(opts.extra)) {
      env[envKey(env, key)] = value
    }
  }
  return env
}
