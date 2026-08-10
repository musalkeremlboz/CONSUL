/** Arayüz temasının köke uygulanması.
 *
 *  Token'lar `src/shared/theme.ts`ten gelir; burada yalnız DOM'a yazılır.
 *  Önceki temadan kalan değişkenler temizlenir ki tema geçişlerinde bayat
 *  değer kalmasın. */
import { UI_THEMES, type Appearance } from '../../../shared/theme'
import type { UiThemeMode } from '../../../shared/types'

let appliedKeys: string[] = []

/** `system` seçiliyse işletim sisteminin tercihini okur. */
export function resolveAppearance(mode: UiThemeMode): Appearance {
  if (mode !== 'system') return mode
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function applyUiTheme(mode: UiThemeMode): Appearance {
  const appearance = resolveAppearance(mode)
  const theme = UI_THEMES[appearance]
  const root = document.documentElement

  for (const key of appliedKeys) root.style.removeProperty(key)
  for (const [key, value] of Object.entries(theme.tokens)) root.style.setProperty(key, value)
  appliedKeys = Object.keys(theme.tokens)

  root.dataset.appearance = appearance
  return appearance
}

/** Sistem teması değişimini izler (yalnız `system` modunda anlamlıdır). */
export function watchSystemAppearance(cb: () => void): () => void {
  const query = window.matchMedia?.('(prefers-color-scheme: light)')
  if (!query) return () => undefined
  query.addEventListener('change', cb)
  return () => query.removeEventListener('change', cb)
}
