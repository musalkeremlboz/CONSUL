# CONSUL — Claude Code Geliştirme Talimatı

Bu depoda çalışıyorsan **CONSUL masaüstü terminal uygulamasını** geliştiriyorsun.
Bu dosya senin rolünü, mimariyi ve uyman gereken sözleşmeleri tanımlar.

CONSUL Developer (`--developer` bayrağıyla açılan yardımcı uygulama) seni tam
olarak bu depo kökünde başlatır; yani bu dosya her oturumda bağlamın olur.

---

## Rolün

- CONSUL mimarisini korumak ve tutarlı tutmak.
- Kod kalitesini artırmak, tekrarları ve ölü kodu temizlemek.
- Hata bulmak ve düzeltmek.
- Terminal performansını (gecikme, bellek, CPU) korumak.
- Cross-platform uyumluluğu (Windows / macOS / Linux) bozmamak.
- CONSUL-MEMO hafıza sistemini sürdürmek.
- Kurulum ve güncelleme altyapısını sağlam tutmak.
- **CONSUL Developer'ı sade tutmak** — oraya tema, sekme, panel eklenmez.
- İşi bitmiş saymadan önce testleri çalıştırmak.
- Mimari değişiklikten sonra dokümantasyonu güncellemek.
- Sırları asla açığa çıkarmamak.
- Açık izin olmadan yıkıcı Git işlemi yapmamak.

---

## Dil

- **Kullanıcıya dönük her metin Türkçedir**: arayüz yazıları, hata mesajları,
  bildirimler, hafıza belgeleri.
- **Kod İngilizcedir**: tanımlayıcılar, dosya adları, commit mesajları.
- Kod yorumları Türkçedir (mevcut üsluba uy: *neden*'i anlat, *ne*'yi değil).

---

## Mimari

```
src/
├── core/                 Bağımlılıksız çekirdek: şema doğrulama, atomik depo,
│                         dosya kilidi, dayanıklı izleyici. Electron İÇERMEZ.
├── shared/               main ↔ preload ↔ renderer ortak tipler, IPC kanal
│                         adları, tema/palet tanımları. React/Node İÇERMEZ.
├── main/                 Electron main süreci
│   ├── app/              giriş, mod tespiti (CONSUL / CONSUL Developer), pencere
│   ├── platform/         TEK platform soyutlaması (os, paths, pathUtils,
│   │                     executables, shells) — başka yerde `process.platform`
│   │                     kontrolü YAZILMAZ
│   ├── terminal/         PTY yöneticisi, ortam hazırlığı, başlatma tarifi
│   ├── projects/         proje açma + Git entegrasyonu + remote ayrıştırma
│   ├── memory/           CONSUL-MEMO: klasör çözümleme, Markdown belgeleri
│   ├── settings/         şema doğrulamalı atomik ayar deposu
│   ├── updater/          electron-updater + sürüm/manifest doğrulama
│   ├── developer/        CONSUL Developer: çalışma alanı + Claude Code
│   ├── fs/               klasör gezgini (yalnız dizin listeler)
│   └── ipc/              IPC kayıt defteri (gönderen + şema doğrulaması)
├── preload/              contextBridge yüzeyleri (index.ts = CONSUL,
│                         developer.ts = CONSUL Developer)
└── renderer/
    ├── index.html        CONSUL arayüzü
    ├── developer.html    CONSUL Developer (tek terminal)
    ├── src/              React arayüzü, xterm kurulumu, kısayol kayıt defteri
    └── developer/        Developer arayüzü — React YOK, tema YOK
```

### Terminal katmanı

- Emülatör (`xterm`) ile süreç katmanı (`node-pty`) birbirinden ayrıdır.
- Terminal verisi **React state'inden geçmez**; `createTerminal.ts` doğrudan
  xterm'e yazar. Bunu bozacak bir değişiklik yapma — her tuş vuruşunda render
  olur ve gecikme hissedilir hâle gelir.
- Akış kontrolü: main 1 MiB onaylanmamış veride PTY'yi duraklatır, 256 KiB'ın
  altına inince devam eder. Renderer `ack` göndermeyi bırakırsa terminal donar.
- Çıktı main tarafında ~6 ms'lik pencerelerde birleştirilir (IPC yükü).

### PTY katmanı

- `PtyManager` oturumları izole eder: bir oturumun çökmesi uygulamayı düşürmez.
- Kabuklar `platform/shells.ts` tarafından KEŞFEDİLİR; sabit kabuk yolu yazma.
- **Komut satırı string'i kurulmaz.** Çalıştırılabilir + argüman DİZİSİ verilir.
  Kullanıcı girdisini bir komut metnine gömmek yasaktır.

### CONSUL-MEMO

- Konum: `<Belgeler>/CONSUL-MEMO/<repo-adı>/` — Belgeler dizini platform
  API'sinden alınır, "Documents" adı varsayılmaz.
- Klasör adı sırası: GitHub/remote repo adı → git kökü → proje klasörü.
- Repo yeniden adlandırılırsa klasör **taşınır**, kopyalanmaz
  (`.consul-index.json` + `.consul-memo.json` bunu izler).
- Belgeler kullanıcıya aittir: yalnız `<!-- consul:begin:… -->` işaretli
  bölgeler güncellenir; CHANGELOG.md **yalnız eklenir**, hiçbir satır silinmez.

### Güncelleme

- `electron-updater` + GitHub Releases. sha512 doğrulaması devre dışı bırakılmaz.
- Ek savunma: `updater/version.ts` sürüm düşürmeyi ve özetsiz yayını reddeder.
- Kurulum **daima** kullanıcı onayıyla; çalışan terminal oturumları zorla
  kapatılmaz.

---

## Sözleşmeler (bunları bozma)

1. **Güvenlik duruşu:** `contextIsolation: true`, `nodeIntegration: false`,
   `sandbox: true`. Her IPC işleyicisi göndereni doğrular ve yükü
   `src/core/schema.ts` ile ayrıştırır.
2. **Keyfi komut çalıştıran IPC kanalı açma.** PTY yalnız keşfedilmiş kabuk
   kayıtlarından üretilen tariflerle başlar.
3. **Platform kontrolleri `src/main/platform/` içinde kalır.**
4. **OS diyalogları kullanılmaz** (`confirm`/`prompt`): `ui/Modal`, `ui/Dialogs`.
5. **Sabit renk gömme.** Renkler `src/shared/theme.ts` token'larından gelir.
6. **Animasyonlar `prefers-reduced-motion`'a saygılı olmalı.**
7. **Fontlar yereldir** (`@fontsource/*`); çalışma zamanında CDN yok.
8. **Sır loglama.** Ortam değişkeni değerleri, token'lar, anahtarlar log'a yazılmaz.
9. **Türkçe locale tuzağı:** sayfa `lang="tr"` olduğu için `text-transform:
   uppercase` "i" harfini "İ" yapar. ASCII kalması gereken metinlere (dosya
   yolu, marka) `lang="en"` verilir.
10. **CONSUL Developer sade kalır:** tek pencere, tek terminal, tema yok.

---

## Komutlar

```bash
npm install            # bağımlılıklar
npm run dev            # geliştirme modunda CONSUL
npm run lint           # ESLint (uyarı toleransı sıfır)
npm run typecheck      # üç TypeScript projesi (main / renderer / test)
npm run test           # vitest
npm run verify         # lint + typecheck + test  ← iş bitmeden ÖNCE çalıştır
npm run build          # electron-vite derlemesi
npm run package:win    # Windows NSIS kurulum dosyası
npm run package:mac    # macOS dmg   (yalnız macOS'ta)
npm run package:linux  # Linux AppImage + deb (yalnız Linux'ta)
npm run smoke:pty      # gerçek PTY dumanı testi (Electron'suz)
```

CONSUL Developer'ı geliştirme modunda açmak için:

```bash
npx electron-vite dev -- --developer      # veya CONSUL_MODE=developer npm run dev
```

---

## Üretilen / elle değiştirilmemesi gereken dosyalar

| Yol | Not |
|---|---|
| `out/` | electron-vite çıktısı — commit edilmez |
| `release/` | electron-builder çıktısı — commit edilmez |
| `package-lock.json` | `npm install` üretir; elle düzenleme |
| `out/**/app-update.yml` | electron-builder üretir (publish ayarından) |
| `build/icon*.png`, `build/icon.ico` | uygulama ikonları |

`electron-builder.yml` içindeki `publish.owner` alanı yayın hesabına göre
doldurulur; rastgele değiştirme.

---

## Çalışma alışkanlıkları

- Önce oku, sonra değiştir. Büyük değişikliği küçük, doğrulanabilir adımlara böl.
- Bir hata gördüğünde üstünü örtme; kök nedeni bul.
- Çalışan kodu gerekçesiz yeniden yazma.
- Yeni bağımlılık eklemeden önce gerçekten gerekli mi diye sor.
- Anlamlı bir değişiklikten sonra CONSUL-MEMO CHANGELOG'una kayıt düşülebilir
  (her küçük düzenleme için değil).
- Test yazılabilir her mantığı UI'dan bağımsız tut.

## Git

- `git reset --hard`, force push, history rewrite, kullanıcı dosyası silme: **hayır**.
- Küçük ve anlamlı commit'ler.
- Sırları (token, sertifika, `.pem`) asla commit etme — `.gitignore` bunları
  kapsar ama sorumluluk sende.
