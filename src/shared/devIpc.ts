/** CONSUL Developer'ın IPC kanalları.
 *
 *  Neden ayrı dosya: sandbox'lı preload betikleri **kendi kendine yeten tek
 *  dosya** olmak zorundadır — Electron onları `require` zinciri olmadan yükler.
 *  İki preload aynı modülü içe aktarırsa Rollup ortak bir "chunk" üretir ve
 *  preload çalışma zamanında `module not found: ./chunks/…` ile ÇÖKER
 *  (pencere açılır ama arayüz boştur).
 *
 *  Bu yüzden CONSUL ve CONSUL Developer kanal sabitleri BİLEREK ayrı
 *  modüllerdedir; ortak bir modülü paylaşmazlar.
 *  Regresyon koruması: `scripts/check-preload.mjs` (derlemeden sonra çalışır). */
export const DEV_IPC = {
  bootstrap: 'dev:bootstrap',
  ptyWrite: 'dev:ptyWrite',
  ptyResize: 'dev:ptyResize',
  ptyData: 'dev:ptyData',
  ptyExit: 'dev:ptyExit',
  restart: 'dev:restart',
} as const
