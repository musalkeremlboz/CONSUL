/** Remote URL ayrıştırma ve repository adı çözümlemesi.
 *
 *  Saf fonksiyonlar: dosya sistemi, ağ veya Electron bağımlılığı YOKTUR —
 *  doğrudan birim testinden geçirilir (`tests/repository.test.ts`).
 *
 *  CONSUL-MEMO klasör adı bu modülün ürettiği `shortName` değerinden türer;
 *  bu yüzden çözümleme sırası sözleşmedir ve testle sabitlenmiştir. */
import { basename } from 'node:path'
import type { GitProvider } from '../../shared/types'
import { sanitizeSegment } from '../platform/pathUtils'

export interface ParsedRemote {
  provider: GitProvider
  /** Sunucu adı (github.com, gitlab.example.org …). */
  host: string
  /** Varsa sahip/organizasyon (iç içe gruplarda tam yol: `group/sub`). */
  owner?: string
  /** Yalnız repository adı (.git eki atılmış). */
  name: string
  /** `owner/name` — sahip yoksa yalnız `name`. */
  fullName: string
}

function providerFor(host: string): GitProvider {
  const h = host.toLowerCase()
  if (h === 'github.com' || h.endsWith('.github.com')) return 'github'
  if (h === 'gitlab.com' || h.startsWith('gitlab.')) return 'gitlab'
  if (h === 'bitbucket.org' || h.startsWith('bitbucket.')) return 'bitbucket'
  if (h === 'dev.azure.com' || h.endsWith('.visualstudio.com')) return 'azure'
  return 'other'
}

function stripGitSuffix(value: string): string {
  return value.replace(/\.git$/i, '')
}

/** Desteklenen biçimler:
 *   https://github.com/owner/repo(.git)
 *   http://host/owner/repo
 *   ssh://git@github.com:22/owner/repo.git
 *   git@github.com:owner/repo.git            (scp benzeri)
 *   git://host/owner/repo.git
 *   https://dev.azure.com/org/project/_git/repo
 *   file:///C:/yol/repo  ·  /yerel/yol/repo  */
export function parseRemoteUrl(url: string): ParsedRemote | null {
  const raw = String(url ?? '').trim()
  if (!raw) return null

  let host = ''
  let path = ''

  // `C:\repos\demo` gibi Windows yolları scp benzeri sözdizimine benzer;
  // tek harfli "sunucu" adı daima bir sürücü harfidir → yerel yol sayılır.
  const scpLike = /^[A-Za-z]:[\\/]/.test(raw) ? null : /^([^@/\\]+@)?([^:/\\]+):(?!\/\/)(.+)$/.exec(raw)
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw)
      if (parsed.protocol === 'file:') {
        const name = stripGitSuffix(basename(decodeURIComponent(parsed.pathname).replace(/[/\\]+$/, '')))
        if (!name) return null
        return { provider: 'none', host: '', name, fullName: name }
      }
      host = parsed.hostname
      path = decodeURIComponent(parsed.pathname)
    } catch {
      return null
    }
  } else if (scpLike) {
    host = scpLike[2]
    path = scpLike[3]
  } else {
    // Yerel yol (git remote bir klasör olabilir)
    const name = stripGitSuffix(basename(raw.replace(/[/\\]+$/, '')))
    if (!name) return null
    return { provider: 'none', host: '', name, fullName: name }
  }

  const segments = path.split(/[/\\]+/).filter(Boolean).map(stripGitSuffix)
  if (segments.length === 0) return null

  const provider = providerFor(host)

  // Azure DevOps: org/project/_git/repo
  const gitIdx = segments.indexOf('_git')
  if (provider === 'azure' && gitIdx > 0 && gitIdx < segments.length - 1) {
    const name = segments[segments.length - 1]
    const owner = segments.slice(0, gitIdx).join('/')
    return { provider, host, owner, name, fullName: `${owner}/${name}` }
  }

  const name = segments[segments.length - 1]
  if (!name) return null
  const ownerParts = segments.slice(0, -1)
  const owner = ownerParts.length > 0 ? ownerParts.join('/') : undefined
  return { provider, host, owner, name, fullName: owner ? `${owner}/${name}` : name }
}

/** CONSUL-MEMO klasör adı için repository adını çözer.
 *
 *  Öncelik sırası (talimat §10):
 *   1. GitHub (ya da başka bir sağlayıcı) remote'undan repository adı
 *   2. Remote yoksa Git repository kök klasörünün adı
 *   3. Git repository değilse proje klasörünün adı
 *
 *  Sonuç daima dosya sistemi için güvenli tek bir segmenttir. */
export function resolveMemoName(input: {
  remoteUrl?: string | null
  repositoryRoot?: string | null
  projectPath: string
}): string {
  const remote = input.remoteUrl ? parseRemoteUrl(input.remoteUrl) : null
  if (remote?.name) return sanitizeSegment(remote.name)

  const root = input.repositoryRoot?.replace(/[/\\]+$/, '')
  if (root) {
    const name = basename(root)
    if (name) return sanitizeSegment(name)
  }

  const project = input.projectPath.replace(/[/\\]+$/, '')
  const name = basename(project)
  // `C:\` gibi sürücü kökünde basename boş kalır
  return sanitizeSegment(name || project.replace(/[:\\/]/g, '') || 'proje')
}

/** Remote URL'den tarayıcıda açılabilir HTTPS adresi (yoksa null). */
export function webUrlFor(remote: ParsedRemote | null): string | null {
  if (!remote || !remote.host || remote.provider === 'none') return null
  const path = remote.owner ? `${remote.owner}/${remote.name}` : remote.name
  return `https://${remote.host}/${path}`
}
