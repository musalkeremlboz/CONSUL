# CONSUL

**Modern, sekmeli, proje hafızalı geliştirici terminali.** Windows, macOS ve Linux.

CONSUL yalnızca bir terminal değildir: üzerinde çalıştığın her repository'nin ne
olduğunu, neden var olduğunu, nasıl çalıştığını ve hangi değişikliklerden
geçtiğini **insan tarafından okunabilir Markdown dosyalarında** hatırlar.

```
CONSUL
├── Modern terminal        gerçek PTY, sekmeler, arama, komut paleti
├── Proje çalışma alanı    klasör aç, Git bilgisini otomatik gör
├── Git entegrasyonu       dal, remote, sağlayıcı, çalışma ağacı durumu
├── CONSUL-MEMO            <Belgeler>/CONSUL-MEMO/<repo>/*.md
├── Otomatik güncelleme    GitHub Releases + sha512 doğrulaması
└── CONSUL Developer       CONSUL'un kendi kaynağı üzerinde Claude Code
```

---

## Öne çıkanlar

**Gerçek terminal.** Sahte bir kabuk taklidi yok: sistemdeki kabuklar keşfedilir
(Windows'ta PowerShell 7 / Windows PowerShell / Komut İstemi / Git Bash / WSL
dağıtımları; macOS ve Linux'ta `/etc/shells` + bilinen konumlar) ve gerçek bir
pseudo-terminal üzerinde çalıştırılır. ANSI/256/TrueColor, Unicode 11, emoji,
kopyala-yapıştır, geçmiş, arama, tıklanabilir URL ve dosya yolları desteklenir.

**Düşük gecikme.** Terminal çıktısı React durumundan geçmez; doğrudan xterm'e
yazılır. Main süreç çıktıyı ~6 ms'lik pencerelerde birleştirir ve onaylanmamış
veri 1 MiB'ı aşarsa PTY'yi duraklatır — sonsuz çıktı arayüzü boğmaz.

**Proje hafızası.** Bir klasörü proje olarak açtığında CONSUL,
`<Belgeler>/CONSUL-MEMO/<repository-adı>/` altında beş belge tutar:
`README.md`, `PURPOSE.md`, `CHANGELOG.md`, `ARCHITECTURE.md`, `ELEMENTS.md`.
Bunlar düz Markdown'dır: istediğin editörle düzenler, istersen sürüm kontrolüne
alırsın. CONSUL yalnız kendi işaretlediği bölgeleri günceller — senin yazdığın
hiçbir satır ezilmez, CHANGELOG yalnızca büyür.

**İzole oturumlar.** Bir terminal çökerse yalnız o sekme etkilenir.

**CONSUL Developer.** Ayrı bir uygulama girişi: tek pencere, tek terminal, tema
yok. CONSUL'un kaynak ağacında açılır ve Claude Code'u başlatır — CONSUL'u
CONSUL'un içinden geliştirmek için.

---

## Kurulum

Hazır kurulum paketlerini [Releases](../../releases) sayfasından indir:

| Platform | Dosya |
|---|---|
| Windows | `CONSUL-Setup-<sürüm>.exe` |
| macOS | `CONSUL-<sürüm>-<arch>.dmg` |
| Linux | `CONSUL-<sürüm>-x64.AppImage` · `CONSUL-<sürüm>-x64.deb` |

Her yayında `SHA256SUMS.txt` bulunur; indirdiğin dosyayı doğrulamak için:

```bash
# Linux / macOS
sha256sum -c SHA256SUMS.txt --ignore-missing

# Windows (PowerShell)
Get-FileHash .\CONSUL-Setup-1.0.0.exe -Algorithm SHA256
```

### CONSUL Developer'ı açma

- **Windows:** Başlat menüsünde “CONSUL Developer”.
- **macOS / Linux:** `CONSUL --developer`
- Belirli bir kaynak ağacıyla: `CONSUL --developer --workspace /yol/CONSUL`

---

## Kaynaktan çalıştırma

Gereksinim: **Node.js 20+** (geliştirme Node 24 ile yapılır).

```bash
git clone <repository-url> CONSUL
cd CONSUL
npm install
npm run dev
```

Faydalı komutlar:

```bash
npm run verify         # lint + typecheck + test — iş bitmeden önce
npm run test           # vitest
npm run build          # üretim derlemesi
npm run package:win    # Windows kurulum dosyası (release/ altına)
npm run smoke:pty      # gerçek PTY dumanı testi
```

Platform paketleri **kendi platformlarında** üretilir; cross-platform yayın
GitHub Actions ile yapılır (bkz. [docs/RELEASE.md](docs/RELEASE.md)).

---

## Kısayollar

| Kısayol | İşlev |
|---|---|
| `Ctrl/⌘ + T` | Yeni terminal sekmesi |
| `Ctrl/⌘ + W` | Sekmeyi kapat |
| `Ctrl/⌘ + Tab` | Sonraki sekme (`Shift` ile önceki) |
| `Ctrl/⌘ + 1…9` | Sekmeye geç |
| `Ctrl/⌘ + Shift + D` | Sekmeyi çoğalt |
| `Ctrl/⌘ + Shift + R` | Sekmeyi yeniden adlandır |
| `Ctrl/⌘ + F` | Terminalde ara |
| `Ctrl/⌘ + Shift + L` | Terminali temizle |
| `Ctrl/⌘ + Shift + P` | Komut paleti |
| `Ctrl/⌘ + O` | Proje klasörü aç |
| `Ctrl/⌘ + Shift + M` | Proje hafızasını aç |
| `Ctrl/⌘ + ,` | Ayarlar |
| `Ctrl/⌘ + +` / `-` / `0` | Yazı boyutu |

Sekmeler sürüklenerek sıralanır, çift tıkla yeniden adlandırılır, orta tıkla kapanır.

---

## Belgeler

- [CLAUDE.md](CLAUDE.md) — Claude Code için geliştirme talimatı ve sözleşmeler
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — katmanlar ve veri akışı
- [docs/CONSUL-MEMO.md](docs/CONSUL-MEMO.md) — hafıza sisteminin sözleşmesi
- [docs/RELEASE.md](docs/RELEASE.md) — sürüm yayınlama adımları
- [docs/UPDATER.md](docs/UPDATER.md) — otomatik güncelleme akışı ve güvenliği
- [docs/SIGNING.md](docs/SIGNING.md) — kod imzalama / notarization durumu
- [CHANGELOG.md](CHANGELOG.md) — sürüm geçmişi

---

## Gizlilik

CONSUL telemetri toplamaz. Ne yazdığın, hangi komutları çalıştırdığın ve proje
hafızan yalnız senin diskinde kalır. Ağ erişimi tek bir amaç içindir: GitHub
Releases üzerinden güncelleme kontrolü (kapatılabilir).

## Lisans

Bu depo için henüz bir lisans belirlenmemiştir.
