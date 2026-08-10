/** Yol temizleme ve hapsetme — güvenlik açısından kritik davranışlar.
 *
 *  `sanitizeSegment` bozulursa kullanıcı verisi hafıza kökünün dışına yazılabilir;
 *  bu yüzden path traversal denemeleri açıkça test edilir. */
import { describe, expect, it } from 'vitest'
import { join, sep } from 'node:path'
import { isInside, joinInside, sanitizeSegment } from '../src/main/platform/pathUtils'

describe('sanitizeSegment', () => {
  it('yol ayraçlarını segmente dönüştürmez', () => {
    expect(sanitizeSegment('a/b')).not.toContain('/')
    expect(sanitizeSegment('a\\b')).not.toContain('\\')
  })

  it('path traversal denemesini etkisizleştirir', () => {
    const clean = sanitizeSegment('../../etc/passwd')
    expect(clean).not.toContain('/')
    expect(clean).not.toContain('..' + sep)
    expect(clean.startsWith('..')).toBe(false)
  })

  it('yalnız nokta olan adları yedek ada çevirir', () => {
    expect(sanitizeSegment('.')).toBe('proje')
    expect(sanitizeSegment('..')).toBe('proje')
    expect(sanitizeSegment('')).toBe('proje')
  })

  it('Windows yasak karakterlerini temizler', () => {
    expect(sanitizeSegment('a<b>c:d"e|f?g*h')).not.toMatch(/[<>:"|?*]/)
  })

  it('kontrol karakterlerini atar', () => {
    const withControl = 'ad' + String.fromCharCode(0) + String.fromCharCode(31) + 'sonu'
    expect(sanitizeSegment(withControl)).toBe('adsonu')
  })

  it('sondaki nokta ve boşluğu kırpar (Windows bunları sessizce siler)', () => {
    expect(sanitizeSegment('proje.  ')).toBe('proje')
    expect(sanitizeSegment('proje...')).toBe('proje')
  })

  it('Windows ayrılmış aygıt adlarını değiştirir', () => {
    expect(sanitizeSegment('CON')).toBe('CON-proje')
    expect(sanitizeSegment('lpt1')).toBe('lpt1-proje')
  })

  it('Türkçe karakterleri korur', () => {
    expect(sanitizeSegment('şaşırtıcı-proje-ĞÜÖİÇ')).toBe('şaşırtıcı-proje-ĞÜÖİÇ')
  })

  it('aşırı uzun adı sınırlar', () => {
    expect(sanitizeSegment('x'.repeat(500)).length).toBeLessThanOrEqual(96)
  })
})

describe('isInside', () => {
  const root = join('C:', 'kok')

  it('kökün kendisini içeride sayar', () => {
    expect(isInside(root, root)).toBe(true)
  })

  it('alt dizini içeride sayar', () => {
    expect(isInside(root, join(root, 'alt', 'derin'))).toBe(true)
  })

  it('üst dizini dışarıda sayar', () => {
    expect(isInside(root, join(root, '..'))).toBe(false)
    expect(isInside(root, join(root, '..', 'baska'))).toBe(false)
  })

  it('benzer adlı kardeş dizini dışarıda sayar', () => {
    expect(isInside(join('C:', 'kok'), join('C:', 'kok-baska'))).toBe(false)
  })
})

describe('joinInside', () => {
  const root = join('C:', 'memo')

  it('kök altındaki yolu birleştirir', () => {
    expect(joinInside(root, 'proje', 'README.md')).toBe(join(root, 'proje', 'README.md'))
  })

  it('dışarı taşan yolda hata fırlatır', () => {
    expect(() => joinInside(root, '..', 'kacis')).toThrow(/kök dizinin dışına/)
  })
})
