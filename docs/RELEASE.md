# Sürüm Yayınlama

## Sürümleme

[Semantic Versioning](https://semver.org/lang/tr/): `MAJOR.MINOR.PATCH`.
Git etiketi `v` önekiyle: `v1.0.0`.

| Değişiklik | Artan alan |
|---|---|
| Geriye dönük uyumsuz davranış (ayar biçimi, hafıza düzeni) | MAJOR |
| Yeni özellik, uyumlu | MINOR |
| Hata düzeltmesi | PATCH |

## Ön koşullar (bir kez)

1. `electron-builder.yml` içindeki `publish.owner` alanını GitHub hesabınla doldur:

   ```yaml
   publish:
     - provider: github
       owner: <github-kullanıcısı>
       repo: CONSUL
   ```

   Bu değer derleme sırasında `app-update.yml`ye gömülür; kurulu uygulama
   güncellemeleri buradan arar. Yanlışsa güncelleme çalışmaz.

2. (İsteğe bağlı) İmzalama secret'larını GitHub deposuna ekle —
   bkz. [SIGNING.md](SIGNING.md). Yoksa build imzasız devam eder.

## Yayın adımları

```bash
# 1. Her şey temiz ve doğrulanmış mı
git status
npm run verify          # lint + typecheck + test
npm run build

# 2. Sürümü yükselt (package.json + CHANGELOG.md)
#    CHANGELOG'a yeni sürüm başlığı ve değişiklikleri yaz.

# 3. Commit + etiket
git add -A
git commit -m "release: v1.1.0"
git tag v1.1.0

# 4. İt — Actions gerisini yapar
git push origin main
git push origin v1.1.0
```

`v*` etiketi `release.yml` iş akışını tetikler:

```
Etiket
  ├─ Doğrulama (lint + typecheck + test)
  ├─ Windows  → CONSUL-Setup-<sürüm>.exe        ┐
  ├─ macOS    → CONSUL-<sürüm>-<arch>.dmg       ├─ taslak Release'e yüklenir
  ├─ Linux    → CONSUL-<sürüm>-x64.AppImage     │  (+ latest*.yml updater metadata)
  │             CONSUL-<sürüm>-x64.deb          ┘
  └─ Sağlamalar → SHA256SUMS.txt + yayını aç
```

## Yerel paketleme

Her platform **kendi üzerinde** paketlenir; çapraz derleme yapılmaz.

```bash
npm run package:win      # Windows'ta  → release/CONSUL-Setup-<sürüm>.exe
npm run package:mac      # macOS'ta    → release/CONSUL-<sürüm>-<arch>.dmg
npm run package:linux    # Linux'ta    → release/CONSUL-<sürüm>-x64.AppImage, .deb
```

Yerel paketler `--publish never` ile üretilir; kazara yayına gitmezler.

## Kurulum içeriği

Tek kurulum paketi iki uygulama girişi sağlar:

| Giriş | Nasıl açılır |
|---|---|
| CONSUL | Masaüstü + Başlat menüsü kısayolu |
| CONSUL Developer | Başlat menüsü kısayolu (`--developer` bayrağı) |

İkisi ayrı süreç ve ayrı `userData` dizini kullanır. macOS ve Linux'ta CONSUL
Developer `CONSUL --developer` ile açılır.

## Yayın sonrası doğrulama

- [ ] Release sayfası erişilebilir ve taslak değil
- [ ] Üç platformun kurulum dosyaları ve `latest*.yml` yüklü
- [ ] `SHA256SUMS.txt` var ve dosya adları eşleşiyor
- [ ] Sürüm numarası `package.json`, etiket ve Release başlığında aynı
- [ ] Temiz bir makinede kurulum çalışıyor
- [ ] CONSUL açılıyor, terminal oturumu başlıyor
- [ ] CONSUL Developer açılıyor ve doğru dizinde başlıyor
- [ ] Bir önceki sürüm kuruluyken güncelleme algılanıyor

## Geri alma

Kötü bir yayın çıkarsa:

```bash
gh release delete v1.1.0 --yes        # yayını kaldır
git push --delete origin v1.1.0       # etiketi kaldır
git tag -d v1.1.0
```

Kurulu istemciler bir sonraki kontrolde eski sürümü "yeni" saymaz —
`updater/version.ts` sürüm düşürmeyi reddeder. Düzeltme için **daha yüksek**
bir yama sürümü yayınla (`v1.1.1`).
