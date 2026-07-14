import { enabledOptions, optionWeight } from './catalog'
import { nextRandom } from './random'
import type { GameContext, RollTask, WheelOption, WheelPool } from './types'

export interface DrawResult {
  option: WheelOption
  probability: number
  nextRng: number
  eligibleCount: number
}

function containsAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value))
}

export function isEligible(option: WheelOption, task: RollTask, context: GameContext): boolean {
  const text = option.name
  const allTraits = [
    ...context.talents,
    ...context.traits,
    ...context.domains,
    ...context.martialSoulTypes,
    ...context.martialSouls,
  ].join('、')

  if (/男性限定|要求男性/.test(text) && !context.gender.includes('男')) return false
  if (/女性限定|要求女性/.test(text) && !context.gender.includes('女')) return false
  if (/要求有神考|需要神考/.test(text) && !context.godTrial) return false
  if (/要求.*领域/.test(text) && context.domains.length === 0) return false
  if (/要求拥有【([^】]+)】/.test(text)) {
    const required = text.match(/要求拥有【([^】]+)】/)?.[1]
    if (required && !allTraits.includes(required)) return false
  }
  if (/无法重复获得|已拥有则重抽/.test(text)) {
    const named = [...text.matchAll(/【([^】]+)】/g)].map((match) => match[1]).filter((name): name is string => Boolean(name))
    if (named.some((name) => allTraits.includes(name))) return false
  }
  if (/B级以上容貌限定/.test(text) && !containsAny(context.appearance, ['B', 'A', 'S', 'EX'])) {
    return false
  }
  if (/极致武魂限定/.test(text) && !context.martialSoulTypes.includes('极致武魂')) return false
  if (/海魂兽/.test(text) && /限定|要求/.test(text) && context.beast?.type !== '海魂兽') return false
  if (task.meta?.only && !String(task.meta.only).split('|').some((value) => text.includes(value))) return false
  return true
}

export function drawOption(pool: WheelPool, task: RollTask, context: GameContext): DrawResult {
  const enabled = enabledOptions(pool)
  const eligible = enabled.filter((option) => isEligible(option, task, context))
  const candidates = eligible.length > 0 ? eligible : enabled
  if (candidates.length === 0) throw new Error(`转盘“${pool.name}”没有可用选项`)

  const total = candidates.reduce((sum, option) => sum + optionWeight(option), 0)
  const random = nextRandom(context.rng)
  let cursor = random.value * total
  let selected = candidates[candidates.length - 1]!
  for (const option of candidates) {
    cursor -= optionWeight(option)
    if (cursor <= 0) {
      selected = option
      break
    }
  }
  return {
    option: selected,
    probability: optionWeight(selected) / total,
    nextRng: random.state,
    eligibleCount: candidates.length,
  }
}

export function previewOptions(pool: WheelPool, task: RollTask, context: GameContext): WheelOption[] {
  const eligible = enabledOptions(pool).filter((option) => isEligible(option, task, context))
  return eligible.length > 0 ? eligible : enabledOptions(pool)
}
