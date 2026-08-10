/** Uygulama modu — tek paket, iki bağımsız uygulama.
 *
 *  CONSUL ve CONSUL Developer ayrı süreçlerdir ve birbirinin çökmesinden
 *  etkilenmez. Hangi modda açıldığı yalnız burada belirlenir:
 *   - `--developer` argümanı (kurulumun oluşturduğu kısayol bunu geçer), ya da
 *   - çalıştırılabilir dosyanın adında "developer" geçmesi (ayrı ikili
 *     dağıtılırsa), ya da
 *   - `CONSUL_MODE=developer` ortam değişkeni (geliştirme kolaylığı).
 *
 *  Modlar ayrı `userData` dizini kullanır: ayarlar, pencere durumu ve
 *  tek-örnek kilidi birbirine karışmaz. */
import { basename } from 'node:path'

export type AppMode = 'consul' | 'developer'

export const DEVELOPER_FLAG = '--developer'

export function detectMode(argv: string[] = process.argv, execPath: string = process.execPath): AppMode {
  if (argv.includes(DEVELOPER_FLAG)) return 'developer'
  if (process.env['CONSUL_MODE'] === 'developer') return 'developer'
  if (/developer/i.test(basename(execPath))) return 'developer'
  return 'consul'
}

/** Mod başına tek-örnek kilidi ve veri dizini ayrımı için ek. */
export function userDataSuffix(mode: AppMode): string {
  return mode === 'developer' ? 'CONSUL Developer' : 'CONSUL'
}
