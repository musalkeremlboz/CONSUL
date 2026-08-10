/** Çalıştırılabilir dosya keşfi — kabuk çalıştırmadan.
 *
 *  `where.exe` / `which` çağırmak yerine PATH dizinleri doğrudan taranır:
 *  (1) platformdan bağımsızdır, (2) araya kabuk girmediği için komut enjeksiyonu
 *  yüzeyi yoktur, (3) uygulama bayat bir PATH ile başlatılmış olsa bile
 *  platforma özgü kurulum konumları ek olarak denenir.
 *
 *  Sürüm bilgisi isteğe bağlıdır ve YALNIZ çözümlenmiş MUTLAK yol ile,
 *  kabuk olmadan (`execFile`) alınır. */
import { execFile } from 'node:child_process'
import { accessSync, constants, existsSync, statSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { homedir } from 'node:os'
import { EXECUTABLE_EXTENSIONS, isLinux, isMacOS, isWindows } from './os'

export interface ExecutableInfo {
  available: boolean
  /** Çözümlenmiş mutlak yol (bulunduysa). */
  path?: string
  /** `--version` çıktısının ilk satırı (istenmişse ve alınabildiyse). */
  version?: string
}

function isExecutableFile(path: string): boolean {
  try {
    const st = statSync(path)
    if (!st.isFile()) return false
    if (isWindows) return true
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/** PATH'e ek olarak taranan, platforma özgü kurulum konumları. */
export function extraSearchDirs(): string[] {
  const home = homedir()
  const dirs: string[] = []
  if (isWindows) {
    const appData = process.env['APPDATA']
    const localAppData = process.env['LOCALAPPDATA']
    const programFiles = process.env['ProgramFiles']
    dirs.push(join(home, '.local', 'bin'))
    if (appData) dirs.push(join(appData, 'npm'))
    if (localAppData) {
      dirs.push(join(localAppData, 'Programs', 'OpenAI', 'Codex', 'bin'))
      dirs.push(join(localAppData, 'Microsoft', 'WindowsApps'))
      dirs.push(join(localAppData, 'Yarn', 'bin'))
    }
    if (programFiles) dirs.push(join(programFiles, 'nodejs'))
  } else {
    dirs.push(join(home, '.local', 'bin'))
    dirs.push(join(home, 'bin'))
    dirs.push(join(home, '.bun', 'bin'))
    dirs.push(join(home, '.volta', 'bin'))
    dirs.push(join(home, '.npm-global', 'bin'))
    dirs.push('/usr/local/bin')
    dirs.push('/usr/bin')
    if (isMacOS) {
      dirs.push('/opt/homebrew/bin') // Apple Silicon
      dirs.push('/usr/local/opt/node/bin')
    }
    if (isLinux) {
      dirs.push('/var/lib/flatpak/exports/bin')
      dirs.push(join(home, '.nix-profile', 'bin'))
      dirs.push('/snap/bin')
    }
  }
  return dirs
}

/** PATH + platforma özgü konumlarda `name` çalıştırılabilirini arar. */
export function findExecutable(name: string, env: NodeJS.ProcessEnv = process.env): string | null {
  if (!name) return null
  // Zaten mutlak/göreli yol verilmişse doğrudan doğrula
  if (name.includes('/') || name.includes('\\')) {
    return isExecutableFile(name) ? name : null
  }

  const pathValue =
    (isWindows
      ? Object.entries(env).find(([k]) => k.toLowerCase() === 'path')?.[1]
      : env['PATH']) ?? ''
  const dirs = [...pathValue.split(delimiter).filter(Boolean), ...extraSearchDirs()]

  const seen = new Set<string>()
  for (const dir of dirs) {
    const key = isWindows ? dir.toLowerCase() : dir
    if (seen.has(key)) continue
    seen.add(key)
    if (!existsSync(dir)) continue
    for (const ext of EXECUTABLE_EXTENSIONS) {
      const candidate = join(dir, name + ext)
      if (isExecutableFile(candidate)) return candidate
    }
  }
  return null
}

/** Keşif + isteğe bağlı sürüm sorgusu. Sürüm alınamazsa `available` yine true'dur. */
export function inspectExecutable(
  name: string,
  opts: { version?: boolean; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}
): Promise<ExecutableInfo> {
  const resolved = findExecutable(name, opts.env)
  if (!resolved) return Promise.resolve({ available: false })
  if (!opts.version) return Promise.resolve({ available: true, path: resolved })

  return new Promise((resolvePromise) => {
    // Kabuk YOK: argümanlar dizi olarak geçer, enjeksiyon mümkün değildir.
    execFile(
      resolved,
      ['--version'],
      { env: opts.env, timeout: opts.timeoutMs ?? 15_000, windowsHide: true },
      (err, stdout) => {
        const line = stdout?.toString().trim().split(/\r?\n/)[0]
        resolvePromise({
          available: true,
          path: resolved,
          version: err || !line ? undefined : line,
        })
      }
    )
  })
}
