import rawData from '@/data/wheels.json'
import type { WheelData, WheelOption, WheelPool } from './types'

export const wheelData = rawData as WheelData

const tagsById = new Map(wheelData.tags.map((tag) => [tag.id, tag]))
const poolsByName = new Map(wheelData.decisions.map((pool) => [pool.name, pool]))

export const tagNames = wheelData.tags.map((tag) => tag.name)

export function poolsForTag(tagName: string): WheelPool[] {
  return wheelData.decisions.filter((pool) =>
    pool.tags.some((id) => tagsById.get(id)?.name === tagName),
  )
}

export function findPool(name: string): WheelPool | undefined {
  const exact = poolsByName.get(name)
  if (exact) return exact
  return wheelData.decisions.find((pool) => pool.name.includes(name))
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
