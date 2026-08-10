/** Kabuk keşfi — sistemde gerçekten kurulu olan kabukları bulur.
 *
 *  CONSUL sahte bir kabuk taklit etmez: burada bulunan her kayıt gerçek bir
 *  çalıştırılabilir dosyaya işaret eder ve PTY'ye argüman DİZİSİ olarak verilir
 *  (kabuk komut satırı string'i kurulmaz → enjeksiyon yüzeyi yoktur).
 *
 *  Windows'ta konsol kod sayfası çoğu kurulumda UTF-8 değildir (bu makinede
 *  CP1254). PowerShell 5.1 ve cmd.exe için SABİT bir UTF-8 önsözü geçilir;
 *  önsöz derleme zamanı sabitidir, hiçbir kullanıcı girdisi içine gömülmez. */
import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { isLinux, isMacOS, isWindows } from './os'
import { findExecutable } from './executables'

export type ShellKind = 'powershell' | 'cmd' | 'posix' | 'wsl'

export interface ShellDescriptor {
  /** Ayarlarda saklanan kalıcı kimlik. */
  id: string
  /** Arayüzde gösterilen ad. */
  label: string
  /** Çalıştırılabilir dosyanın mutlak yolu (WSL'de wsl.exe). */
  file: string
  /** Argüman dizisi — asla tek bir komut string'i değildir. */
  args: string[]
  kind: ShellKind
}

/** Windows PowerShell 5.1 için sabit UTF-8 önsözü (interpolasyon YOK). */
const PS5_UTF8_PRELUDE =
  '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; $OutputEncoding=[System.Text.Encoding]::UTF8'

function gitBashCandidates(): string[] {
  const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files'
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  const localAppData = process.env['LOCALAPPDATA'] ?? ''
  const out = [join(programFiles, 'Git', 'bin', 'bash.exe'), join(programFilesX86, 'Git', 'bin', 'bash.exe')]
  if (localAppData) out.push(join(localAppData, 'Programs', 'Git', 'bin', 'bash.exe'))
  return out
}

/** Git Bash yolu — Claude Code'un Bash aracı da bu değere ihtiyaç duyar. */
export function findGitBash(): string | null {
  for (const candidate of gitBashCandidates()) {
    if (existsSync(candidate)) return candidate
  }
  return findExecutable('bash')
}

function windowsShells(): ShellDescriptor[] {
  const list: ShellDescriptor[] = []

  const pwsh = findExecutable('pwsh')
  if (pwsh) {
    // PowerShell 7+ zaten UTF-8 konuşur — önsöze gerek yok
    list.push({ id: 'pwsh', label: 'PowerShell 7+', file: pwsh, args: ['-NoLogo'], kind: 'powershell' })
  }

  const powershell =
    findExecutable('powershell') ??
    join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  if (existsSync(powershell)) {
    list.push({
      id: 'windows-powershell',
      label: 'Windows PowerShell',
      file: powershell,
      args: ['-NoLogo', '-NoExit', '-Command', PS5_UTF8_PRELUDE],
      kind: 'powershell',
    })
  }

  const cmd = process.env['ComSpec'] ?? findExecutable('cmd')
  if (cmd && existsSync(cmd)) {
    list.push({
      id: 'cmd',
      label: 'Komut İstemi',
      file: cmd,
      args: ['/K', 'chcp 65001>nul'],
      kind: 'cmd',
    })
  }

  const gitBash = findGitBash()
  if (gitBash) {
    list.push({ id: 'git-bash', label: 'Git Bash', file: gitBash, args: ['-i', '-l'], kind: 'posix' })
  }

  return list
}

/** /etc/shells + bilinen konumlardan POSIX kabukları. */
function posixShells(): ShellDescriptor[] {
  const labels: Record<string, string> = {
    zsh: 'Zsh',
    bash: 'Bash',
    fish: 'Fish',
    sh: 'Bourne Shell',
    dash: 'Dash',
    ksh: 'Korn Shell',
    tcsh: 'Tcsh',
    nu: 'Nushell',
  }

  const candidates = new Set<string>()
  try {
    const content = readFileSync('/etc/shells', 'utf8')
    for (const raw of content.split('\n')) {
      const line = raw.trim()
      if (line && !line.startsWith('#')) candidates.add(line)
    }
  } catch {
    // /etc/shells okunamadı — bilinen adlarla devam
  }
  for (const name of Object.keys(labels)) {
    const found = findExecutable(name)
    if (found) candidates.add(found)
  }

  const list: ShellDescriptor[] = []
  const seenNames = new Set<string>()
  for (const file of candidates) {
    if (!existsSync(file)) continue
    const name = basename(file)
    if (seenNames.has(name)) continue
    seenNames.add(name)
    list.push({
      id: name,
      label: labels[name] ?? name,
      file,
      // -l: giriş kabuğu — kullanıcının profil dosyaları (PATH dahil) yüklenir
      args: name === 'fish' || name === 'nu' ? ['-l'] : ['-i', '-l'],
      kind: 'posix',
    })
  }

  // Kullanıcının sistemdeki varsayılan kabuğu listenin başına gelsin
  const userShell = process.env['SHELL']
  if (userShell) {
    const idx = list.findIndex((s) => s.file === userShell)
    if (idx > 0) list.unshift(...list.splice(idx, 1))
  }
  return list
}

/** WSL dağıtımları (yalnız Windows). `wsl.exe -l -q` UTF-16LE yazar. */
function wslShells(): Promise<ShellDescriptor[]> {
  if (!isWindows) return Promise.resolve([])
  const wsl = findExecutable('wsl')
  if (!wsl) return Promise.resolve([])

  return new Promise((resolve) => {
    execFile(
      wsl,
      ['-l', '-q'],
      { encoding: 'buffer', timeout: 8000, windowsHide: true },
      (err, stdout) => {
        if (err || !stdout) {
          resolve([])
          return
        }
        const text = Buffer.from(stdout).toString('utf16le').replace(/\0/g, '')
        const distros = text
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && s.length < 128)
        resolve(
          distros.map((distro) => ({
            id: `wsl:${distro}`,
            label: `WSL · ${distro}`,
            file: wsl,
            // Dağıtım adı AYRI bir argv elemanıdır; komut satırına gömülmez.
            args: ['-d', distro],
            kind: 'wsl' as const,
          }))
        )
      }
    )
  })
}

let cache: ShellDescriptor[] | null = null

/** Sistemdeki kabukları keşfeder (süreç ömrü boyunca önbelleklenir). */
export async function discoverShells(): Promise<ShellDescriptor[]> {
  if (cache) return cache
  const base = isWindows ? windowsShells() : posixShells()
  const wsl = await wslShells()
  cache = [...base, ...wsl]
  if (cache.length === 0) {
    // Hiçbir kabuk bulunamadı — son çare, çekirdeğin varsayılanı
    const fallback = isWindows
      ? { id: 'cmd', label: 'Komut İstemi', file: 'cmd.exe', args: [], kind: 'cmd' as const }
      : { id: 'sh', label: 'Bourne Shell', file: '/bin/sh', args: ['-i'], kind: 'posix' as const }
    cache = [fallback]
  }
  return cache
}

/** Ayarlarda kayıtlı kimlik bulunamazsa platformun makul varsayılanına düşer. */
export async function resolveShell(id?: string | null): Promise<ShellDescriptor> {
  const shells = await discoverShells()
  if (id) {
    const found = shells.find((s) => s.id === id)
    if (found) return found
  }
  return shells[0]
}

/** Platformun tercih ettiği varsayılan kabuk kimliği. */
export async function defaultShellId(): Promise<string> {
  const shells = await discoverShells()
  const preferred = isWindows
    ? ['pwsh', 'windows-powershell', 'cmd']
    : isMacOS
      ? ['zsh', 'bash']
      : isLinux
        ? ['bash', 'zsh', 'fish']
        : []
  for (const id of preferred) {
    if (shells.some((s) => s.id === id)) return id
  }
  return shells[0].id
}

/** Test edilebilirlik: keşif önbelleğini sıfırlar. */
export function resetShellCache(): void {
  cache = null
}
