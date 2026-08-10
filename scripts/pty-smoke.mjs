#!/usr/bin/env node
/**
 * PTY dumanı testi — Electron olmadan.
 *
 * Amacı: yerel `node-pty` bağlamasının bu makinede/CI'da GERÇEKTEN çalıştığını
 * kanıtlamak. Birim testleri bunu yapamaz (native modül + gerçek süreç gerekir).
 *
 * Kabuk keşfi uygulamayla aynı mantığı taklit eder ama bağımsızdır: bu betik
 * derleme çıktısına ihtiyaç duymaz.
 *
 *   node scripts/pty-smoke.mjs
 */
import { spawn } from '@lydell/node-pty'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const isWindows = process.platform === 'win32'

function pickShell() {
  if (isWindows) {
    const system = process.env.SystemRoot ?? 'C:\\Windows'
    const powershell = join(system, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    if (existsSync(powershell)) {
      return { file: powershell, args: ['-NoLogo', '-NoProfile', '-Command', 'Write-Output CONSUL_PTY_OK'] }
    }
    return { file: process.env.ComSpec ?? 'cmd.exe', args: ['/c', 'echo CONSUL_PTY_OK'] }
  }
  for (const candidate of ['/bin/bash', '/bin/sh']) {
    if (existsSync(candidate)) return { file: candidate, args: ['-c', 'echo CONSUL_PTY_OK'] }
  }
  return { file: '/bin/sh', args: ['-c', 'echo CONSUL_PTY_OK'] }
}

const { file, args } = pickShell()
console.log(`[smoke] kabuk: ${file}`)

let output = ''
let finished = false

const timer = setTimeout(() => {
  if (finished) return
  console.error('[smoke] BAŞARISIZ: 20 saniyede çıktı alınamadı')
  process.exit(1)
}, 20_000)

let pty
try {
  pty = spawn(file, args, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: process.cwd(),
    env: { ...process.env, TERM: 'xterm-256color' },
  })
} catch (err) {
  clearTimeout(timer)
  console.error(`[smoke] BAŞARISIZ: PTY başlatılamadı — ${err.message}`)
  process.exit(1)
}

pty.onData((data) => {
  output += data
})

pty.onExit(({ exitCode }) => {
  finished = true
  clearTimeout(timer)
  if (!output.includes('CONSUL_PTY_OK')) {
    console.error(`[smoke] BAŞARISIZ: beklenen çıktı yok (çıkış kodu ${exitCode})`)
    console.error(`[smoke] alınan: ${JSON.stringify(output.slice(0, 400))}`)
    process.exit(1)
  }
  console.log('[smoke] BAŞARILI: PTY oluşturuldu, çıktı alındı, süreç sonlandı')
  process.exit(0)
})

// Boyutlandırmanın da çökmediğini doğrula
setTimeout(() => {
  try {
    pty.resize(100, 30)
  } catch (err) {
    console.error(`[smoke] UYARI: resize hatası — ${err.message}`)
  }
}, 200)
