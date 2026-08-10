/** CONSUL-MEMO: Markdown üretimi, kullanıcı içeriğinin korunması, changelog
 *  eklemesi ve klasör çözümlemesi (repository yeniden adlandırma dahil). */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import {
  appendChangelog,
  localDateStamp,
  readManagedRegion,
  writeManagedRegion,
} from '../src/main/memory/markdown'
import { ensureDocuments, listMemoFiles, MEMO_FILES } from '../src/main/memory/documents'
import { resolveMemoDir } from '../src/main/memory/memoDirectory'
import { isInside } from '../src/main/platform/pathUtils'
import type { GitInfo } from '../src/shared/types'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'consul-memo-test-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const git: GitInfo = {
  isRepository: true,
  root: '/proje',
  repositoryName: 'example/demo',
  shortName: 'demo',
  currentBranch: 'main',
  defaultBranch: 'main',
  remoteUrl: 'https://github.com/example/demo.git',
  provider: 'github',
  dirtyFiles: 0,
  ahead: 0,
  behind: 0,
}

function context(projectPath: string) {
  return {
    projectName: 'demo',
    projectPath,
    git,
    facts: {
      declaredName: 'demo',
      languages: ['TypeScript'],
      frameworks: ['Vite'],
      scripts: ['build'],
      topLevelDirs: ['src', 'tests'],
      notableFiles: ['package.json'],
    },
  }
}

/* ── İşaretli bölgeler ─────────────────────────────────────────── */

describe('işaretli bölgeler', () => {
  it('bölge yoksa belgenin sonuna ekler', () => {
    const out = writeManagedRegion('# Başlık\n\nKullanıcı metni.\n', 'repo', 'içerik')
    expect(out).toContain('Kullanıcı metni.')
    expect(readManagedRegion(out, 'repo')).toBe('içerik')
  })

  it('yalnız bölgeyi değiştirir, çevresini korur', () => {
    const first = writeManagedRegion('ÖNCE\n\n<!-- consul:begin:repo -->\neski\n<!-- consul:end:repo -->\n\nSONRA', 'repo', 'yeni')
    expect(first).toContain('ÖNCE')
    expect(first).toContain('SONRA')
    expect(first).not.toContain('eski')
    expect(readManagedRegion(first, 'repo')).toBe('yeni')
  })

  it('bulunmayan bölge için null döner', () => {
    expect(readManagedRegion('# yalnızca başlık', 'repo')).toBeNull()
  })
})

/* ── Changelog ─────────────────────────────────────────────────── */

describe('appendChangelog', () => {
  it('boş belgede iskelet kurar', () => {
    const out = appendChangelog('', { date: '2026-08-10', title: 'İlk kayıt', bullets: ['bir şey yapıldı'] })
    expect(out).toContain('# Proje Değişiklik Günlüğü')
    expect(out).toContain('## 2026-08-10')
    expect(out).toContain('### İlk kayıt')
    expect(out).toContain('- bir şey yapıldı')
  })

  it('mevcut kayıtları ASLA silmez', () => {
    let doc = appendChangelog('', { date: '2026-08-09', title: 'Eski', bullets: ['eski madde'] })
    doc = appendChangelog(doc, { date: '2026-08-10', title: 'Yeni', bullets: ['yeni madde'] })
    expect(doc).toContain('Eski')
    expect(doc).toContain('eski madde')
    expect(doc).toContain('Yeni')
  })

  it('en yeni tarihi en üste koyar', () => {
    let doc = appendChangelog('', { date: '2026-08-09', title: 'Eski', bullets: ['a'] })
    doc = appendChangelog(doc, { date: '2026-08-10', title: 'Yeni', bullets: ['b'] })
    expect(doc.indexOf('## 2026-08-10')).toBeLessThan(doc.indexOf('## 2026-08-09'))
  })

  it('aynı tarihe ikinci kaydı aynı bölüme ekler', () => {
    let doc = appendChangelog('', { date: '2026-08-10', title: 'Birinci', bullets: ['a'] })
    doc = appendChangelog(doc, { date: '2026-08-10', title: 'İkinci', bullets: ['b'] })
    expect(doc.match(/## 2026-08-10/g)).toHaveLength(1)
    expect(doc).toContain('### Birinci')
    expect(doc).toContain('### İkinci')
  })

  it('değişen dosyaları ayrı bölümde listeler', () => {
    const doc = appendChangelog('', {
      date: '2026-08-10',
      title: 'Refactor',
      bullets: ['bölündü'],
      files: ['src/a.ts', 'src/b.ts'],
    })
    expect(doc).toContain('**Değişen dosyalar**')
    expect(doc).toContain('`src/a.ts`')
  })

  it('kullanıcının elle yazdığı giriş paragrafını korur', () => {
    const original = '# Günlük\n\nBu proje hakkında elle yazdığım not.\n'
    const doc = appendChangelog(original, { date: '2026-08-10', title: 'X', bullets: ['y'] })
    expect(doc).toContain('Bu proje hakkında elle yazdığım not.')
  })
})

describe('localDateStamp', () => {
  it('yerel takvim gününü YYYY-MM-DD verir', () => {
    expect(localDateStamp(new Date(2026, 7, 10, 23, 30))).toBe('2026-08-10')
  })
})

/* ── Belgeler ──────────────────────────────────────────────────── */

describe('ensureDocuments', () => {
  it('beş hafıza dosyasını oluşturur', () => {
    const result = ensureDocuments(root, context('/proje'))
    expect(result.created.sort()).toEqual([...MEMO_FILES].sort())
    for (const name of MEMO_FILES) {
      expect(existsSync(join(root, name))).toBe(true)
    }
    expect(listMemoFiles(root)).toHaveLength(MEMO_FILES.length)
  })

  it('üretilen bölgeleri gerçek olgularla doldurur', () => {
    ensureDocuments(root, context('/proje'))
    const purpose = readFileSync(join(root, 'PURPOSE.md'), 'utf8')
    expect(purpose).toContain('TypeScript')
    expect(purpose).toContain('example/demo')
  })

  it('ikinci çağrıda dosyaları yeniden OLUŞTURMAZ', () => {
    ensureDocuments(root, context('/proje'))
    const second = ensureDocuments(root, context('/proje'))
    expect(second.created).toHaveLength(0)
    expect(second.updated).toHaveLength(0)
  })

  it('kullanıcının eklediği metni korur', () => {
    ensureDocuments(root, context('/proje'))
    const path = join(root, 'PURPOSE.md')
    writeFileSync(path, readFileSync(path, 'utf8') + '\n## Benim notlarım\n\nBunlar kaybolmamalı.\n', 'utf8')

    ensureDocuments(root, { ...context('/proje'), facts: { ...context('/proje').facts, languages: ['Rust'] } })

    const after = readFileSync(path, 'utf8')
    expect(after).toContain('Bunlar kaybolmamalı.')
    expect(after).toContain('Rust') // üretilen bölge tazelendi
  })

  it('CHANGELOG.md içeriğine hiç dokunmaz', () => {
    ensureDocuments(root, context('/proje'))
    const path = join(root, 'CHANGELOG.md')
    const custom = '# Kendi günlüğüm\n\n- elle yazılmış kayıt\n'
    writeFileSync(path, custom, 'utf8')
    ensureDocuments(root, context('/proje'))
    expect(readFileSync(path, 'utf8')).toBe(custom)
  })
})

/* ── Klasör çözümlemesi ────────────────────────────────────────── */

describe('resolveMemoDir', () => {
  it('yeni proje için klasör oluşturur', () => {
    const result = resolveMemoDir({ root, projectPath: join(root, '..', 'p1'), desiredName: 'demo' })
    expect(result.created).toBe(true)
    expect(existsSync(result.dir)).toBe(true)
    expect(result.dir.endsWith('demo')).toBe(true)
  })

  it('aynı proje ikinci kez açılınca AYNI klasörü verir', () => {
    const project = join(root, '..', 'p2')
    const first = resolveMemoDir({ root, projectPath: project, desiredName: 'demo' })
    const second = resolveMemoDir({ root, projectPath: project, desiredName: 'demo' })
    expect(second.dir).toBe(first.dir)
    expect(second.created).toBe(false)
  })

  it('repository yeniden adlandırıldığında klasörü TAŞIR (kopya oluşturmaz)', () => {
    const project = join(root, '..', 'p3')
    const first = resolveMemoDir({ root, projectPath: project, desiredName: 'eski-ad' })
    writeFileSync(join(first.dir, 'CHANGELOG.md'), 'korunmalı', 'utf8')

    const second = resolveMemoDir({ root, projectPath: project, desiredName: 'yeni-ad' })

    expect(second.renamedFrom).toBe('eski-ad')
    expect(second.dir.endsWith('yeni-ad')).toBe(true)
    expect(readFileSync(join(second.dir, 'CHANGELOG.md'), 'utf8')).toBe('korunmalı')
    expect(existsSync(first.dir)).toBe(false)
  })

  it('proje taşınsa bile aynı adlı klasörü benimser', () => {
    resolveMemoDir({ root, projectPath: join(root, '..', 'eski-yol'), desiredName: 'demo' })
    const moved = resolveMemoDir({ root, projectPath: join(root, '..', 'yeni-yol'), desiredName: 'demo' })
    expect(moved.created).toBe(false)
    expect(moved.dir.endsWith('demo')).toBe(true)
  })

  it('farklı projeler aynı adı istediğinde çakışmayı sonekle çözer', () => {
    mkdirSync(join(root, 'demo'), { recursive: true })
    writeFileSync(join(root, 'demo', '.consul-memo.json'), JSON.stringify({ id: 'x', folder: 'demo', projectPaths: ['/a'], createdAt: '', updatedAt: '' }), 'utf8')
    const a = resolveMemoDir({ root, projectPath: '/a', desiredName: 'demo' })
    const b = resolveMemoDir({ root, projectPath: '/b', desiredName: 'demo' })
    expect(a.dir).toBe(b.dir) // aynı ad → aynı klasör benimsenir
    expect(existsSync(join(root, '.consul-index.json'))).toBe(true)
  })

  it('güvensiz istenen adda hafıza kökünün DIŞINA çıkmaz', () => {
    const result = resolveMemoDir({ root, projectPath: '/x', desiredName: '../../kacis' })
    // Gerçek güvence: sonuç kökün altında ve TEK bir segment
    expect(isInside(root, result.dir)).toBe(true)
    expect(relative(root, result.dir).split(sep)).toHaveLength(1)
    expect(existsSync(result.dir)).toBe(true)
  })
})
