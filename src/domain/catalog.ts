import rawData from '@/data/wheels.json'
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
const beastMartialSoulPools = createBeastMartialSoulPools()
const toolMartialSoulPools = createToolMartialSoulPools()
const virtualPools = [...beastMartialSoulPools, ...toolMartialSoulPools]
const poolsByName = new Map([...wheelData.decisions, ...virtualPools].map((pool) => [pool.name, pool]))

export const tagNames = wheelData.tags.map((tag) => tag.name)

export function poolsForTag(tagName: string): WheelPool[] {
  return [...wheelData.decisions, ...virtualPools].filter((pool) =>
    pool.tags.some((id) => tagsById.get(id)?.name === tagName),
  )
}

export function findPool(name: string): WheelPool | undefined {
  const exact = poolsByName.get(name)
  if (exact) return exact
  return [...wheelData.decisions, ...virtualPools].find((pool) => pool.name.includes(name))
}

function createBeastMartialSoulPools(): WheelPool[] {
  const source = (rawData as WheelData).decisions.find((pool) => pool.name === '兽武魂')
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
  const source = (rawData as WheelData).decisions.find((pool) => pool.name === '器武魂')
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
  return wheelData.decisions
    .map((pool) => ({ pool, options: enabledOptions(pool).length, tag: getTagName(pool) }))
    .filter(({ options }) => options >= 20)
    .sort((left, right) => right.options - left.options)
    .slice(0, limit)
}
