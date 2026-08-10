/** Temalı klasör seçici için dizin listeleme.
 *
 *  Yalnız klasörler listelenir; dosya içeriği okunmaz. Renderer'a giden her
 *  yol gerçek bir dizindir. Erişilemeyen dizin hata mesajıyla döner, süreç
 *  düşmez. */
import { existsSync, mkdirSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { ListDirResult } from '../../shared/types'
import { homeDir, quickAccessDirs, sanitizeSegment } from '../platform/paths'

export function listDir(path?: string): ListDirResult {
  const quick = quickAccessDirs()
  const fallback = quick[0]?.path ?? homeDir()
  let target = path && existsSync(path) ? path : fallback
  try {
    target = realpathSync(target)
    if (!statSync(target).isDirectory()) target = fallback
  } catch {
    target = fallback
  }

  try {
    const dirs = readdirSync(target, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('$'))
      .map((e) => ({ name: e.name, path: join(target, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    const parent = dirname(target)
    return { path: target, parent: parent === target ? null : parent, dirs, quick }
  } catch (err) {
    return {
      path: target,
      parent: null,
      dirs: [],
      quick,
      error: `Klasör okunamadı: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

export function makeDir(parent: string, name: string): { ok: boolean; path?: string; error?: string } {
  const cleanParent = String(parent ?? '').trim()
  if (!cleanParent || !existsSync(cleanParent)) return { ok: false, error: 'Üst klasör bulunamadı.' }
  const raw = String(name ?? '').trim()
  if (!raw) return { ok: false, error: 'Klasör adı boş olamaz.' }
  // Yol ayracı ve yasak karakterler temizlenir → alt dizine/dışarı yazılamaz
  const clean = sanitizeSegment(raw, '')
  if (!clean) return { ok: false, error: 'Geçersiz klasör adı.' }
  try {
    const path = join(cleanParent, clean)
    mkdirSync(path, { recursive: true })
    return { ok: true, path }
  } catch (err) {
    return { ok: false, error: `Klasör oluşturulamadı: ${err instanceof Error ? err.message : String(err)}` }
  }
}
