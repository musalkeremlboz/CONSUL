/** Ayarlar — kabuk, görünüm, terminal, hafıza ve güncelleme.
 *
 *  Her değişiklik anında main sürece yazılır ve şemadan geçer; geçersiz değer
 *  kalıcılaşmaz. Platforma özgü ayarlar yalnız ilgili platformda gösterilir. */
import type { BootFlags, Settings, UpdateStatus } from '../../../shared/types'
import { TERMINAL_SCHEMES } from '../../../shared/theme'
import { Modal } from '../ui/Modal'
import { MAX_FONT, MIN_FONT } from '../state/fontLimits'

interface Props {
  settings: Settings
  boot: BootFlags | null
  update: UpdateStatus | null
  memoRoot: string | null
  onPatch: (patch: Partial<Settings>) => void
  onCheckUpdate: () => void
  onDownloadUpdate: () => void
  onInstallUpdate: () => void
  onOpenMemoRoot: () => void
  onDismiss: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="c-settings__section">
      <h3 className="c-settings__title">{title}</h3>
      <div className="c-settings__body">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="c-settings__row">
      <div className="c-settings__label">
        <span>{label}</span>
        {hint && <span className="c-settings__hint">{hint}</span>}
      </div>
      <div className="c-settings__control">{children}</div>
    </div>
  )
}

export function SettingsPanel({
  settings,
  boot,
  update,
  memoRoot,
  onPatch,
  onCheckUpdate,
  onDownloadUpdate,
  onInstallUpdate,
  onOpenMemoRoot,
  onDismiss,
}: Props) {
  return (
    <Modal title="AYARLAR" onDismiss={onDismiss} wide>
      <Section title="KABUK">
        <Row label="Varsayılan kabuk" hint="Yeni sekmeler bu kabukla açılır">
          <select
            className="c-select"
            value={settings.defaultShellId ?? boot?.defaultShellId ?? ''}
            onChange={(event) => onPatch({ defaultShellId: event.target.value })}
          >
            {(boot?.shells ?? []).map((shell) => (
              <option key={shell.id} value={shell.id}>
                {shell.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Başlangıç davranışı">
          <select
            className="c-select"
            value={settings.startupBehavior}
            onChange={(event) =>
              onPatch({ startupBehavior: event.target.value as Settings['startupBehavior'] })
            }
          >
            <option value="home">Başlangıç ekranı</option>
            <option value="new-terminal">Yeni terminal aç</option>
            <option value="restore-last">Son projeyi aç</option>
          </select>
        </Row>
      </Section>

      <Section title="GÖRÜNÜM">
        <Row label="Arayüz teması">
          <select
            className="c-select"
            value={settings.uiTheme}
            onChange={(event) => onPatch({ uiTheme: event.target.value as Settings['uiTheme'] })}
          >
            <option value="dark">Koyu</option>
            <option value="light">Açık</option>
            <option value="system">Sistemi izle</option>
          </select>
        </Row>
        <Row label="Terminal renk şeması" hint="Arayüz temasından bağımsızdır">
          <select
            className="c-select"
            value={settings.terminalScheme}
            onChange={(event) => onPatch({ terminalScheme: event.target.value })}
          >
            {TERMINAL_SCHEMES.map((scheme) => (
              <option key={scheme.id} value={scheme.id}>
                {scheme.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Vurgu efekti" hint="Kalın çıktıya CONSUL imzası glitch vurgusu">
          <label className="c-switch">
            <input
              type="checkbox"
              checked={settings.glitchHighlights}
              onChange={(event) => onPatch({ glitchHighlights: event.target.checked })}
            />
            <span />
          </label>
        </Row>
      </Section>

      <Section title="TERMİNAL">
        <Row label="Yazı tipi" hint="Boş bırakılırsa gömülü tek aralıklı font kullanılır">
          <input
            className="c-input"
            value={settings.fontFamily}
            placeholder="IBM Plex Mono"
            onChange={(event) => onPatch({ fontFamily: event.target.value })}
          />
        </Row>
        <Row label="Yazı boyutu">
          <input
            className="c-input c-input--num"
            type="number"
            min={MIN_FONT}
            max={MAX_FONT}
            value={settings.fontSize}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (Number.isFinite(next)) onPatch({ fontSize: Math.min(MAX_FONT, Math.max(MIN_FONT, next)) })
            }}
          />
        </Row>
        <Row label="Satır yüksekliği">
          <input
            className="c-input c-input--num"
            type="number"
            min={0.8}
            max={3}
            step={0.05}
            value={settings.lineHeight}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (Number.isFinite(next)) onPatch({ lineHeight: Math.min(3, Math.max(0.8, next)) })
            }}
          />
        </Row>
        <Row label="İmleç biçimi">
          <select
            className="c-select"
            value={settings.cursorStyle}
            onChange={(event) => onPatch({ cursorStyle: event.target.value as Settings['cursorStyle'] })}
          >
            <option value="block">Blok</option>
            <option value="bar">Çizgi</option>
            <option value="underline">Alt çizgi</option>
          </select>
        </Row>
        <Row label="İmleç yanıp sönsün">
          <label className="c-switch">
            <input
              type="checkbox"
              checked={settings.cursorBlink}
              onChange={(event) => onPatch({ cursorBlink: event.target.checked })}
            />
            <span />
          </label>
        </Row>
        <Row label="Geçmiş satır sayısı" hint="Büyük değerler bellek kullanımını artırır">
          <input
            className="c-input c-input--num"
            type="number"
            min={200}
            max={200000}
            step={1000}
            value={settings.scrollback}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (Number.isFinite(next)) onPatch({ scrollback: Math.min(200000, Math.max(200, Math.round(next))) })
            }}
          />
        </Row>
      </Section>

      <Section title="PROJE HAFIZASI">
        <Row label="CONSUL-MEMO" hint={memoRoot ?? 'Belgeler klasörünüz altında oluşturulur'}>
          <label className="c-switch">
            <input
              type="checkbox"
              checked={settings.memoryEnabled}
              onChange={(event) => onPatch({ memoryEnabled: event.target.checked })}
            />
            <span />
          </label>
        </Row>
        <Row label="Hafıza klasörü">
          <button type="button" className="c-btn" onClick={onOpenMemoRoot}>
            KLASÖRÜ AÇ
          </button>
        </Row>
      </Section>

      <Section title="GÜNCELLEME">
        <Row label="Otomatik kontrol" hint="Açılışta arka planda yeni sürüm arar">
          <label className="c-switch">
            <input
              type="checkbox"
              checked={settings.autoUpdate}
              onChange={(event) => onPatch({ autoUpdate: event.target.checked })}
            />
            <span />
          </label>
        </Row>
        <Row label="Kanal">
          <select
            className="c-select"
            value={settings.updateChannel}
            onChange={(event) => onPatch({ updateChannel: event.target.value as Settings['updateChannel'] })}
          >
            <option value="stable">Kararlı</option>
            <option value="beta">Beta</option>
          </select>
        </Row>
        <Row label="Durum" hint={update?.error}>
          <div className="c-settings__update">
            <span className="c-settings__version" lang="en">
              v{update?.currentVersion ?? boot?.version ?? '—'}
            </span>
            {update?.phase === 'available' && (
              <button type="button" className="c-btn c-btn--primary" onClick={onDownloadUpdate}>
                v{update.newVersion} İNDİR
              </button>
            )}
            {update?.phase === 'downloading' && <span className="c-settings__hint">İndiriliyor… %{update.percent ?? 0}</span>}
            {update?.phase === 'ready' && (
              <button type="button" className="c-btn c-btn--primary" onClick={onInstallUpdate}>
                KUR VE YENİDEN BAŞLAT
              </button>
            )}
            {(update?.phase === 'idle' ||
              update?.phase === 'up-to-date' ||
              update?.phase === 'error' ||
              update?.phase === 'unsupported') && (
              <button type="button" className="c-btn" onClick={onCheckUpdate}>
                GÜNCELLEME ARA
              </button>
            )}
            {update?.phase === 'up-to-date' && <span className="c-settings__hint">Güncel.</span>}
          </div>
        </Row>
      </Section>
    </Modal>
  )
}
