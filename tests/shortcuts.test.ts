/** Kısayol kayıt defteri — uygulama kısayolları terminale SIZMAMALI,
 *  terminal tuşları da uygulama tarafından yutulmamalı. */
import { describe, expect, it } from 'vitest'
import { COMMANDS, comboLabel, isAppShortcut, matchCommand } from '../src/renderer/src/state/shortcuts'

function key(init: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
  return {
    key: init.key,
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    shiftKey: init.shiftKey ?? false,
    altKey: init.altKey ?? false,
  } as KeyboardEvent
}

describe('komut kayıt defteri', () => {
  it('her komutun en az bir kısayolu vardır', () => {
    for (const command of COMMANDS) {
      expect(command.combos.length).toBeGreaterThan(0)
      expect(command.label).toBeTruthy()
      expect(command.group).toBeTruthy()
    }
  })

  it('komut kimlikleri benzersizdir', () => {
    expect(new Set(COMMANDS.map((c) => c.id)).size).toBe(COMMANDS.length)
  })
})

describe('matchCommand', () => {
  it('Ctrl+T yeni sekme açar', () => {
    expect(matchCommand(key({ key: 't', ctrlKey: true }))).toBe('tab.new')
  })

  it('Ctrl+Shift+P komut paletini açar', () => {
    expect(matchCommand(key({ key: 'p', ctrlKey: true, shiftKey: true }))).toBe('palette.open')
  })

  it('Shift farkını gözetir (Ctrl+P palet DEĞİLDİR)', () => {
    expect(matchCommand(key({ key: 'p', ctrlKey: true }))).toBeNull()
  })

  it('Ctrl+F terminalde arama açar', () => {
    expect(matchCommand(key({ key: 'f', ctrlKey: true }))).toBe('terminal.search')
  })

  it('Ctrl+Tab / Ctrl+Shift+Tab sekme değiştirir', () => {
    expect(matchCommand(key({ key: 'Tab', ctrlKey: true }))).toBe('tab.next')
    expect(matchCommand(key({ key: 'Tab', ctrlKey: true, shiftKey: true }))).toBe('tab.prev')
  })

  it('değiştirici olmayan tuş komut değildir (terminale gider)', () => {
    expect(matchCommand(key({ key: 't' }))).toBeNull()
    expect(matchCommand(key({ key: 'Enter' }))).toBeNull()
  })

  it('Ctrl+C komut DEĞİLDİR — süreç kesme terminale ait', () => {
    expect(matchCommand(key({ key: 'c', ctrlKey: true }))).toBeNull()
  })

  it('Alt bileşimlerini karıştırmaz', () => {
    expect(matchCommand(key({ key: 't', ctrlKey: true, altKey: true }))).toBeNull()
  })
})

describe('isAppShortcut', () => {
  it('uygulama kısayollarını terminale bırakmaz', () => {
    expect(isAppShortcut(key({ key: 't', ctrlKey: true }))).toBe(true)
    expect(isAppShortcut(key({ key: '3', ctrlKey: true }))).toBe(true)
  })

  it('terminal tuşlarını yutmaz', () => {
    expect(isAppShortcut(key({ key: 'c', ctrlKey: true }))).toBe(false)
    expect(isAppShortcut(key({ key: 'a' }))).toBe(false)
    expect(isAppShortcut(key({ key: 'd', ctrlKey: true }))).toBe(false)
  })
})

describe('comboLabel', () => {
  it('okunabilir gösterim üretir', () => {
    expect(comboLabel({ key: 'p', primary: true, shift: true })).toMatch(/\+Shift\+P$/)
    expect(comboLabel({ key: 'Tab', primary: true })).toMatch(/Tab$/)
  })
})
