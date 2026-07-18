import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { entityId, optionId, poolId } from '@/core/ids'
import { v03Content } from '@/content/v03/content'

function typescriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? typescriptFiles(path) : path.endsWith('.ts') ? [path] : []
  })
}

describe('v0.3 core architecture', () => {
  it('keeps core independent from Vue, browser infrastructure and the legacy domain', () => {
    for (const file of typescriptFiles('src/core')) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toMatch(/from\s+['"]vue['"]|@\/domain|localStorage|\bdocument\.|\bwindow\./)
    }
  })

  it('accepts stable semantic IDs and rejects display text as identity', () => {
    expect(poolId('pool.setup.gender')).toBe('pool.setup.gender')
    expect(optionId('option.gender.male')).toBe('option.gender.male')
    expect(entityId('entity.gender.male')).toBe('entity.gender.male')
    expect(() => poolId('基础设定3:你的性别是？')).toThrow(/stable ASCII identifier/)
    expect(() => optionId('Option With Spaces')).toThrow(/stable ASCII identifier/)
  })

  it('resolves every process-manager pool reference without name fallback', () => {
    const references = typescriptFiles('src/core/processes').flatMap((file) => {
      const source = readFileSync(file, 'utf8')
      return [...source.matchAll(/poolId\('([^']+)'\)/g)].map((match) => match[1]!)
    })
    references.push(
      ...[1, 2, 3, 4].map((index) => `pool.story.${index}`),
      ...[1, 2, 3, 4].map((index) => `pool.postwar.${index}`),
    )
    expect([...new Set(references)].filter((id) => !v03Content.mechanics.pools.has(id as never))).toEqual([])
  })
})
