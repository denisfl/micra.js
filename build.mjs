#!/usr/bin/env node
/**
 * build.mjs — Micra.js build script
 *
 * Outputs:
 *   dist/micra.js       — IIFE bundle for CDN  (window.Micra)
 *   dist/micra.min.js   — minified IIFE for CDN
 *   dist/micra.esm.js   — ES module for bundlers (import)
 *   dist/micra.cjs.js   — CommonJS for Node.js  (require)
 *   dist/index.d.ts     — TypeScript declarations (via tsc)
 *
 * Usage:
 *   node build.mjs          — production build
 *   node build.mjs --watch  — rebuild on source changes
 */

import { build, context } from 'esbuild'
import { execSync }       from 'child_process'
import { readFileSync }   from 'fs'
import { gzipSync }       from 'zlib'

const watch = process.argv.includes('--watch')
const pkg   = JSON.parse(readFileSync('./package.json', 'utf8'))

const banner = `/* Micra.js v${pkg.version} — https://github.com/micra-js/micra — MIT */`

/** @type {import('esbuild').BuildOptions} */
const shared = {
  entryPoints: ['src/index.ts'],
  bundle:      true,
  target:      'es2019',
  banner:      { js: banner },
}

const configs = [
  // ── CDN / browser (global Micra.*)
  {
    ...shared,
    format:     'iife',
    globalName: 'Micra',
    outfile:    'dist/micra.js',
    sourcemap:  true,
  },
  // ── CDN minified
  {
    ...shared,
    format:     'iife',
    globalName: 'Micra',
    outfile:    'dist/micra.min.js',
    minify:     true,
  },
  // ── ESM for bundlers
  {
    ...shared,
    format:     'esm',
    outfile:    'dist/micra.esm.js',
    sourcemap:  true,
  },
  // ── CJS for Node.js require()
  {
    ...shared,
    format:     'cjs',
    outfile:    'dist/micra.cjs.js',
    sourcemap:  true,
  },
]

// Generate TypeScript declarations via tsc
function emitDeclarations() {
  console.log('📝 Generating .d.ts…')
  try {
    execSync('npx tsc --emitDeclarationOnly', { stdio: 'inherit' })
    console.log('   ✓ dist/index.d.ts')
  } catch {
    process.exit(1)
  }
}

if (watch) {
  // Dev watch mode — only IIFE build for speed, .d.ts on first run
  emitDeclarations()
  const ctx = await context({
    ...configs[0],
    plugins: [{
      name: 'on-build',
      setup(b) {
        b.onEnd(result => {
          if (result.errors.length) return
          console.log(`[${new Date().toLocaleTimeString()}] rebuilt dist/micra.js`)
        })
      },
    }],
  })
  await ctx.watch()
  console.log('👀 Watching src/ for changes…')
} else {
  // Production build — all formats + declarations
  console.log(`\n🔨 Building Micra.js v${pkg.version}\n`)

  emitDeclarations()

  const results = await Promise.all(configs.map(cfg => build(cfg)))

  for (const [cfg, res] of configs.map((c, i) => [c, results[i]])) {
    const errors = res.errors?.length ?? 0
    const label  = (cfg).outfile.replace('dist/', '')
    console.log(`   ${errors ? '✗' : '✓'} ${label}`)
  }

  console.log('\n✅ Build complete\n')

  // ── CSP guard ───────────────────────────────────────────────────────────────
  // Micra must run under a strict CSP (`default-src 'self'`, no `unsafe-eval`).
  // The expression evaluator parses+interprets — it must never reintroduce
  // `new Function` / `eval`. Fail the build if the bundle ships either.
  for (const file of ['dist/micra.min.js', 'dist/micra.esm.js', 'dist/micra.cjs.js']) {
    const src = readFileSync(file, 'utf8')
    const hit = /\beval\s*\(|new\s+Function\s*\(/.exec(src)
    if (hit) {
      console.error(`❌ CSP guard: "${hit[0]}" found in ${file} — breaks strict CSP`)
      process.exit(1)
    }
  }
  console.log('🔒 CSP guard: no eval / new Function in the bundle ✓')

  // ── Bundle size guard ──────────────────────────────────────────────────────
  // 7 KB — raised from 5.5 KB in v2.4 for the CSP-safe expression evaluator
  // (own parser/interpreter, no `new Function`). The eval-based path was
  // removed, not kept as a fallback, so this is the whole cost.
  const MAX_GZIP_BYTES = 7 * 1024
  const minified  = readFileSync('dist/micra.min.js')
  const gzipSize  = gzipSync(minified).length
  const kbStr     = (gzipSize / 1024).toFixed(1)
  if (gzipSize > MAX_GZIP_BYTES) {
    console.error(`❌ Bundle too large: ${kbStr} KB gzip (limit ${MAX_GZIP_BYTES / 1024} KB)`)
    process.exit(1)
  }
  console.log(`📦 Bundle size: ${kbStr} KB gzip ✓\n`)
}
