# Değişiklik Günlüğü

Bu proje [Semantic Versioning](https://semver.org/lang/tr/) kullanır.

## [1.0.0] — 2026-08-10

CONSUL'un bağımsız bir uygulama olarak ilk sürümü.

### Eklendi

- **Cross-platform terminal.** Windows (PowerShell 7, Windows PowerShell, Komut
  İstemi, Git Bash, WSL dağıtımları), macOS ve Linux (`/etc/shells` + bilinen
  konumlar) kabukları otomatik keşfedilir; varsayılan kabuk ayarlardan seçilir.
- **Sekmeler.** Sürükleyerek sıralama, çift tıkla yeniden adlandırma, çoğaltma,
  orta tıkla kapatma, bağlam menüsü; her sekme kendi kabuğu, dizini ve geçmişiyle
  izoledir.
- **Terminal deneyimi.** ANSI/256/TrueColor, Unicode 11, emoji, WebGL renderer,
  terminal içi arama, tıklanabilir URL ve dosya yolları, ACK tabanlı akış kontrolü.
- **Komut paleti** ve merkezî klavye kısayolu kayıt defteri.
- **Proje kavramı ve Git entegrasyonu.** Repository kökü, dal, varsayılan dal,
  remote URL, sağlayıcı, çalışma ağacı durumu ve ahead/behind sayıları.
- **CONSUL-MEMO.** `<Belgeler>/CONSUL-MEMO/<repo>/` altında beş Markdown belgesi;
  incremental güncelleme, kullanıcı içeriğinin korunması, repository yeniden
  adlandırıldığında klasörün kayıpsız taşınması.
- **CONSUL Developer.** Tek pencereli, temasız, tek terminalli yardımcı uygulama;
  CONSUL kaynak ağacında açılır ve Claude Code'u izin sistemini atlamadan başlatır.
- **Otomatik güncelleme.** GitHub Releases + electron-updater; sha512 doğrulaması,
  sürüm düşürme reddi, kullanıcı onaylı kurulum, kararlı/beta kanalları.
- **Tema.** Koyu / açık arayüz teması (sistemi izleme dahil) ve arayüzden bağımsız
  beş terminal renk şeması.
- **Ayarlar.** Varsayılan kabuk, başlangıç davranışı, yazı tipi/boyut/satır
  yüksekliği, imleç biçimi, geçmiş satır sayısı, hafıza ve güncelleme tercihleri.
- **Testler.** 134 birim testi (vitest) + gerçek PTY dumanı testi; üç platformda
  CI doğrulaması.

### Güvenlik

- `contextIsolation` + `sandbox` açık, `nodeIntegration` kapalı; renderer'ın
  Node'a veya keyfi IPC kanallarına erişimi yok.
- Her IPC işleyicisinde gönderen doğrulaması ve şema tabanlı yük denetimi.
- PTY başlatmada komut satırı string'i kurulmaz; çalıştırılabilir ve argümanlar
  ayrı verilir — kullanıcı girdisi hiçbir zaman komut metnine gömülmez.
- Klasör adları dosya sistemi için temizlenir; hafıza yazımları kökün dışına
  çıkamaz (path traversal engeli testlerle sabitlenmiştir).
- Güncelleme manifesti doğrulanmadan hiçbir ikili kurulmaz.
