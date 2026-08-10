/** Main ↔ preload ↔ renderer arasında paylaşılan veri tipleri.
 *
 *  UYARI: bu tipler bir GÜVEN SINIRI DEĞİLDİR. Renderer'dan gelen her yük
 *  main tarafında `src/core/schema.ts` ile ayrıca doğrulanır. */

export type ShellKind = 'powershell' | 'cmd' | 'posix' | 'wsl'

/** Renderer'a açılan kabuk bilgisi — çalıştırılabilir YOL içermez. */
export interface ShellInfo {
  id: string
  label: string
  kind: ShellKind
}

export type UiThemeMode = 'dark' | 'light' | 'system'
export type CursorStyle = 'block' | 'bar' | 'underline'
export type StartupBehavior = 'home' | 'new-terminal' | 'restore-last'
export type UpdateChannel = 'stable' | 'beta'

export interface Settings {
  /** Yeni sekmelerin kullanacağı kabuk kimliği; null → platform varsayılanı. */
  defaultShellId: string | null
  /** Klasör seçicinin açılacağı dizin; null → Belgeler. */
  defaultProjectDir: string | null
  fontFamily: string
  fontSize: number
  lineHeight: number
  cursorStyle: CursorStyle
  cursorBlink: boolean
  /** Terminal renk şeması — arayüz temasından BAĞIMSIZDIR. */
  terminalScheme: string
  /** Arayüz teması: koyu / açık / sistemi izle. */
  uiTheme: UiThemeMode
  scrollback: number
  startupBehavior: StartupBehavior
  recentProjects: string[]
  /** CONSUL imzası: kalın (bold) çıktıya glitch vurgusu. */
  glitchHighlights: boolean
  /** CONSUL-MEMO proje hafızası yazımı. */
  memoryEnabled: boolean
  autoUpdate: boolean
  updateChannel: UpdateChannel
}

export interface BootFlags {
  version: string
  platform: 'windows' | 'macos' | 'linux'
  shells: ShellInfo[]
  defaultShellId: string
  /** Açılışta komut satırından gelen proje yolu (varsa). */
  initialProject?: string
}

/* ── PTY ───────────────────────────────────────────────────────── */

export interface PtyCreateRequest {
  shellId: string
  cwd: string
  cols: number
  rows: number
}

export interface PtyCreateResponse {
  id: string
}

export interface PtyDataEvent {
  id: string
  data: string
}

export interface PtyExitEvent {
  id: string
  exitCode: number
  signal: number | null
}

/* ── Proje / Git ───────────────────────────────────────────────── */

export type GitProvider = 'github' | 'gitlab' | 'bitbucket' | 'azure' | 'other' | 'none'

export interface GitInfo {
  isRepository: boolean
  /** Repository kök dizini (proje kökünden farklı olabilir). */
  root?: string
  /** `owner/repo` ya da yalnız `repo`. */
  repositoryName?: string
  /** Yalnız repo adı (CONSUL-MEMO klasör adı bundan türer). */
  shortName?: string
  currentBranch?: string
  defaultBranch?: string
  remoteUrl?: string
  provider: GitProvider
  /** Çalışma ağacı: değişen dosya sayısı; -1 → okunamadı. */
  dirtyFiles: number
  ahead: number
  behind: number
}

export interface ProjectInfo {
  /** Kullanıcının açtığı klasör. */
  path: string
  /** Arayüzde gösterilen ad. */
  name: string
  git: GitInfo
  /** CONSUL-MEMO klasörünün tam yolu (hafıza kapalıysa null). */
  memoDir: string | null
}

/* ── CONSUL-MEMO ───────────────────────────────────────────────── */

export interface MemoryFileInfo {
  name: string
  path: string
  bytes: number
  updatedAt: string
}

export interface MemoryStatus {
  enabled: boolean
  /** Hafıza kökü: <Belgeler>/CONSUL-MEMO */
  root: string
  /** Aktif projenin hafıza klasörü. */
  projectDir: string | null
  files: MemoryFileInfo[]
  /** Son hata (Türkçe) — kullanıcıya gösterilir. */
  error?: string
}

export interface ChangelogInput {
  title: string
  entries: string[]
  files?: string[]
}

/* ── Güncelleme ────────────────────────────────────────────────── */

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'up-to-date'
  | 'error'
  | 'unsupported'

export interface UpdateStatus {
  phase: UpdatePhase
  currentVersion: string
  newVersion?: string
  releaseNotes?: string
  percent?: number
  /** Türkçe, kullanıcıya gösterilebilir hata mesajı. */
  error?: string
}

/* ── Klasör gezgini ────────────────────────────────────────────── */

export interface DirEntry {
  name: string
  path: string
}

export interface ListDirResult {
  path: string
  parent: string | null
  dirs: DirEntry[]
  quick: { label: string; path: string }[]
  error?: string
}
