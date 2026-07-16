import { formatBiography } from './biography'
import { findPool } from './catalog'
import { drawActiveTask, createInitialState, transition } from './machine'
import { drawUniformOption, calculateCombatPower } from './engine'
import { getMartialSoulTier } from './martialSoulTiers'
import type { MachineState, StartRoute, WheelPool } from './types'

export type SamplingMode = 'weighted' | 'uniform'

export interface SimulationTraceEntry {
  roll: number
  pool: string
  optionId: string
  option: string
  probability: number
  level: number
  soulBoneCount: number
  queuedNextPool: string | null
  impact: string
}

export interface SimulationIssue {
  code: 'invalid-domain' | 'missing-growth-reward' | 'missing-killing-domain' | 'missing-soul-bone-draw' | 'premature-domain-draw' | 'incomplete-journey'
    | 'empty-pool-error' | 'level-out-of-bounds' | 'cultivation-negative' | 'appearance-unchanged'
    | 'combat-no-reward' | 'faction-no-reward' | 'beast-encounter-no-cultivation-change'
    | 'flag-leaked-to-biography' | 'stuck-level' | 'combat-power-zero' | 'god-condition-mismatch'
    | 'no-impact-story' | 'no-impact-batch'
  message: string
  roll?: number
}

export interface SimulationAudit {
  passed: boolean
  issues: SimulationIssue[]
}

export interface SimulationResult {
  requestedRolls: number
  executedRolls: number
  completed: boolean
  samplingMode: SamplingMode
  state: MachineState
  trace: SimulationTraceEntry[]
  biography: string
  audit: SimulationAudit
}

export interface SimulationOptions {
  seed: string
  route?: StartRoute
  rolls?: number
  samplingMode?: SamplingMode
  resolvePool?: (name: string) => WheelPool | undefined
}

export interface FullJourneyOptions {
  seed: string
  route: 'human' | 'beast'
  maxRolls?: number
  resolvePool?: (name: string) => WheelPool | undefined
}

export interface SimulationArchive {
  format: 'douluo-spin-long-simulation'
  formatVersion: 2
  generatedAt: string
  seed: string
  requestedRolls: number
  executedRolls: number
  completed: boolean
  samplingMode: SamplingMode
  audit: SimulationAudit
  biography: string
  trace: SimulationTraceEntry[]
  state: MachineState
}

function inspect(state: MachineState, trace: SimulationTraceEntry[], completed: boolean): SimulationAudit {
  const issues: SimulationIssue[] = []
  const ctx = state.context

  if (!completed) {
    issues.push({
      code: 'incomplete-journey',
      message: '在安全投掷上限前未进入命运终局。',
    })
  }

  // === Domain validation ===
  for (const domain of ctx.domains) {
    if (!domain.includes('领域') || /获得(?:完整)?领域|领域雏形|^是，|^否，/.test(domain)) {
      issues.push({
        code: 'invalid-domain',
        message: `领域列表含有非领域文本："${domain}"。`,
      })
    }
  }

  // === Level / cultivation bounds ===
  if (ctx.beast) {
    if (ctx.beast.cultivation < 10) {
      issues.push({ code: 'cultivation-negative', message: `魂兽修为异常低：${ctx.beast.cultivation}年` })
    }
  } else if (ctx.level > ctx.maxLevel) {
    issues.push({ code: 'level-out-of-bounds', message: `等级 ${ctx.level} 超过上限 ${ctx.maxLevel}` })
  } else if (ctx.level <= 0) {
    issues.push({ code: 'level-out-of-bounds', message: `等级异常：${ctx.level}` })
  }

  // === Combat power check ===
  const power = calculateCombatPower(ctx)
  if (power <= 0 && !ctx.beast) {
    issues.push({ code: 'combat-power-zero', message: `战力值为 0` })
  }

  // === Flag leaks in biography ===
  const bio = formatBiography(ctx)
  for (const flag of ['_badCount', '_combatCount', '_god99Triggered', '_noGodCount',
    '_pendingCustomGod', '_pendingDomainDraws', '_god99Triggered']) {
    if (bio.includes(flag)) {
      issues.push({ code: 'flag-leaked-to-biography', message: `内部标志 "${flag}" 泄露到传记中` })
    }
  }

  // === Appearance unchanged ===
  if (!ctx.beast && ctx.appearance && ctx.level > 30 && ctx.appearance === 'B') {
    // B is the default/median initial grade; after level 30 it should have been changed
    const hasAppearanceRoll = trace.some((e) => e.option.includes('容貌'))
    if (!hasAppearanceRoll) {
      issues.push({ code: 'appearance-unchanged', message: '30级以上容貌从未变化' })
    }
  }

  // === God trial vs martial soul tier mismatch ===
  if (ctx.godTrial) {
    const tier = ctx.martialSouls.length ? Math.max(...ctx.martialSouls.map((s) => getMartialSoulTier(s))) : 3
    const requiredTier = ctx.godTrial.tier === '神王' ? 6 : ctx.godTrial.tier === '一级' ? 5 :
      ctx.godTrial.tier === '二级' ? 3 : 2
    if (tier < requiredTier - 1) {
      issues.push({ code: 'god-condition-mismatch', message: `武魂阶位 ${tier} 不足以匹配 ${ctx.godTrial.tier} 神考` })
    }
  }

  // === Stuck level detection ===
  for (let i = 3; i < trace.length; i += 1) {
    const prev = trace[i - 3]
    const curr = trace[i]
    if (!prev || !curr) continue
    if (prev.pool.includes('时间跳跃') && curr.pool.includes('时间跳跃') && prev.level === curr.level) {
      issues.push({
        code: 'stuck-level',
        roll: curr.roll,
        message: `第 ${prev.roll}-${curr.roll} 次投掷内经过 3+ 次时间跳跃但等级未变化。`,
      })
    }
  }

  // === Per-entry trace checks ===
  for (const entry of trace) {
    if (entry.pool.includes('魂环吸收') && /魂骨抽(?:取|奖)池/.test(entry.pool) && entry.soulBoneCount < 7 && entry.queuedNextPool !== '魂骨抽取池（已拥有部位则重抽）') {
      issues.push({ code: 'missing-soul-bone-draw', roll: entry.roll, message: '魂环池承诺的魂骨抽取没有进入下一抽取队列。' })
    }
    if (entry.option.includes('领域雏形') && entry.level < 90 && entry.queuedNextPool === '完整领域池子') {
      issues.push({ code: 'premature-domain-draw', roll: entry.roll, message: '未达到90级时，领域雏形被提前转成完整领域抽取。' })
    }
    if (entry.pool !== '是否获得杀神领域') continue
    if (entry.option.includes('获得一次特殊成长经历') && !['特殊成长经历', '枪械武魂专属剧情池'].includes(entry.queuedNextPool ?? '')) {
      issues.push({ code: 'missing-growth-reward', roll: entry.roll, message: '杀戮之都的特殊成长经历补偿没有进入下一抽取队列。' })
    }
    if (/^是/.test(entry.option) && !ctx.domains.includes('杀神领域')) {
      issues.push({ code: 'missing-killing-domain', roll: entry.roll, message: '杀戮之都成功结果没有登记杀神领域。' })
    }
  }

  // === No-impact events in story/battle pools ===
  let noImpactCount = 0
  for (const entry of trace) {
    if (entry.impact !== '无变化') { noImpactCount = 0; continue }
    if (/剧情\d|嘉陵关|神战|决赛|单人赛|预选赛|遭遇剧情|势力|在校|入学|比赛后/.test(entry.pool)) {
      noImpactCount += 1
      if (noImpactCount >= 3) {
        issues.push({
          code: 'no-impact-batch',
          roll: entry.roll,
          message: `连续 ${noImpactCount} 个剧情/战斗事件均无反馈（从第 ${entry.roll - noImpactCount + 1} 次开始）`,
        })
        noImpactCount = 0
      }
    }
  }

  return { passed: issues.length === 0, issues }
}

function resolveSimulationGodName(state: MachineState): MachineState {
  const pending = state.context.flags._pendingCustomGod
  if (!pending) return state

  const tier = String(pending)
  const total = tier === '三级' ? 7 : tier === '二级' ? 8 : 9
  const next = structuredClone(state)
  next.context.godTrial = { tier, deity: '模拟命运神', completed: 0, total }
  delete next.context.flags._pendingCustomGod
  return next
}

function diffImpact(before: MachineState, after: MachineState): string {
  const parts: string[] = []
  const b = before.context
  const a = after.context

  if (a.level !== b.level) parts.push(`等级${a.level > b.level ? '+' : ''}${a.level - b.level}`)
  if (a.appearance !== b.appearance) parts.push(`容貌${b.appearance}→${a.appearance}`)
  if (a.martialSouls.length !== b.martialSouls.length) {
    const added = a.martialSouls.filter((s) => !b.martialSouls.includes(s))
    if (added.length) parts.push(`+武魂:${added.join('/')}`)
  }
  if (a.traits.length !== b.traits.length) {
    const added = a.traits.filter((s) => !b.traits.includes(s))
    if (added.length) parts.push(`+称号:${added.slice(0, 3).join('/')}${added.length > 3 ? '…' : ''}`)
  }
  if (a.domains.length !== b.domains.length) {
    const added = a.domains.filter((s) => !b.domains.includes(s))
    if (added.length) parts.push(`+领域:${added.join('/')}`)
  }
  if (a.soulBones.length !== b.soulBones.length) {
    parts.push(`+魂骨:${a.soulBones.length - b.soulBones.length}`)
  }
  if (a.rings.length !== b.rings.length) {
    parts.push(`+魂环:${a.rings.length - b.rings.length}`)
  }
  if (a.talents.length !== b.talents.length) {
    const added = a.talents.filter((s) => !b.talents.includes(s))
    if (added.length) parts.push(`+天赋:${added.join('/')}`)
  }
  if (b.godTrial !== a.godTrial) {
    if (!b.godTrial && a.godTrial) parts.push(`开启${a.godTrial.tier}神考`)
    else if (a.godTrial) parts.push(`神考${a.godTrial.completed}/${a.godTrial.total}`)
  }
  if (a.maxLevel !== b.maxLevel) parts.push(`上限${a.maxLevel}`)
  if (a.beast && b.beast && a.beast.cultivation !== b.beast.cultivation) {
    parts.push(`修为${a.beast.cultivation > b.beast.cultivation ? '+' : ''}${a.beast.cultivation - b.beast.cultivation}`)
  }
  if (a.faction !== b.faction && a.faction) parts.push(`势力→${a.faction}`)
  if (!a.alive && b.alive) parts.push('阵亡')

  return parts.length > 0 ? parts.join(' │ ') : '无变化'
}

export function simulateRealRolls(options: SimulationOptions): SimulationResult {
  const requestedRolls = Math.max(1, Math.floor(options.rolls ?? 20))
  const samplingMode = options.samplingMode ?? 'weighted'
  const started = transition(createInitialState(), {
    type: 'START',
    route: options.route ?? 'human',
    seed: options.seed,
  })
  if (!started.accepted) throw new Error(started.reason || '无法开始模拟')

  let state = started.state
  const trace: SimulationTraceEntry[] = []
  const resolvePool = options.resolvePool ?? findPool
  for (let roll = 1; roll <= requestedRolls && state.value !== 'ending'; roll += 1) {
    state = resolveSimulationGodName(state)
    const before = state
    const rolling = transition(state, { type: 'ROLL' })
    if (!rolling.accepted || rolling.state.value === 'ending') {
      state = rolling.state
      break
    }

    const active = rolling.state.context.activeTask
    if (!active) throw new Error('模拟转盘缺少活动任务')
    const pool = resolvePool(active.pool)
    if (!pool) throw new Error(`找不到转盘：${active.pool}`)
    const draw = samplingMode === 'uniform'
      ? drawUniformOption(pool, active, rolling.state.context)
      : drawActiveTask(rolling.state, resolvePool).draw
    const drawn = structuredClone(rolling.state)
    drawn.context.rng = draw.nextRng
    const resolved = transition(drawn, {
      type: 'RESOLVE',
      option: draw.option,
      probability: draw.probability,
    })
    if (!resolved.accepted) throw new Error(resolved.reason || '无法结算模拟转盘')

    state = resolved.state
    trace.push({
      roll,
      pool: active.pool,
      optionId: draw.option.id,
      option: draw.option.name,
      probability: draw.probability,
      level: state.context.level,
      soulBoneCount: state.context.soulBones.length,
      queuedNextPool: state.context.queue[0]?.pool ?? null,
      impact: diffImpact(before, state),
    })
  }

  const completed = state.value === 'ending'
  return {
    requestedRolls,
    executedRolls: trace.length,
    completed,
    samplingMode,
    state,
    trace,
    biography: formatBiography(state.context),
    audit: inspect(state, trace, completed),
  }
}

export function simulateFullJourney(options: FullJourneyOptions): SimulationResult {
  return simulateRealRolls({
    seed: options.seed,
    route: options.route,
    rolls: options.maxRolls ?? 500,
    samplingMode: 'weighted',
    resolvePool: options.resolvePool,
  })
}

export function createSimulationArchive(result: SimulationResult, generatedAt = new Date().toISOString()): SimulationArchive {
  return {
    format: 'douluo-spin-long-simulation',
    formatVersion: 2,
    generatedAt,
    seed: result.state.context.seed,
    requestedRolls: result.requestedRolls,
    executedRolls: result.executedRolls,
    completed: result.completed,
    samplingMode: result.samplingMode,
    audit: result.audit,
    biography: result.biography,
    trace: result.trace,
    state: result.state,
  }
}
