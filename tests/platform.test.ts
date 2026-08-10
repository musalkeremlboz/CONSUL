/** Platform katmanı: kabuk keşfi, çalıştırılabilir bulma ve PTY ortamı.
 *
 *  Bu testler ÇALIŞTIKLARI GERÇEK SİSTEME karşı koşar (mock yok): CONSUL'un
 *  sahte bir kabuk üretmediğini, bulduğu her kaydın gerçek bir dosyaya işaret
 *  ettiğini doğrular. */
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { PLATFORM, PATH_SEPARATOR, isWindows } from '../src/main/platform/os'
import { discoverShells, defaultShellId, resolveShell, resetShellCache } from '../src/main/platform/shells'
import { findExecutable, inspectExecutable } from '../src/main/platform/executables'
import { buildPtyEnv, cleanEnv } from '../src/main/terminal/env'

describe('platform tespiti', () => {
  it('üç platformdan birini bildirir', () => {
    expect(['windows', 'macos', 'linux']).toContain(PLATFORM)
  })

  it('PATH ayracı platforma uygundur', () => {
    expect(PATH_SEPARATOR).toBe(isWindows ? ';' : ':')
  })
})

describe('findExecutable', () => {
  it('node çalıştırılabilirini bulur', () => {
    const found = findExecutable('node')
    expect(found).toBeTruthy()
    expect(isAbsolute(found!)).toBe(true)
    expect(existsSync(found!)).toBe(true)
  })

  it('olmayan komut için null döner', () => {
    expect(findExecutable('kesinlikle-olmayan-komut-xyz123')).toBeNull()
  })

  it('boş ad için null döner', () => {
    expect(findExecutable('')).toBeNull()
  })

  it('sürüm bilgisini kabuk çalıştırmadan alır', async () => {
    const info = await inspectExecutable('node', { version: true })
    expect(info.available).toBe(true)
    expect(info.version).toMatch(/^v?\d+\./)
  })

  it('bulunamayan komutu available:false bildirir', async () => {
    expect(await inspectExecutable('kesinlikle-olmayan-komut-xyz123')).toEqual({ available: false })
  })
})

describe('kabuk keşfi', () => {
  it('en az bir kabuk bulur ve hepsi gerçektir', async () => {
    resetShellCache()
    const shells = await discoverShells()
    expect(shells.length).toBeGreaterThan(0)
    for (const shell of shells) {
      expect(shell.id).toBeTruthy()
      expect(shell.label).toBeTruthy()
      expect(Array.isArray(shell.args)).toBe(true)
      expect(['powershell', 'cmd', 'posix', 'wsl']).toContain(shell.kind)
      // WSL dağıtımları wsl.exe üzerinden çalışır; diğerleri gerçek dosyadır
      if (shell.kind !== 'wsl') expect(existsSync(shell.file)).toBe(true)
    }
  })

  it('kabuk kimlikleri benzersizdir', async () => {
    const shells = await discoverShells()
    expect(new Set(shells.map((s) => s.id)).size).toBe(shells.length)
  })

  it('varsayılan kabuk keşfedilenler arasındadır', async () => {
    const shells = await discoverShells()
    expect(shells.map((s) => s.id)).toContain(await defaultShellId())
  })

  it('bilinmeyen kimlik varsayılana düşer (asla hata vermez)', async () => {
    const fallback = await resolveShell('boyle-bir-kabuk-yok')
    expect(fallback).toBeTruthy()
    expect(fallback.file).toBeTruthy()
  })

  it('argümanlar dizidir — komut satırı string’i kurulmaz', async () => {
    const shells = await discoverShells()
    for (const shell of shells) {
      expect(Array.isArray(shell.args)).toBe(true)
      for (const arg of shell.args) expect(typeof arg).toBe('string')
    }
  })
})

describe('PTY ortamı', () => {
  it('Electron kalıntılarını temizler', () => {
    const env = cleanEnv({ ELECTRON_RUN_AS_NODE: '1', NODE_OPTIONS: '--x', PATH: '/usr/bin' })
    expect(env['ELECTRON_RUN_AS_NODE']).toBeUndefined()
    expect(env['NODE_OPTIONS']).toBeUndefined()
  })

  it('terminal kimliğini ekler', () => {
    const env = buildPtyEnv()
    expect(env['TERM']).toBe('xterm-256color')
    expect(env['COLORTERM']).toBe('truecolor')
    expect(env['TERM_PROGRAM']).toBe('CONSUL')
  })

  it('ek değişkenleri uygular', () => {
    expect(buildPtyEnv({ extra: { CONSUL_TEST: 'evet' } })['CONSUL_TEST']).toBe('evet')
  })

  it('PATH değerini korur ve zenginleştirir', () => {
    const env = buildPtyEnv()
    const key = Object.keys(env).find((k) => k.toLowerCase() === 'path')
    expect(key).toBeTruthy()
    expect(env[key!].length).toBeGreaterThan(0)
  })
})
