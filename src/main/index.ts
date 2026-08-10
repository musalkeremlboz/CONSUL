/** CONSUL — main süreç girişi.
 *
 *  Tek paket, iki bağımsız uygulama:
 *    CONSUL            → sekmeli geliştirici terminali
 *    CONSUL Developer  → CONSUL kaynak kodu üzerinde tek terminal (`--developer`)
 *
 *  İki mod ayrı süreç, ayrı `userData` ve ayrı tek-örnek kilidi kullanır;
 *  birinin çökmesi diğerini etkilemez. */
import { app, BrowserWindow, Menu, nativeTheme } from 'electron'
import { join } from 'node:path'
import { detectMode, userDataSuffix } from './app/mode'
import { createMainWindow } from './app/window'
import { createDeveloperWindow, registerDeveloperIpc } from './developer'
import { registerIpc } from './ipc'
import { getSettings } from './settings'
import { PtyManager } from './terminal/ptyManager'
import { checkForUpdates, initUpdater } from './updater'

const mode = detectMode()

// Mod başına veri dizini: ayarlar ve pencere durumu birbirine karışmaz.
// (`userData` app hazır olmadan ÖNCE ayarlanmalıdır.)
app.setPath('userData', join(app.getPath('appData'), userDataSuffix(mode)))

// Yakalanmayan hatalar süreci sessizce düşürmesin — kaydedip devam et.
// Sır içerebileceği için yalnızca hata mesajı ve yığın yazılır, ortam DEĞİL.
process.on('uncaughtException', (err) => {
  console.error('[consul] yakalanmayan hata:', err?.message ?? err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[consul] işlenmeyen reddetme:', reason instanceof Error ? reason.message : reason)
})

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  void app.whenReady().then(() => {
    Menu.setApplicationMenu(null)

    if (mode === 'developer') {
      const win = createDeveloperWindow()
      const stop = registerDeveloperIpc(win)
      app.on('before-quit', stop)
      app.on('window-all-closed', () => {
        stop()
        app.quit()
      })
      return
    }

    const ptys = new PtyManager()
    const win = createMainWindow()
    registerIpc(win, ptys)

    const settings = getSettings()
    nativeTheme.themeSource = settings.uiTheme === 'system' ? 'system' : settings.uiTheme

    void initUpdater({ autoDownload: false, channel: settings.updateChannel }).then(() => {
      // Açılışta arka planda kontrol; indirme ve kurulum kullanıcı onayıyla olur
      if (settings.autoUpdate) setTimeout(() => void checkForUpdates(), 4000)
    })

    app.on('before-quit', () => ptys.killAll())
    app.on('window-all-closed', () => {
      ptys.killAll()
      // macOS'ta uygulama pencere kapansa da açık kalır (platform geleneği)
      if (process.platform !== 'darwin') app.quit()
    })
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const next = createMainWindow()
        registerIpc(next, ptys)
      }
    })
  })
}
