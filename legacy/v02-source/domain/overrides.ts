import { wheelData } from './catalog'
import type { WheelOption, WheelPool } from './types'

export const WHEEL_OVERRIDE_STORAGE_KEY = 'douluo-wheel-overrides-v1'

export interface WheelOverride {
  poolId: string
  poolName: string
  options: WheelOption[]
}

export type WheelOverrides = Record<string, WheelOverride>

export interface WheelOverrideExport {
  format: 'douluo-wheel-overrides'
  formatVersion: 1
  source: { wheelDataVersion: number; wheelDataExportDate: string }
  generatedAt: string
  poolCount: number
  pools: Array<WheelOverride & { baseFingerprint: string; summary: OverrideSummary }>
}

export interface OverrideSummary {
  added: number
  updated: number
  disabled: number
}

function copyOptions(options: readonly WheelOption[]): WheelOption[] {
  return options.map((option) => ({ ...option }))
}

export function effectivePool(pool: WheelPool, overrides: WheelOverrides): WheelPool {
  const override = overrides[pool.id]
  return override ? { ...pool, options: copyOptions(override.options) } : pool
}

export function overrideSummary(pool: WheelPool, options: readonly WheelOption[]): OverrideSummary {
  const originals = new Map(pool.options.map((option) => [option.id, option]))
  let added = 0
  let updated = 0
  let disabled = 0
  for (const option of options) {
    const original = originals.get(option.id)
    if (!original) {
      added += 1
      continue
    }
    if (option.enabled === false && original.enabled !== false) disabled += 1
    if (option.name !== original.name || Boolean(option.enabled) !== Boolean(original.enabled) || Number(option.weight ?? 1) !== Number(original.weight ?? 1)) updated += 1
  }
  return { added, updated, disabled }
}

export function stableFingerprint(pool: WheelPool): string {
  let hash = 2166136261
  const value = JSON.stringify(pool.options.map(({ id, name, enabled, weight }) => ({ id, name, enabled: enabled !== false, weight: weight ?? 1 })))
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a-${(hash >>> 0).toString(16)}`
}

export function validateOverride(pool: WheelPool, options: readonly WheelOption[]): string | null {
  const ids = new Set<string>()
  for (const option of options) {
    if (!option.id.trim() || ids.has(option.id)) return '事件 ID 必须唯一。'
    ids.add(option.id)
    if (!option.name.trim()) return '事件文本不能为空。'
    const weight = Number(option.weight ?? 1)
    if (!Number.isFinite(weight) || weight <= 0 || weight > 1_000_000) return '权重必须是 0.01 到 1000000 之间的有限正数。'
  }
  if (!options.some((option) => option.enabled !== false && Number(option.weight ?? 1) > 0)) return '至少保留一个启用且权重为正的事件。'
  return null
}

export function makeOverride(pool: WheelPool, options: readonly WheelOption[]): WheelOverride {
  return { poolId: pool.id, poolName: pool.name, options: copyOptions(options) }
}

export function createOverrideExport(overrides: WheelOverrides, generatedAt = new Date().toISOString()): WheelOverrideExport {
  const pools = Object.values(overrides).map((override) => {
    const pool = wheelData.decisions.find((candidate) => candidate.id === override.poolId)
    const base: WheelPool = pool ?? {
      id: override.poolId,
      name: override.poolName,
      tags: [],
      options: [],
    }
    return {
      ...makeOverride(base, override.options),
      baseFingerprint: stableFingerprint(base),
      summary: overrideSummary(base, override.options),
    }
  })
  return {
    format: 'douluo-wheel-overrides',
    formatVersion: 1,
    source: { wheelDataVersion: wheelData.version, wheelDataExportDate: wheelData.exportDate },
    generatedAt,
    poolCount: pools.length,
    pools,
  }
}

export function parseOverrides(raw: string | null): WheelOverrides {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: WheelOverrides = {}
    for (const [poolId, value] of Object.entries(parsed as Record<string, unknown>)) {
      const candidate = value as Partial<WheelOverride>
      if (candidate.poolId === poolId && typeof candidate.poolName === 'string' && Array.isArray(candidate.options)) {
        result[poolId] = makeOverride({ id: poolId, name: candidate.poolName, tags: [], options: [] }, candidate.options as WheelOption[])
      }
    }
    return result
  } catch {
    return {}
  }
}
