/** Başlangıç ekranı — proje aç, son projeler, kabuk seçimi.
 *
 *  Terminal alanını daraltmaz: yalnız hiç sekme yokken ya da kullanıcı açıkça
 *  istediğinde görünür. */
import type { BootFlags } from '../../../shared/types'
import { shortcutLabel } from '../state/shortcuts'

interface Props {
  boot: BootFlags | null
  recents: string[]
  defaultShellId: string
  onPickFolder: () => void
  onOpenRecent: (path: string) => void
  onNewTerminal: (shellId: string) => void
}

function shortPath(path: string): string {
  const sep = path.includes('\\') ? '\\' : '/'
  const parts = path.split(/[\\/]/).filter(Boolean)
  if (parts.length <= 3) return path
  return `${parts[0]}${sep}…${sep}${parts.slice(-2).join(sep)}`
}

export function HomeView({ boot, recents, defaultShellId, onPickFolder, onOpenRecent, onNewTerminal }: Props) {
  return (
    <div className="c-home">
      <div className="c-home__inner">
        <h1 className="c-home__title" lang="en">
          CONSUL
        </h1>
        <p className="c-home__subtitle">
          GELİŞTİRİCİ TERMİNALİ{boot ? ` · v${boot.version}` : ''}
        </p>
        <div className="c-home__rule" aria-hidden="true" />

        <div className="c-home__actions">
          <button type="button" className="c-btn c-btn--primary c-btn--lg" onClick={onPickFolder}>
            PROJE KLASÖRÜ AÇ
            <span className="c-btn__hint">{shortcutLabel('project.open')}</span>
          </button>
          <button
            type="button"
            className="c-btn c-btn--lg"
            onClick={() => onNewTerminal(defaultShellId)}
          >
            YENİ TERMİNAL
            <span className="c-btn__hint">{shortcutLabel('tab.new')}</span>
          </button>
        </div>

        {recents.length > 0 && (
          <section className="c-home__section">
            <h2 className="c-home__section-title">SON PROJELER</h2>
            <ul className="c-home__recents">
              {recents.map((path) => (
                <li key={path}>
                  <button type="button" className="c-home__recent" onClick={() => onOpenRecent(path)} title={path}>
                    <span className="c-home__recent-name">
                      {path.split(/[\\/]/).filter(Boolean).pop() ?? path}
                    </span>
                    <span className="c-home__recent-path" lang="en">
                      {shortPath(path)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {boot && boot.shells.length > 0 && (
          <section className="c-home__section">
            <h2 className="c-home__section-title">KABUKLAR</h2>
            <ul className="c-home__shells">
              {boot.shells.map((shell) => (
                <li key={shell.id}>
                  <button type="button" className="c-chip" onClick={() => onNewTerminal(shell.id)}>
                    {shell.label}
                    {shell.id === defaultShellId && <span className="c-chip__mark">varsayılan</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
