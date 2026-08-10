# Kod İmzalama ve Notarization — Mevcut Durum

Bu belge **olduğu gibi** durumu anlatır. Eksik olan hiçbir şey "varmış gibi"
yapılandırılmamıştır; sahte imzalama katmanı yoktur.

## Şu anki durum

| Platform | Durum | Sonuç |
|---|---|---|
| Windows | **İmzasız** — kod imzalama sertifikası yok | SmartScreen "Bilinmeyen yayıncı" uyarısı gösterir; updater yayıncı adını doğrulayamaz |
| macOS | **İmzasız ve notarize edilmemiş** — Apple Developer hesabı yok | Gatekeeper açılışı engeller; kullanıcı sağ tık → Aç ile geçmelidir |
| Linux | İmzasız paket + **SHA256 sağlaması yayınlanır** | AppImage/deb doğrudan çalışır |

## İmzasız ve imzalı dağıtım farkı

|  | İmzasız (şu an) | İmzalı (hedef) |
|---|---|---|
| Windows kurulum | SmartScreen uyarısı, "Yine de çalıştır" gerekir | Uyarı yok |
| macOS ilk açılış | Gatekeeper engeli, elle izin | Çift tıkla açılır |
| Güncelleme bütünlüğü | **sha512 karşılaştırması var** | sha512 + yayıncı adı doğrulaması |
| Kurcalanmış artefakt | sha512 uyuşmazlığında reddedilir | aynı + imza kırılır |

Yani **indirilen güncellemenin bütünlüğü imzasız dağıtımda da doğrulanır**;
eksik olan, ikilinin *kimden geldiğini* kanıtlayan katmandır.

## Eksik olanlar ve tamamlanması için gerekenler

### Windows kod imzalama

Gereken: bir kod imzalama sertifikası (OV veya EV, `.pfx`).

```
GitHub secrets:
  WIN_CSC_LINK            → base64 kodlanmış .pfx
  WIN_CSC_KEY_PASSWORD    → sertifika parolası
```

Bu secret'lar tanımlıysa `release.yml` iş akışı onları `CSC_LINK` /
`CSC_KEY_PASSWORD` olarak electron-builder'a geçirir ve imzalama kendiliğinden
devreye girer. Tanımlı değilse build imzasız devam eder — **hata vermez**.

### macOS imzalama + notarization

Gereken: Apple Developer Program üyeliği (yıllık ücretli), "Developer ID
Application" sertifikası ve app-specific password.

```
GitHub secrets:
  MAC_CSC_LINK            → base64 kodlanmış .p12
  MAC_CSC_KEY_PASSWORD    → sertifika parolası
  APPLE_ID                → Apple hesabı e-postası
  APPLE_APP_SPECIFIC_PASSWORD
  APPLE_TEAM_ID
```

`hardenedRuntime` ve `entitlements` zaten yapılandırılmıştır
(`build/entitlements.mac.plist`) — yalnız kimlik bilgileri eksiktir.

### Linux

Paket imzalama (deb için `dpkg-sig`, rpm için GPG) yapılandırılmamıştır.
Bunun yerine her yayında `SHA256SUMS.txt` üretilir ve kullanıcılar indirdikleri
dosyayı doğrulayabilir.

## Asla yapılmayacaklar

- Özel anahtar deposunda tutulmaz. `.gitignore` `*.pem`, `*.p12`, `*.pfx`
  dosyalarını kapsar.
- Sertifika yokken "imzalanmış" görünen bir yapılandırma yazılmaz.
- Güncelleme zincirindeki sha512 doğrulaması hiçbir koşulda devre dışı bırakılmaz.

## Kullanıcıya ne söylenmeli

Yayın notlarına şu satır konulabilir:

> Bu sürüm kod imzasızdır. Windows'ta SmartScreen uyarısı görebilir, macOS'ta
> ilk açılışta sağ tık → Aç yapmanız gerekebilir. İndirdiğiniz dosyayı
> `SHA256SUMS.txt` ile doğrulayabilirsiniz.
