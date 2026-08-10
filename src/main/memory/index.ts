/** MemoryService — CONSUL-MEMO'nun tek dış yüzeyi.
 *
 *  Katmanlar (talimat §13):
 *    ProjectResolver / RepositoryResolver → projects/{git,repository}.ts
 *    MemoDirectoryManager                 → memoDirectory.ts
 *    Purpose/Architecture/ElementRegistry → documents.ts
 *    ChangelogManager                     → appendChangelog (aşağıda)
 *
 *  Servis UI'dan tamamen bağımsızdır: Electron `app` dışında hiçbir arayüz
 *  bağımlılığı yoktur ve doğrudan test edilebilir. */
import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { ChangelogInput, GitInfo, MemoryStatus } from '../../shared/types'
import { memoRootDir } from '../platform/paths'
import { resolveMemoName } from '../projects/repository'
import { ensureDocuments, listMemoFiles, type DocumentContext } from './documents'
import { writeFileAtomicText } from './fsText'
import { appendChangelog as appendChangelogText, localDateStamp } from './markdown'
import { resolveMemoDir } from './memoDirectory'
import { readProjectFacts } from './projectFacts'

export interface OpenOptions {
  projectPath: string
  git: GitInfo
  /** Ayarlardan gelen "hafıza açık mı" bayrağı. */
  enabled: boolean
}

export interface OpenResult extends MemoryStatus {
  /** Repository yeniden adlandırıldığı için klasör taşındıysa eski ad. */
  renamedFrom?: string
}

function projectDisplayName(projectPath: string, git: GitInfo): string {
  if (git.shortName) return git.shortName
  const name = basename(projectPath.replace(/[/\\]+$/, ''))
  return name || projectPath
}

function buildContext(projectPath: string, git: GitInfo): DocumentContext {
  return {
    projectName: projectDisplayName(projectPath, git),
    projectPath,
    git,
    facts: readProjectFacts(projectPath),
  }
}

/** Proje açıldığında hafıza klasörünü hazırlar ve belgeleri tazeler. */
export function openProjectMemory(opts: OpenOptions): OpenResult {
  const root = memoRootDir()
  if (!opts.enabled) {
    return { enabled: false, root, projectDir: null, files: [] }
  }
  if (!opts.projectPath || !existsSync(opts.projectPath)) {
    return { enabled: true, root, projectDir: null, files: [], error: 'Proje klasörü bulunamadı.' }
  }

  try {
    const desiredName = resolveMemoName({
      remoteUrl: opts.git.remoteUrl ?? null,
      repositoryRoot: opts.git.root ?? null,
      projectPath: opts.projectPath,
    })
    const resolved = resolveMemoDir({
      root,
      projectPath: opts.projectPath,
      desiredName,
      repositoryName: opts.git.repositoryName,
    })
    ensureDocuments(resolved.dir, buildContext(opts.projectPath, opts.git))

    const result: OpenResult = {
      enabled: true,
      root,
      projectDir: resolved.dir,
      files: listMemoFiles(resolved.dir),
    }
    if (resolved.renamedFrom) result.renamedFrom = resolved.renamedFrom
    return result
  } catch (err) {
    return {
      enabled: true,
      root,
      projectDir: null,
      files: [],
      error: `Proje hafızası hazırlanamadı: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/** CHANGELOG.md'ye kayıt ekler (append-only). Klasör hazır değilse hazırlar. */
export function appendProjectChangelog(opts: OpenOptions & { input: ChangelogInput }): MemoryStatus {
  const status = openProjectMemory(opts)
  if (!status.projectDir) return status

  const title = String(opts.input?.title ?? '').trim()
  const entries = (opts.input?.entries ?? []).map((e) => String(e)).filter((e) => e.trim())
  if (!title || entries.length === 0) {
    return { ...status, error: 'Değişiklik kaydı için başlık ve en az bir madde gerekli.' }
  }

  const path = join(status.projectDir, 'CHANGELOG.md')
  let current = ''
  try {
    if (existsSync(path)) current = readFileSync(path, 'utf8')
  } catch {
    // Okunamayan dosyanın üzerine YAZMA — veri kaybı riski
    return { ...status, error: 'CHANGELOG.md okunamadı; kayıt eklenmedi.' }
  }

  const next = appendChangelogText(current, {
    date: localDateStamp(),
    title,
    bullets: entries,
    files: opts.input.files?.filter((f) => String(f).trim()),
  })

  try {
    writeFileAtomicText(path, next)
  } catch (err) {
    return { ...status, error: `CHANGELOG.md yazılamadı: ${err instanceof Error ? err.message : String(err)}` }
  }
  return { ...status, files: listMemoFiles(status.projectDir) }
}
