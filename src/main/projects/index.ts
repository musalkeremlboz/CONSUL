/** ProjectManager — bir klasörü "proje" olarak açar.
 *
 *  Proje = yerel klasör. Klasör bir Git repository ise repository bilgileri
 *  otomatik okunur; DEĞİLSE proje yine tam olarak çalışır (talimat §14).
 *  GitHub bağlantısının olmaması hiçbir yeteneği kapatmaz. */
import { existsSync, realpathSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import type { ProjectInfo } from '../../shared/types'
import { readGitInfo } from './git'
import { openProjectMemory } from '../memory'
import { getSettings } from '../settings'

export class ProjectError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectError'
  }
}

/** Kullanıcıdan gelen yolu doğrular ve sembolik bağlantıları çözer. */
export function normalizeProjectPath(input: string): string {
  const raw = String(input ?? '').trim()
  if (!raw) throw new ProjectError('Proje yolu boş olamaz.')
  if (!existsSync(raw)) throw new ProjectError(`Klasör bulunamadı: ${raw}`)
  let resolved: string
  try {
    resolved = realpathSync(raw)
  } catch {
    throw new ProjectError(`Klasör açılamadı: ${raw}`)
  }
  try {
    if (!statSync(resolved).isDirectory()) throw new ProjectError(`Bu bir klasör değil: ${raw}`)
  } catch (err) {
    if (err instanceof ProjectError) throw err
    throw new ProjectError(`Klasör okunamadı: ${raw}`)
  }
  return resolved
}

/** Projeyi açar: Git bilgisi + (etkinse) CONSUL-MEMO hazırlığı. */
export async function openProject(input: string): Promise<ProjectInfo> {
  const path = normalizeProjectPath(input)
  const git = await readGitInfo(path)
  const settings = getSettings()

  const memory = openProjectMemory({ projectPath: path, git, enabled: settings.memoryEnabled })

  return {
    path,
    name: git.shortName ?? basename(path.replace(/[/\\]+$/, '')) ?? path,
    git,
    memoDir: memory.projectDir,
  }
}
