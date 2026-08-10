/** Başlık çubuğu — marka, aktif proje ve pencere denetimleri.
 *
 *  Sürüklenebilir bölge CSS'te `-webkit-app-region: drag` ile tanımlanır;
 *  düğmeler `no-drag` alanındadır. */
import type { ProjectInfo } from '../../../shared/types'
import { WindowControls } from '../ui/WindowControls'
import { shortcutLabel } from '../state/shortcuts'

interface Props {
  project: ProjectInfo | null
  onOpenProject: () => void
  onOpenPalette: () => void
  onOpenSettings: () => void
}

/** Uzun yolu ortadan kısaltır; tam yol `title` ipucunda kalır. */
function shortPath(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  if (parts.length <= 3) return path
  return `${parts[0]}${path.includes('\\') ? '\\' : '/'}…${path.includes('\\') ? '\\' : '/'}${parts.slice(-2).join(path.includes('\\') ? '\\' : '/')}`
}

export function TitleBar({ project, onOpenProject, onOpenPalette, onOpenSettings }: Props) {
  return (
    <header className="c-titlebar">
      <div className="c-titlebar__brand" lang="en">
        CONSUL
      </div>

      <button
        type="button"
        className="c-titlebar__project"
        onClick={onOpenProject}
        title={project ? project.path : 'Proje klasörü aç'}
      >
        {project ? (
          <>
            <span className="c-titlebar__project-name">{project.name}</span>
            <span className="c-titlebar__project-path" lang="en">
              {shortPath(project.path)}
            </span>
          </>
        ) : (
          <span className="c-titlebar__project-empty">PROJE AÇ</span>
        )}
      </button>

      <div className="c-titlebar__actions">
        <button
          type="button"
          className="c-iconbtn"
          onClick={onOpenPalette}
          title={`Komut paleti (${shortcutLabel('palette.open')})`}
          aria-label="Komut paleti"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 4h12M2 8h12M2 12h7" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </button>
        <button
          type="button"
          className="c-iconbtn"
          onClick={onOpenSettings}
          title={`Ayarlar (${shortcutLabel('settings.open')})`}
          aria-label="Ayarlar"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path
              d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M13 3l-1.5 1.5M4.5 11.5L3 13"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
        </button>
        <WindowControls />
      </div>
    </header>
  )
}
