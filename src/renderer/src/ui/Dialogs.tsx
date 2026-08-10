/** Onay ve metin girişi diyalogları (OS `confirm`/`prompt` yerine). */
import { useState } from 'react'
import { Modal } from './Modal'

interface ConfirmProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'ONAYLA',
  cancelLabel = 'VAZGEÇ',
  danger,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  return (
    <Modal
      title={title}
      onDismiss={onCancel}
      footer={
        <>
          <button type="button" className="c-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={'c-btn c-btn--primary' + (danger ? ' c-btn--danger' : '')}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="c-dialog__message">{message}</p>
    </Modal>
  )
}

interface PromptProps {
  title: string
  label: string
  initialValue?: string
  placeholder?: string
  confirmLabel?: string
  onSubmit: (value: string) => void
  onCancel: () => void
}

export function PromptDialog({
  title,
  label,
  initialValue = '',
  placeholder,
  confirmLabel = 'KAYDET',
  onSubmit,
  onCancel,
}: PromptProps) {
  const [value, setValue] = useState(initialValue)
  const submit = (): void => {
    const clean = value.trim()
    if (clean) onSubmit(clean)
  }

  return (
    <Modal
      title={title}
      onDismiss={onCancel}
      footer={
        <>
          <button type="button" className="c-btn" onClick={onCancel}>
            VAZGEÇ
          </button>
          <button type="button" className="c-btn c-btn--primary" onClick={submit} disabled={!value.trim()}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <label className="c-field">
        <span className="c-field__label">{label}</span>
        <input
          className="c-input"
          value={value}
          placeholder={placeholder}
          autoFocus
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
        />
      </label>
    </Modal>
  )
}
