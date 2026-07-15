import rawData from '@/data/wheels.json'
import {
  ANIME_EXPANDED_MARTIAL_SOULS,
  CANONICAL_POOL_ADDITIONS,
  CROSSOVER_BEAST_MARTIAL_SOULS,
  CROSSOVER_BODY_MARTIAL_SOULS,
  FIREARM_MARTIAL_SOULS,
  FIREARM_STORY_OPTIONS,
  FIREARM_STORY_POOL_NAME,
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
const virtualPools = [...beastMartialSoulPools, ...toolMartialSoulPools, ...firearmStoryPools]
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
    const additions: Array<{ name: string; weight?: number }> = [
      ...(CANONICAL_POOL_ADDITIONS[pool.name] ?? []).map((name) => ({ name })),
      ...(ANIME_EXPANDED_MARTIAL_SOULS[pool.name] ?? []).map((name) => ({ name })),
      ...(pool.name === '兽武魂' ? CROSSOVER_BEAST_MARTIAL_SOULS.map((name) => ({ name })) : []),
      ...(pool.name === '本体武魂' ? CROSSOVER_BODY_MARTIAL_SOULS.map((name) => ({ name })) : []),
      ...(pool.name === '器武魂' ? FIREARM_MARTIAL_SOULS : []),
    ]
    if (!additions?.length) return pool

    const existingNames = new Set(pool.options.map((option) => option.name))
    const options = additions
      .filter(({ name }) => !existingNames.has(name))
      .map(({ name, weight }) => ({
        id: `canon-${encodeURIComponent(pool.name)}-${encodeURIComponent(name)}`,
        name,
        ...(weight == null ? {} : { weight }),
      }))
    return options.length ? { ...pool, options: [...pool.options, ...options] } : pool
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
