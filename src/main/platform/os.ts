/** Merkezî platform tespiti.
 *
 *  Kural: kod tabanının hiçbir yerinde dağınık `process.platform === 'win32'`
 *  kontrolü YAPILMAZ; platforma bağlı her davranış bu klasördeki servislerden
 *  geçer. Böylece yeni bir platform eklemek tek bir yerde değişiklik demektir. */

export type PlatformId = 'windows' | 'macos' | 'linux'

function detect(): PlatformId {
  switch (process.platform) {
    case 'win32':
      return 'windows'
    case 'darwin':
      return 'macos'
    default:
      return 'linux'
  }
}

export const PLATFORM: PlatformId = detect()

export const isWindows = PLATFORM === 'windows'
export const isMacOS = PLATFORM === 'macos'
export const isLinux = PLATFORM === 'linux'

/** PATH ortam değişkeninin ayracı (Windows `;`, POSIX `:`). */
export const PATH_SEPARATOR = isWindows ? ';' : ':'

/** Çalıştırılabilir dosya uzantıları — POSIX'te uzantı yoktur. */
export const EXECUTABLE_EXTENSIONS: string[] = isWindows
  ? ((process.env['PATHEXT'] ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean))
  : ['']

/** Ortam değişkeni adları Windows'ta harf duyarsızdır. */
export function envKey(env: Record<string, string>, name: string): string {
  if (!isWindows) return name
  return Object.keys(env).find((k) => k.toLowerCase() === name.toLowerCase()) ?? name
}

/** Klavye kısayollarında gösterilecek değiştirici tuş adı. */
export const PRIMARY_MODIFIER: 'Ctrl' | 'Cmd' = isMacOS ? 'Cmd' : 'Ctrl'
