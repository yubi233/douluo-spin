import { describe, expect, it } from 'vitest'
import { enabledOptions, findPool, poolsForTag, recategorizationCandidates, wheelData } from '@/domain/catalog'

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

  it('adds virtual beast martial soul category pools without changing source data', () => {
    const source = findPool('兽武魂')
    const category = findPool('兽武魂分类')
    expect(source?.options).toHaveLength(113)
    expect(category?.options.map((option) => option.name)).toContain('龙族')
    expect(category?.options.map((option) => option.name)).toContain('猫科')
    const nestedTotal = category!.options.reduce((sum, option) => sum + (findPool(`兽武魂：${option.name}`)?.options.length ?? 0), 0)
    expect(nestedTotal).toBe(source?.options.length)
  })

  it('adds virtual tool martial soul category pools without changing source data', () => {
    const source = findPool('器武魂')
    const category = findPool('器武魂分类')
    expect(source?.options).toHaveLength(61)
    expect(category?.options.map((option) => option.name)).toContain('剑类')
    expect(category?.options.map((option) => option.name)).toContain('枪矛戟类')
    expect(category?.options.map((option) => option.name)).toContain('塔鼎容器')
    const nestedTotal = category!.options.reduce((sum, option) => sum + (findPool(`器武魂：${option.name}`)?.options.length ?? 0), 0)
    expect(nestedTotal).toBe(source?.options.length)
  })

  it('surfaces large wheels that should be considered for recategorization', () => {
    const candidates = recategorizationCandidates(3)
    expect(candidates.map((candidate) => candidate.pool.name)).toEqual(['兽武魂', '器武魂', '故事开始时的魂力等级（18岁限定）'])
  })
})
