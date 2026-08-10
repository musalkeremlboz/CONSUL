/** CONSUL-MEMO belge yöneticileri.
 *
 *  Beş belge (talimat §11):
 *    README.md        — klasörün ne olduğu + diğer belgelere bağlantılar
 *    PURPOSE.md       — projenin amacı, problemi, kapsamı, teknolojileri
 *    CHANGELOG.md     — anlamlı değişikliklerin tarihsel kaydı (append-only)
 *    ARCHITECTURE.md  — çalışma mimarisi (Mermaid diyagramlı)
 *    ELEMENTS.md      — önemli modüller: görev, girdi, çıktı, bağımlılıklar
 *
 *  Güncelleme ilkesi (talimat §12): **incremental**. Dosya yoksa şablonla
 *  oluşturulur; VARSA yalnız `<!-- consul:begin:… -->` işaretli bölgeler
 *  tazelenir. Kullanıcının elle yazdığı her şey korunur. */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { writeFileAtomicText } from './fsText'
import { MANAGED_NOTE, readManagedRegion, writeManagedRegion } from './markdown'
import type { ProjectFacts } from './projectFacts'
import type { GitInfo } from '../../shared/types'

export const MEMO_FILES = ['README.md', 'PURPOSE.md', 'CHANGELOG.md', 'ARCHITECTURE.md', 'ELEMENTS.md'] as const
export type MemoFileName = (typeof MEMO_FILES)[number]

export interface DocumentContext {
  projectName: string
  projectPath: string
  git: GitInfo
  facts: ProjectFacts
}

function bullet(label: string, value: string | undefined | null): string {
  return `- **${label}:** ${value && String(value).trim() ? value : '_(belirlenmedi)_'}`
}

function list(values: string[], empty = '_(tespit edilmedi)_'): string {
  return values.length > 0 ? values.map((v) => `- ${v}`).join('\n') : empty
}

/* ── Üretilen bölgeler ─────────────────────────────────────────── */

function repoRegion(ctx: DocumentContext): string {
  const git = ctx.git
  const lines = [
    bullet('Proje adı', ctx.facts.declaredName ?? ctx.projectName),
    bullet('Proje yolu', `\`${ctx.projectPath}\``),
    bullet('Git repository', git.isRepository ? 'evet' : 'hayır'),
  ]
  if (git.isRepository) {
    lines.push(
      bullet('Repository adı', git.repositoryName ?? git.shortName),
      bullet('Sağlayıcı', git.provider === 'none' ? 'yerel' : git.provider),
      bullet('Remote URL', git.remoteUrl ? `\`${git.remoteUrl}\`` : undefined),
      bullet('Varsayılan dal', git.defaultBranch),
      bullet('Repository kökü', git.root ? `\`${git.root}\`` : undefined)
    )
  }
  if (ctx.facts.version) lines.push(bullet('Sürüm', ctx.facts.version))
  return lines.join('\n')
}

function techRegion(ctx: DocumentContext): string {
  const f = ctx.facts
  const parts = [
    '**Diller / çalışma zamanları**',
    '',
    list(f.languages),
    '',
    '**Çatılar ve araçlar**',
    '',
    list(f.frameworks),
  ]
  if (f.packageManager) parts.push('', bullet('Paket yöneticisi', f.packageManager))
  if (f.scripts.length > 0) {
    parts.push('', '**Tanımlı komutlar**', '', f.scripts.map((s) => `- \`${s}\``).join('\n'))
  }
  return parts.join('\n')
}

function structureRegion(ctx: DocumentContext): string {
  const dirs = ctx.facts.topLevelDirs
  const parts = ['**Üst düzey klasörler**', '', list(dirs, '_(alt klasör bulunamadı)_')]
  if (ctx.facts.notableFiles.length > 0) {
    parts.push('', '**Önemli kök dosyalar**', '', ctx.facts.notableFiles.map((f) => `- \`${f}\``).join('\n'))
  }
  return parts.join('\n')
}

function diagramRegion(ctx: DocumentContext): string {
  const dirs = ctx.facts.topLevelDirs.slice(0, 8)
  const nodes = dirs.map((d, i) => `    D${i}["${d}"]`).join('\n')
  const edges = dirs.map((_, i) => `    ROOT --> D${i}`).join('\n')
  const root = ctx.facts.declaredName ?? ctx.projectName
  if (dirs.length === 0) {
    return ['```mermaid', 'flowchart TD', `    ROOT["${root}"]`, '```'].join('\n')
  }
  return ['```mermaid', 'flowchart TD', `    ROOT["${root}"]`, nodes, edges, '```'].join('\n')
}

/* ── Şablonlar (yalnız dosya YOKKEN kullanılır) ────────────────── */

function readmeTemplate(ctx: DocumentContext): string {
  return `# ${ctx.projectName} — CONSUL Proje Hafızası

Bu klasör **CONSUL** tarafından oluşturulan proje hafızasıdır. İçerik düz
Markdown'dır: istediğiniz editörle okuyabilir, düzenleyebilir, sürüm kontrolüne
alabilirsiniz.

${MANAGED_NOTE}

## Belgeler

- [PURPOSE.md](PURPOSE.md) — proje neden var, hangi problemi çözüyor
- [CHANGELOG.md](CHANGELOG.md) — anlamlı değişikliklerin tarihsel kaydı
- [ARCHITECTURE.md](ARCHITECTURE.md) — projenin çalışma mimarisi
- [ELEMENTS.md](ELEMENTS.md) — önemli modüller ve sorumlulukları

## Proje

<!-- consul:begin:repo -->
<!-- consul:end:repo -->
`
}

function purposeTemplate(ctx: DocumentContext): string {
  return `# ${ctx.projectName} — Amaç

${MANAGED_NOTE}

## Projenin amacı

_(Bu bölümü siz doldurun: proje ne yapıyor?)_

## Çözmeye çalıştığı problem

_(Hangi ihtiyaçtan doğdu?)_

## Ana kullanım senaryosu

_(Tipik kullanım nasıl işliyor?)_

## Kapsam

_(Neler dahil, neler dışında?)_

## Temel teknolojiler

<!-- consul:begin:tech -->
<!-- consul:end:tech -->

## Repository bilgisi

<!-- consul:begin:repo -->
<!-- consul:end:repo -->
`
}

function changelogTemplate(ctx: DocumentContext): string {
  return `# ${ctx.projectName} — Değişiklik Günlüğü

Bu dosya CONSUL tarafından **eklemeli** (append-only) güncellenir: yeni kayıtlar
en üste eklenir, mevcut satırlar hiçbir zaman silinmez veya değiştirilmez.
`
}

function architectureTemplate(ctx: DocumentContext): string {
  return `# ${ctx.projectName} — Mimari

${MANAGED_NOTE}

## Genel bakış

_(Sistem nasıl çalışıyor? Bu bölümü siz yazın.)_

## Klasör yapısı

<!-- consul:begin:structure -->
<!-- consul:end:structure -->

## Bileşen diyagramı

<!-- consul:begin:diagram -->
<!-- consul:end:diagram -->

## Veri akışı

_(İstek/olay hangi katmanlardan geçiyor?)_

## Kararlar ve gerekçeleri

_(Önemli mimari kararlar ve neden alındıkları.)_
`
}

function elementsTemplate(ctx: DocumentContext): string {
  return `# ${ctx.projectName} — Elementler

Projedeki önemli modüller. Her element için görevi, girdisi, çıktısı,
bağımlılıkları ve ilişkili dosyaları yazın.

${MANAGED_NOTE}

## Tespit edilen üst düzey birimler

<!-- consul:begin:structure -->
<!-- consul:end:structure -->

## Elementler

### _(örnek) Element adı_

- **Görev:**
- **Girdi:**
- **Çıktı:**
- **Bağımlılıklar:**
- **İlişkili dosyalar:**
- **İletişim kurduğu elementler:**
`
}

/* ── Uygulama ──────────────────────────────────────────────────── */

const TEMPLATES: Record<MemoFileName, (ctx: DocumentContext) => string> = {
  'README.md': readmeTemplate,
  'PURPOSE.md': purposeTemplate,
  'CHANGELOG.md': changelogTemplate,
  'ARCHITECTURE.md': architectureTemplate,
  'ELEMENTS.md': elementsTemplate,
}

/** Her belgenin hangi işaretli bölgeleri taşıdığı. */
const REGIONS: Record<MemoFileName, { id: string; render: (ctx: DocumentContext) => string }[]> = {
  'README.md': [{ id: 'repo', render: repoRegion }],
  'PURPOSE.md': [
    { id: 'tech', render: techRegion },
    { id: 'repo', render: repoRegion },
  ],
  'CHANGELOG.md': [],
  'ARCHITECTURE.md': [
    { id: 'structure', render: structureRegion },
    { id: 'diagram', render: diagramRegion },
  ],
  'ELEMENTS.md': [{ id: 'structure', render: structureRegion }],
}

export interface EnsureResult {
  created: MemoFileName[]
  updated: MemoFileName[]
}

/**
 * Hafıza belgelerini oluşturur/tazeler.
 *
 * - Dosya yoksa: şablon + işaretli bölgeler yazılır.
 * - Dosya varsa: SADECE işaretli bölgeler, içerikleri gerçekten değiştiyse
 *   yeniden yazılır. Kullanıcının metni asla ezilmez, gereksiz yazım yapılmaz.
 */
export function ensureDocuments(dir: string, ctx: DocumentContext): EnsureResult {
  const result: EnsureResult = { created: [], updated: [] }

  for (const name of MEMO_FILES) {
    const path = join(dir, name)
    const exists = existsSync(path)

    let document: string
    if (exists) {
      try {
        document = readFileSync(path, 'utf8')
      } catch {
        // Okunamıyorsa DOKUNMA — üzerine yazmak veri kaybı olurdu
        continue
      }
    } else {
      document = TEMPLATES[name](ctx)
    }

    let next = document
    for (const region of REGIONS[name]) {
      const rendered = region.render(ctx)
      if (readManagedRegion(next, region.id) === rendered) continue
      next = writeManagedRegion(next, region.id, rendered)
    }

    if (!exists) {
      writeFileAtomicText(path, next)
      result.created.push(name)
    } else if (next !== document) {
      writeFileAtomicText(path, next)
      result.updated.push(name)
    }
  }

  return result
}

/** Klasördeki hafıza dosyalarının listesi (arayüzde gösterilir). */
export function listMemoFiles(dir: string): { name: string; path: string; bytes: number; updatedAt: string }[] {
  const out: { name: string; path: string; bytes: number; updatedAt: string }[] = []
  for (const name of MEMO_FILES) {
    const path = join(dir, name)
    try {
      const st = statSync(path)
      out.push({ name, path, bytes: st.size, updatedAt: st.mtime.toISOString() })
    } catch {
      // dosya yok — listelenmez
    }
  }
  return out
}
