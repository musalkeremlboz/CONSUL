/** CONSUL Developer: kaynak ağacı tespiti ve Claude Code başlatma tarifi.
 *
 *  En kritik iki güvence burada test edilir:
 *   1. Claude Code izinleri atlayan bir bayrakla ASLA başlatılmaz.
 *   2. Claude bulunamazsa uygulama çökmez; kullanıcıya anlaşılır bilgi verilir. */
import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { looksLikeConsulSource } from '../src/main/developer/sourceDetect'
import { claudeLaunchSpec, claudeMissingMessage, findClaude } from '../src/main/developer/claude'
import { isWindows } from '../src/main/platform/os'

function makeDir(files: Record<string, string>, dirs: string[] = []): string {
  const root = mkdtempSync(join(tmpdir(), 'consul-dev-test-'))
  for (const dir of dirs) mkdirSync(join(root, dir), { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(root, name, '..'), { recursive: true })
    writeFileSync(join(root, name), content, 'utf8')
  }
  return root
}

describe('looksLikeConsulSource', () => {
  it('gerçek CONSUL kaynak ağacını tanır', () => {
    const root = makeDir({ 'package.json': JSON.stringify({ name: 'consul' }) }, ['src/main'])
    expect(looksLikeConsulSource(root)).toBe(true)
    rmSync(root, { recursive: true, force: true })
  })

  it('productName üzerinden de tanır', () => {
    const root = makeDir({ 'package.json': JSON.stringify({ name: 'baska', productName: 'CONSUL' }) }, ['src/main'])
    expect(looksLikeConsulSource(root)).toBe(true)
    rmSync(root, { recursive: true, force: true })
  })

  it('başka bir projeyi CONSUL sanmaz', () => {
    const root = makeDir({ 'package.json': JSON.stringify({ name: 'baska-proje' }) }, ['src/main'])
    expect(looksLikeConsulSource(root)).toBe(false)
    rmSync(root, { recursive: true, force: true })
  })

  it('src/main yoksa reddeder', () => {
    const root = makeDir({ 'package.json': JSON.stringify({ name: 'consul' }) })
    expect(looksLikeConsulSource(root)).toBe(false)
    rmSync(root, { recursive: true, force: true })
  })

  it('bozuk package.json ile çökmez', () => {
    const root = makeDir({ 'package.json': '{ bozuk' }, ['src/main'])
    expect(looksLikeConsulSource(root)).toBe(false)
    rmSync(root, { recursive: true, force: true })
  })

  it('olmayan klasörde false döner', () => {
    expect(looksLikeConsulSource(join(tmpdir(), 'kesinlikle-yok-123'))).toBe(false)
  })

  it('CONSUL deposunun kendisini tanır', () => {
    // Test dosyasından repository kökü: tests/ → ..
    expect(looksLikeConsulSource(resolve(__dirname, '..'))).toBe(true)
  })
})

describe('claudeLaunchSpec', () => {
  const base = { cwd: process.cwd(), cols: 80, rows: 24 }

  it('izinleri atlayan bayrak EKLEMEZ', () => {
    const spec = claudeLaunchSpec({ ...base, executable: '/usr/local/bin/claude' })
    const all = [spec.file, ...spec.args].join(' ')
    expect(all).not.toContain('dangerously')
    expect(all).not.toContain('skip-permissions')
    expect(all).not.toContain('--yes')
  })

  it('doğrudan çalıştırılabiliri argümansız başlatır', () => {
    const spec = claudeLaunchSpec({ ...base, executable: '/usr/local/bin/claude' })
    expect(spec.file).toBe('/usr/local/bin/claude')
    expect(spec.args).toEqual([])
  })

  it('çalışma dizinini ve boyutları aktarır', () => {
    const spec = claudeLaunchSpec({ ...base, executable: '/usr/local/bin/claude' })
    expect(spec.cwd).toBe(base.cwd)
    expect(spec.cols).toBe(80)
    expect(spec.rows).toBe(24)
  })

  it('terminal kimliğiyle birlikte temiz ortam verir', () => {
    const spec = claudeLaunchSpec({ ...base, executable: '/usr/local/bin/claude' })
    expect(spec.env['TERM_PROGRAM']).toBe('CONSUL')
    expect(spec.env['ELECTRON_RUN_AS_NODE']).toBeUndefined()
  })

  it.runIf(isWindows)('Windows .cmd shim’ini yorumlayıcıyla, yolu AYRI argüman olarak çalıştırır', () => {
    const spec = claudeLaunchSpec({ ...base, executable: 'C:\\npm\\claude.cmd' })
    expect(spec.file.toLowerCase()).toContain('cmd')
    expect(spec.args).toEqual(['/c', 'C:\\npm\\claude.cmd'])
  })
})

describe('claudeMissingMessage', () => {
  it('kurulum yönergesi içerir ve otomatik kurulum vaat etmez', () => {
    const message = claudeMissingMessage()
    expect(message).toContain('Claude Code bulunamadı')
    expect(message).toContain('claude-code')
    expect(message).toContain('otomatik kurulum yapmaz')
  })
})

describe('findClaude', () => {
  it('kurulu olsun olmasın çökmeden sonuç döner', () => {
    const result = findClaude()
    expect(typeof result.found).toBe('boolean')
    if (result.found) expect(result.path).toBeTruthy()
  })
})
