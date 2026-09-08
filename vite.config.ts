/// <reference types="vitest/config" />

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'path'

import babel from '@rolldown/plugin-babel'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type PluginOption } from 'vite'

import {
  buildRelease,
  isSentryEnabled,
  resolveBuildSourcemap,
} from './sentry.config'

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const { version } = JSON.parse(
    readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
  ) as { version: string }

  let gitSha = 'unknown'
  try {
    gitSha = execSync('git rev-parse --short HEAD', {
      encoding: 'utf-8',
    }).trim()
  } catch {
    // .git недоступен (напр. в некоторых Docker-образах) — билд не должен падать
  }

  const release = buildRelease({ version, gitSha })

  const sentryEnabled = isSentryEnabled({ command, env })

  const plugins: PluginOption[] = [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ]

  if (sentryEnabled) {
    plugins.push(
      sentryVitePlugin({
        org: env.SENTRY_ORG,
        project: env.SENTRY_PROJECT,
        authToken: env.SENTRY_AUTH_TOKEN,
        release: {
          name: release,
          // auto: сам берёт repo/commit из git — нужен GitHub integration в Sentry
          // (Settings → Integrations → GitHub), иначе шаг тихо пропускается
          // (ignoreMissing/ignoreEmpty не роняют билд).
          setCommits: { auto: true, ignoreMissing: true, ignoreEmpty: true },
          // деплоем считаем только сборки на Vercel (VERCEL_ENV задаётся им
          // автоматически) — CI/локальные билды в Deploys не попадают.
          ...(env.VERCEL_ENV ? { deploy: { env: env.VERCEL_ENV } } : {}),
        },
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        errorHandler: error => {
          console.warn('[sentry-vite-plugin]', error)
        },
      }),
    )
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@app': path.resolve(__dirname, 'src/app'),
        '@pages': path.resolve(__dirname, 'src/pages'),
        '@widgets': path.resolve(__dirname, 'src/widgets'),
        '@features': path.resolve(__dirname, 'src/features'),
        '@entities': path.resolve(__dirname, 'src/entities'),
        '@shared': path.resolve(__dirname, 'src/shared'),
      },
    },
    define: {
      __APP_RELEASE__: JSON.stringify(release),
    },
    build: {
      sourcemap: resolveBuildSourcemap(sentryEnabled),
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: true,
    },
  }
})
