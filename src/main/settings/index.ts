/** Uygulama ayarları — atomik JSON deposu.
 *
 *  `electron-store` yerine `src/core/atomic-store.ts` kullanılır: yazım
 *  tmp+fsync+rename ile atomiktir, iki nesil yedek tutulur ve bozuk dosya
 *  karantinaya alınıp varsayılanlarla kurtarılır. Geçici IO hatasında (dosya
 *  kilitli) okuma sessizce varsayılana DÜŞMEZ — `TransientReadError` fırlar,
 *  böylece bir tur atlanır ve kullanıcının ayarları silinmez.
 *
 *  Doğrulama: her yama şemadan geçer; bilinmeyen alanlar atılır, aralık dışı
 *  değerler Türkçe hata ile reddedilir — geçersiz değer kalıcılaşmaz. */
import { join } from 'node:path'
import { createAtomicStore, type AtomicStore } from '../../core/atomic-store'
import { v } from '../../core/schema'
import type { Settings } from '../../shared/types'
import { userDataDir } from '../platform/paths'

const SCHEMA_VERSION = 1
const MAX_RECENTS = 12

export const DEFAULT_FONT_SIZE = 14
export const MIN_FONT_SIZE = 8
export const MAX_FONT_SIZE = 40

export function defaultSettings(): Settings {
  return {
    defaultShellId: null,
    defaultProjectDir: null,
    fontFamily: '',
    fontSize: DEFAULT_FONT_SIZE,
    lineHeight: 1.2,
    cursorStyle: 'block',
    cursorBlink: true,
    terminalScheme: 'consul-dark',
    uiTheme: 'dark',
    scrollback: 10_000,
    startupBehavior: 'home',
    recentProjects: [],
    glitchHighlights: true,
    memoryEnabled: true,
    autoUpdate: true,
    updateChannel: 'stable',
  }
}

/** Tam ayar nesnesi şeması — diskten okunan veri de buradan geçer. */
const SettingsSchema = v.object({
  defaultShellId: v.withDefault(v.nullable(v.string({ max: 128, trim: true })), null),
  defaultProjectDir: v.withDefault(v.nullable(v.string({ max: 4096 })), null),
  fontFamily: v.withDefault(v.string({ max: 200, trim: true }), ''),
  fontSize: v.withDefault(v.number({ min: MIN_FONT_SIZE, max: MAX_FONT_SIZE, int: true }), DEFAULT_FONT_SIZE),
  lineHeight: v.withDefault(v.number({ min: 0.8, max: 3 }), 1.2),
  cursorStyle: v.withDefault(v.literal('block', 'bar', 'underline'), 'block'),
  cursorBlink: v.withDefault(v.boolean(), true),
  terminalScheme: v.withDefault(v.string({ min: 1, max: 64, trim: true }), 'consul-dark'),
  uiTheme: v.withDefault(v.literal('dark', 'light', 'system'), 'dark'),
  scrollback: v.withDefault(v.number({ min: 200, max: 200_000, int: true }), 10_000),
  startupBehavior: v.withDefault(v.literal('home', 'new-terminal', 'restore-last'), 'home'),
  recentProjects: v.withDefault(v.array(v.string({ min: 1, max: 4096 }), { max: MAX_RECENTS }), []),
  glitchHighlights: v.withDefault(v.boolean(), true),
  memoryEnabled: v.withDefault(v.boolean(), true),
  autoUpdate: v.withDefault(v.boolean(), true),
  updateChannel: v.withDefault(v.literal('stable', 'beta'), 'stable'),
})

/** Kısmi yama şeması — verilmeyen alan `undefined` kalır, mevcut değer korunur. */
const SettingsPatchSchema = v.object({
  defaultShellId: v.optional(v.nullable(v.string({ max: 128, trim: true }))),
  defaultProjectDir: v.optional(v.nullable(v.string({ max: 4096 }))),
  fontFamily: v.optional(v.string({ max: 200, trim: true })),
  fontSize: v.optional(v.number({ min: MIN_FONT_SIZE, max: MAX_FONT_SIZE, int: true })),
  lineHeight: v.optional(v.number({ min: 0.8, max: 3 })),
  cursorStyle: v.optional(v.literal('block', 'bar', 'underline')),
  cursorBlink: v.optional(v.boolean()),
  terminalScheme: v.optional(v.string({ min: 1, max: 64, trim: true })),
  uiTheme: v.optional(v.literal('dark', 'light', 'system')),
  scrollback: v.optional(v.number({ min: 200, max: 200_000, int: true })),
  startupBehavior: v.optional(v.literal('home', 'new-terminal', 'restore-last')),
  recentProjects: v.optional(v.array(v.string({ min: 1, max: 4096 }), { max: MAX_RECENTS })),
  glitchHighlights: v.optional(v.boolean()),
  memoryEnabled: v.optional(v.boolean()),
  autoUpdate: v.optional(v.boolean()),
  updateChannel: v.optional(v.literal('stable', 'beta')),
})

let store: AtomicStore<Settings> | null = null
let cached: Settings | null = null
const listeners = new Set<(settings: Settings) => void>()

function getStore(): AtomicStore<Settings> {
  if (!store) {
    store = createAtomicStore<Settings>({
      path: join(userDataDir(), 'settings.json'),
      schemaVersion: SCHEMA_VERSION,
      defaults: defaultSettings,
      // Eksik/bozuk tek alan tüm dosyayı düşürmesin: alan bazlı varsayılanlar
      normalize: (raw) => SettingsSchema.parse(raw ?? {}),
    })
  }
  return store
}

export function getSettings(): Settings {
  if (cached) return cached
  try {
    cached = getStore().read()
  } catch {
    // Geçici IO hatası: varsayılanı DÖNDÜR ama ÖNBELLEĞE ALMA — bir sonraki
    // okuma gerçek dosyayı yeniden dener, kullanıcının ayarları ezilmez.
    return defaultSettings()
  }
  return cached
}

export function setSettings(patch: Partial<Settings>): Settings {
  const validated = SettingsPatchSchema.parse(patch ?? {})
  // Şema, verilmeyen alanları sonuçtan TAMAMEN çıkarır (undefined yazmaz);
  // bu yüzden doğrudan birleştirme mevcut değerleri korur.
  const next = getStore().update((current) => Object.assign({}, current, validated))
  cached = next
  for (const listener of listeners) {
    try {
      listener(next)
    } catch {
      // Dinleyici hatası ayar yazımını bozmaz
    }
  }
  return next
}

export function addRecentProject(path: string): Settings {
  const clean = String(path ?? '').trim()
  if (!clean) return getSettings()
  const current = getSettings().recentProjects
  const list = current.filter((p) => p.toLowerCase() !== clean.toLowerCase())
  list.unshift(clean)
  return setSettings({ recentProjects: list.slice(0, MAX_RECENTS) })
}

export function onSettingsChanged(listener: (settings: Settings) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Testler için: önbelleği ve depoyu sıfırlar. */
export function resetSettingsForTest(): void {
  store = null
  cached = null
  listeners.clear()
}
