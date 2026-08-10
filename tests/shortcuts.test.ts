/** Kısayol kayıt defteri — uygulama kısayolları terminale SIZMAMALI,
 *  terminal tuşları da uygulama tarafından yutulmamalı.
 *
 *  Testler PLATFORMDAN BAĞIMSIZ yazılır: birincil değiştirici macOS'ta ⌘,
 *  diğerlerinde Ctrl olduğu için olaylar `IS_MAC`e göre kurulur. (Ctrl'ü sabit
 *  kabul eden bir test macOS'ta yanlış yere kırmızı yanar — CI'da tam olarak
 *  bu oldu.) */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { COMMANDS, comboLabel, IS_MAC, isAppShortcut, matchCommand } from '../src/renderer/src/state/shortcuts'

interface KeyInit {
  key: string
  /** Platformun birincil değiştiricisi: macOS'ta ⌘, diğerlerinde Ctrl. */
  primary?: boolean
  /** Platformun İKİNCİL değiştiricisi — komut eşleşmesini bozmalıdır. */
  secondary?: boolean
  shift?: boolean
  alt?: boolean
}

function key(init: KeyInit): KeyboardEvent {
  return {
    key: init.key,
    ctrlKey: IS_MAC ? !!init.secondary : !!init.primary,
    metaKey: IS_MAC ? !!init.primary : !!init.secondary,
    shiftKey: !!init.shift,
    altKey: !!init.alt,
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

  it('aynı tuş bileşimi iki komuta atanmamıştır', () => {
    const seen = new Set<string>()
    for (const command of COMMANDS) {
      for (const combo of command.combos) {
        const signature = `${combo.primary ? 'P' : ''}${combo.shift ? 'S' : ''}${combo.alt ? 'A' : ''}:${combo.key.toLowerCase()}`
        expect(seen.has(signature), `çakışan kısayol: ${signature} (${command.id})`).toBe(false)
        seen.add(signature)
      }
    }
  })
})

describe('matchCommand', () => {
  it('birincil+T yeni sekme açar', () => {
    expect(matchCommand(key({ key: 't', primary: true }))).toBe('tab.new')
  })

  it('birincil+Shift+P komut paletini açar', () => {
    expect(matchCommand(key({ key: 'p', primary: true, shift: true }))).toBe('palette.open')
  })

  it('Shift farkını gözetir (birincil+P palet DEĞİLDİR)', () => {
    expect(matchCommand(key({ key: 'p', primary: true }))).toBeNull()
  })

  it('birincil+F terminalde arama açar', () => {
    expect(matchCommand(key({ key: 'f', primary: true }))).toBe('terminal.search')
  })

  it('birincil+Tab / +Shift+Tab sekme değiştirir', () => {
    expect(matchCommand(key({ key: 'Tab', primary: true }))).toBe('tab.next')
    expect(matchCommand(key({ key: 'Tab', primary: true, shift: true }))).toBe('tab.prev')
  })

  it('değiştirici olmayan tuş komut değildir (terminale gider)', () => {
    expect(matchCommand(key({ key: 't' }))).toBeNull()
    expect(matchCommand(key({ key: 'Enter' }))).toBeNull()
  })

  it('birincil+C komut DEĞİLDİR — süreç kesme terminale ait', () => {
    expect(matchCommand(key({ key: 'c', primary: true }))).toBeNull()
  })

  it('ikincil değiştirici komut tetiklemez', () => {
    // Windows/Linux'ta ⊞/Meta, macOS'ta Ctrl — hiçbiri uygulama kısayolu değildir
    expect(matchCommand(key({ key: 't', secondary: true }))).toBeNull()
  })

  it('Alt bileşimlerini karıştırmaz', () => {
    expect(matchCommand(key({ key: 't', primary: true, alt: true }))).toBeNull()
  })
})

describe('isAppShortcut', () => {
  it('uygulama kısayollarını terminale bırakmaz', () => {
    expect(isAppShortcut(key({ key: 't', primary: true }))).toBe(true)
    expect(isAppShortcut(key({ key: '3', primary: true }))).toBe(true)
  })

  it('terminal tuşlarını yutmaz', () => {
    expect(isAppShortcut(key({ key: 'c', primary: true }))).toBe(false)
    expect(isAppShortcut(key({ key: 'a' }))).toBe(false)
    expect(isAppShortcut(key({ key: 'd', primary: true }))).toBe(false)
  })
})

describe('comboLabel', () => {
  it('okunabilir gösterim üretir', () => {
    expect(comboLabel({ key: 'p', primary: true, shift: true })).toMatch(/\+Shift\+P$/)
    expect(comboLabel({ key: 'Tab', primary: true })).toMatch(/Tab$/)
  })

  it('birincil değiştiriciyi platforma göre adlandırır', () => {
    expect(comboLabel({ key: 't', primary: true }).startsWith(IS_MAC ? '⌘' : 'Ctrl')).toBe(true)
  })
})

/* ── Platform dalları ──────────────────────────────────────────────
 *
 * Birincil değiştirici modül YÜKLENİRKEN `navigator`dan türetilir. Bu yüzden
 * "macOS'ta ⌘ çalışıyor mu" sorusu yalnız macOS'ta koşan CI ile yanıtlanır ve
 * hata ancak orada görülür (nitekim ilk CI koşusunda böyle oldu). Aşağıdaki
 * testler `navigator`ı taklit edip modülü TAZE içe aktararak her iki dalı da
 * HER platformdan doğrular. */

async function loadWithPlatform(platform: string) {
  vi.resetModules()
  vi.stubGlobal('navigator', { platform, userAgent: `Test/(${platform})` })
  const mod = await import('../src/renderer/src/state/shortcuts')
  return mod
}

describe('birincil değiştirici platforma göre çözülür', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('macOS: ⌘ komutu tetikler, Ctrl tetiklemez', async () => {
    const mac = await loadWithPlatform('MacIntel')
    expect(mac.IS_MAC).toBe(true)
    const withMeta = { key: 't', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false } as KeyboardEvent
    const withCtrl = { key: 't', metaKey: false, ctrlKey: true, shiftKey: false, altKey: false } as KeyboardEvent
    expect(mac.matchCommand(withMeta)).toBe('tab.new')
    expect(mac.matchCommand(withCtrl)).toBeNull()
    expect(mac.comboLabel({ key: 't', primary: true })).toBe('⌘+T')
  })

  it('Windows/Linux: Ctrl komutu tetikler, Meta tetiklemez', async () => {
    const win = await loadWithPlatform('Win32')
    expect(win.IS_MAC).toBe(false)
    const withCtrl = { key: 't', metaKey: false, ctrlKey: true, shiftKey: false, altKey: false } as KeyboardEvent
    const withMeta = { key: 't', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false } as KeyboardEvent
    expect(win.matchCommand(withCtrl)).toBe('tab.new')
    expect(win.matchCommand(withMeta)).toBeNull()
    expect(win.comboLabel({ key: 't', primary: true })).toBe('Ctrl+T')
  })
})
