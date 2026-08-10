/** Metin dosyaları için atomik yazım.
 *
 *  `src/core/store.ts` JSON'a özeldir; hafıza belgeleri Markdown olduğundan
 *  aynı güvenceyi (tmp'e yaz → fsync → rename) düz metin için sağlarız:
 *  yarıda kalan bir yazım kullanıcının hafıza dosyasını asla bozmaz. */
import { closeSync, fsyncSync, mkdirSync, openSync, renameSync, unlinkSync, writeSync } from 'node:fs'
import { dirname } from 'node:path'

export function writeFileAtomicText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.tmp`
  const fd = openSync(tmp, 'w')
  try {
    writeSync(fd, content, null, 'utf8')
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  try {
    renameSync(tmp, path)
  } catch (err) {
    try {
      unlinkSync(tmp)
    } catch {
      // geçici dosya kalabilir — kritik değil
    }
    throw err
  }
}
