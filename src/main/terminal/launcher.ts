/** Kabuk kimliği + çalışma dizini → PTY başlatma tarifi.
 *
 *  Burada ASLA komut satırı string'i kurulmaz: çalıştırılabilir dosya ve
 *  argümanlar ayrı ayrı PTY'ye verilir. Kullanıcıdan gelen tek serbest değer
 *  çalışma dizinidir ve o da gerçek bir klasör olarak doğrulanır. */
import { realpathSync, statSync } from 'node:fs'
import { resolveShell } from '../platform/shells'
import { buildPtyEnv } from './env'
import { PtyError, type PtyLaunchSpec } from './ptyManager'

export interface LaunchOptions {
  shellId?: string | null
  cwd: string
  cols: number
  rows: number
}

/** Çalışma dizinini doğrular ve sembolik bağlantıları çözer. */
export function resolveWorkingDirectory(cwd: string): string {
  const raw = String(cwd ?? '').trim()
  if (!raw) throw new PtyError('cwd-invalid', 'Çalışma dizini boş olamaz.')
  let resolved: string
  try {
    // Sembolik bağlantı zinciri çözülür; hedef gerçekte nereye bakıyorsa o kullanılır
    resolved = realpathSync(raw)
  } catch {
    throw new PtyError('cwd-invalid', `Çalışma dizini bulunamadı: ${raw}`)
  }
  try {
    if (!statSync(resolved).isDirectory()) {
      throw new PtyError('cwd-invalid', `Çalışma dizini bir klasör değil: ${raw}`)
    }
  } catch (err) {
    if (err instanceof PtyError) throw err
    throw new PtyError('cwd-invalid', `Çalışma dizini okunamadı: ${raw}`)
  }
  return resolved
}

export async function buildLaunchSpec(opts: LaunchOptions): Promise<PtyLaunchSpec> {
  const shell = await resolveShell(opts.shellId)
  const cwd = resolveWorkingDirectory(opts.cwd)
  return {
    file: shell.file,
    args: [...shell.args],
    cwd,
    cols: opts.cols,
    rows: opts.rows,
    env: buildPtyEnv(),
  }
}
