import { enabledOptions, optionWeight } from './catalog'
import { FIREARM_MARTIAL_SOUL_NAMES } from './canonAdditions'
import { highestMartialSoulTier, getMartialSoulTier } from './martialSoulTiers'
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
  if (!isCombat) {
    if (task.handler === 'initialPower') return baseWeight * innatePowerMultiplier(option.name, context)
    return baseWeight
  }

  let multiplier = 1

  if (isFirearmMartialSoul(context) && isOverlevelKillOutcome(option.name)) {
    multiplier = Math.max(multiplier, 2)
  }

  if (task.handler === 'story') {
    const power = calculateCombatPower(context)
    multiplier *= combatPowerMultiplier(option.name, power, context.level)
  }

  return baseWeight * multiplier
}

function innatePowerMultiplier(name: string, context: GameContext): number {
  const tier = highestMartialSoulTier(context)
  if (tier >= 6) return 1  // tier 6 uses special pool, no bias needed

  let level: number
  if (/先天二十级|二十级/.test(name)) level = 20
  else if (/先天满魂力/.test(name)) level = 10
  else {
    const match = name.match(/(\d+)级/)
    if (!match || !match[1]) return 1
    level = parseInt(match[1])
  }

  const targets: Record<number, number> = { 1: 1, 2: 3, 3: 5, 4: 7, 5: 9 }
  const target = targets[tier] ?? 5
  const sigma = 1.8
  const diff = level - target

  return Math.exp(-(diff * diff) / (2 * sigma * sigma)) * 8
}

function ringPower(years: number): number {
  if (years <= 0) return 0
  if (years < 100) return Math.round(5 + (years - 10) / 90 * 3)
  if (years < 1000) return Math.round(9 + (years - 100) / 900 * 2)
  if (years < 10000) return Math.round(12 + (years - 1000) / 9000 * 3)
  if (years < 100000) return Math.round(16 + (years - 10000) / 90000 * 4)
  if (years < 1000000) return Math.round(21 + (years - 100000) / 900000 * 9)
  return Math.round(31 + Math.min(9, (years - 1000000) / 1000000 * 9))
}

const TIER_POWER: Record<number, number> = { 1: 0, 2: 3, 3: 8, 4: 15, 5: 25, 6: 45 }

function parseSoulBoneYears(text: string): number {
  const match = text.match(/(\d+)万/)
  if (match && match[1]) return parseInt(match[1]) * 10000
  const match2 = text.match(/(\d{4,})年/)
  if (match2 && match2[1]) return parseInt(match2[1])
  return 10000
}

function bonePower(text: string): number {
  const years = parseSoulBoneYears(text)
  if (years <= 0) return 5
  if (years < 10000) return Math.round(5 + (years - 1000) / 9000 * 3)
  if (years < 50000) return Math.round(8 + (years - 10000) / 40000 * 4)
  if (years < 100000) return Math.round(12 + (years - 50000) / 50000 * 4)
  return Math.round(16 + Math.min(4, (years - 100000) / 400000 * 4))
}

export function calculateCombatPower(context: GameContext): number {
  let power = 0

  power += context.level * context.level / 20

  for (const ring of context.rings) power += ringPower(ring.years)

  for (const name of context.martialSouls) {
    const tier = getMartialSoulTier(name)
    power += TIER_POWER[tier] ?? 0
  }

  power += context.domains.length * 15

  for (const bone of context.soulBones) power += bonePower(bone)

  const talentCount = Math.min(context.talents.length, 10)
  const talentCoeff = talentCount * 0.005

  let battleTraitCount = 0
  for (const trait of context.traits) {
    if (/[杀战斗力破斩暴狂怒王]/.test(trait)) battleTraitCount += 1
  }
  const traitCoeff = Math.min(battleTraitCount, 10) * 0.005

  power *= (1 + talentCoeff + traitCoeff)

  return Math.round(power)
}

export function estimateOpponentLevel(text: string): number {
  const levelMatch = text.match(/对战(\d+)级/)
  if (levelMatch?.[1]) return parseInt(levelMatch[1])

  const reqMatch = text.match(/要求(\d+)\+级/)
  if (reqMatch?.[1]) return parseInt(reqMatch[1])

  const named: Array<[RegExp, number]> = [
    // 神级对手 (嘉陵关/神战时期)
    [/罗刹神?/, 102], [/天使神?/, 102], [/海神/, 102],
    [/修罗神/, 103],

    // 武魂殿顶级 (嘉陵关时期)
    [/比比东/, 98], [/千仞雪/, 96],
    [/金鳄斗罗|\d+级金鳄/, 98],

    // 天斗/昊天 (嘉陵关时期)
    [/唐三.*/, 93], [/唐昊/, 97], [/唐啸/, 97],
    [/剑斗罗/, 96], [/骨斗罗/, 95],

    // 武魂殿封号斗罗
    [/雄狮斗罗|\d+级雄狮/, 97],
    [/光翎斗罗|\d+级光翎/, 97],
    [/菊斗罗/, 95], [/鬼斗罗/, 95],

    // 嘉陵关战场
    [/呼延震/, 89], [/赵无极/, 78], [/弗兰德/, 78],

    // 史莱克七怪 (嘉陵关时期)
    [/戴沐白/, 86], [/马红俊/, 85], [/宁荣荣/, 82],
    [/奥斯卡/, 83], [/朱竹清/, 85], [/幽冥白虎/, 88],
    [/小舞/, 60], [/史莱克六怪/, 85],

    // 超级魂兽
    [/帝天/, 99], [/熊君/, 96], [/深海魔鲸王/, 98],
    [/冰帝/, 93],
  ]
  for (const [regex, level] of named) {
    if (regex.test(text)) return level
  }

  if (/封号斗罗/.test(text)) return 93
  if (/魂圣/.test(text)) return 75
  if (/魂帝/.test(text)) return 65
  if (/魂王/.test(text)) return 50
  if (/魂宗/.test(text)) return 40
  if (/十万年魂兽/.test(text)) return 93

  return 0
}

function combatPowerMultiplier(text: string, playerPower: number, playerLevel: number): number {
  const isVictory = /无伤战胜|轻松战胜|秒杀|斩杀|获胜|胜出|单刷|拿下|带领.*获胜|一人.*斩杀|击败|战胜|平推|反杀|轻伤战胜|无伤/.test(text)
  const isDefeat = /战死|被击杀|重伤|落败|战败|被秒杀|被围攻|拖后腿|失败|翻车|被.*(?:杀|吞|秒|斩|重创)|被吃|战败身死/.test(text)

  if (!isVictory && !isDefeat) return 1

  const opponentLevel = estimateOpponentLevel(text)
  const opponentPower = opponentLevel > 0 ? Math.round(opponentLevel * opponentLevel / 20) : 0

  if (opponentPower <= 0) {
    if (isVictory) return 1 + Math.min(playerPower / 100, 5)
    if (isDefeat) return Math.max(0.05, 1 - Math.min(playerPower / 120, 0.95))
    return 1
  }

  const ratio = playerPower / Math.max(1, opponentPower)

  if (isVictory) return Math.max(0.1, Math.min(10, ratio * 2))
  if (isDefeat) return Math.max(0.05, Math.min(10, 1 / Math.max(0.1, ratio) * 2))
  return 1
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

function hasEligibilityConstraint(option: WheelOption): boolean {
  return Boolean(option.requirements) || /限定|要求|无法重复获得|已拥有则重抽|负面剧情触发|战斗剧情触发/.test(option.name)
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
  const namedDomain = text.match(/([\u4e00-\u9fa5]{2,}领域)限定/)?.[1]
  if (namedDomain && !context.domains.includes(namedDomain)) return false
  if (/已拥有部位则重抽/.test(task.pool) && context.soulBones.some((bone) => bone.includes(text))) return false
  if (/要求拥有【([^】]+)】/.test(text)) {
    const required = text.match(/要求拥有【([^】]+)】/)?.[1]
    if (required && !allTraits.includes(required)) return false
  }
  if (/无法重复获得|已拥有则重抽|无法叠加则重抽/.test(text)) {
    const named = [...text.matchAll(/【([^】]+)】/g)].map((match) => match[1]).filter((name): name is string => Boolean(name))
    if (named.some((name) => allTraits.includes(name))) return false
  }
  if (/B级以上容貌限定/.test(text) && !containsAny(context.appearance, ['B', 'A', 'S', 'EX'])) {
    return false
  }
  if (/极致武魂限定/.test(text) && !context.martialSoulTypes.includes('极致武魂')) return false
  if (/海魂兽/.test(text) && /限定|要求/.test(text) && context.beast?.type !== '海魂兽') return false
  if (/兽武魂限定/.test(text) && !context.martialSoulTypes.includes('兽武魂')) return false
  if (/器武魂限定/.test(text) && !context.martialSoulTypes.includes('器武魂')) return false

  const martialSoulNames = context.martialSouls.join('、')
  const attributeChecks: Array<[RegExp, RegExp]> = [
    [/火属性武魂限定/, /火|炎|焰|烈|赤|焚|灼|阳/],
    [/水属性武魂限定/, /水|海|潮|浪|波|涛|冰|雪/],
    [/雷属性武魂限定/, /雷|电|霆/],
    [/冰属性武魂限定/, /冰|雪|寒|霜|冻/],
    [/风属性武魂限定/, /风|飘|气/],
    [/光属性武魂限定/, /光|日|圣|明/],
    [/暗属性武魂限定/, /暗|黑|魔|影|幽冥|邪|死|罗刹/],
    [/生命属性武魂限定/, /生命|木|花|草|药|树/],
    [/毁灭属性武魂限定/, /毁灭|破|灭|崩/],
    [/剑类武魂限定/, /剑/],
    [/刀类武魂限定/, /刀/],
    [/枪类武魂限定/, /枪|矛|戟/],
    [/弓类武魂限定/, /弓/],
    [/龙族武魂限定/, /龙/],
  ]
  for (const [pattern, matcher] of attributeChecks) {
    if (pattern.test(text) && !matcher.test(martialSoulNames)) return false
  }

  if (/S级以上容貌限定/.test(text) && !/[SX]/.test(context.appearance)) return false

  const badCountMatch = text.match(/负面剧情触发大于(\d+)次限定/)
  if (badCountMatch) {
    const required = Number(badCountMatch[1])
    if ((Number(context.flags._badCount) || 0) <= required) return false
  }

  const combatCountMatch = text.match(/战斗剧情触发大于(\d+)次限定/)
  if (combatCountMatch) {
    const required = Number(combatCountMatch[1])
    if ((Number(context.flags._combatCount) || 0) <= required) return false
  }

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
    : /已拥有部位则重抽/.test(task.pool) || enabled.some(hasEligibilityConstraint)
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

export function drawUniformOption(pool: WheelPool, task: RollTask, context: GameContext): DrawResult {
  const candidates = candidateDistribution(pool, task, context)
  if (candidates.length === 0) throw new Error(`转盘“${pool.name}”没有可用选项`)

  const random = nextRandom(context.rng)
  const index = Math.min(candidates.length - 1, Math.floor(random.value * candidates.length))
  const selected = candidates[index]!
  return {
    option: selected.option,
    probability: 1 / candidates.length,
    nextRng: random.state,
    eligibleCount: candidates.length,
  }
}

export function previewOptions(pool: WheelPool, task: RollTask, context: GameContext): WheelOption[] {
  return candidateDistribution(pool, task, context).map((candidate) => ({ ...candidate.option, weight: candidate.weight }))
}
