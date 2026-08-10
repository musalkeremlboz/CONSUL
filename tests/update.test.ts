/** Güncelleme güvenliği: sürüm karşılaştırma, manifest doğrulama ve
 *  başarısız güncellemenin kullanıcıya anlaşılır biçimde bildirilmesi. */
import { describe, expect, it } from 'vitest'
import {
  compareVersions,
  isNewerVersion,
  isPrerelease,
  parseVersion,
  validateUpdateManifest,
} from '../src/main/updater/version'
import { friendlyUpdateError } from '../src/main/updater/errors'

const SHA = 'a'.repeat(88)

describe('parseVersion', () => {
  it('kararlı sürümü ayrıştırır', () => {
    expect(parseVersion('1.2.3')).toMatchObject({ major: 1, minor: 2, patch: 3, prerelease: [] })
  })

  it('v önekini kabul eder', () => {
    expect(parseVersion('v2.0.0')?.major).toBe(2)
  })

  it('ön-sürüm etiketini ayrıştırır', () => {
    expect(parseVersion('1.0.0-beta.3')?.prerelease).toEqual(['beta', 3])
  })

  it('geçersiz sürümde null döner', () => {
    expect(parseVersion('sürüm-yok')).toBeNull()
    expect(parseVersion('1.2')).toBeNull()
  })
})

describe('compareVersions', () => {
  it('major/minor/patch sırasına uyar', () => {
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1)
    expect(compareVersions('1.2.0', '1.10.0')).toBe(-1)
    expect(compareVersions('1.0.1', '1.0.1')).toBe(0)
  })

  it('ön-sürüm, kararlı sürümden küçüktür', () => {
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(-1)
    expect(compareVersions('1.0.0', '1.0.0-beta.1')).toBe(1)
  })

  it('ön-sürümleri kendi aralarında sıralar', () => {
    expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.10')).toBe(-1)
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1)
  })

  it('ayrıştırılamayan sürümü küçük sayar (güvenli taraf)', () => {
    expect(compareVersions('bozuk', '1.0.0')).toBe(-1)
  })
})

describe('isNewerVersion / isPrerelease', () => {
  it('yalnız gerçekten yeni sürüme evet der', () => {
    expect(isNewerVersion('1.1.0', '1.0.0')).toBe(true)
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false)
    expect(isNewerVersion('0.9.0', '1.0.0')).toBe(false)
  })

  it('ön-sürümü tanır', () => {
    expect(isPrerelease('1.0.0-beta.1')).toBe(true)
    expect(isPrerelease('1.0.0')).toBe(false)
  })
})

describe('validateUpdateManifest', () => {
  const good = { version: '1.1.0', files: [{ url: 'CONSUL-Setup-1.1.0.exe', sha512: SHA, size: 100 }] }

  it('geçerli manifesti kabul eder', () => {
    const result = validateUpdateManifest(good, '1.0.0', 'stable')
    expect(result.ok).toBe(true)
    expect(result.manifest?.files[0].sha512).toBe(SHA)
  })

  it('SÜRÜM DÜŞÜRME girişimini reddeder', () => {
    const result = validateUpdateManifest({ ...good, version: '0.9.0' }, '1.0.0', 'stable')
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/yeni değil/)
  })

  it('aynı sürümü reddeder', () => {
    expect(validateUpdateManifest({ ...good, version: '1.0.0' }, '1.0.0', 'stable').ok).toBe(false)
  })

  it('sha512 özeti eksik dosyayı reddeder', () => {
    const result = validateUpdateManifest(
      { version: '1.1.0', files: [{ url: 'x.exe' }] },
      '1.0.0',
      'stable'
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/sha512/)
  })

  it('kısa/sahte özeti reddeder', () => {
    const result = validateUpdateManifest(
      { version: '1.1.0', files: [{ url: 'x.exe', sha512: 'kisa' }] },
      '1.0.0',
      'stable'
    )
    expect(result.ok).toBe(false)
  })

  it('dosyasız yayını reddeder', () => {
    expect(validateUpdateManifest({ version: '1.1.0', files: [] }, '1.0.0', 'stable').ok).toBe(false)
  })

  it('kararlı kanalda ön-sürümü reddeder', () => {
    const result = validateUpdateManifest({ ...good, version: '1.1.0-beta.1' }, '1.0.0', 'stable')
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/ön-sürüm/)
  })

  it('beta kanalında ön-sürümü kabul eder', () => {
    expect(validateUpdateManifest({ ...good, version: '1.1.0-beta.1' }, '1.0.0', 'beta').ok).toBe(true)
  })

  it('bozuk girdide çökmez', () => {
    expect(validateUpdateManifest(null, '1.0.0', 'stable').ok).toBe(false)
    expect(validateUpdateManifest('metin', '1.0.0', 'stable').ok).toBe(false)
    expect(validateUpdateManifest({ version: 'yok' }, '1.0.0', 'stable').ok).toBe(false)
  })
})

describe('friendlyUpdateError', () => {
  it('ağ hatasını Türkçe açıklar', () => {
    expect(friendlyUpdateError(new Error('getaddrinfo ENOTFOUND github.com'))).toMatch(/İnternet bağlantınızı/)
  })

  it('bütünlük hatasını açıkça bildirir', () => {
    expect(friendlyUpdateError(new Error('sha512 checksum mismatch'))).toMatch(/bütünlük doğrulaması/)
  })

  it('yayın yoksa bunu söyler', () => {
    expect(friendlyUpdateError(new Error('HttpError: 404 Not Found'))).toMatch(/güncelleme bulunamadı/)
  })

  it('izin hatasını ayırt eder', () => {
    expect(friendlyUpdateError(new Error('EACCES: permission denied'))).toMatch(/erişim izni yok/)
  })

  it('bilinmeyen hatayı yığın izi olmadan aktarır', () => {
    const message = friendlyUpdateError(new Error('beklenmedik durum'))
    expect(message).toContain('beklenmedik durum')
    expect(message).not.toContain('at ')
  })
})
