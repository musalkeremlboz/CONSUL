/** Proje olguları — hafıza belgelerinin CONSUL tarafından üretilen bölümlerini
 *  besleyen, dosya sisteminden okunan gerçekler.
 *
 *  Buradaki hiçbir şey tahmin değildir: yalnız gerçekten var olan dosyalardan
 *  çıkarılan bilgiler döner. Bulunamayan alan boş bırakılır ki hafıza belgesi
 *  uydurma bilgi taşımasın. */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { readJsonSafe } from '../../core/store'

export interface ProjectFacts {
  /** package.json / Cargo.toml vb. içinden okunan ad. */
  declaredName?: string
  declaredDescription?: string
  version?: string
  /** Tespit edilen diller/çalışma zamanları. */
  languages: string[]
  /** Tespit edilen çatı ve kütüphaneler. */
  frameworks: string[]
  packageManager?: string
  /** package.json scripts anahtarları (en çok 12). */
  scripts: string[]
  /** Kök dizindeki üst düzey klasörler (en çok 24). */
  topLevelDirs: string[]
  /** Kök dizindeki dikkat çeken dosyalar. */
  notableFiles: string[]
}

interface PackageJson {
  name?: string
  description?: string
  version?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const FRAMEWORK_HINTS: { dep: string; label: string }[] = [
  { dep: 'electron', label: 'Electron' },
  { dep: 'react', label: 'React' },
  { dep: 'vue', label: 'Vue' },
  { dep: 'svelte', label: 'Svelte' },
  { dep: 'next', label: 'Next.js' },
  { dep: 'vite', label: 'Vite' },
  { dep: 'express', label: 'Express' },
  { dep: 'fastify', label: 'Fastify' },
  { dep: 'nestjs', label: 'NestJS' },
  { dep: '@nestjs/core', label: 'NestJS' },
  { dep: 'tauri', label: 'Tauri' },
  { dep: '@tauri-apps/api', label: 'Tauri' },
  { dep: 'typescript', label: 'TypeScript' },
  { dep: 'jest', label: 'Jest' },
  { dep: 'vitest', label: 'Vitest' },
  { dep: 'tailwindcss', label: 'Tailwind CSS' },
]

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  'dist',
  'out',
  'build',
  'release',
  'target',
  'vendor',
  '__pycache__',
  '.venv',
  'venv',
])

export function readProjectFacts(projectPath: string): ProjectFacts {
  const facts: ProjectFacts = {
    languages: [],
    frameworks: [],
    scripts: [],
    topLevelDirs: [],
    notableFiles: [],
  }
  if (!projectPath || !existsSync(projectPath)) return facts

  const has = (name: string): boolean => existsSync(join(projectPath, name))
  const addLanguage = (name: string): void => {
    if (!facts.languages.includes(name)) facts.languages.push(name)
  }
  const addFramework = (name: string): void => {
    if (!facts.frameworks.includes(name)) facts.frameworks.push(name)
  }

  // ── Node / JavaScript ekosistemi ──
  if (has('package.json')) {
    const pkg = readJsonSafe<PackageJson>(join(projectPath, 'package.json'), {})
    if (pkg.name) facts.declaredName = pkg.name
    if (pkg.description) facts.declaredDescription = pkg.description
    if (pkg.version) facts.version = pkg.version
    facts.scripts = Object.keys(pkg.scripts ?? {}).slice(0, 12)
    addLanguage('JavaScript / Node.js')
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
    for (const hint of FRAMEWORK_HINTS) {
      if (deps[hint.dep]) addFramework(hint.label)
    }
    if (deps['typescript']) addLanguage('TypeScript')
    facts.packageManager = has('pnpm-lock.yaml')
      ? 'pnpm'
      : has('yarn.lock')
        ? 'yarn'
        : has('bun.lockb')
          ? 'bun'
          : has('package-lock.json')
            ? 'npm'
            : undefined
  }

  // ── Diğer ekosistemler ──
  if (has('Cargo.toml')) {
    addLanguage('Rust')
    try {
      const toml = readFileSync(join(projectPath, 'Cargo.toml'), 'utf8')
      const name = /^\s*name\s*=\s*"([^"]+)"/m.exec(toml)?.[1]
      if (name && !facts.declaredName) facts.declaredName = name
    } catch {
      // okunamadı — yoksay
    }
  }
  if (has('go.mod')) addLanguage('Go')
  if (has('pyproject.toml') || has('requirements.txt') || has('setup.py')) addLanguage('Python')
  if (has('pom.xml') || has('build.gradle') || has('build.gradle.kts')) addLanguage('Java / JVM')
  if (has('Gemfile')) addLanguage('Ruby')
  if (has('composer.json')) addLanguage('PHP')
  if (has('CMakeLists.txt') || has('Makefile')) addLanguage('C / C++')
  if (has('Dockerfile') || has('docker-compose.yml')) addFramework('Docker')
  if (existsSync(join(projectPath, '.github', 'workflows'))) addFramework('GitHub Actions')

  // ── Yapı ──
  try {
    const entries = readdirSync(projectPath, { withFileTypes: true })
    facts.topLevelDirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, 'en'))
      .slice(0, 24)

    const interesting = new Set([
      'README.md',
      'CLAUDE.md',
      'CHANGELOG.md',
      'LICENSE',
      'package.json',
      'tsconfig.json',
      'Cargo.toml',
      'go.mod',
      'pyproject.toml',
      'Dockerfile',
    ])
    facts.notableFiles = entries
      .filter((e) => e.isFile() && interesting.has(e.name))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, 'en'))
  } catch {
    // dizin okunamadı — boş bırak
  }

  return facts
}
