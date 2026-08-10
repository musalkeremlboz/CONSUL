/** Yol yardımcıları — **Electron'dan bağımsız** saf fonksiyonlar.
 *
 *  `paths.ts` Electron'un `app` API'sine ihtiyaç duyar; buradaki fonksiyonlar
 *  duymaz. Böylece ad temizleme ve yol hapsi mantığı doğrudan birim testinden
 *  geçirilebilir (güvenlik açısından kritik oldukları için test edilmeleri
 *  şarttır — bkz. tests/paths.test.ts). */
import { isAbsolute, join, normalize, relative, resolve, sep } from 'node:path'

/** Dosya sistemi için güvenli tek segment üretir.
 *
 *  Temizlenenler: yol ayraçları, kontrol karakterleri (`\p{Cc}`), Windows'ta
 *  yasak karakterler, sondaki nokta/boşluk (Windows bunları sessizce siler) ve
 *  ayrılmış aygıt adları. Sonuç ASLA `.`/`..` olmaz ve ASLA ayraç içermez. */
export function sanitizeSegment(name: string, fallback = 'proje'): string {
  let out = String(name ?? '')
    .normalize('NFC')
    .replace(/\p{Cc}/gu, '')
    .replace(/[\\/]/g, '-')
    .replace(/[<>:"|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    // Baştaki noktalar POSIX'te GİZLİ klasör üretir; hafıza klasörü listelemesi
    // nokta ile başlayanları atladığı için böyle bir ad "kayıp hafıza" demektir.
    .replace(/^\.+/, '')
    .trim()
  if (!out || out === '.' || out === '..') out = fallback
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(out)) out = `${out}-proje`
  return out.slice(0, 96)
}

/** `child` gerçekten `root` altında mı? Path traversal ve sürücü değişimi engeli.
 *  Sembolik bağlantılar çağıran tarafından `realpath` ile çözülmelidir. */
export function isInside(root: string, child: string): boolean {
  const r = resolve(root)
  const c = resolve(child)
  if (r === c) return true
  const rel = relative(r, c)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return false
  return !rel.split(sep).includes('..')
}

/** `root` altında güvenli birleştirme; dışarı taşan yol Error fırlatır. */
export function joinInside(root: string, ...segments: string[]): string {
  const candidate = normalize(join(root, ...segments))
  if (!isInside(root, candidate)) {
    throw new Error(`Güvenlik: hedef yol kök dizinin dışına çıkıyor (${root})`)
  }
  return candidate
}
