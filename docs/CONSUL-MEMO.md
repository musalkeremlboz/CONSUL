# CONSUL-MEMO — Proje Hafızası Sözleşmesi

CONSUL, üzerinde çalıştığın her proje için kalıcı bir hafıza tutar. Bu hafıza
gizli bir veritabanında değil, **senin okuyup düzenleyebileceğin Markdown
dosyalarında** yaşar.

## Konum

```
<Belgeler>/CONSUL-MEMO/<repository-adı>/
├── README.md          bu klasör nedir, hangi belgeler var
├── PURPOSE.md         proje neden var, hangi problemi çözüyor
├── CHANGELOG.md       anlamlı değişikliklerin tarihsel kaydı
├── ARCHITECTURE.md    projenin çalışma mimarisi (Mermaid diyagramlı)
└── ELEMENTS.md        önemli modüller: görev, girdi, çıktı, bağımlılıklar
```

Belgeler dizini **platform API'sinden** alınır (`app.getPath('documents')`);
"Documents" adı varsayılmaz. Yerelleştirilmiş ("Belgeler", "Dokumente") ya da
kullanıcı tarafından taşınmış dizinler de doğru bulunur.

## Klasör adı

Öncelik sırası:

1. Git remote'undan repository adı — `github.com/example/my-awesome-app` →
   `my-awesome-app`
2. Remote yoksa Git repository kök klasörünün adı
3. Git repository değilse proje klasörünün adı

Sonuç daima dosya sistemi için güvenli **tek bir segmenttir**: yol ayraçları,
kontrol karakterleri, Windows'ta yasak karakterler ve ayrılmış aygıt adları
temizlenir; baştaki noktalar atılır (gizli klasör oluşmasın).

## Repository yeniden adlandırma

Bu, hafıza sistemlerinin en kolay veri kaybettiği yerdir. CONSUL şunu yapar:

```
<CONSUL-MEMO>/.consul-index.json      proje yolu → klasör eşlemesi
<klasör>/.consul-memo.json            klasörün kalıcı kimliği + bilinen yollar
```

- Proje yolu indekste kayıtlıysa **aynı klasör** kullanılır. Repository adı
  değişmişse ve yeni ad boştaysa klasör **taşınır** (rename) — içerik korunur,
  kopya oluşmaz.
- Proje başka bir yola taşınmışsa, aynı adlı klasör **benimsenir**.
- İki farklı proje aynı adı isterse çakışma `-2`, `-3` sonekiyle çözülür.
- Taşıma başarısız olursa (dosya kilitli) eski adla devam edilir — veri güvende.

Kullanıcının repository'sine **hiçbir şey yazılmaz**; tüm defter hafıza kökünde
yaşar. Çok pencereli kullanımda indeks dosya kilidi altında güncellenir.

## Güncelleme ilkesi: incremental

Belgeler **sana aittir**. CONSUL yalnız kendi işaretlediği bölgeleri günceller:

```markdown
## Temel teknolojiler

<!-- consul:begin:tech -->
**Diller / çalışma zamanları**

- TypeScript
<!-- consul:end:tech -->

## Benim notlarım

Bunlar asla ezilmez.
```

| Belge | Davranış |
|---|---|
| `CHANGELOG.md` | **Yalnız eklenir.** Hiçbir satır silinmez veya değiştirilmez. |
| `PURPOSE.md` | `tech` ve `repo` bölgeleri tazelenir; gerisi korunur. |
| `ARCHITECTURE.md` | `structure` ve `diagram` bölgeleri tazelenir. |
| `ELEMENTS.md` | `structure` bölgesi tazelenir. |
| `README.md` | `repo` bölgesi tazelenir. |

Ek güvenceler:

- Dosya okunamıyorsa (izin, kilit) **üzerine yazılmaz** — atlanır.
- Bölge içeriği gerçekten değişmediyse dosyaya dokunulmaz (gereksiz yazım yok).
- Yazım atomiktir (tmp + fsync + rename): yarıda kalan bir yazım hafızayı bozmaz.
- İşaret bulunamazsa bölge dosyanın **sonuna eklenir**; mevcut metin silinmez.

## CHANGELOG biçimi

```markdown
# demo — Değişiklik Günlüğü

## 2026-08-10

### Terminal oturum yönetimi

- PTY yaşam döngüsü ayrıştırıldı.
- Sekme kapanınca alt sürecin düzgün sonlandırılması sağlandı.

**Değişen dosyalar**

- `src/main/terminal/ptyManager.ts`
```

Aynı güne ikinci kayıt aynı bölüme eklenir; yeni gün en üste açılır.

## Üretilen içerik nereden gelir?

`memory/projectFacts.ts` yalnız **gerçekten var olan** dosyalardan bilgi çıkarır:
`package.json` (ad, açıklama, sürüm, komutlar, bağımlılıklardan çatı tespiti),
`Cargo.toml`, `go.mod`, `pyproject.toml`, `pom.xml`, `Gemfile`, `composer.json`,
`Dockerfile`, `.github/workflows` ve üst düzey klasör listesi.

Bulunamayan alan boş bırakılır — hafıza belgesi **uydurma bilgi taşımaz**.

## Kapatma

Ayarlar → Proje Hafızası → CONSUL-MEMO anahtarı. Kapalıyken hiçbir dosya
oluşturulmaz veya güncellenmez; mevcut klasörler olduğu gibi kalır.

## Council'dan göç

Eski Council/HERMES proje hafızası (`<proje>/.council/memory.json`) tek seferlik
bir betikle taşınabilir:

```bash
node scripts/migrate-council-memory.mjs --dry-run <proje-yolu>
node scripts/migrate-council-memory.mjs <proje-yolu>
```

Kaynak `.council` klasörü **değiştirilmez**; hedefte var olan dosyalar ezilmez.
