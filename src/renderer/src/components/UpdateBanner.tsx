/** Güncelleme bildirimi — kullanıcıyı hiçbir zaman zorlamaz.
 *
 *  Çalışan terminal oturumu varken "kur ve yeniden başlat" ek onay ister:
 *  terminaldeki süreçler veri kaybına yol açacak biçimde kapatılmaz (§41). */
import type { UpdateStatus } from '../../../shared/types'

interface Props {
  status: UpdateStatus
  hasRunningSessions: boolean
  onDownload: () => void
  onInstall: () => void
  onDismiss: () => void
}

export function UpdateBanner({ status, hasRunningSessions, onDownload, onInstall, onDismiss }: Props) {
  if (status.phase !== 'available' && status.phase !== 'downloading' && status.phase !== 'ready') return null

  return (
    <div className="c-update" role="status">
      <div className="c-update__text">
        {status.phase === 'available' && (
          <>
            <strong>Yeni sürüm hazır: v{status.newVersion}</strong>
            {status.releaseNotes && <span className="c-update__notes">{status.releaseNotes.slice(0, 180)}</span>}
          </>
        )}
        {status.phase === 'downloading' && <strong>Güncelleme indiriliyor… %{status.percent ?? 0}</strong>}
        {status.phase === 'ready' && (
          <>
            <strong>v{status.newVersion} kurulmaya hazır.</strong>
            {hasRunningSessions && (
              <span className="c-update__notes">
                Çalışan terminal oturumlarınız var; kurulum uygulamayı yeniden başlatır.
              </span>
            )}
          </>
        )}
      </div>
      <div className="c-update__actions">
        {status.phase === 'available' && (
          <button type="button" className="c-btn c-btn--primary" onClick={onDownload}>
            İNDİR
          </button>
        )}
        {status.phase === 'ready' && (
          <button type="button" className="c-btn c-btn--primary" onClick={onInstall}>
            KUR VE YENİDEN BAŞLAT
          </button>
        )}
        <button type="button" className="c-btn" onClick={onDismiss}>
          SONRA
        </button>
      </div>
    </div>
  )
}
