import { computed, readonly, shallowRef } from 'vue'
import { findPool } from '@/domain/catalog'
import {
  createOverrideExport,
  effectivePool,
  makeOverride,
  parseOverrides,
  validateOverride,
  WHEEL_OVERRIDE_STORAGE_KEY,
  type WheelOverrides,
} from '@/domain/overrides'
import type { WheelOption, WheelPool } from '@/domain/types'

function load(): WheelOverrides {
  if (typeof window === 'undefined') return {}
  return parseOverrides(localStorage.getItem(WHEEL_OVERRIDE_STORAGE_KEY))
}

const overrides = shallowRef<WheelOverrides>(load())

function persist() {
  try {
    localStorage.setItem(WHEEL_OVERRIDE_STORAGE_KEY, JSON.stringify(overrides.value))
  } catch {
    // The game stays usable when browser storage is unavailable.
  }
}

export function useWheelOverrides() {
  function effective(pool: WheelPool): WheelPool {
    return effectivePool(pool, overrides.value)
  }

  function resolve(name: string): WheelPool | undefined {
    const pool = findPool(name)
    return pool ? effective(pool) : undefined
  }

  function apply(pool: WheelPool, options: readonly WheelOption[]): string | null {
    const error = validateOverride(pool, options)
    if (error) return error
    overrides.value = { ...overrides.value, [pool.id]: makeOverride(pool, options) }
    persist()
    return null
  }

  function reset(poolId: string) {
    if (!(poolId in overrides.value)) return
    const next = { ...overrides.value }
    delete next[poolId]
    overrides.value = next
    persist()
  }

  function clear() {
    overrides.value = {}
    persist()
  }

  function exportJson() {
    return JSON.stringify(createOverrideExport(overrides.value), null, 2)
  }

  return {
    overrides: readonly(overrides),
    count: computed(() => Object.keys(overrides.value).length),
    effective,
    resolve,
    apply,
    reset,
    clear,
    exportJson,
  }
}
