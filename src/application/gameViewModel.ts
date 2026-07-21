import type { Candidate } from '@/core/draw/draw'
import type { CombatPowerSnapshot, CompiledContent, EffectSpec, EventBatch, GameState, MechanicsOption, Predicate } from '@/core/model/contracts'
import { applyBatch, createInitialGameState } from '@/core/reducer/reducer'
import { calculateCombatPower } from '@/core/rules/combatPower'
import { DOULUO_CALENDAR_MILESTONES, douluoMilestoneAtTangAge, formatDouluoDate, formatDouluoYear } from '@/core/rules/douluoCalendar'
import { highestLegacyMartialSoulTier, legacyMartialSoulTier } from '@/content/v03/legacyMartialSoulRules'
import { legacyRingYears } from '@/content/v03/legacyFlow'

export interface WheelOptionView {
  readonly id: string
  readonly name: string
  readonly enabled: boolean
  readonly weight: number
  readonly probability: number
  readonly availableWhen?: Predicate
  readonly weightModifier?: MechanicsOption['weightModifier']
  readonly effects: readonly EffectSpec[]
}

export interface WheelPoolView {
  readonly id: string
  readonly name: string
  readonly description?: string
  readonly options: readonly WheelOptionView[]
}

export interface TaskView {
  readonly id: string
  readonly poolId: string
  readonly pool: string
  readonly process: string
}

export interface ChronicleView {
  readonly id: string
  readonly step: number
  readonly title: string
  readonly text: string
  readonly tone: 'normal' | 'good' | 'bad' | 'major'
  readonly calendar: string
  readonly characterStatus: string
  readonly milestone: string
}

export interface GameViewModel {
  readonly seed: string
  readonly route: GameState['route']
  readonly name: string
  readonly step: number
  readonly age: number | null
  readonly tangAge: number | null
  readonly gender: string
  readonly appearance: string
  readonly level: number
  readonly maxLevel: number
  readonly faction: string
  readonly martialSoulTypes: readonly string[]
  readonly martialSouls: readonly string[]
  readonly martialSoulDetails: readonly { readonly title: string; readonly tier: number; readonly tierLabel: string }[]
  readonly highestMartialSoulTier: number
  readonly talents: readonly string[]
  readonly traits: readonly string[]
  readonly domains: readonly string[]
  readonly rings: readonly { readonly index: number; readonly years: number; readonly description: string }[]
  readonly soulBones: readonly string[]
  readonly beast: { readonly cultivation: number; readonly species: string; readonly type: string; readonly area: string; readonly bloodlines: readonly string[]; readonly laws: readonly string[] } | null
  readonly godTrial: { readonly tier: string; readonly deity: string; readonly completed: number; readonly total: number; readonly origin: 'inheritance' | 'selfCreated' } | null
  readonly godhoods: readonly { readonly deity: string; readonly tier: string; readonly origin: 'inheritance' | 'selfCreated' }[]
  readonly alive: boolean
  readonly ending: string
  readonly lastPool: string
  readonly lastResult: string
  readonly lastProbability: number | null
  readonly logs: readonly ChronicleView[]
  readonly combatPower: number
  readonly combatPowerBreakdown: CombatPowerSnapshot
  readonly settings: { readonly softenText: boolean; readonly spinDuration: number }
}

function title(content: CompiledContent, id: string): string {
  return content.presentation.entities.get(id as never)?.title ?? id
}

const martialSoulTierLabels: Readonly<Record<number, string>> = {
  1: '废武魂', 2: '一般武魂', 3: '优秀武魂', 4: '顶级武魂', 5: '极品武魂', 6: '神级武魂',
}
const appearanceRankLabels = ['F级', 'E级', 'D级', 'C级', 'B级', 'A级', 'S级', 'EX级'] as const

function characterStatusLabel(state: GameState): string {
  const age = formatCompactNumber(state.stats.age)
  return state.route === 'beast'
    ? `${age}岁，${formatCompactNumber(state.stats['beast-cultivation'])}年修为`
    : `${age}岁，${formatCompactNumber(state.stats.level)}级`
}

export function projectChronicle(state: GameState, batches: readonly EventBatch[], content: CompiledContent): ChronicleView[] {
  let projectedState = createInitialGameState(state.contentVersion)
  const markedMilestones = new Set<number>()
  return batches.flatMap((batch, index) => {
    projectedState = applyBatch(projectedState, batch)
    const selected = batch.events.find((event) => event.type === 'option.selected')
    if (!selected || selected.type !== 'option.selected') return []
    const milestone = douluoMilestoneAtTangAge(projectedState.stats['tang-age'])
    const milestoneTitle = milestone && !markedMilestones.has(milestone.tangAge) ? milestone.title : ''
    if (milestone) markedMilestones.add(milestone.tangAge)
    const finished = batch.events.find((event) => event.type === 'run.finished')
    const hasProgress = batch.events.some((event) => event.type === 'stat.changed' || event.type === 'entity.granted')
    const tone = finished && finished.type === 'run.finished' ? (finished.alive ? 'major' : 'bad') : hasProgress ? 'good' : 'normal'
    return [{
      id: batch.turnId,
      step: index,
      title: content.presentation.pools.get(selected.poolId)?.title ?? selected.poolId,
      text: content.presentation.options.get(selected.optionId)?.title ?? selected.optionId,
      tone,
      calendar: formatDouluoYear(projectedState.stats['tang-age']),
      characterStatus: characterStatusLabel(projectedState),
      milestone: milestoneTitle,
    } satisfies ChronicleView]
  })
}

export function projectGameView(
  state: GameState,
  batches: readonly EventBatch[],
  content: CompiledContent,
  settings = { softenText: false, spinDuration: 900 },
): GameViewModel {
  const logs = projectChronicle(state, batches, content)
  const lastSelected = [...batches].reverse().flatMap((batch) => batch.events).find((event) => event.type === 'option.selected')
  const trial = state.progression.godTrial
  const martialSoulDetails = state.entities['martial-soul'].map((id) => {
    const tier = legacyMartialSoulTier(id)
    return { title: title(content, id), tier, tierLabel: martialSoulTierLabels[tier] ?? `T${tier}` }
  })
  const godhoods = state.entities.godhood.map((id) => ({ deity: title(content, id), tier: '一级', origin: trial?.origin === 'self-created' ? 'selfCreated' as const : 'inheritance' as const }))
  const routeIsBeast = state.route === 'beast'
  const combatPowerBreakdown = calculateCombatPower(state)
  return {
    seed: state.random.seed,
    route: state.route,
    name: formatDouluoYear(state.stats['tang-age']),
    step: state.turn,
    age: state.stats.age || null,
    tangAge: state.stats['tang-age'],
    gender: state.entities.gender.map((id) => title(content, id)).at(-1) ?? '',
    appearance: appearanceRankLabels[state.stats['appearance-rank']] ?? state.entities.appearance.map((id) => title(content, id)).at(-1) ?? '',
    level: state.stats.level,
    maxLevel: state.stats['max-level'],
    faction: state.entities.faction.map((id) => title(content, id)).at(-1) ?? '',
    martialSoulTypes: state.entities['martial-soul-type'].map((id) => title(content, id)),
    martialSouls: state.entities['martial-soul'].map((id) => title(content, id)),
    martialSoulDetails,
    highestMartialSoulTier: highestLegacyMartialSoulTier(state.entities['martial-soul']),
    talents: [],
    traits: state.entities.trait.map((id) => title(content, id)).filter((value) => !['基础设定', '成长', '魂兽', '剧情', '神考'].includes(value)),
    domains: state.entities.domain.map((id) => title(content, id)),
    rings: state.progression.rings.map((id, index) => {
      const label = title(content, id)
      const bonus = state.progression.ringYearBonuses[index] ?? 0
      const years = (legacyRingYears(id) ?? (id.endsWith('hundred') ? 100 : id.endsWith('thousand') ? 1_000 : 10_000)) + bonus
      return { index: index + 1, years, description: bonus > 0 ? `${years}年魂环（原${label}，神考提升${bonus}年）` : label }
    }),
    soulBones: state.entities['soul-bone'].map((id) => title(content, id)),
    beast: routeIsBeast ? {
      cultivation: state.stats['beast-cultivation'],
      species: state.entities['beast-species'].map((id) => title(content, id)).at(-1) ?? '',
      type: state.entities['beast-type'].map((id) => title(content, id)).at(-1) ?? '',
      area: state.entities['beast-area'].map((id) => title(content, id)).at(-1) ?? '',
      bloodlines: state.entities['beast-bloodline'].map((id) => title(content, id)),
      laws: state.progression.resolvedTribulations.map((value) => `${value}年雷劫`),
    } : null,
    godTrial: trial ? {
      tier: title(content, trial.tierId),
      deity: title(content, trial.deityId),
      completed: trial.completed,
      total: trial.total,
      origin: trial.origin === 'self-created' ? 'selfCreated' : 'inheritance',
    } : null,
    godhoods,
    alive: state.ending?.alive ?? true,
    ending: state.ending ? content.presentation.endings.get(state.ending.endingId)?.title ?? state.ending.endingId : '',
    lastPool: lastSelected && lastSelected.type === 'option.selected' ? content.presentation.pools.get(lastSelected.poolId)?.title ?? lastSelected.poolId : '',
    lastResult: lastSelected && lastSelected.type === 'option.selected' ? content.presentation.options.get(lastSelected.optionId)?.title ?? lastSelected.optionId : '',
    lastProbability: lastSelected && lastSelected.type === 'option.selected' ? lastSelected.probability : null,
    logs,
    combatPower: combatPowerBreakdown.total,
    combatPowerBreakdown,
    settings,
  }
}

export function projectPool(content: CompiledContent, poolId: string, candidates: readonly Candidate[]): WheelPoolView | null {
  const pool = content.mechanics.pools.get(poolId as never)
  const presentation = content.presentation.pools.get(poolId as never)
  if (!pool || !presentation) return null
  const probabilities = new Map(candidates.map((candidate) => [candidate.optionId, candidate.probability]))
  return {
    id: pool.id,
    name: presentation.title,
    description: presentation.description,
    options: pool.options.map((option) => ({
      id: option.id,
      name: content.presentation.options.get(option.id)?.title ?? option.id,
      enabled: option.enabled,
      weight: option.baseWeight,
      probability: probabilities.get(option.id) ?? 0,
      availableWhen: option.availableWhen,
      weightModifier: option.weightModifier,
      effects: option.effects,
    })),
  }
}

export function formatBiography(view: GameViewModel): string {
  const combat = view.combatPowerBreakdown
  const combatFormula = `round((${formatCombatPart(combat.levelBase)} + ${formatCombatPart(combat.ringPower)} + ${formatCombatPart(combat.martialSoulPower)} + ${formatCombatPart(combat.domainPower)} + ${formatCombatPart(combat.soulBonePower)}) × ${formatCombatPart(combat.multiplier)}) = ${combat.total}`
  return [
    `# ${view.name}的人物传记`,
    '',
    `模拟种子：${view.seed}`,
    `路线：${view.route ?? '未开始'}`,
    `终局：${view.ending || '旅程进行中'}`,
    `当前历法：${formatDouluoDate(view.tangAge ?? 0)}`,
    `等级/修为：${view.beast ? `${view.beast.cultivation}年` : `${view.level}级`}`,
    `武魂/本体：${view.beast ? view.beast.species : view.martialSoulDetails.map((soul) => `${soul.title}【${soul.tierLabel}】`).join('、') || '未觉醒'}`,
    ...(view.beast ? [] : [`最高武魂阶位：${view.martialSouls.length ? martialSoulTierLabels[view.highestMartialSoulTier] : '无'}`]),
    `魂环：${view.rings.map((ring) => ring.description).join('、') || '无'}`,
    `魂骨：${view.soulBones.join('、') || '无'}`,
    `领域：${view.domains.join('、') || '无'}`,
    `天赋/称号/奖励：${view.traits.join('、') || '无'}`,
    ...(view.godTrial ? [`神考进度：${view.godTrial.deity} · ${view.godTrial.tier} · ${view.godTrial.completed}/${view.godTrial.total}`] : []),
    `神位：${view.godhoods.map((godhood) => godhood.deity).join('、') || '无'}`,
    ...(view.beast ? [] : [
      `战力值：${combat.total}`,
      `战力公式：${combatFormula}`,
      `战力构成：等级 ${formatCombatPart(combat.levelBase)} + 魂环 ${formatCombatPart(combat.ringPower)} + 武魂 ${formatCombatPart(combat.martialSoulPower)} + 领域 ${formatCombatPart(combat.domainPower)} + 魂骨 ${formatCombatPart(combat.soulBonePower)}；天赋系数 ${formatCombatPart(combat.talentCoefficient)}，战斗称号系数 ${formatCombatPart(combat.battleTraitCoefficient)}`,
    ]),
    '',
    '## 斗罗历关键节点',
    ...DOULUO_CALENDAR_MILESTONES.map((milestone) => `- ${formatDouluoDate(milestone.tangAge)}：${milestone.title}`),
    '',
    '## 模拟纪事',
    ...formatBiographyChronicle(view.logs),
  ].join('\n')
}

function formatBiographyChronicle(entries: readonly ChronicleView[]): string[] {
  let previousCalendar = ''
  return entries.flatMap((entry) => {
    const calendarChanged = entry.calendar !== previousCalendar
    previousCalendar = entry.calendar
    return [
      ...(calendarChanged ? ['', `### ${entry.calendar}${entry.milestone ? ` · ${entry.milestone}` : ''}`] : []),
      '',
      `#### 第${entry.step}回 · ${entry.characterStatus} · ${entry.title}`,
      entry.text,
    ]
  })
}

function formatCombatPart(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function formatCompactNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '')
}
