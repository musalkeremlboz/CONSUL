/** Git entegrasyonu — `git` çalıştırılabilirini KABUKSUZ çağırır.
 *
 *  Her komut `execFile(git, [argümanlar])` biçimindedir: kullanıcı yolu veya
 *  dal adı hiçbir zaman bir komut satırı string'ine gömülmez. Git kurulu
 *  değilse veya klasör bir repository değilse servis sessizce "repository yok"
 *  döner — CONSUL'un çalışmasını engellemez (talimat §14). */
import { execFile } from 'node:child_process'
import type { GitInfo } from '../../shared/types'
import { findExecutable } from '../platform/executables'
import { parseRemoteUrl } from './repository'

const TIMEOUT_MS = 8000
const MAX_BUFFER = 4 * 1024 * 1024

let gitPathCache: string | null | undefined

export function gitExecutable(): string | null {
  if (gitPathCache === undefined) gitPathCache = findExecutable('git')
  return gitPathCache
}

/** Tek bir git komutu çalıştırır. Hata durumunda null döner (asla throw etmez). */
function run(cwd: string, args: string[]): Promise<string | null> {
  const git = gitExecutable()
  if (!git) return Promise.resolve(null)
  return new Promise((resolve) => {
    execFile(
      git,
      args,
      {
        cwd,
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
        windowsHide: true,
        // Kimlik doğrulama istemleri terminali kilitlemesin
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
      },
      (err, stdout) => resolve(err ? null : stdout.toString().trim())
    )
  })
}

function emptyInfo(): GitInfo {
  return { isRepository: false, provider: 'none', dirtyFiles: -1, ahead: 0, behind: 0 }
}

/** Belirtilen klasör için repository bilgilerini toplar. */
export async function readGitInfo(cwd: string): Promise<GitInfo> {
  if (!gitExecutable()) return emptyInfo()

  const root = await run(cwd, ['rev-parse', '--show-toplevel'])
  if (!root) return emptyInfo()

  // Kalan sorgular birbirinden bağımsız — paralel çalışsın
  const [branch, remoteName, statusOut, defaultRef] = await Promise.all([
    run(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    run(root, ['remote']),
    run(root, ['status', '--porcelain=v1', '--untracked-files=normal']),
    run(root, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']),
  ])

  // İlk remote'u kullan (genelde origin)
  const firstRemote = remoteName?.split(/\r?\n/).find(Boolean)
  const remoteUrl = firstRemote ? await run(root, ['remote', 'get-url', firstRemote]) : null
  const parsed = remoteUrl ? parseRemoteUrl(remoteUrl) : null

  // Upstream yoksa bu komut hata verir → null → 0/0
  const tracking = await run(root, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'])
  let ahead = 0
  let behind = 0
  if (tracking) {
    const [b, a] = tracking.split(/\s+/).map((n) => Number.parseInt(n, 10))
    if (Number.isFinite(b)) behind = b
    if (Number.isFinite(a)) ahead = a
  }

  const info: GitInfo = {
    isRepository: true,
    root,
    provider: parsed?.provider ?? 'none',
    dirtyFiles: statusOut === null ? -1 : statusOut ? statusOut.split(/\r?\n/).filter(Boolean).length : 0,
    ahead,
    behind,
  }
  if (branch && branch !== 'HEAD') info.currentBranch = branch
  if (defaultRef) info.defaultBranch = defaultRef.replace(/^origin\//, '')
  if (remoteUrl) info.remoteUrl = remoteUrl
  if (parsed) {
    info.repositoryName = parsed.fullName
    info.shortName = parsed.name
  }
  return info
}

/** Testler için: `git` yolu önbelleğini sıfırlar. */
export function resetGitCache(): void {
  gitPathCache = undefined
}
