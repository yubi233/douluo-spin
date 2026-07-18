import type { Candidate } from '@/core/draw/draw'
import type { CompiledContent, EffectSpec, EventBatch, GameState, MechanicsOption, Predicate } from '@/core/model/contracts'

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
  readonly time: string
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
  readonly settings: { readonly softenText: boolean; readonly spinDuration: number }
}

function title(content: CompiledContent, id: string): string {
  return content.presentation.entities.get(id as never)?.title ?? id
}

function timeLabel(state: GameState): string {
  const age = state.stats['tang-age']
  return age < 0 ? `唐三出生前 ${Math.abs(age)} 年` : `唐三 ${age} 岁`
}

export function projectChronicle(state: GameState, batches: readonly EventBatch[], content: CompiledContent): ChronicleView[] {
  return batches.flatMap((batch, index) => {
    const selected = batch.events.find((event) => event.type === 'option.selected')
    if (!selected || selected.type !== 'option.selected') return []
    const finished = batch.events.find((event) => event.type === 'run.finished')
    const hasProgress = batch.events.some((event) => event.type === 'stat.changed' || event.type === 'entity.granted')
    const tone = finished && finished.type === 'run.finished' ? (finished.alive ? 'major' : 'bad') : hasProgress ? 'good' : 'normal'
    return [{
      id: batch.turnId,
      step: index,
      title: content.presentation.pools.get(selected.poolId)?.title ?? selected.poolId,
      text: content.presentation.options.get(selected.optionId)?.title ?? selected.optionId,
      tone,
      time: timeLabel(state),
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
  const godhoods = state.entities.godhood.map((id) => ({ deity: title(content, id), tier: '一级', origin: trial?.origin === 'self-created' ? 'selfCreated' as const : 'inheritance' as const }))
  const routeIsBeast = state.route === 'beast'
  return {
    seed: state.random.seed,
    route: state.route,
    name: '无名旅者',
    step: state.turn,
    age: state.stats.age || null,
    tangAge: state.stats['tang-age'],
    gender: state.entities.gender.map((id) => title(content, id)).at(-1) ?? '',
    appearance: state.entities.appearance.map((id) => title(content, id)).at(-1) ?? '',
    level: state.stats.level,
    maxLevel: state.stats['max-level'],
    faction: state.entities.faction.map((id) => title(content, id)).at(-1) ?? '',
    martialSoulTypes: state.entities['martial-soul-type'].map((id) => title(content, id)),
    martialSouls: state.entities['martial-soul'].map((id) => title(content, id)),
    talents: [],
    traits: state.entities.trait.map((id) => title(content, id)).filter((value) => !['基础设定', '成长', '魂兽', '剧情', '神考'].includes(value)),
    domains: state.entities.domain.map((id) => title(content, id)),
    rings: state.progression.rings.map((id, index) => {
      const label = title(content, id)
      const years = id.endsWith('hundred') ? 100 : id.endsWith('thousand') ? 1_000 : 10_000
      return { index: index + 1, years, description: label }
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
    combatPower: Math.round(state.stats.level * state.stats.level / 20 + state.progression.rings.length * 12),
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
  return [
    `# ${view.name}的人物传记`,
    '',
    `命运种子：${view.seed}`,
    `路线：${view.route ?? '未开始'}`,
    `终局：${view.ending || '旅程进行中'}`,
    `等级/修为：${view.beast ? `${view.beast.cultivation}年` : `${view.level}级`}`,
    `武魂/本体：${view.beast ? view.beast.species : view.martialSouls.join('、') || '未觉醒'}`,
    `魂环：${view.rings.map((ring) => ring.description).join('、') || '无'}`,
    `神位：${view.godhoods.map((godhood) => godhood.deity).join('、') || '无'}`,
    '',
    '## 命运纪事',
    ...view.logs.flatMap((entry) => ['', `### 第${entry.step}回 · ${entry.title}`, entry.text]),
  ].join('\n')
}
