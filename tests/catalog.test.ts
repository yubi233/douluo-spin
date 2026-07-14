import { describe, expect, it } from 'vitest'
import { enabledOptions, findPool, poolsForTag, wheelData } from '@/domain/catalog'

describe('wheel catalog', () => {
  it('preserves the complete embedded source data', () => {
    expect(wheelData.decisions).toHaveLength(273)
    expect(wheelData.tags).toHaveLength(25)
    expect(wheelData.decisions.reduce((sum, pool) => sum + pool.options.length, 0)).toBe(2456)
  })

  it('indexes pools by exact name and tag', () => {
    const pool = findPool('基础设定3:你的性别是？')
    expect(pool?.name).toBe('基础设定3:你的性别是？')
    expect(enabledOptions(pool!)).not.toHaveLength(0)
    expect(poolsForTag('魂兽雷劫池')).toHaveLength(11)
  })
})
