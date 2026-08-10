/** Durum çubuğu — dal, yol, kabuk, oturum durumu ve hafıza göstergesi. */
import type { ProjectInfo, ShellInfo } from '../../../shared/types'
import type { Tab } from '../state/tabs'

interface Props {
  project: ProjectInfo | null
  tab: Tab | null
  shells: ShellInfo[]
  memoDir: string | null
  onOpenMemo: () => void
}

export function StatusBar({ project, tab, shells, memoDir, onOpenMemo }: Props) {
  const git = project?.git
  const shellLabel = shells.find((s) => s.id === tab?.shellId)?.label ?? tab?.shellId ?? '—'

  return (
    <footer className="c-status">
      {git?.isRepository ? (
        <span className="c-status__item" title={git.remoteUrl ?? 'yerel repository'}>
          <span className="c-status__key">DAL</span>
          <span className="c-status__value">{git.currentBranch ?? 'HEAD'}</span>
          {git.dirtyFiles > 0 && <span className="c-status__badge">{git.dirtyFiles}±</span>}
          {git.ahead > 0 && <span className="c-status__badge">↑{git.ahead}</span>}
          {git.behind > 0 && <span className="c-status__badge">↓{git.behind}</span>}
        </span>
      ) : (
        <span className="c-status__item">
          <span className="c-status__key">GIT</span>
          <span className="c-status__value">yok</span>
        </span>
      )}

      <span className="c-status__item c-status__item--grow" title={tab?.cwd ?? ''}>
        <span className="c-status__key">YOL</span>
        <span className="c-status__value c-status__value--path" lang="en">
          {tab?.cwd ?? '—'}
        </span>
      </span>

      <span className="c-status__item">
        <span className="c-status__key">KABUK</span>
        <span className="c-status__value">{shellLabel}</span>
      </span>

      {memoDir && (
        <button
          type="button"
          className="c-status__item c-status__item--button"
          onClick={onOpenMemo}
          title={memoDir}
        >
          <span className="c-status__key">HAFIZA</span>
          <span className="c-status__value">CONSUL-MEMO</span>
        </button>
      )}

      <span className="c-status__item">
        <span className={'c-status__dot' + (tab?.status === 'exited' ? ' is-exited' : '')} aria-hidden="true" />
        <span className="c-status__value">{tab ? (tab.status === 'exited' ? 'sonlandı' : 'çalışıyor') : 'boşta'}</span>
      </span>
    </footer>
  )
}
