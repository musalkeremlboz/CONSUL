/** CONSUL-MEMO Markdown yardımcıları.
 *
 *  Sözleşme: hafıza dosyaları KULLANICIYA AİTTİR. CONSUL yalnız kendi
 *  işaretlediği bölgeleri günceller:
 *
 *    <!-- consul:begin:repo -->
 *    …CONSUL tarafından üretilen içerik…
 *    <!-- consul:end:repo -->
 *
 *  İşaretlerin dışındaki her şey (kullanıcının elle yazdığı notlar) olduğu gibi
 *  korunur. İşaret bulunamazsa bölge dosyanın SONUNA eklenir — mevcut metin
 *  asla silinmez, asla üzerine yazılmaz.
 *
 *  Saf metin fonksiyonları: dosya sistemi bağımlılığı yoktur, test edilebilir. */

export const MANAGED_NOTE =
  '<!-- Bu bölge CONSUL tarafından güncellenir. İşaretlerin DIŞINA yazdıklarınız korunur. -->'

function beginMarker(id: string): string {
  return `<!-- consul:begin:${id} -->`
}

function endMarker(id: string): string {
  return `<!-- consul:end:${id} -->`
}

/** Belgedeki işaretli bölgeyi döndürür (yoksa null). */
export function readManagedRegion(document: string, id: string): string | null {
  const begin = document.indexOf(beginMarker(id))
  if (begin === -1) return null
  const contentStart = begin + beginMarker(id).length
  const end = document.indexOf(endMarker(id), contentStart)
  if (end === -1) return null
  return document.slice(contentStart, end).replace(/^\r?\n/, '').replace(/\r?\n$/, '')
}

/** İşaretli bölgeyi değiştirir; bölge yoksa belgenin sonuna ekler.
 *  Kullanıcının işaret dışındaki metni HER ZAMAN korunur. */
export function writeManagedRegion(document: string, id: string, content: string): string {
  const begin = beginMarker(id)
  const end = endMarker(id)
  const block = `${begin}\n${content.replace(/\s+$/, '')}\n${end}`

  const beginIdx = document.indexOf(begin)
  if (beginIdx !== -1) {
    const endIdx = document.indexOf(end, beginIdx + begin.length)
    if (endIdx !== -1) {
      return document.slice(0, beginIdx) + block + document.slice(endIdx + end.length)
    }
  }
  const base = document.replace(/\s+$/, '')
  return base ? `${base}\n\n${block}\n` : `${block}\n`
}

/** Bir Markdown başlığının (## …) gövdesini bulur. */
function findSection(document: string, heading: string): { start: number; end: number } | null {
  const lines = document.split('\n')
  const target = heading.trim().toLowerCase()
  let start = -1
  let level = 0
  for (let i = 0; i < lines.length; i++) {
    const match = /^(#{1,6})\s+(.*)$/.exec(lines[i])
    if (!match) continue
    if (start === -1) {
      if (match[2].trim().toLowerCase() === target) {
        start = i
        level = match[1].length
      }
      continue
    }
    // Aynı ya da daha üst seviyede bir başlık → bölüm biter
    if (match[1].length <= level) {
      return { start, end: i }
    }
  }
  if (start === -1) return null
  return { start, end: lines.length }
}

export interface ChangelogEntry {
  /** YYYY-MM-DD */
  date: string
  /** `### <başlık>` */
  title: string
  /** Madde işaretli satırlar. */
  bullets: string[]
  /** Değişen dosyalar (varsa ayrı alt bölüm). */
  files?: string[]
}

/** CHANGELOG.md'ye kayıt EKLER (append) — mevcut hiçbir satır silinmez.
 *
 *  - Aynı tarih için bölüm varsa yeni kayıt o bölümün sonuna eklenir.
 *  - Yoksa yeni tarih bölümü, en yeni en üstte olacak biçimde H1'den sonra açılır.
 *  - Dosya boşsa iskelet başlıkla birlikte kurulur. */
export function appendChangelog(document: string, entry: ChangelogEntry): string {
  const block: string[] = [`### ${entry.title.trim()}`, '']
  for (const bullet of entry.bullets) {
    const clean = bullet.trim()
    if (clean) block.push(`- ${clean}`)
  }
  if (entry.files && entry.files.length > 0) {
    block.push('', '**Değişen dosyalar**', '')
    for (const file of entry.files) {
      const clean = file.trim()
      if (clean) block.push(`- \`${clean}\``)
    }
  }
  block.push('')

  const base = document.trim()
    ? document.replace(/\s+$/, '')
    : '# Proje Değişiklik Günlüğü\n\nBu dosya CONSUL tarafından eklemeli (append-only) güncellenir.'

  const lines = base.split('\n')
  const dateHeading = `## ${entry.date}`
  const section = findSection(base, entry.date)

  if (section) {
    // Var olan tarih bölümünün sonuna ekle
    const before = lines.slice(0, section.end)
    const after = lines.slice(section.end)
    while (before.length > 0 && before[before.length - 1].trim() === '') before.pop()
    return [...before, '', ...block, ...after].join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n'
  }

  // Yeni tarih bölümü: H1 (ve varsa giriş paragrafı) hemen ardına, en yeni üstte
  let insertAt = lines.length
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      insertAt = i
      break
    }
    if (i === lines.length - 1) insertAt = lines.length
  }

  const head = lines.slice(0, insertAt)
  const tail = lines.slice(insertAt)
  while (head.length > 0 && head[head.length - 1].trim() === '') head.pop()

  return [...head, '', dateHeading, '', ...block, ...tail]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+$/, '') + '\n'
}

/** Yerel takvime göre YYYY-MM-DD (UTC kaymasız). */
export function localDateStamp(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
