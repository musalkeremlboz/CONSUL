/** IPC Şema Kiti — main süreç güven sınırı doğrulaması (değerlendirme P0 "IPC doğrulaması").
 *
 *  Renderer tipleri güven sınırı DEĞİLDİR: NaN/Infinity, bozuk tarih, boş kimlik ve
 *  aşırı metin main'e ulaşabilir. Bu kit, bağımlılıksız ve tip güvenli doğrulayıcılarla
 *  IPC girdilerini ayrıştırır; hata Türkçe mesajlı `SchemaError` olarak fırlar ve
 *  `ipcMain.handle` reddine dönüşür (renderer'a yapılandırılmış hata gider).
 *
 *  Kullanım:
 *    import { v, SchemaError } from '../../core/schema'
 *    const CreateTask = v.object({
 *      title: v.string({ min: 1, max: 500 }),
 *      due: v.optional(v.isoDate()),
 *      priority: v.literal('low', 'normal', 'high'),
 *    })
 *    ipcMain.handle('task:create', (e, raw) => { const input = CreateTask.parse(raw); … })
 *
 *  Hem main hem saf Node testlerinden kullanılabilir (fs/electron bağımlılığı yok). */

export class SchemaError extends Error {
  readonly path: string
  constructor(path: string, message: string) {
    super(path ? `${path}: ${message}` : message)
    this.name = 'SchemaError'
    this.path = path
  }
}

export interface Validator<T> {
  parse(value: unknown, path?: string): T
}

/** Varsayılan üst sınırlar — "sınırsız metin/dizi" sınıfı hataları durdurur. */
const DEFAULT_MAX_STRING = 10_000
const DEFAULT_MAX_ARRAY = 10_000

function fail(path: string, message: string): never {
  throw new SchemaError(path, message)
}

interface StringOptions {
  min?: number
  max?: number
  pattern?: RegExp
  patternLabel?: string
  trim?: boolean
}

function stringValidator(options: StringOptions = {}): Validator<string> {
  const { min = 0, max = DEFAULT_MAX_STRING, pattern, patternLabel, trim = false } = options
  return {
    parse(value, path = '') {
      if (typeof value !== 'string') fail(path, 'metin bekleniyordu')
      const s = trim ? value.trim() : value
      if (s.length < min) fail(path, `en az ${min} karakter olmalı`)
      if (s.length > max) fail(path, `en çok ${max} karakter olabilir (şu an ${s.length})`)
      if (pattern && !pattern.test(s)) fail(path, patternLabel ?? 'biçim geçersiz')
      return s
    },
  }
}

interface NumberOptions {
  min?: number
  max?: number
  int?: boolean
}

function numberValidator(options: NumberOptions = {}): Validator<number> {
  const { min, max, int = false } = options
  return {
    parse(value, path = '') {
      if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'sonlu sayı bekleniyordu')
      if (int && !Number.isInteger(value)) fail(path, 'tam sayı bekleniyordu')
      if (min !== undefined && value < min) fail(path, `en az ${min} olmalı`)
      if (max !== undefined && value > max) fail(path, `en çok ${max} olabilir`)
      return value
    },
  }
}

type Shape = Record<string, Validator<unknown>>
type ShapeResult<S extends Shape> = { [K in keyof S]: S[K] extends Validator<infer T> ? T : never }

export const v = {
  string: stringValidator,
  number: numberValidator,

  boolean(): Validator<boolean> {
    return {
      parse(value, path = '') {
        if (typeof value !== 'boolean') fail(path, 'boolean bekleniyordu')
        return value
      },
    }
  },

  /** Sabit değer kümesi (enum). */
  literal<const T extends readonly (string | number | boolean)[]>(...values: T): Validator<T[number]> {
    return {
      parse(value, path = '') {
        if (!values.includes(value as T[number])) {
          fail(path, `şunlardan biri olmalı: ${values.map((x) => JSON.stringify(x)).join(', ')}`)
        }
        return value as T[number]
      },
    }
  },

  optional<T>(inner: Validator<T>): Validator<T | undefined> {
    return {
      parse(value, path = '') {
        if (value === undefined) return undefined
        return inner.parse(value, path)
      },
    }
  },

  nullable<T>(inner: Validator<T>): Validator<T | null> {
    return {
      parse(value, path = '') {
        if (value === null) return null
        return inner.parse(value, path)
      },
    }
  },

  withDefault<T>(inner: Validator<T>, fallback: T): Validator<T> {
    return {
      parse(value, path = '') {
        if (value === undefined || value === null) return fallback
        return inner.parse(value, path)
      },
    }
  },

  array<T>(inner: Validator<T>, options: { max?: number } = {}): Validator<T[]> {
    const { max = DEFAULT_MAX_ARRAY } = options
    return {
      parse(value, path = '') {
        if (!Array.isArray(value)) fail(path, 'dizi bekleniyordu')
        if (value.length > max) fail(path, `en çok ${max} öğe olabilir (şu an ${value.length})`)
        return value.map((item, i) => inner.parse(item, `${path}[${i}]`))
      },
    }
  },

  /** Nesne: bilinmeyen anahtarlar SESSİZCE ATILIR (strip) — renderer fazladan alan
   *  gönderse bile depoya sızmaz. `reject` modunda bilinmeyen anahtar hata olur. */
  object<S extends Shape>(shape: S, options: { unknownKeys?: 'strip' | 'reject' } = {}): Validator<ShapeResult<S>> {
    const { unknownKeys = 'strip' } = options
    return {
      parse(value, path = '') {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(path, 'nesne bekleniyordu')
        const raw = value as Record<string, unknown>
        if (unknownKeys === 'reject') {
          for (const key of Object.keys(raw)) {
            if (!(key in shape)) fail(path ? `${path}.${key}` : key, 'bilinmeyen alan')
          }
        }
        const out: Record<string, unknown> = {}
        for (const [key, validator] of Object.entries(shape)) {
          const parsed = validator.parse(raw[key], path ? `${path}.${key}` : key)
          if (parsed !== undefined) out[key] = parsed
        }
        return out as ShapeResult<S>
      },
    }
  },

  /** Serbest anahtarlı sözlük; anahtar sayısı ve anahtar uzunluğu sınırlı. */
  record<T>(inner: Validator<T>, options: { maxKeys?: number; maxKeyLength?: number } = {}): Validator<Record<string, T>> {
    const { maxKeys = 10_000, maxKeyLength = 500 } = options
    return {
      parse(value, path = '') {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(path, 'nesne bekleniyordu')
        const entries = Object.entries(value as Record<string, unknown>)
        if (entries.length > maxKeys) fail(path, `en çok ${maxKeys} anahtar olabilir`)
        const out: Record<string, T> = {}
        for (const [key, item] of entries) {
          if (key.length > maxKeyLength) fail(path, `anahtar en çok ${maxKeyLength} karakter olabilir`)
          out[key] = inner.parse(item, path ? `${path}.${key}` : key)
        }
        return out
      },
    }
  },

  /** Boş olmayan, kırpılmış kimlik metni. */
  id(max = 128): Validator<string> {
    return stringValidator({ min: 1, max, trim: true })
  },

  /** YYYY-MM-DD yerel tarih — gerçek takvim günü olmalı (2026-02-30 reddedilir). */
  isoDate(): Validator<string> {
    return {
      parse(value, path = '') {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(path, 'YYYY-MM-DD bekleniyordu')
        const [y, m, d] = value.split('-').map(Number)
        const date = new Date(Date.UTC(y, m - 1, d))
        if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
          fail(path, 'geçerli bir takvim günü değil')
        }
        return value
      },
    }
  },

  /** ISO 8601 zaman damgası (Date.parse ile doğrulanır). */
  isoDateTime(): Validator<string> {
    return {
      parse(value, path = '') {
        if (typeof value !== 'string' || value.length > 64 || Number.isNaN(Date.parse(value))) {
          fail(path, 'geçerli ISO zaman damgası bekleniyordu')
        }
        return value
      },
    }
  },

  unknown(): Validator<unknown> {
    return { parse: (value) => value }
  },
}
