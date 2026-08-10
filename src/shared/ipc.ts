/** IPC kanal adları — main ve preload aynı sabitleri kullanır.
 *
 *  Kural: renderer'a `ipcRenderer` DOĞRUDAN açılmaz; preload yalnız burada
 *  listelenen kanalları saran tipli bir yüzey sunar. Her main tarafı işleyici
 *  göndereni doğrular ve yükü şemayla denetler. */
export const IPC = {
  /* PTY */
  ptyCreate: 'pty:create',
  ptyWrite: 'pty:write',
  ptyResize: 'pty:resize',
  ptyKill: 'pty:kill',
  ptyAck: 'pty:ack',
  ptyData: 'pty:data',
  ptyExit: 'pty:exit',

  /* Uygulama */
  appGetBootFlags: 'app:getBootFlags',
  appGetSettings: 'app:getSettings',
  appSetSettings: 'app:setSettings',
  appSettingsChanged: 'app:settingsChanged',
  appPickFolder: 'app:pickFolder',
  appOpenExternal: 'app:openExternal',
  appOpenPath: 'app:openPath',
  appAddRecent: 'app:addRecent',

  /* Proje / Git */
  projectOpen: 'project:open',
  projectRefresh: 'project:refresh',

  /* CONSUL-MEMO */
  memoryStatus: 'memory:status',
  memoryEnsure: 'memory:ensure',
  memoryAppendChangelog: 'memory:appendChangelog',
  memoryOpenFolder: 'memory:openFolder',

  /* Güncelleme */
  updateStatus: 'update:status',
  updateCheck: 'update:check',
  updateDownload: 'update:download',
  updateInstall: 'update:install',
  updateChanged: 'update:changed',

  /* Dosya sistemi */
  fsListDir: 'fs:listDir',
  fsMkdir: 'fs:mkdir',

  /* Pencere */
  winMinimize: 'win:minimize',
  winMaximizeToggle: 'win:maximizeToggle',
  winClose: 'win:close',
  winIsMaximized: 'win:isMaximized',
  winMaximized: 'win:maximized',
} as const

// CONSUL Developer kanalları BİLEREK ayrı modüldedir: iki preload ortak bir
// modül paylaşırsa Rollup chunk üretir ve sandbox'lı preload çöker.
// Bkz. src/shared/devIpc.ts
