import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

type McpServerConfig = { type?: string; url?: string }
type McpConfig = { mcpServers?: Record<string, McpServerConfig> }

const ROOT = __dirname

// .mcp.json — единственный источник истины для project-scoped MCP-серверов (см.
// AGENTS.md/план — Sentry remote MCP, https://mcp.sentry.dev/mcp). Читается лениво (не на
// верхнем уровне модуля), по прецеденту vercel-headers.test.ts: битый/невалидный .mcp.json
// должен уронить конкретный `it`, а не весь test-файл сырой ошибкой парсинга.
function readMcpConfig(): McpConfig {
  const raw = readFileSync(path.join(ROOT, '.mcp.json'), 'utf-8')
  return JSON.parse(raw) as McpConfig
}

function getSentryServer(config: McpConfig): McpServerConfig {
  const server = config.mcpServers?.sentry
  if (!server) {
    throw new Error(
      `.mcp.json: mcpServers.sentry не найден (доступно: [${Object.keys(config.mcpServers ?? {}).join(', ')}])`,
    )
  }
  return server
}

describe('.mcp.json — Sentry MCP', () => {
  it('парсится как валидный JSON', () => {
    expect(() => readMcpConfig()).not.toThrow()
  })

  it('mcpServers.sentry.type === "http"', () => {
    const server = getSentryServer(readMcpConfig())
    expect(server.type).toBe('http')
  })

  it('mcpServers.sentry.url начинается с https://mcp.sentry.dev/mcp (не точное равенство — Post-Completion разрешает локально дописать /org/project)', () => {
    const server = getSentryServer(readMcpConfig())
    expect(server.url?.startsWith('https://mcp.sentry.dev/mcp')).toBe(true)
  })
})

describe('getSentryServer — edge case (испорченный/неполный конфиг)', () => {
  it('бросает понятную ошибку, если mcpServers.sentry отсутствует', () => {
    const broken: McpConfig = { mcpServers: { other: { type: 'http' } } }
    expect(() => getSentryServer(broken)).toThrow(
      /mcpServers\.sentry не найден/,
    )
  })

  it('бросает понятную ошибку, если mcpServers отсутствует вовсе', () => {
    expect(() => getSentryServer({})).toThrow(/mcpServers\.sentry не найден/)
  })
})
