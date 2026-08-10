/** Claude Code keşfi ve güvenli başlatma (talimat §26–§27).
 *
 *  Kurallar:
 *   - Claude Code'un kurulu olduğu VARSAYILMAZ; önce çalıştırılabilir keşfi yapılır.
 *   - Başlatma argüman DİZİSİ ile yapılır; kabuk komut satırı kurulmaz.
 *   - İzinleri atlayan bayraklar (`--dangerously-skip-permissions` ve benzeri)
 *     ASLA eklenmez — Claude Code kendi izin mekanizmasıyla çalışır.
 *   - Bulunamazsa uygulama çökmez, sahte bir terminal gösterilmez; kullanıcıya
 *     terminalde ne yapması gerektiği anlatılır.
 *   - Kullanıcının haberi olmadan kurulum YAPILMAZ. */
import { extname } from 'node:path'
import { findExecutable } from '../platform/executables'
import { isWindows } from '../platform/os'
import { buildPtyEnv } from '../terminal/env'
import type { PtyLaunchSpec } from '../terminal/ptyManager'

export interface ClaudeLocation {
  found: boolean
  path?: string
}

export function findClaude(): ClaudeLocation {
  // PATHEXT sırası sayesinde Windows'ta .exe, .cmd shim'inden önce gelir
  const path = findExecutable('claude')
  return path ? { found: true, path } : { found: false }
}

/** Claude Code'u çalıştıracak PTY tarifi. */
export function claudeLaunchSpec(opts: {
  executable: string
  cwd: string
  cols: number
  rows: number
}): PtyLaunchSpec {
  const ext = extname(opts.executable).toLowerCase()
  const env = buildPtyEnv()

  // Windows'ta npm shim'leri .cmd/.bat'tır ve doğrudan CreateProcess ile
  // çalıştırılamaz; yorumlayıcı ComSpec üzerinden çağrılır. Yol AYRI bir argv
  // elemanıdır — komut satırı string'i elle kurulmaz.
  if (isWindows && (ext === '.cmd' || ext === '.bat')) {
    return {
      file: process.env['ComSpec'] ?? 'cmd.exe',
      args: ['/c', opts.executable],
      cwd: opts.cwd,
      cols: opts.cols,
      rows: opts.rows,
      env,
    }
  }

  return {
    file: opts.executable,
    // İzin bayrağı YOK: Claude Code normal izin sistemiyle açılır
    args: [],
    cwd: opts.cwd,
    cols: opts.cols,
    rows: opts.rows,
    env,
  }
}

/** Claude Code bulunamadığında terminalde gösterilecek Türkçe yönerge. */
export function claudeMissingMessage(): string {
  const install =
    'npm install -g @anthropic-ai/claude-code' +
    (isWindows ? '' : '\r\n  veya:  curl -fsSL https://claude.ai/install.sh | bash')
  return [
    '',
    '  \x1b[1;31mClaude Code bulunamadı.\x1b[0m',
    '',
    '  CONSUL Developer, CONSUL kaynak kodu üzerinde Claude Code çalıştırmak için tasarlandı,',
    '  ancak sisteminizde `claude` çalıştırılabilir dosyası bulunamadı.',
    '',
    '  \x1b[1mKurulum:\x1b[0m',
    `    ${install}`,
    '',
    '  Zaten kuruluysa PATH ortam değişkenine eklendiğinden emin olun,',
    '  ardından CONSUL Developer\'ı yeniden başlatın.',
    '',
    '  \x1b[2mCONSUL sizin adınıza otomatik kurulum yapmaz.\x1b[0m',
    '',
  ].join('\r\n')
}
