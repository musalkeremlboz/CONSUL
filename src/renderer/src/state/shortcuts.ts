/** Komut ve kısayol kayıt defteri.
 *
 *  Kısayollar tek yerde tanımlanır; hem `App`'in klavye dinleyicisi hem komut
 *  paleti aynı listeyi okur. Yeni bir komut eklemek için yalnız bu listeye kayıt
 *  eklemek yeterlidir — kısayol, palet girdisi ve terminale sızmama davranışı
 *  otomatik olarak doğru çalışır.
 *
 *  Platform: birincil değiştirici macOS'ta ⌘, diğerlerinde Ctrl. */

export type CommandId =
  | 'tab.new'
  | 'tab.close'
  | 'tab.next'
  | 'tab.prev'
  | 'tab.duplicate'
  | 'tab.rename'
  | 'terminal.clear'
  | 'terminal.search'
  | 'palette.open'
  | 'settings.open'
  | 'project.open'
  | 'memory.open'
  | 'font.increase'
  | 'font.decrease'
  | 'font.reset'
  | 'home.show'

export interface KeyCombo {
  key: string
  /** Ctrl (Windows/Linux) veya ⌘ (macOS). */
  primary?: boolean
  shift?: boolean
  alt?: boolean
}

export interface CommandDefinition {
  id: CommandId
  label: string
  /** Komut paletinde gösterilen kategori. */
  group: string
  combos: KeyCombo[]
}

export const IS_MAC = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent)
const MOD = IS_MAC ? '⌘' : 'Ctrl'

export const COMMANDS: CommandDefinition[] = [
  { id: 'tab.new', label: 'Yeni terminal sekmesi', group: 'Sekme', combos: [{ key: 't', primary: true }] },
  { id: 'tab.close', label: 'Sekmeyi kapat', group: 'Sekme', combos: [{ key: 'w', primary: true }] },
  { id: 'tab.next', label: 'Sonraki sekme', group: 'Sekme', combos: [{ key: 'Tab', primary: true }] },
  { id: 'tab.prev', label: 'Önceki sekme', group: 'Sekme', combos: [{ key: 'Tab', primary: true, shift: true }] },
  {
    id: 'tab.duplicate',
    label: 'Sekmeyi çoğalt',
    group: 'Sekme',
    combos: [{ key: 'd', primary: true, shift: true }],
  },
  { id: 'tab.rename', label: 'Sekmeyi yeniden adlandır', group: 'Sekme', combos: [{ key: 'r', primary: true, shift: true }] },
  { id: 'terminal.clear', label: 'Terminali temizle', group: 'Terminal', combos: [{ key: 'l', primary: true, shift: true }] },
  { id: 'terminal.search', label: 'Terminalde ara', group: 'Terminal', combos: [{ key: 'f', primary: true }] },
  { id: 'palette.open', label: 'Komut paleti', group: 'Uygulama', combos: [{ key: 'p', primary: true, shift: true }] },
  { id: 'settings.open', label: 'Ayarlar', group: 'Uygulama', combos: [{ key: ',', primary: true }] },
  { id: 'home.show', label: 'Başlangıç ekranı', group: 'Uygulama', combos: [{ key: 'h', primary: true, shift: true }] },
  { id: 'project.open', label: 'Proje klasörü aç', group: 'Proje', combos: [{ key: 'o', primary: true }] },
  { id: 'memory.open', label: 'Proje hafızasını aç (CONSUL-MEMO)', group: 'Proje', combos: [{ key: 'm', primary: true, shift: true }] },
  { id: 'font.increase', label: 'Yazı tipini büyüt', group: 'Görünüm', combos: [{ key: '=', primary: true }, { key: '+', primary: true }] },
  { id: 'font.decrease', label: 'Yazı tipini küçült', group: 'Görünüm', combos: [{ key: '-', primary: true }] },
  { id: 'font.reset', label: 'Yazı tipi boyutunu sıfırla', group: 'Görünüm', combos: [{ key: '0', primary: true }] },
]

function comboMatches(combo: KeyCombo, event: KeyboardEvent): boolean {
  const primary = IS_MAC ? event.metaKey : event.ctrlKey
  const otherPrimary = IS_MAC ? event.ctrlKey : event.metaKey
  if (otherPrimary) return false
  if (!!combo.primary !== primary) return false
  if (!!combo.shift !== event.shiftKey) return false
  if (!!combo.alt !== event.altKey) return false
  if (combo.key === 'Tab') return event.key === 'Tab'
  return event.key.toLowerCase() === combo.key.toLowerCase()
}

/** Olay hangi komuta karşılık geliyor? (yoksa null) */
export function matchCommand(event: KeyboardEvent): CommandId | null {
  for (const command of COMMANDS) {
    for (const combo of command.combos) {
      if (comboMatches(combo, event)) return command.id
    }
  }
  // Ctrl/⌘ + 1..9 → sekmeye geç (dinamik olduğu için listede yok)
  const primary = IS_MAC ? event.metaKey : event.ctrlKey
  if (primary && !event.shiftKey && !event.altKey && /^[1-9]$/.test(event.key)) return 'tab.next'
  return null
}

/** Terminale gitmemesi gereken tuş bileşimi mi? */
export function isAppShortcut(event: KeyboardEvent): boolean {
  if (matchCommand(event) !== null) return true
  const primary = IS_MAC ? event.metaKey : event.ctrlKey
  return primary && !event.shiftKey && !event.altKey && /^[1-9]$/.test(event.key)
}

/** Kısayolun insan tarafından okunabilir gösterimi (ör. "Ctrl+Shift+P"). */
export function comboLabel(combo: KeyCombo): string {
  const parts: string[] = []
  if (combo.primary) parts.push(MOD)
  if (combo.shift) parts.push('Shift')
  if (combo.alt) parts.push(IS_MAC ? '⌥' : 'Alt')
  parts.push(combo.key === 'Tab' ? 'Tab' : combo.key.toUpperCase())
  return parts.join('+')
}

export function shortcutLabel(id: CommandId): string {
  const command = COMMANDS.find((c) => c.id === id)
  return command?.combos[0] ? comboLabel(command.combos[0]) : ''
}
