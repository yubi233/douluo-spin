import rawData from '@/data/wheels.json'
import {
  ANIME_EXPANDED_MARTIAL_SOULS,
  CANONICAL_POOL_ADDITIONS,
  CROSSOVER_BEAST_MARTIAL_SOULS,
  CROSSOVER_BODY_MARTIAL_SOULS,
  FACTION_STORY_DEFINITIONS,
  FIREARM_MARTIAL_SOULS,
  FIREARM_STORY_OPTIONS,
  FIREARM_STORY_POOL_NAME,
  SHREK_MENTOR_ENTRY_OPTIONS,
  SHREK_MENTOR_ENTRY_POOL_NAME,
  SHREK_MENTOR_REUNION_OPTIONS,
  SHREK_MENTOR_REUNION_POOL_NAME,
  SHREK_MENTOR_TOURNAMENT_OPTIONS,
  SHREK_MENTOR_TOURNAMENT_POOL_NAME,
} from './canonAdditions'
import {
  BEAST_MARTIAL_SOUL_CATEGORIES,
  BEAST_MARTIAL_SOUL_CATEGORY_POOL,
  TOOL_MARTIAL_SOUL_CATEGORIES,
  TOOL_MARTIAL_SOUL_CATEGORY_POOL,
  beastMartialSoulPoolName,
  classifyBeastMartialSoul,
  classifyToolMartialSoul,
  toolMartialSoulPoolName,
} from './martialSoulCategories'
import type { WheelData, WheelOption, WheelPool } from './types'

export const wheelData = rawData as WheelData

const tagsById = new Map(wheelData.tags.map((tag) => [tag.id, tag]))
const catalogDecisions = createCatalogDecisions()
const beastMartialSoulPools = createBeastMartialSoulPools()
const toolMartialSoulPools = createToolMartialSoulPools()
const firearmStoryPools = createFirearmStoryPools()
const seniorStoryPools = createSeniorStoryPools()
const factionStoryPools = createFactionStoryPools()
const virtualPools = [...beastMartialSoulPools, ...toolMartialSoulPools, ...firearmStoryPools, ...seniorStoryPools, ...factionStoryPools]
const catalogPools = [...catalogDecisions, ...virtualPools]
const poolsByName = new Map(catalogPools.map((pool) => [pool.name, pool]))

export const tagNames = wheelData.tags.map((tag) => tag.name)

export function poolsForTag(tagName: string): WheelPool[] {
  return catalogPools.filter((pool) =>
    pool.tags.some((id) => tagsById.get(id)?.name === tagName),
  )
}

export function findPool(name: string): WheelPool | undefined {
  const exact = poolsByName.get(name)
  if (exact) return exact
  return catalogPools.find((pool) => pool.name.includes(name))
}

function createCatalogDecisions(): WheelPool[] {
  return wheelData.decisions.map((pool) => {
    const correctedPool = pool.name === '基础设定8:穿越时期'
      ? {
          ...pool,
          options: pool.options.map((option) => option.name === '唐三6岁' ? { ...option, weight: 20 } : option),
        }
      : pool
    const additions: Array<{ name: string; weight?: number }> = [
      ...(CANONICAL_POOL_ADDITIONS[correctedPool.name] ?? []).map((name) => ({ name })),
      ...(ANIME_EXPANDED_MARTIAL_SOULS[correctedPool.name] ?? []).map((name) => ({ name })),
      ...(correctedPool.name === '兽武魂' ? CROSSOVER_BEAST_MARTIAL_SOULS.map((name) => ({ name })) : []),
      ...(correctedPool.name === '本体武魂' ? CROSSOVER_BODY_MARTIAL_SOULS.map((name) => ({ name })) : []),
      ...(correctedPool.name === '器武魂' ? FIREARM_MARTIAL_SOULS : []),
    ]
    if (!additions.length) return correctedPool

    const existingNames = new Set(correctedPool.options.map((option) => option.name))
    const options = additions
      .filter(({ name }) => !existingNames.has(name))
      .map(({ name, weight }) => ({
        id: `canon-${encodeURIComponent(correctedPool.name)}-${encodeURIComponent(name)}`,
        name,
        ...(weight == null ? {} : { weight }),
      }))
    return options.length ? { ...correctedPool, options: [...correctedPool.options, ...options] } : correctedPool
  })
}

function createBeastMartialSoulPools(): WheelPool[] {
  const source = catalogDecisions.find((pool) => pool.name === '兽武魂')
  if (!source) return []

  const groups = new Map<string, WheelOption[]>()
  for (const category of BEAST_MARTIAL_SOUL_CATEGORIES) groups.set(category, [])
  for (const option of source.options) groups.get(classifyBeastMartialSoul(option))?.push({ ...option })

  const categoryOptions = BEAST_MARTIAL_SOUL_CATEGORIES
    .map((category) => ({ category, options: groups.get(category) ?? [] }))
    .filter(({ options }) => options.length > 0)

  return [
    {
      id: 'virtual-beast-martial-soul-category',
      name: BEAST_MARTIAL_SOUL_CATEGORY_POOL,
      description: '先抽取兽武魂大类，再进入对应子转盘抽取具体兽武魂。',
      tags: source.tags,
      options: categoryOptions.map(({ category, options }) => ({
        id: `beast-martial-category-${category}`,
        name: category,
        weight: options.length,
      })),
    },
    ...categoryOptions.map(({ category, options }) => ({
      id: `virtual-beast-martial-soul-${category}`,
      name: beastMartialSoulPoolName(category),
      description: `兽武魂分类子池：${category}`,
      tags: source.tags,
      options,
    })),
  ]
}

function createToolMartialSoulPools(): WheelPool[] {
  const source = catalogDecisions.find((pool) => pool.name === '器武魂')
  if (!source) return []

  const groups = new Map<string, WheelOption[]>()
  for (const category of TOOL_MARTIAL_SOUL_CATEGORIES) groups.set(category, [])
  for (const option of source.options) groups.get(classifyToolMartialSoul(option))?.push({ ...option })

  const categoryOptions = TOOL_MARTIAL_SOUL_CATEGORIES
    .map((category) => ({ category, options: groups.get(category) ?? [] }))
    .filter(({ options }) => options.length > 0)

  return [
    {
      id: 'virtual-tool-martial-soul-category',
      name: TOOL_MARTIAL_SOUL_CATEGORY_POOL,
      description: '先抽取器武魂大类，再进入对应子转盘抽取具体器武魂。',
      tags: source.tags,
      options: categoryOptions.map(({ category, options }) => ({
        id: `tool-martial-category-${category}`,
        name: category,
        weight: options.length,
      })),
    },
    ...categoryOptions.map(({ category, options }) => ({
      id: `virtual-tool-martial-soul-${category}`,
      name: toolMartialSoulPoolName(category),
      description: `器武魂分类子池：${category}`,
      tags: source.tags,
      options,
    })),
  ]
}

function createFirearmStoryPools(): WheelPool[] {
  const source = catalogDecisions.find((pool) => pool.name === '特殊成长经历')
  if (!source) return []

  return [{
    id: 'virtual-firearm-story',
    name: FIREARM_STORY_POOL_NAME,
    description: '仅枪械类武魂可触发的特殊成长剧情，侧重越级击杀、火力压制与魂导改造。',
    tags: source.tags,
    options: FIREARM_STORY_OPTIONS.map((option, index) => ({
      id: `firearm-story-${index + 1}`,
      ...option,
    })),
  }]
}

function createSeniorStoryPools(): WheelPool[] {
  const source = catalogDecisions.find((pool) => pool.name === '剧情1:是否参与入学剧情（史莱克学院限定）（唐三12岁限定）')
  if (!source) return []

  return [
    {
      id: 'virtual-shrek-mentor-entry',
      name: SHREK_MENTOR_ENTRY_POOL_NAME,
      description: '超过学院大赛参赛年龄的角色，以客卿导师而非学员身份介入史莱克剧情。',
      tags: source.tags,
      options: SHREK_MENTOR_ENTRY_OPTIONS.map((option, index) => ({ id: `shrek-mentor-entry-${index + 1}`, ...option })),
    },
    {
      id: 'virtual-shrek-mentor-tournament',
      name: SHREK_MENTOR_TOURNAMENT_POOL_NAME,
      description: '导师只负责教学、带队和保护学员，不占用学院大赛参赛名额。',
      tags: source.tags,
      options: SHREK_MENTOR_TOURNAMENT_OPTIONS.map((option, index) => ({ id: `shrek-mentor-tournament-${index + 1}`, ...option })),
    },
    {
      id: 'virtual-shrek-mentor-reunion',
      name: SHREK_MENTOR_REUNION_POOL_NAME,
      description: '七怪重聚阶段沿用导师身份，不重新回到学员或八怪成员位置。',
      tags: source.tags,
      options: SHREK_MENTOR_REUNION_OPTIONS.map((option, index) => ({ id: `shrek-mentor-reunion-${index + 1}`, ...option })),
    },
  ]
}

function createFactionStoryPools(): WheelPool[] {
  const source = catalogDecisions.find((pool) => pool.name === '人物背景or加入的势力（6岁限定）')
  if (!source) return []

  return FACTION_STORY_DEFINITIONS.map((definition) => ({
    id: `virtual-faction-story-${definition.id}`,
    name: definition.poolName,
    description: definition.description,
    tags: source.tags,
    options: definition.options.map((option, index) => ({
      id: `faction-story-${definition.id}-${index + 1}`,
      name: option.name,
      weight: option.weight,
      requirements: option.requirements,
    })),
  }))
}

export function optionWeight(option: WheelOption): number {
  const weight = Number(option.weight)
  return Number.isFinite(weight) && weight >= 0 ? weight : 1
}

export function enabledOptions(pool: WheelPool): WheelOption[] {
  return pool.options.filter((option) => option.enabled !== false)
}

export function poolStats(pool: WheelPool) {
  const options = enabledOptions(pool)
  const totalWeight = options.reduce((sum, option) => sum + optionWeight(option), 0)
  return {
    options: options.length,
    totalWeight,
    highestWeight: Math.max(...options.map(optionWeight)),
  }
}

export function getTagName(pool: WheelPool): string {
  const firstTag = pool.tags[0]
  return firstTag ? tagsById.get(firstTag)?.name ?? '未分类' : '未分类'
}

export function recategorizationCandidates(limit = 12) {
  return catalogDecisions
    .map((pool) => ({ pool, options: enabledOptions(pool).length, tag: getTagName(pool) }))
    .filter(({ options }) => options >= 20)
    .sort((left, right) => right.options - left.options)
    .slice(0, limit)
}
