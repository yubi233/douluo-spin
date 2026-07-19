import { findPool, poolsForTag } from './catalog'
import {
  FACTION_STORY_CHECKPOINTS,
  FIREARM_MARTIAL_SOUL_NAMES,
  FIREARM_STORY_POOL_NAME,
  SHREK_MENTOR_ENTRY_POOL_NAME,
  SHREK_MENTOR_REUNION_POOL_NAME,
  SHREK_MENTOR_TOURNAMENT_POOL_NAME,
  factionStoryDefinitionFor,
} from './canonAdditions'
import { drawOption } from './engine'
import {
  BEAST_MARTIAL_SOUL_CATEGORY_POOL,
  TOOL_MARTIAL_SOUL_CATEGORY_POOL,
  beastMartialSoulPoolName,
  toolMartialSoulPoolName,
} from './martialSoulCategories'
import { hashSeed, nextRandom } from './random'
import { getMartialSoulTier, highestMartialSoulTier } from './martialSoulTiers'
import type {
  ChronicleEntry,
  GameContext,
  MachineEvent,
  MachineState,
  MachineValue,
  RollTask,
  StableMachineValue,
  StartRoute,
  TaskHandler,
  TransitionResult,
  WheelOption,
  WheelPool,
} from './types'

const HUMAN_SETUP: Array<[string, string, TaskHandler]> = [
  ['基础设定', '基础设定3:你的性别是？', 'gender'],
  ['基础设定', '基础设定4:容貌（B级以下无法恋爱）', 'appearance'],
  ['基础设定', '基础设定5:武魂天赋', 'martialType'],
  ['基础设定', '基础设定6:是否拥有特殊天赋', 'specialChance'],
  ['基础设定', '基础设定7:你的年龄', 'age'],
  ['基础设定', '基础设定8:穿越时期', 'period'],
]

const BEAST_SETUP: Array<[string, string, TaskHandler]> = [
  ['魂兽基础设定', '基础设定1:魂兽穿越时期', 'beastPeriod'],
  ['魂兽基础设定', '基础设定2:魂兽性别', 'beastGender'],
  ['魂兽基础设定', '基础设定3:你是什么级别的魂兽', 'beastRealm'],
  ['魂兽基础设定', '基础设定4:你是什么类型的魂兽', 'beastType'],
]

const MARTIAL_POOLS: Record<string, string> = {
  概念型武魂: '概念型武魂',
  变异武魂: '变异武魂',
  本体武魂: '本体武魂',
  极致武魂: '极致武魂',
  兽武魂: BEAST_MARTIAL_SOUL_CATEGORY_POOL,
  器武魂: TOOL_MARTIAL_SOUL_CATEGORY_POOL,
}

const BEAST_SPECIES_POOLS: Record<string, string> = {
  猴子类: '猿猴类魂兽初始池子',
  猿猴类: '猿猴类魂兽初始池子',
  蛇类: '蛇类魂兽初始池子',
  亚龙种: '亚龙种魂兽初始池子',
  地龙种: '地龙种魂兽初始池子',
  纯血龙种: '纯血龙种魂兽初始池',
  翼类: '翼类魂兽初始池子',
  猫科魂兽: '猫科类魂兽初始池子',
  犬科魂兽: '犬科魂兽初始池子',
  精神类魂兽: '精神类魂兽初始池子',
  虫蛹类: '虫蛹类魂兽初始池子',
  兔子类: '兔子类魂兽初始池子',
  植物系魂兽: '植物系魂兽初始池子',
  海魂兽: '海魂兽初始池子（默认全部带水属性，血脉融合则叠加）',
  猪类魂兽: '猪类魂兽',
  熊类: '熊类魂兽池子',
}

const STORY_PLAN: Record<1 | 2 | 3, Array<[number, number, number]>> = {
  1: [[12, 1, 3], [14, 4, 9], [19, 10, 13], [20, 14, 15], [21, 16, 16], [24.5, 17, 18.4], [24.8, 19, 20], [25, 21, 25]],
  2: [[14, 1, 3], [20, 4, 9], [24, 10, 12.4], [24.8, 13, 14], [25, 15, 17]],
  3: [[12, 1, 2], [14, 3, 6], [20, 7, 7], [24, 8, 10.4], [24.8, 11, 12], [25, 13, 17]],
}

const STORY_TAGS: Record<1 | 2 | 3, string> = {
  1: '《斗罗大陆》剧情第一分支',
  2: '《斗罗大陆》剧情第二分支',
  3: '《斗罗大陆》剧情第三分支',
}

const SOUL_BONE_PARTS = ['头骨', '左臂骨', '左腿骨', '右臂骨', '躯干骨', '右腿骨', '外附魂骨']

let taskSequence = 0

function task(tag: string, pool: string, handler: TaskHandler, meta?: RollTask['meta']): RollTask {
  taskSequence += 1
  return { id: `task-${taskSequence}`, tag, pool, handler, meta }
}

function freshContext(): GameContext {
  return {
    seed: '',
    rng: 0,
    route: null,
    name: '无名旅者',
    step: 0,
    age: null,
    tangAge: null,
    gender: '',
    appearance: '',
    level: 0,
    maxLevel: 99,
    faction: '',
    branch: null,
    martialSoulTypes: [],
    martialSouls: [],
    talents: [],
    traits: [],
    domains: [],
    rings: [],
    soulBones: [],
    beast: null,
    godTrial: null,
    queue: [],
    activeTask: null,
    lastPool: '',
    lastOptionId: '',
    lastResult: '',
    lastProbability: null,
    logs: [],
    flags: {},
    alive: true,
    ending: '',
    resumeState: null,
    settings: { softenText: false, spinDuration: 900 },
  }
}

export function createInitialState(): MachineState {
  return { value: 'idle', context: freshContext() }
}

function clone(state: MachineState): MachineState {
  return structuredClone(state)
}

function addUnique(values: string[], value: string) {
  const cleaned = value.replace(/（.*$/, '').trim()
  if (cleaned && !values.includes(cleaned)) values.push(cleaned)
}

function hasFirearmMartialSoul(context: GameContext): boolean {
  return context.martialSouls.some((martialSoul) => FIREARM_MARTIAL_SOUL_NAMES.has(martialSoul))
}

function specialGrowthTask(context: GameContext): RollTask {
  const pool = hasFirearmMartialSoul(context) ? FIREARM_STORY_POOL_NAME : '特殊成长经历'
  return task('特殊成长经历', pool, 'growth')
}

function hasAvailableSoulBone(context: GameContext): boolean {
  return SOUL_BONE_PARTS.some((part) => !context.soulBones.some((bone) => bone.includes(part)))
}

function timeLabel(context: GameContext): string {
  if (context.tangAge == null) return context.age == null ? '时间未定' : `${context.age}岁`
  if (context.tangAge < 0) return `唐三出生前 ${Math.abs(context.tangAge)} 年`
  return `唐三 ${context.tangAge} 岁`
}

function log(context: GameContext, title: string, text: string, tone: ChronicleEntry['tone'] = 'normal') {
  context.logs.push({
    id: `${context.step}-${context.logs.length}-${Date.now()}`,
    step: context.step,
    title,
    text,
    tone,
    time: timeLabel(context),
  })
}

function resolveStartRoute(route: StartRoute, context: GameContext): 'human' | 'beast' {
  if (route !== 'random' && route !== 'transformed') return route
  const pool = findPool('基础设定1:你的种族是？')
  if (!pool) return 'human'
  const raceTask = task('基础设定', pool.name, 'race')
  const result = drawOption(pool, raceTask, context)
  context.rng = result.nextRng
  return result.option.name.includes('魂兽') ? 'beast' : 'human'
}

function initializeRun(route: StartRoute, seed: string): MachineState {
  const context = freshContext()
  context.seed = seed
  context.rng = hashSeed(seed)
  context.name = '命运旅者'
  const resolved = resolveStartRoute(route, context)
  context.route = resolved
  context.queue = (resolved === 'human' ? HUMAN_SETUP : BEAST_SETUP).map(([tagName, pool, handler]) =>
    task(tagName, pool, handler),
  )
  if (resolved === 'beast') {
    context.beast = {
      cultivation: 10,
      species: '',
      type: '',
      area: '',
      bloodlines: [],
      laws: [],
      pendingTribulation: null,
    }
  }
  log(context, '命运启封', `种子：${seed}`, 'major')
  return { value: resolved === 'human' ? 'humanSetup' : 'beastSetup', context }
}

function firstNumber(text: string, fallback = 0): number {
  const match = text.match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : fallback
}

function parseTangAge(text: string): number {
  const number = firstNumber(text, 0)
  return /出生前|之前/.test(text) ? -number : number
}

function parseCultivation(text: string): number {
  const number = firstNumber(text, 10)
  if (/百万/.test(text)) return number * 1_000_000
  if (/十万/.test(text) && number <= 10) return number * 100_000
  if (/万年|万修为|万级/.test(text)) return number * 10_000
  if (/千年/.test(text)) return number * 1_000
  if (/百年/.test(text)) return number * 100
  return number
}

function appearanceGrade(text: string): string {
  return text.match(/EX|[A-FS]/i)?.[0].toUpperCase() ?? text.replace(/（.*$/, '').trim()
}

const FACTION_HISTORY_SEPARATOR = '｜'

function factionHistory(context: GameContext): string[] {
  const stored = context.flags.factionHistory
  if (typeof stored === 'string' && stored) return stored.split(FACTION_HISTORY_SEPARATOR).filter(Boolean)
  return context.faction ? [context.faction] : []
}

function addAffiliation(context: GameContext, affiliation: string) {
  const history = factionHistory(context)
  if (!history.includes(affiliation)) history.push(affiliation)
  context.flags.factionHistory = history.join(FACTION_HISTORY_SEPARATOR)
}

function skipPastStoryMilestones(context: GameContext, branch: 1 | 2 | 3) {
  const currentTime = context.tangAge ?? -999
  const projectedTournamentAge = (context.age ?? 0) + Math.max(0, 14 - currentTime)
  const canStillEnterMentorArc = (branch === 1 || branch === 3) && currentTime < 18 && projectedTournamentAge >= 25
  for (const [time] of STORY_PLAN[branch]) {
    const preserveMentorMilestone = canStillEnterMentorArc && (time === 12 || time === 14)
    if (time < currentTime && !preserveMentorMilestone) context.flags[`story:${branch}@${time}`] = true
  }
}

function setFaction(context: GameContext, text: string) {
  context.faction = text.replace(/（.*$/, '').trim()
  addAffiliation(context, context.faction)
  const factionStory = factionStoryDefinitionFor(context.faction)
  if (factionStory) context.flags.factionId = factionStory.id
  else delete context.flags.factionId
  const branch = /史莱克|分支一/.test(text) ? 1 : /武魂殿|分支二/.test(text) ? 2 : 3
  context.branch = branch
  skipPastStoryMilestones(context, branch)
}

function queueInitialHumanContext(context: GameContext) {
  const age = context.age ?? 6
  const levelPool = age === 6
    ? context.martialSoulTypes.includes('极致武魂') || highestMartialSoulTier(context) >= 6
      ? '极致武魂先天魂力（6岁限定）'
      : '先天魂力（6岁限定）'
    : `故事开始时的魂力等级（${age}岁限定）`
  const factionPool = age < 12
    ? '人物背景or加入的势力（6岁限定）'
    : age < 18
      ? '加入的势力（12岁限定）'
      : '加入的势力（18岁限定）'
  context.queue.push(
    task('初始等级or先天魂力池', levelPool, 'initialPower'),
    task('选择势力', factionPool, 'faction', { stage: age < 12 ? 6 : age < 18 ? 12 : 18 }),
  )
}

function humanGrowthPool(context: GameContext): string {
  const age = context.age ?? 6
  if (age < 12) return '2年后，你的成长（6岁-12岁限定，已达12岁则不可再抽取该池）'
  if (age < 18) return '2年后，你的成长（12岁-18岁限定，已达18岁不可再抽取该池）（没有神位最多到99级）'
  return '2年后，你的成长（18岁+的年龄通用池）（无神位最多只能达到99级）'
}

function nextFactionTask(context: GameContext): RollTask | null {
  if ((context.age ?? 0) >= 18 && !context.flags['faction:18']) {
    return task('选择势力', '加入的势力（18岁限定）', 'faction', { stage: 18 })
  }
  if ((context.age ?? 0) >= 12 && !context.flags['faction:12']) {
    return task('选择势力', '加入的势力（12岁限定）', 'faction', { stage: 12 })
  }
  return null
}

function storyNumber(name: string): number | null {
  const value = name.match(/^剧情(\d+(?:\.\d+)?)/)?.[1]
  return value == null ? null : Number(value)
}

function nextFactionExclusiveStoryTask(context: GameContext): RollTask | null {
  const definition = factionStoryDefinitionFor(context.faction)
  if (!definition) return null

  context.flags.factionId = definition.id
  for (const checkpoint of FACTION_STORY_CHECKPOINTS) {
    const age = context.age ?? -1
    const meetsAge = age >= checkpoint.minAge && (checkpoint.maxAge == null || age <= checkpoint.maxAge)
    const meetsLevel = checkpoint.minLevel == null || context.level >= checkpoint.minLevel
    const flag = `factionStory:${definition.id}:${checkpoint.id}`
    if (!meetsAge || !meetsLevel || context.flags[flag]) continue

    context.flags[flag] = true
    return task('势力专属剧情', definition.poolName, 'story', {
      factionId: definition.id,
      factionStoryStage: checkpoint.id,
    })
  }
  return null
}

function hasPendingShrekMentorStory(context: GameContext): boolean {
  const branch = context.branch
  if (branch !== 1 && branch !== 3) return false

  const currentTime = context.tangAge ?? -999
  if (context.flags.shrekMentor && currentTime >= 19 && !context.flags.shrekMentorReunion) return true

  const milestone = STORY_PLAN[branch].find(([time]) => currentTime >= time && !context.flags[`story:${branch}@${time}`])
  if (!milestone) return false

  const [time] = milestone
  const projectedTournamentAge = (context.age ?? 0) + Math.max(0, 14 - currentTime)
  return projectedTournamentAge >= 25 && (time === 12 || time === 14)
}

function nextStoryTasks(context: GameContext): RollTask[] {
  const branch = context.branch
  if (!branch) return []
  const currentTime = context.tangAge ?? -999
  if (context.flags.shrekMentor && currentTime >= 19 && !context.flags.shrekMentorReunion) {
    context.flags.shrekMentorReunion = true
    if (branch === 1) context.flags['story:1@19'] = true
    return [task(STORY_TAGS[branch], SHREK_MENTOR_REUNION_POOL_NAME, 'story', { milestone: 19 })]
  }
  const milestone = STORY_PLAN[branch].find(([time]) => currentTime >= time && !context.flags[`story:${branch}@${time}`])
  if (!milestone) return []
  const [time, minimum, maximum] = milestone
  context.flags[`story:${branch}@${time}`] = true
  if (currentTime >= 18 && time <= 14) return nextStoryTasks(context)
  const tagName = STORY_TAGS[branch]
  const projectedTournamentAge = (context.age ?? 0) + Math.max(0, 14 - currentTime)
  const requiresMentorRole = (branch === 1 || branch === 3) && projectedTournamentAge >= 25
  if (requiresMentorRole && time === 12) {
    const alreadyTeachingAtShrek = factionHistory(context).some((faction) => /史莱克学院任职教师/.test(faction))
    const only = alreadyTeachingAtShrek
      ? '本就在史莱克'
      : '接受弗兰德|受大师邀请|保持现有身份'
    return [task(tagName, SHREK_MENTOR_ENTRY_POOL_NAME, 'story', { milestone: time, only })]
  }
  if (requiresMentorRole && time === 14) {
    return context.flags.shrekMentor
      ? [task(tagName, SHREK_MENTOR_TOURNAMENT_POOL_NAME, 'story', { milestone: time })]
      : []
  }
  return poolsForTag(tagName)
    .filter((pool) => {
      const number = storyNumber(pool.name)
      if (number == null || number < minimum || number > maximum) return false
      // 不参加魂师大赛时，跳过比赛结果剧情
      if (context.flags._skipTournament && number >= 4 && number <= 6) return false
      // 不参与天斗宫变时，跳过战斗结果剧情
      if (context.flags._skipBattle && number >= 8 && number <= 10) return false
      return true
    })
    .sort((left, right) => (storyNumber(left.name) ?? 0) - (storyNumber(right.name) ?? 0))
    .map((pool) => task(tagName, pool.name, 'story', { milestone: time }))
}

function nextRingTask(context: GameContext): RollTask | null {
  const required = Math.min(9, Math.floor(context.level / 10))
  if (context.rings.length >= required) return null
  const labels = ['第一', '第二', '第三', '第四', '第五', '第六', '第七', '第八', '第九']
  const label = labels[context.rings.length]
  const pool = poolsForTag('魂环吸收').find((candidate) => candidate.name.startsWith(`魂环吸收（${label}魂环）`))
  return pool ? task('魂环吸收', pool.name, 'ring', { index: context.rings.length + 1 }) : null
}

function nextGodReward(context: GameContext): RollTask | null {
  const trial = context.godTrial
  if (!trial || !trial.deity || trial.completed >= trial.total) return null
  const thresholds = trial.tier === '神王'
    ? [40, 50, 60, 70, 80, 90, 95, 98, 99]
    : trial.tier === '一级'
      ? [40, 50, 60, 70, 80, 90, 95, 98, 99]
      : trial.tier === '二级'
        ? [40, 50, 60, 70, 80, 90, 95, 99]
        : [40, 50, 60, 70, 80, 90, 99]
  const exam = trial.completed + 1
  const threshold = thresholds[exam - 1]
  if (threshold == null || context.level < threshold) return null
  const prefix = trial.tier === '神王' ? '神王考核' : `${trial.tier}神考核`
  const chinese = ['第一', '第二', '第三', '第四', '第五', '第六', '第七', '第八', '第九'][exam - 1]
  const pool = poolsForTag('神考抽取池').find((candidate) => candidate.name.startsWith(`${prefix}${chinese}考奖励`))
  return pool ? task('神考抽取池', pool.name, 'godReward', { exam }) : null
}

function beastGrowthPool(cultivation: number): string {
  if (cultivation < 100) return '10年后，你的成长（十年魂兽限定，已达百年魂兽则不可再抽取该池）'
  if (cultivation < 1_000) return '10年后，你的成长（百年魂兽限定，已达千年魂兽则不可再抽取该池）'
  if (cultivation < 10_000) return '10年后，你的成长（千年魂兽限定，已达万年魂兽则不可再抽取该池）'
  if (cultivation < 100_000) return '10年后，你的成长（万年魂兽限定，达到十万年以后无法再抽取，需经历十万年雷劫）'
  return '10年后，你的成长（十万年魂兽限定，达到百万年无法再抽取，需突破神劫成神）（每提升十万年，进入雷劫突破池，才可继续提升）'
}

function beastEncounterPool(cultivation: number): string {
  if (cultivation < 100) return '十年魂兽遭遇剧情（每经历1次时间跳跃可抽取该池）'
  if (cultivation < 1_000) return '百年魂兽遭遇剧情（每经历1次时间跳跃可抽取该池）'
  if (cultivation < 10_000) return '千年魂兽遭遇剧情（每经历1次时间跳跃可抽取该池）'
  if (cultivation < 100_000) return '万年魂兽遭遇剧情（每经历1次时间跳跃可抽取该池）'
  if (cultivation < 200_000) return '十万年魂兽遭遇剧情（每经历1次时间跳跃可抽取该池）'
  if (cultivation < 300_000) return '二十万年魂兽遭遇剧情（每经历1次时间跳跃可抽取该池）'
  return '30万年-99万年魂兽遭遇剧情（每经历1次时间跳跃可抽取该池）'
}

function tribulationPool(threshold: number): string | null {
  if (threshold >= 1_000_000) return '百万年神劫池，突破成功则成就魂兽神位'
  const map: Record<number, string> = {
    100000: '万年魂兽突破十万年雷劫池',
    200000: '十万年魂兽突破二十万年雷劫池',
    300000: '二十万年魂兽突破三十万年雷劫池',
    400000: '三十万年魂兽突破四十万年雷劫池',
    500000: '四十万年魂兽突破五十万年雷劫池',
    600000: '五十万年魂兽突破六十万年雷劫池',
    700000: '六十万年魂兽突破七十万年雷劫池',
    800000: '七十万年魂兽突破八十万年雷劫池',
    900000: '八十万年魂兽突破九十万年雷劫池',
  }
  return map[threshold] ?? null
}

function prepareNext(state: MachineState): MachineState {
  const { context } = state
  if (context.queue.length > 0 || context.activeTask || state.value === 'ending') return state

  if (state.value === 'humanSetup') return { ...state, value: context.godTrial ? 'godTrial' : 'humanAdventure' }
  if (state.value === 'beastSetup') return { ...state, value: 'beastAdventure' }
  if (state.value === 'transformedSetup') return { ...state, value: 'transformedAdventure' }

  if (['humanAdventure', 'transformedAdventure', 'godTrial'].includes(state.value)) {
    if ((context.tangAge ?? 0) >= 26) return finishState(state, '你走过斗罗大陆主线年代，命运进入新的时代。')
    const ring = nextRingTask(context)
    if (ring) context.queue.push(ring)
    else {
      const pendingDomainDraws = Number(context.flags._pendingDomainDraws) || 0
      if (context.level >= 90 && pendingDomainDraws > 0) {
        context.flags._pendingDomainDraws = pendingDomainDraws - 1
        context.queue.push(task('完整领域抽取池', '完整领域池子', 'domain'))
        return state
      }
      const reward = nextGodReward(context)
      if (reward) context.queue.push(reward)
      else {
        if (context.level >= 99 && !context.godTrial && (Number(context.flags._noGodCount) || 0) >= 5) {
          context.flags._noGodCount = 0
          context.queue.push(task('神考抽取池', '自创神位剧情', 'godTier', { tier: '二级' }))
          return state
        }
        if (context.level >= 99 && !context.godTrial && !context.flags._god99Triggered) {
          context.flags._god99Triggered = true
          const rng = nextRandom(context.rng)
          context.rng = rng.state
          if (rng.value < 0.5) {
            context.flags._noGodCount = 0
            context.queue.push(task('神考抽取池', '99级神考触发', 'godTier'))
            return state
          }
        }
        if (context.level >= 80 && !context.godTrial && !context.flags._god80Triggered) {
          context.flags._god80Triggered = true
          const rng = nextRandom(context.rng)
          context.rng = rng.state
          if (rng.value < 0.5) {
            context.flags._noGodCount = 0
            context.queue.push(task('神考抽取池', '99级神考触发', 'godTier'))
            return state
          }
        }
        if (context.level >= 70 && !context.godTrial && !context.flags._god70Triggered) {
          context.flags._god70Triggered = true
          const rng = nextRandom(context.rng)
          context.rng = rng.state
          if (rng.value < 0.5) {
            context.flags._noGodCount = 0
            context.queue.push(task('神考抽取池', '99级神考触发', 'godTier'))
            return state
          }
        }
        const faction = nextFactionTask(context)
        if (faction) context.queue.push(faction)
        else {
          const mentorTasks = hasPendingShrekMentorStory(context) ? nextStoryTasks(context) : []
          if (mentorTasks.length > 0) context.queue.push(...mentorTasks)
          else if ((context.age ?? 0) >= 16 && (context.age ?? 0) <= 22 && !context.flags.slaughter) {
            const factionStory = nextFactionExclusiveStoryTask(context)
            if (factionStory) context.queue.push(factionStory)
            else {
              context.flags.slaughter = true
              context.queue.push(task('杀戮之都', '是否进入杀戮之都（角色在16岁~22岁限定事件，未满足年龄不能抽取）', 'story'))
            }
          } else {
            const factionStory = nextFactionExclusiveStoryTask(context)
            if (factionStory) context.queue.push(factionStory)
            else {
              const storyTasks = nextStoryTasks(context)
              if (storyTasks.length > 0) context.queue.push(...storyTasks)
              else if (context.godTrial && context.level >= 70 && context.level <= 95 && !context.flags._seaGodTrained) {
                context.flags._seaGodTrained = true
                context.queue.push(task('海神岛修行', '海神岛修行（有神考限定）', 'growth'))
              }
              else context.queue.push(task('时间跳跃', humanGrowthPool(context), 'humanTime'))
            }
          }
        }
      }
    }
  }

  if (state.value === 'beastAdventure' && context.beast) {
    if ((context.tangAge ?? 0) >= 26) return finishState(state, '你走过斗罗大陆主线年代，命运进入新的时代。')
    const pending = context.beast.pendingTribulation
    if (pending) {
      const pool = tribulationPool(pending)
      if (pool) context.queue.push(task('魂兽雷劫池', pool, 'tribulation', { threshold: pending }))
    } else {
      context.queue.push(
        task('魂兽时间跳跃', beastGrowthPool(context.beast.cultivation), 'beastGrowth'),
        task('魂兽时间跳跃', beastEncounterPool(context.beast.cultivation), 'beastEncounter'),
      )
    }
  }
  return state
}

function lethal(text: string): boolean {
  return /你被[^，。]*(?:杀死|击杀|砍死|打死|秒杀|吞噬|斩杀)|当场死亡|最终战死|变成魂环/.test(text)
}

function resultTone(text: string): ChronicleEntry['tone'] {
  if (/死亡|失败|重伤|失去|掉落|反噬/.test(text)) return 'bad'
  if (/神位|十万年|领域|法则|进化|觉醒/.test(text)) return 'major'
  if (/获得|成功|胜利|提升|加入|等级\+/.test(text)) return 'good'
  return 'normal'
}

function applyCommon(context: GameContext, text: string) {
  for (const match of text.matchAll(/【([^】]+)】/g)) if (match[1]) addUnique(context.traits, match[1])
  if (/获得.*领域|领悟.*领域/.test(text) && !/获得(?:完整)?领域|领域雏形/.test(text)) {
    const domain = text.match(/【([^】]*领域[^】]*)】/)?.[1] ?? text.match(/([\u4e00-\u9fa5]{2,8}领域)/)?.[1]
    if (domain) addUnique(context.domains, domain)
  }
  if (/魂骨/.test(text) && /获得|拿下|献祭/.test(text) && !/抽取池/.test(text)) addUnique(context.soulBones, text)
  const levelChange = text.match(/等级\s*([+-])\s*(\d+)/)
  if (levelChange) {
    const amount = Number(levelChange[2]) * (levelChange[1] === '+' ? 1 : -1)
    context.level = Math.max(1, Math.min(context.maxLevel, context.level + amount))
  }
  const appearanceChange = text.match(/容貌\s*([+-])\s*(\d+)/)
  if (appearanceChange && !/ex级?无法提升/.test(text)) {
    const GRADES = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'EX']
    const idx = GRADES.indexOf(context.appearance.toUpperCase())
    if (idx >= 0) {
      const delta = Number(appearanceChange[2]) * (appearanceChange[1] === '+' ? 1 : -1)
      const clampedIdx = Math.max(0, Math.min(GRADES.length - 1, idx + delta))
      context.appearance = GRADES[clampedIdx]!
    }
  }
}

function applyResult(state: MachineState, option: WheelOption, probability: number): MachineState {
  const context = state.context
  const active = context.activeTask
  if (!active) return state
  const text = option.name
  context.step += 1
  context.lastPool = active.pool
  context.lastOptionId = option.id
  context.lastResult = text
  context.lastProbability = probability
  context.activeTask = null
  applyCommon(context, text)

  switch (active.handler) {
    case 'gender':
    case 'beastGender':
      context.gender = text.replace(/（.*$/, '').trim()
      break
    case 'appearance':
      context.appearance = appearanceGrade(text)
      break
    case 'martialType': {
      const type = text.replace(/（.*$/, '').trim()
      addUnique(context.martialSoulTypes, type)
      const pool = MARTIAL_POOLS[type]
      if (pool) context.queue.unshift(task('武魂池子', pool, /兽武魂|器武魂/.test(type) ? 'martialSoulCategory' : 'martialSoul'))
      break
    }
    case 'martialSoulCategory': {
      const category = text.replace(/（.*$/, '').trim()
      const isToolCategory = active.pool === TOOL_MARTIAL_SOUL_CATEGORY_POOL
      context.flags[isToolCategory ? 'toolMartialSoulCategory' : 'beastMartialSoulCategory'] = category
      context.queue.unshift(task('武魂池子', isToolCategory ? toolMartialSoulPoolName(category) : beastMartialSoulPoolName(category), 'martialSoul'))
      break
    }
    case 'martialSoul':
      addUnique(context.martialSouls, text)
      break
    case 'specialChance':
      if (/^是|拥有|获得/.test(text)) context.queue.unshift(task('特殊天赋池', '特殊天赋', 'specialTalent'))
      break
    case 'specialTalent':
      addUnique(context.talents, text)
      if (/双生武魂/.test(text)) context.queue.unshift(task('基础设定', '基础设定5:武魂天赋', 'martialType'))
      if (/三生武魂/.test(text)) context.queue.unshift(
        task('基础设定', '基础设定5:武魂天赋', 'martialType'),
        task('基础设定', '基础设定5:武魂天赋', 'martialType'),
      )
      if (/人兽混血/.test(text)) {
        addUnique(context.martialSoulTypes, '兽武魂')
        context.queue.unshift(task('武魂池子', '兽武魂分类', 'martialSoulCategory'))
      }
      if (/神明转世/.test(text)) context.queue.unshift(task('神考抽取池', '神考池子', 'godTier'))
      if (/亚龙血脉/.test(text)) {
        addUnique(context.martialSoulTypes, '兽武魂')
        context.queue.unshift(task('魂兽种类初始池', '亚龙种魂兽初始池子', 'martialSoul'))
      }
      if (/真龙血脉/.test(text)) {
        addUnique(context.martialSoulTypes, '兽武魂')
        context.queue.unshift(task('魂兽种类初始池', '纯血龙种魂兽初始池', 'martialSoul'))
      }
      if (/地龙血脉/.test(text)) {
        addUnique(context.martialSoulTypes, '兽武魂')
        context.queue.unshift(task('魂兽种类初始池', '地龙种魂兽初始池子', 'martialSoul'))
      }
      break
    case 'growthChance':
      if (/^是|获得/.test(text)) {
        context.queue.unshift(specialGrowthTask(context))
      }
      break
    case 'growth':
      if (/领域雏形/.test(text)) {
        addUnique(context.traits, '领域雏形')
        context.flags._pendingDomainDraws = (Number(context.flags._pendingDomainDraws) || 0) + 1
      } else if (/获得完整领域|进入领域.*池/.test(text)) {
        context.queue.unshift(task('完整领域抽取池', '完整领域池子', 'domain'))
      }
      if (/魂骨抽取池/.test(text) && hasAvailableSoulBone(context)) {
        context.queue.unshift(task('魂骨抽取池', '魂骨抽取池（已拥有部位则重抽）', 'bone', {
          years: context.rings[context.rings.length - 1]?.years ?? 0,
        }))
      }
      if (/获得神考/.test(text) && !context.godTrial) {
        const godPool = context.level >= 99 ? '99级神考触发' : '神考池子'
        context.queue.unshift(task('神考抽取池', godPool, 'godTier'))
        context.flags._noGodCount = 0
      }
      if (/极致进化/.test(text) && !context.martialSoulTypes.includes('极致武魂')) {
        addUnique(context.martialSoulTypes, '极致武魂')
      }
      if (/草鞋.*双枪|穿上草鞋/.test(text)) {
        addUnique(context.martialSouls, '双枪')
        addUnique(context.martialSoulTypes, '器武魂')
      }
      if (context.level >= 99 && !context.godTrial && context.flags._god99Triggered)
        context.flags._noGodCount = (Number(context.flags._noGodCount) || 0) + 1
      break
    case 'age':
      context.age = firstNumber(text, 6)
      break
    case 'period':
      context.tangAge = parseTangAge(text)
      queueInitialHumanContext(context)
      break
    case 'initialPower':
      context.level = /无魂力/.test(text) ? 0 : firstNumber(text, 1)
      if (context.martialSouls.length > 0) {
        const best = context.martialSouls.reduce((a, b) => getMartialSoulTier(a) > getMartialSoulTier(b) ? a : b)
        context.lastResult = `${context.lastResult}（受${best}武魂影响）`
      }
      break
    case 'faction':
      setFaction(context, text)
      for (const stage of [6, 12, 18]) {
        if (stage <= Number(active.meta?.stage ?? 6)) context.flags[`faction:${stage}`] = true
      }
      break
    case 'humanTime': {
      const years = firstNumber(active.pool, 2)
      context.age = (context.age ?? 0) + years
      context.tangAge = (context.tangAge ?? 0) + years
      context.queue.unshift(task('特殊成长经历', '是否获得特殊成长经历（每次经过一次时间跳跃，可抽取该池）', 'growthChance'))
      break
    }
    case 'ring': {
      const years = parseCultivation(text)
      context.rings.push({ index: Number(active.meta?.index ?? context.rings.length + 1), years, description: text })
      if (/魂骨抽(?:取|奖)池/.test(active.pool) && hasAvailableSoulBone(context)) {
        context.queue.unshift(task('魂骨抽取池', '魂骨抽取池（已拥有部位则重抽）', 'bone', { years }))
      }
      break
    }
    case 'domain':
      if (active.pool === '是否获得杀神领域') {
        if (/^是/.test(text)) addUnique(context.domains, '杀神领域')
        else if (/获得一次特殊成长经历/.test(text)) context.queue.unshift(specialGrowthTask(context))
      } else {
        addUnique(context.domains, text)
      }
      break
    case 'bone':
      addUnique(context.soulBones, `${Number(active.meta?.years) > 0 ? `${active.meta?.years}年` : ''}${text}`)
      break
    case 'godTier': {
      const isCustom = /自创神位/.test(text)
      const tier = isCustom ? (String(active.meta?.tier) || '二级')
        : /神王/.test(text) ? '神王' : /一级/.test(text) ? '一级' : /二级/.test(text) ? '二级' : '三级'
      const total = tier === '三级' ? 7 : tier === '二级' ? 8 : 9

      if (isCustom) {
        context.flags._pendingCustomGod = tier
        context.flags._noGodCount = 0
      } else {
        context.godTrial = { tier, deity: '', completed: 0, total }
        const pool = tier === '神王' ? '神王考核抽取池（神王神位一共9考）' : `${tier}神考抽取池（${tier}神一共${total}考）`
        context.queue.unshift(task('神考抽取池', pool, 'godDeity'))
        context.flags._noGodCount = 0
      }
      break
    }
    case 'godDeity':
      if (/自创神位/.test(text)) {
        if (context.godTrial) context.flags._pendingCustomGod = context.godTrial.tier
      } else if (context.godTrial) {
        context.godTrial.deity = text.replace(/神位考核|神位|考核/g, '').trim()
      }
      break
    case 'godReward':
      if (context.godTrial) {
        context.godTrial.completed = Number(active.meta?.exam ?? context.godTrial.completed + 1)
        if (context.godTrial.completed >= context.godTrial.total) {
          context.level = Math.max(100, context.level)
          context.maxLevel = context.godTrial.tier === '神王' ? 159 : context.godTrial.tier === '一级' ? 139 : context.godTrial.tier === '二级' ? 119 : 109
          return finishState(state, `完成${context.godTrial.deity}${context.godTrial.tier}神考，百级成神。`)
        }
      }
      break
    case 'beastPeriod':
      context.tangAge = parseTangAge(text)
      if (context.beast) context.flags.beastPeriod = text
      break
    case 'beastRealm':
      if (context.beast) context.beast.cultivation = parseCultivation(text)
      break
    case 'beastType': {
      if (!context.beast) break
      const type = text.replace(/（.*$/, '').trim()
      context.beast.type = type
      const pool = Object.entries(BEAST_SPECIES_POOLS).find(([key]) => type.includes(key))?.[1]
      if (type !== '海魂兽') context.queue.unshift(task('魂兽基础设定', '基础设定5:你的生存区域（海魂兽默认大海无需抽取该池）', 'beastArea'))
      else context.beast.area = '大海'
      if (pool) context.queue.unshift(task('魂兽种类初始池', pool, 'beastSpecies'))
      break
    }
    case 'beastSpecies':
      if (context.beast) {
        context.beast.species = text.replace(/（.*$/, '').trim()
        addUnique(context.beast.bloodlines, context.beast.species)
        if (context.beast.area && context.beast.cultivation >= 100_000) {
          context.queue.push(task('魂兽基础设定', '基础设定6:十万年魂兽路线分歧点（初始十万年魂兽或万年魂兽成功经历十万年雷劫后可选该池）', 'beastRoute'))
        }
      }
      break
    case 'beastArea':
      if (context.beast) context.beast.area = text.replace(/（.*$/, '').trim()
      if (context.beast && context.beast.cultivation >= 100_000) {
        context.queue.push(task('魂兽基础设定', '基础设定6:十万年魂兽路线分歧点（初始十万年魂兽或万年魂兽成功经历十万年雷劫后可选该池）', 'beastRoute'))
      }
      break
    case 'beastRoute':
      if (/化形/.test(text)) {
        context.route = 'transformed'
        context.age = 6
        context.level = 10
        context.martialSoulTypes = ['兽武魂']
        context.martialSouls = [context.beast?.species || context.beast?.type || '魂兽本体']
        addUnique(context.talents, '十万年魂兽化形')
        context.queue = [
          task('基础设定', '基础设定3:你的性别是？', 'gender'),
          task('基础设定', '基础设定4:容貌（B级以下无法恋爱）', 'appearance'),
          task('选择势力', '人物背景or加入的势力（6岁限定）', 'faction'),
        ]
        state.value = 'transformedSetup'
      }
      break
    case 'beastEncounter': {
      if (!context.beast) break
      const gainMatch = text.match(/修为\s*\+\s*(\d+)/)
      const lossMatch = text.match(/修为掉落\s*(\d+)/) ?? text.match(/修为\s*-\s*(\d+)/)
      let delta = 0
      if (gainMatch && gainMatch[1]) delta = Number(gainMatch[1])
      if (lossMatch && lossMatch[1]) delta = -Number(lossMatch[1])
      if (delta !== 0) context.beast.cultivation = Math.max(10, context.beast.cultivation + delta)
      break
    }
    case 'beastGrowth': {
      if (!context.beast) break
      const before = context.beast.cultivation
      const gainMatch = text.match(/修为\s*\+\s*(\d+)/)
      const gain = gainMatch ? Number(gainMatch[1]) : parseCultivation(text)
      context.beast.cultivation = Math.max(before, before + Math.max(0, gain))
      context.tangAge = (context.tangAge ?? 0) + 10
      const nextThreshold = before < 100_000 ? 100_000 : Math.ceil((before + 1) / 100_000) * 100_000
      if (context.beast.cultivation >= nextThreshold) {
        context.beast.cultivation = nextThreshold
        context.beast.pendingTribulation = nextThreshold
      }
      break
    }
    case 'tribulation':
      if (context.beast && /成功|渡过|突破|神位/.test(text)) {
        const threshold = Number(active.meta?.threshold ?? context.beast.pendingTribulation ?? 0)
        context.beast.cultivation = threshold
        context.beast.pendingTribulation = null
        if (threshold >= 1_000_000 || /兽神神位/.test(text)) return finishState(state, '渡过百万年神劫，成就兽神神位。')
        context.queue.unshift(task('魂兽进化池', '魂兽进化方向选择（十年进阶百年，百年进阶千年，千年进阶万年，万年成功进阶十万年，或十万年魂兽每成功经历雷劫可抽取该池）', 'beastEvolution'))
        if (threshold === 100_000) context.queue.push(task('魂兽基础设定', '基础设定6:十万年魂兽路线分歧点（初始十万年魂兽或万年魂兽成功经历十万年雷劫后可选该池）', 'beastRoute'))
      }
      break
    case 'beastEvolution':
      addUnique(context.traits, text)
      break
    case 'story':
      context.flags[`result:${active.pool}`] = text
      if (active.pool === SHREK_MENTOR_ENTRY_POOL_NAME) {
        context.flags.shrekMentor = /^是/.test(text)
        if (context.flags.shrekMentor) {
          const role = /本就在史莱克/.test(text) ? '史莱克学院大赛导师' : '史莱克学院客卿导师'
          context.flags.shrekMentorRole = role
          addAffiliation(context, role)
        }
      }
      if (active.pool.startsWith('是否进入杀戮之都') && /^是/.test(text)) {
        context.queue.unshift(task('杀戮之都', '是否获得杀神领域', 'domain'))
      }
      // 参与类选项选择"否"时，跳过对应的结果剧情
      if (/是否参与.*团队核心竞争/.test(active.pool) && /否|不感兴趣/.test(text))
        context.flags._skipTournament = true
      if (/是否参与.*天斗宫变/.test(active.pool) && /否|不感兴趣/.test(text))
        context.flags._skipBattle = true
      break
  }

  log(context, active.pool, text, resultTone(text))
  if (lethal(text)) return finishState(state, text, false)
  return state
}

function finishState(state: MachineState, reason: string, alive = true): MachineState {
  state.context.alive = alive
  state.context.ending = reason
  state.context.queue = []
  state.context.activeTask = null
  log(state.context, alive ? '命运终章' : '命运断绝', reason, alive ? 'major' : 'bad')
  state.value = 'ending'
  state.context.resumeState = null
  return state
}

const ACCEPTED: Record<MachineValue, MachineEvent['type'][]> = {
  idle: ['OPEN_START', 'START', 'RESTORE'],
  routeSelection: ['CANCEL_START', 'START', 'RESTORE'],
  humanSetup: ['ROLL', 'OPEN_START', 'FINISH', 'RESTORE'],
  beastSetup: ['ROLL', 'OPEN_START', 'FINISH', 'RESTORE'],
  humanAdventure: ['ROLL', 'OPEN_START', 'FINISH', 'RESTORE'],
  beastAdventure: ['ROLL', 'OPEN_START', 'FINISH', 'RESTORE'],
  transformedSetup: ['ROLL', 'OPEN_START', 'FINISH', 'RESTORE'],
  transformedAdventure: ['ROLL', 'OPEN_START', 'FINISH', 'RESTORE'],
  godTrial: ['ROLL', 'OPEN_START', 'FINISH', 'RESTORE'],
  rolling: ['RESOLVE', 'FINISH', 'RESTORE'],
  ending: ['OPEN_START', 'RESET', 'RESTORE'],
}

export function canTransition(state: MachineState, event: MachineEvent['type']): boolean {
  return ACCEPTED[state.value].includes(event)
}

export function transition(current: MachineState, event: MachineEvent): TransitionResult {
  if (!canTransition(current, event.type)) {
    return { state: current, accepted: false, reason: `状态 ${current.value} 不接受事件 ${event.type}` }
  }
  if (event.type === 'RESTORE') return { state: event.state, accepted: true }
  if (event.type === 'RESET') return { state: createInitialState(), accepted: true }

  let state = clone(current)
  if (event.type === 'OPEN_START') {
    state.context.resumeState = state.value === 'rolling' ? state.context.resumeState : state.value as StableMachineValue
    state.value = 'routeSelection'
    return { state, accepted: true }
  }
  if (event.type === 'CANCEL_START') {
    state.value = state.context.resumeState ?? 'idle'
    state.context.resumeState = null
    return { state, accepted: true }
  }
  if (event.type === 'START') return { state: initializeRun(event.route, event.seed), accepted: true }
  if (event.type === 'FINISH') return { state: finishState(state, event.reason), accepted: true }

  if (event.type === 'ROLL') {
    state = prepareNext(state)
    if (state.value === 'ending') return { state, accepted: true }
    const active = state.context.queue.shift()
    if (!active) return { state, accepted: false, reason: '当前阶段没有可执行任务' }
    if (!findPool(active.pool)) return { state, accepted: false, reason: `找不到转盘：${active.pool}` }
    state.context.activeTask = active
    state.context.resumeState = state.value as StableMachineValue
    state.value = 'rolling'
    return { state, accepted: true }
  }

  if (event.type === 'RESOLVE') {
    state = applyResult(state, event.option, event.probability)
    if (state.value === 'ending') return { state, accepted: true }
    const resumed = state.context.resumeState
    state.value = state.value === 'transformedSetup'
      ? 'transformedSetup'
      : resumed === 'humanSetup' || resumed === 'beastSetup' || resumed === 'transformedSetup'
        ? resumed
        : state.context.godTrial && state.context.godTrial.completed < state.context.godTrial.total
          ? 'godTrial'
          : resumed ?? (state.context.route === 'beast' ? 'beastAdventure' : 'humanAdventure')
    state.context.resumeState = null
    state = prepareNext(state)
    return { state, accepted: true }
  }
  return { state: current, accepted: false }
}

export function drawActiveTask(state: MachineState, resolvePool: (name: string) => WheelPool | undefined = findPool) {
  const active = state.context.activeTask
  if (state.value !== 'rolling' || !active) throw new Error('当前状态没有待抽取任务')
  const pool = resolvePool(active.pool)
  if (!pool) throw new Error(`找不到转盘：${active.pool}`)
  return { pool, draw: drawOption(pool, active, state.context) }
}

export const machineStates: MachineValue[] = [
  'idle',
  'routeSelection',
  'humanSetup',
  'beastSetup',
  'humanAdventure',
  'beastAdventure',
  'transformedSetup',
  'transformedAdventure',
  'godTrial',
  'rolling',
  'ending',
]
