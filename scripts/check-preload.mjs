#!/usr/bin/env node
/**
 * Preload bütünlük denetimi — derlemeden SONRA çalışır.
 *
 * Sandbox'lı preload betikleri kendi kendine yeten tek dosya olmalıdır.
 * Rollup, iki preload girişi ortak bir modülü içe aktardığında paylaşılan bir
 * "chunk" üretir; Electron bunu yükleyemez ve preload sessizce çöker:
 *
 *   Unable to load preload script: …\out\preload\developer.js
 *   Error: module not found: ./chunks/ipc-XXXX.js
 *
 * Sonuç: pencere açılır ama arayüz boştur. Bu, gözle fark edilmesi zor ve
 * testlerin yakalayamadığı bir hata sınıfıdır — bu yüzden derleme çıktısı
 * doğrudan denetlenir.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const preloadDir = join(process.cwd(), 'out', 'preload')

if (!existsSync(preloadDir)) {
  console.error('[check-preload] out/preload bulunamadı — önce `npm run build` çalıştırın.')
  process.exit(1)
}

const entries = readdirSync(preloadDir, { withFileTypes: true })
const scripts = entries.filter((e) => e.isFile() && e.name.endsWith('.js')).map((e) => e.name)
const directories = entries.filter((e) => e.isDirectory()).map((e) => e.name)

let failed = false

if (scripts.length === 0) {
  console.error('[check-preload] HATA: hiç preload betiği üretilmemiş.')
  failed = true
}

if (directories.length > 0) {
  console.error(
    `[check-preload] HATA: out/preload altında alt dizin var (${directories.join(', ')}). ` +
      'Bu, paylaşılan chunk üretildiği anlamına gelir — preload sandbox’ta yüklenemez.'
  )
  failed = true
}

for (const name of scripts) {
  const content = readFileSync(join(preloadDir, name), 'utf8')
  const relativeRequire = /require\(\s*["']\.[^"']*["']\s*\)/.exec(content)
  if (relativeRequire) {
    console.error(
      `[check-preload] HATA: ${name} göreli bir modül yüklüyor → ${relativeRequire[0]}\n` +
        '  Sandbox’lı preload kendi kendine yetmelidir. İki preload’ın ortak bir modülü ' +
        'içe aktarmadığından emin olun (bkz. src/shared/devIpc.ts başlığı).'
    )
    failed = true
    continue
  }
  console.log(`[check-preload] ${name}: kendi kendine yeten (${(content.length / 1024).toFixed(1)} kB)`)
}

if (failed) process.exit(1)
console.log('[check-preload] BAŞARILI: tüm preload betikleri sandbox uyumlu.')
