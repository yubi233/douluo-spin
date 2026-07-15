import { describe, expect, it } from 'vitest'
import {
  FACTION_STORY_DEFINITIONS,
  FIREARM_STORY_POOL_NAME,
  SHREK_MENTOR_ENTRY_POOL_NAME,
  SHREK_MENTOR_REUNION_POOL_NAME,
  SHREK_MENTOR_TOURNAMENT_POOL_NAME,
} from '@/domain/canonAdditions'
import { enabledOptions, findPool, poolsForTag, recategorizationCandidates, wheelData } from '@/domain/catalog'
import { advanceWheelRotation, normalizeDegrees, targetRotationForSegment } from '@/utils/wheelGeometry'

describe('wheel catalog', () => {
  it('preserves the complete embedded source data', () => {
    expect(wheelData.decisions).toHaveLength(275)
    expect(wheelData.tags).toHaveLength(25)
    expect(wheelData.decisions.reduce((sum, pool) => sum + pool.options.length, 0)).toBe(2468)
  })

  it('indexes pools by exact name and tag', () => {
    const pool = findPool('基础设定3:你的性别是？')
    expect(pool?.name).toBe('基础设定3:你的性别是？')
    expect(enabledOptions(pool!)).not.toHaveLength(0)
    expect(poolsForTag('魂兽雷劫池')).toHaveLength(11)
  })

  it('reduces the effective Tang San age-six entry weight to twenty', () => {
    const option = findPool('基础设定8:穿越时期')?.options.find((candidate) => candidate.name === '唐三6岁')
    expect(option?.weight).toBe(20)
  })

  it('adds virtual beast martial soul category pools without changing source data', () => {
    const source = findPool('兽武魂')
    const category = findPool('兽武魂分类')
    expect(source?.options).toHaveLength(131)
    expect(category?.options.map((option) => option.name)).toContain('龙族')
    expect(category?.options.map((option) => option.name)).toContain('猫科')
    expect(findPool('兽武魂：鸟禽飞行')?.options.map((option) => option.name)).toContain('六翼天使')
    expect(findPool('兽武魂：鸟禽飞行')?.options.map((option) => option.name)).toContain('青鸾神鸟')
    expect(findPool('兽武魂：猫科')?.options.map((option) => option.name)).toContain('烈焰雄狮')
    expect(source?.options.map((option) => option.name)).toEqual(expect.arrayContaining([
      '守鹤', '又旅', '矶抚', '孙悟空', '穆王', '犀犬', '重明', '牛鬼', '九喇嘛',
    ]))
    expect(findPool('兽武魂：猫科')?.options.map((option) => option.name)).toContain('又旅')
    expect(findPool('兽武魂：虫蛛节肢')?.options.map((option) => option.name)).toContain('重明')
    expect(findPool('兽武魂：虫蛛节肢')?.options.map((option) => option.name)).toContain('光明女神蝶')
    const nestedTotal = category!.options.reduce((sum, option) => sum + (findPool(`兽武魂：${option.name}`)?.options.length ?? 0), 0)
    expect(nestedTotal).toBe(source?.options.length)
  })

  it('adds virtual tool martial soul category pools without changing source data', () => {
    const source = findPool('器武魂')
    const category = findPool('器武魂分类')
    expect(source?.options).toHaveLength(75)
    expect(category?.options.map((option) => option.name)).toContain('剑类')
    expect(category?.options.map((option) => option.name)).toContain('枪矛戟类')
    expect(category?.options.map((option) => option.name)).toContain('枪械类')
    expect(category?.options.map((option) => option.name)).toContain('塔鼎容器')
    expect(findPool('器武魂：枪械类')?.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '98k狙击枪', weight: 10 }),
      expect.objectContaining({ name: '东风导弹', weight: 3 }),
    ]))
    expect(findPool('器武魂：弓弩类')?.options.map((option) => option.name)).toContain('光翎神弓')
    const nestedTotal = category!.options.reduce((sum, option) => sum + (findPool(`器武魂：${option.name}`)?.options.length ?? 0), 0)
    expect(nestedTotal).toBe(source?.options.length)
  })

  it('exposes a dedicated firearm martial-soul story pool', () => {
    const pool = findPool(FIREARM_STORY_POOL_NAME)
    expect(pool?.options).toHaveLength(8)
    expect(pool?.options.some((option) => option.name.includes('越级击杀'))).toBe(true)
  })

  it('exposes senior Shrek mentor story pools without student combat outcomes', () => {
    expect(findPool(SHREK_MENTOR_ENTRY_POOL_NAME)?.options.some((option) => option.name.includes('客卿导师'))).toBe(true)
    const tournament = findPool(SHREK_MENTOR_TOURNAMENT_POOL_NAME)
    expect(tournament?.options.every((option) => !/你一打|你单挑|成为学院核心团队成员/.test(option.name))).toBe(true)
    expect(findPool(SHREK_MENTOR_REUNION_POOL_NAME)?.options.every((option) => !/成为八怪成员|与唐三组队2v2/.test(option.name))).toBe(true)
  })

  it('exposes one structured exclusive-story pool for every supported faction', () => {
    expect(FACTION_STORY_DEFINITIONS).toHaveLength(8)
    for (const definition of FACTION_STORY_DEFINITIONS) {
      const pool = findPool(definition.poolName)
      expect(pool?.options).toHaveLength(15)
      expect(pool?.options.every((option) => option.requirements?.minAge != null && option.requirements.storyStages?.length)).toBe(true)
      expect(pool?.options.some((option) => option.requirements?.genders?.includes('男'))).toBe(true)
      expect(pool?.options.some((option) => option.requirements?.genders?.includes('女'))).toBe(true)
    }
  })

  it('adds crossover ocular abilities to the body martial-soul pool', () => {
    expect(findPool('本体武魂')?.options.map((option) => option.name)).toEqual(expect.arrayContaining([
      '轮回眼', '白眼', '写轮眼', '净眼',
    ]))
  })

  it('merges canonical martial soul and soul beast entries into their existing pools', () => {
    expect(findPool('植物系魂兽初始池子')?.options.map((option) => option.name)).toContain('碧磷七绝花')
    expect(findPool('虫蛹类魂兽初始池子')?.options.map((option) => option.name)).toContain('人面魔蛛')
    expect(findPool('海魂兽初始池子')?.options.map((option) => option.name)).toContain('邪魔虎鲸王')
    expect(findPool('器武魂：杖书法器')?.options.map((option) => option.name)).toContain('治疗权杖')
  })

  it('surfaces large wheels that should be considered for recategorization', () => {
    const candidates = recategorizationCandidates(3)
    expect(candidates.map((candidate) => candidate.pool.name)).toEqual(['兽武魂', '器武魂', '故事开始时的魂力等级（18岁限定）'])
  })
})

describe('wheel geometry', () => {
  it('targets any position inside the selected weighted segment at the bottom pointer', () => {
    const weights = [1, 3, 6]
    expect(targetRotationForSegment(weights, 1, 0)).toBeCloseTo(144)
    expect(targetRotationForSegment(weights, 1, 0.5)).toBeCloseTo(90)
    expect(targetRotationForSegment(weights, 1, 1)).toBeCloseTo(36)
  })

  it('keeps forward motion while varying full rotations', () => {
    const fiveTurns = advanceWheelRotation(350, 20, 5)
    const eightTurns = advanceWheelRotation(350, 20, 8)
    expect(normalizeDegrees(fiveTurns)).toBeCloseTo(20)
    expect(normalizeDegrees(eightTurns)).toBeCloseTo(20)
    expect(eightTurns - fiveTurns).toBe(1080)
    expect(fiveTurns).toBeGreaterThan(350)
  })
})
