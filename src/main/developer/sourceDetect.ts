/** CONSUL kaynak ağacı tespiti — Electron'suz, test edilebilir.
 *
 *  CONSUL Developer'ın yanlış bir klasörde açılmaması için tek doğrulama
 *  noktasıdır: klasörün gerçekten CONSUL kaynağı olduğu `package.json` adı ve
 *  `src/main` varlığıyla kanıtlanır. */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function looksLikeConsulSource(path: string): boolean {
  try {
    const pkgPath = join(path, 'package.json')
    if (!existsSync(pkgPath)) return false
    if (!existsSync(join(path, 'src', 'main'))) return false
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string; productName?: string }
    const name = String(pkg.name ?? '').toLowerCase()
    const product = String(pkg.productName ?? '').toLowerCase()
    return name === 'consul' || product === 'consul'
  } catch {
    return false
  }
}
