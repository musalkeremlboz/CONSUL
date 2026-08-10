#!/usr/bin/env node
/**
 * Council `.council/memory.json` → CONSUL-MEMO göçü.
 *
 * CONSUL, Council ekosisteminden bağımsız bir uygulamaya dönüşürken eski
 * HERMES/MERCURIUS proje hafızası (`<proje>/.council/`) kaldırıldı. Bu betik,
 * o hafızayı SİLMEDEN okur ve yeni biçimde `<Belgeler>/CONSUL-MEMO/<repo>/`
 * altına yazar.
 *
 * Güvence: hiçbir kaynak dosya silinmez veya değiştirilmez; hedefte var olan
 * dosyalar EZİLMEZ (yalnız eksik olanlar oluşturulur, CHANGELOG'a eklenir).
 *
 * Kullanım:
 *   node scripts/migrate-council-memory.mjs <proje-yolu> [<proje-yolu> …]
 *   node scripts/migrate-council-memory.mjs --dry-run <proje-yolu>
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { homedir, platform } from 'node:os'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const projects = args.filter((a) => !a.startsWith('--'))

if (projects.length === 0) {
  console.error('Kullanım: node scripts/migrate-council-memory.mjs [--dry-run] <proje-yolu> …')
  process.exit(1)
}

/** Belgeler dizini — sabit "Documents" adı VARSAYILMAZ. */
function documentsDir() {
  try {
    if (platform() === 'win32') {
      const out = execFileSync(
        'reg',
        ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Shell Folders', '/v', 'Personal'],
        { encoding: 'utf8', windowsHide: true }
      )
      const match = /Personal\s+REG_\w+\s+(.+)/.exec(out)
      if (match) return match[1].trim()
    } else if (platform() === 'linux') {
      const out = execFileSync('xdg-user-dir', ['DOCUMENTS'], { encoding: 'utf8' }).trim()
      if (out) return out
    }
  } catch {
    // Kayıt defteri/xdg yoksa yedeğe düş
  }
  return join(homedir(), 'Documents')
}

function gitRemote(project) {
  try {
    return execFileSync('git', ['-C', project, 'remote', 'get-url', 'origin'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

function sanitize(name) {
  const out = String(name)
    .replace(/[\\/]/g, '-')
    .replace(/[<>:"|?*]/g, '-')
    .replace(/[. ]+$/g, '')
    .trim()
  return out || 'proje'
}

function memoName(project) {
  const remote = gitRemote(project)
  if (remote) {
    const last = remote.replace(/\.git$/i, '').split(/[/\\:]/).filter(Boolean).pop()
    if (last) return sanitize(last)
  }
  return sanitize(basename(project.replace(/[/\\]+$/, '')))
}

/** ISO zaman damgasından YYYY-MM-DD. */
function dateOf(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '1970-01-01'
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}

function writeIfMissing(path, content) {
  if (existsSync(path)) {
    console.log(`  · atlandı (zaten var): ${basename(path)}`)
    return false
  }
  if (!dryRun) writeFileSync(path, content, 'utf8')
  console.log(`  ✓ yazıldı: ${basename(path)}`)
  return true
}

let migrated = 0

for (const raw of projects) {
  const project = resolve(raw)
  const memoryFile = join(project, '.council', 'memory.json')
  console.log(`\n▸ ${project}`)

  if (!existsSync(memoryFile)) {
    console.log('  · .council/memory.json bulunamadı — atlanıyor')
    continue
  }

  let memory
  try {
    const parsed = JSON.parse(readFileSync(memoryFile, 'utf8'))
    // Council deposu {schemaVersion, data} zarfı kullanabilir
    memory = parsed && typeof parsed === 'object' && 'data' in parsed ? parsed.data : parsed
  } catch (err) {
    console.error(`  ✗ okunamadı: ${err.message}`)
    continue
  }

  const name = memoName(project)
  const target = join(documentsDir(), 'CONSUL-MEMO', name)
  console.log(`  hedef: ${target}`)
  if (!dryRun) mkdirSync(target, { recursive: true })

  const changelog = Array.isArray(memory?.changelog) ? memory.changelog : []
  const notes = Array.isArray(memory?.notes) ? memory.notes : []
  const ledger = Array.isArray(memory?.ledger) ? memory.ledger : []

  // ── CHANGELOG.md ──
  const byDate = new Map()
  for (const entry of changelog) {
    const date = dateOf(entry?.at)
    const text = String(entry?.summary ?? '').trim()
    if (!text) continue
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date).push(text)
  }
  const dates = [...byDate.keys()].sort().reverse()
  const changelogBody = [
    `# ${name} — Değişiklik Günlüğü`,
    '',
    'Bu dosya CONSUL tarafından **eklemeli** (append-only) güncellenir.',
    '',
    '> Aşağıdaki kayıtlar Council `.council/memory.json` hafızasından taşınmıştır.',
    '',
    ...dates.flatMap((date) => [
      `## ${date}`,
      '',
      '### Council hafızasından taşınan kayıtlar',
      '',
      ...byDate.get(date).map((line) => `- ${line}`),
      '',
    ]),
  ].join('\n')
  writeIfMissing(join(target, 'CHANGELOG.md'), changelogBody)

  // ── PURPOSE.md (notlar buraya taşınır) ──
  const purposeBody = [
    `# ${name} — Amaç`,
    '',
    '<!-- Bu bölge CONSUL tarafından güncellenir. İşaretlerin DIŞINA yazdıklarınız korunur. -->',
    '',
    '## Projenin amacı',
    '',
    '_(Bu bölümü siz doldurun.)_',
    '',
    '## Çözmeye çalıştığı problem',
    '',
    '_(Hangi ihtiyaçtan doğdu?)_',
    '',
    '## Ana kullanım senaryosu',
    '',
    '_(Tipik kullanım nasıl işliyor?)_',
    '',
    '## Kapsam',
    '',
    '_(Neler dahil, neler dışında?)_',
    '',
    '## Temel teknolojiler',
    '',
    '<!-- consul:begin:tech -->',
    '<!-- consul:end:tech -->',
    '',
    '## Repository bilgisi',
    '',
    '<!-- consul:begin:repo -->',
    '<!-- consul:end:repo -->',
    '',
    ...(notes.length > 0
      ? [
          '## Council hafızasından taşınan kalıcı notlar',
          '',
          ...notes
            .map((note) => String(note?.text ?? '').trim())
            .filter(Boolean)
            .map((text) => `- ${text}`),
          '',
        ]
      : []),
  ].join('\n')
  writeIfMissing(join(target, 'PURPOSE.md'), purposeBody)

  // ── İskelet belgeler ──
  writeIfMissing(
    join(target, 'README.md'),
    [
      `# ${name} — CONSUL Proje Hafızası`,
      '',
      'Bu klasör CONSUL tarafından tutulan proje hafızasıdır.',
      '',
      '- [PURPOSE.md](PURPOSE.md)',
      '- [CHANGELOG.md](CHANGELOG.md)',
      '- [ARCHITECTURE.md](ARCHITECTURE.md)',
      '- [ELEMENTS.md](ELEMENTS.md)',
      '',
      '<!-- consul:begin:repo -->',
      '<!-- consul:end:repo -->',
      '',
    ].join('\n')
  )
  writeIfMissing(
    join(target, 'ARCHITECTURE.md'),
    [
      `# ${name} — Mimari`,
      '',
      '## Genel bakış',
      '',
      '_(Sistem nasıl çalışıyor?)_',
      '',
      '## Klasör yapısı',
      '',
      '<!-- consul:begin:structure -->',
      '<!-- consul:end:structure -->',
      '',
      '## Bileşen diyagramı',
      '',
      '<!-- consul:begin:diagram -->',
      '<!-- consul:end:diagram -->',
      '',
    ].join('\n')
  )
  writeIfMissing(
    join(target, 'ELEMENTS.md'),
    [
      `# ${name} — Elementler`,
      '',
      '<!-- consul:begin:structure -->',
      '<!-- consul:end:structure -->',
      '',
      '## Elementler',
      '',
      '_(Her element için görev, girdi, çıktı, bağımlılıklar.)_',
      '',
    ].join('\n')
  )

  // ── Ham defter (geriye dönük referans) ──
  if (ledger.length > 0) {
    const ledgerBody = [
      `# ${name} — Council olay defteri (arşiv)`,
      '',
      'Council `.council/ledger` kayıtlarının salt-okunur arşivi.',
      '',
      ...ledger.slice(-500).map((e) => `- \`${e?.at ?? ''}\` **${e?.type ?? '?'}** ${String(e?.summary ?? e?.text ?? '')}`),
      '',
    ].join('\n')
    writeIfMissing(join(target, 'COUNCIL-LEDGER.md'), ledgerBody)
  }

  migrated++
  console.log(
    `  → ${changelog.length} değişiklik kaydı, ${notes.length} not, ${ledger.length} olay taşındı${dryRun ? ' (deneme)' : ''}`
  )
}

console.log(`\n${migrated} proje işlendi.${dryRun ? ' (--dry-run: hiçbir dosya yazılmadı)' : ''}`)
console.log('Kaynak .council klasörleri DEĞİŞTİRİLMEDİ.')
