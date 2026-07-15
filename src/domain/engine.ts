import { enabledOptions, optionWeight } from './catalog'
import { FIREARM_MARTIAL_SOUL_NAMES } from './canonAdditions'
import { nextRandom } from './random'
import type { GameContext, RollTask, WheelOption, WheelPool } from './types'

export interface DrawResult {
  option: WheelOption
  probability: number
  nextRng: number
  eligibleCount: number
}

export interface CandidateDistribution {
  option: WheelOption
  weight: number
  probability: number
  startAngle: number
  endAngle: number
}

function containsAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value))
}

function isFirearmMartialSoul(context: GameContext) {
  return context.martialSouls.some((name) => FIREARM_MARTIAL_SOUL_NAMES.has(name))
}

function isOverlevelKillOutcome(text: string) {
  if (/你被|被[^，。]*(?:击杀|斩杀|杀死|击败)|落败|死亡/.test(text)) return false
  return /越级|反杀|斩杀|击杀|单挑.*(?:战胜|获胜)|1v\d|一人.*(?:斩杀|战胜|击杀)/.test(text)
}

function explicitMinimumLevel(text: string): number | null {
  if (!/限定|否则重抽|要求(?:先天魂力)?\s*\d/.test(text)) return null
  const match = text.match(/(\d+)\s*\+\s*级/) ?? text.match(/要求(?:先天魂力)?\s*(\d+)\s*级以上/)
  return match ? Number(match[1]) : null
}

function roleMinimumLevel(text: string): number | null {
  if (/武魂殿.*长老/.test(text)) return 90
  if (/七宝琉璃宗.*供奉/.test(text)) return 70
  if (/武魂殿.*主教/.test(text)) return 40
  if (/客卿导师|实战与战术导师/.test(text)) return 40
  if (/任职教师/.test(text)) return 30
  if (/副团长/.test(text)) return 30
  return null
}

function candidateWeight(option: WheelOption, task: RollTask, context: GameContext) {
  const baseWeight = optionWeight(option)
  const isCombat = task.handler === 'humanEncounter' || task.handler === 'beastEncounter' || task.handler === 'story'
  return isCombat && isFirearmMartialSoul(context) && isOverlevelKillOutcome(option.name)
    ? baseWeight * 2
    : baseWeight
}

function meetsStructuredRequirements(option: WheelOption, task: RollTask, context: GameContext): boolean {
  const requirements = option.requirements
  if (!requirements) return true

  const age = context.age ?? -1
  if (requirements.minAge != null && age < requirements.minAge) return false
  if (requirements.maxAge != null && age > requirements.maxAge) return false
  if (requirements.minLevel != null && context.level < requirements.minLevel) return false
  if (requirements.maxLevel != null && context.level > requirements.maxLevel) return false
  if (requirements.genders?.length && !requirements.genders.some((gender) => context.gender.includes(gender))) return false

  const storyStage = task.meta?.factionStoryStage
  if (requirements.storyStages?.length && (typeof storyStage !== 'string' || !requirements.storyStages.includes(storyStage))) {
    return false
  }
  return true
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

  if (!meetsStructuredRequirements(option, task, context)) return false
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
  const minimumLevel = explicitMinimumLevel(text) ?? roleMinimumLevel(text)
  if (minimumLevel != null && context.level < minimumLevel) return false
  if (task.meta?.only && !String(task.meta.only).split('|').some((value) => text.includes(value))) return false
  return true
}

export function candidateDistribution(pool: WheelPool, task: RollTask, context: GameContext): CandidateDistribution[] {
  const enabled = enabledOptions(pool).filter((option) => optionWeight(option) > 0)
  const eligible = enabled.filter((option) => isEligible(option, task, context))
  const candidates = eligible.length > 0
    ? eligible
    : enabled.some((option) => option.requirements)
      ? []
      : enabled
  if (candidates.length === 0) return []

  const total = candidates.reduce((sum, option) => sum + candidateWeight(option, task, context), 0)
  let startAngle = 0
  return candidates.map((option) => {
    const weight = candidateWeight(option, task, context)
    const probability = weight / total
    const endAngle = startAngle + probability * Math.PI * 2
    const candidate = { option, weight, probability, startAngle, endAngle }
    startAngle = endAngle
    return candidate
  })
}

export function drawOption(pool: WheelPool, task: RollTask, context: GameContext): DrawResult {
  const candidates = candidateDistribution(pool, task, context)
  if (candidates.length === 0) throw new Error(`转盘“${pool.name}”没有可用选项`)

  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0)
  const random = nextRandom(context.rng)
  let cursor = random.value * total
  let selected = candidates[candidates.length - 1]!
  for (const candidate of candidates) {
    cursor -= candidate.weight
    if (cursor <= 0) {
      selected = candidate
      break
    }
  }
  return {
    option: selected.option,
    probability: selected.probability,
    nextRng: random.state,
    eligibleCount: candidates.length,
  }
}

export function previewOptions(pool: WheelPool, task: RollTask, context: GameContext): WheelOption[] {
  return candidateDistribution(pool, task, context).map((candidate) => ({ ...candidate.option, weight: candidate.weight }))
}
