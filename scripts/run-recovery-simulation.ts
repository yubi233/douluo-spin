import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { GameService } from '@/application/gameService'
import { formatBiography, projectGameView } from '@/application/gameViewModel'
import { v03Content, v03Policies } from '@/content/v03/content'
import { legacyFlow } from '@/content/v03/legacyFlow'
import { compileEffects } from '@/core/effects/compileEffects'
import type { DomainEvent, EventBatch, GameState, Route } from '@/core/model/contracts'
import { calculateCombatPower } from '@/core/rules/combatPower'
import { applyBatch, createInitialGameState } from '@/core/reducer/reducer'

type CohortRoute = 'human' | 'beast'
type JourneyRoute = CohortRoute | 'random'
type CoverageStatus = 'observed' | 'controlled' | 'composed' | 'blocked'

interface TraceEntry {
  readonly turn: number
  readonly poolId: string
  readonly optionId: string
  readonly probability: number
}

interface AuditIssue {
  readonly code: string
  readonly message: string
  readonly turnId?: string
  readonly poolId?: string
  readonly optionId?: string
}

interface RunArchive {
  readonly route: JourneyRoute
  readonly seed: string
  readonly completed: boolean
  readonly state: GameState
  readonly eventLog: readonly EventBatch[]
  readonly trace: readonly TraceEntry[]
  readonly biography: string
  readonly sideEffectAudit: readonly {
    readonly turnId: string
    readonly poolId: string
    readonly optionId: string
    readonly expected: readonly DomainEvent[]
    readonly actual: readonly DomainEvent[]
    readonly passed: boolean
  }[]
  readonly audit: { readonly passed: boolean; readonly issues: readonly AuditIssue[] }
}

interface ControlledEvidence {
  readonly route: JourneyRoute
  readonly seed: string
  readonly trace: readonly TraceEntry[]
  readonly eventLog: readonly EventBatch[]
}

const cohortSize = 100
const maxTurns = 240
const controlledSeedLimit = Number(process.env.RECOVERY_CONTROLLED_SEED_LIMIT ?? 2_000)

function assertCleanWorktree() {
  const status = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { encoding: 'utf8' }).trim()
  if (status) {
    throw new Error(`Recovery certification requires a clean worktree before it can bind evidence to a commit:\n${status}`)
  }
}

assertCleanWorktree()
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const sourceSha256 = 'a15531384c18d428622596d1d96b645ded8a8d65e14e3d948c1c33ad1c024b1b'
const generation = process.env.RECOVERY_GENERATION?.trim()
  || `${v03Content.manifest.contentVersion}-${commit.slice(0, 12)}-${new Date().toISOString().replace(/[:.]/g, '-')}`
const root = resolve('simulation-archives', 'v03-recovery', generation)
const runsDirectory = resolve(root, 'runs')
const findingsDirectory = resolve(root, 'findings')

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function selected(events: readonly DomainEvent[]) {
  return events.find((event): event is Extract<DomainEvent, { type: 'option.selected' }> => event.type === 'option.selected')
}

function optionEffects(batch: EventBatch, before: GameState): { poolId: string; optionId: string; expected: readonly DomainEvent[]; actual: readonly DomainEvent[] } | null {
  const choice = selected(batch.events)
  if (!choice) return null
  const pool = v03Content.mechanics.pools.get(choice.poolId)
  const option = pool?.options.find((candidate) => candidate.id === choice.optionId)
  if (!pool || !option) throw new Error(`Missing selected option ${choice.optionId} in ${choice.poolId}`)
  const expected = compileEffects(option.effects, before, v03Policies, v03Content.mechanics.endings)
  const choiceIndex = batch.events.indexOf(choice)
  const taskCompletedIndex = batch.events.findIndex((event, index) => index > choiceIndex && event.type === 'task.completed')
  const actual = taskCompletedIndex < 0 ? [] : batch.events.slice(taskCompletedIndex + 1, taskCompletedIndex + 1 + expected.length)
  return { poolId: choice.poolId, optionId: choice.optionId, expected, actual }
}

function sameEvents(left: readonly DomainEvent[], right: readonly DomainEvent[]) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function levelIssues(state: GameState, events: readonly DomainEvent[], turnId: string): readonly AuditIssue[] {
  const hasGodContext = state.progression.godTrial != null || state.ending?.endingId === 'ending.god-ascension' || state.ending?.endingId === 'ending.self-created-ascension'
  const level = state.stats.level
  const issues: AuditIssue[] = []
  if (!Number.isFinite(level) || level < 1 || level > 159) {
    issues.push({ code: 'level-out-of-range', message: `Level ${level} is outside 1..159`, turnId })
  }
  if (hasGodContext && level < 100 && state.ending?.alive) {
    issues.push({ code: 'god-level-boundary', message: `God-trial state ended below level 100 (${level})`, turnId })
  }
  if (!hasGodContext && level > 99) {
    issues.push({ code: 'mortal-level-boundary', message: `Non-god state exceeded level 99 (${level})`, turnId })
  }
  const combatChanged = events.some((event) => event.type === 'stat.changed' && event.stat === 'level')
    || events.some((event) => event.type === 'entity.granted' || event.type === 'entity.revoked')
  const snapshot = events.find((event): event is Extract<DomainEvent, { type: 'combat-power.recalculated' }> => event.type === 'combat-power.recalculated')
  const calculated = calculateCombatPower(state)
  if (!snapshot) issues.push({ code: 'missing-combat-snapshot', message: 'Missing combat-power recalculation', turnId })
  else if (JSON.stringify(snapshot.after) !== JSON.stringify(calculated)) {
    issues.push({ code: 'combat-power-mismatch', message: 'Combat-power snapshot disagrees with structural calculation', turnId })
  }
  if (combatChanged && state.route === 'human' && state.entities['martial-soul'].length > 0 && (!Number.isFinite(calculated.total) || calculated.total <= 0)) {
    issues.push({ code: 'invalid-combat-power', message: `Awakened human combat power is ${calculated.total}`, turnId })
  }
  return issues
}

function runJourney(route: JourneyRoute, seed: string): RunArchive {
  const service = new GameService(v03Content, v03Policies)
  const trace: TraceEntry[] = []
  const executionIssues: AuditIssue[] = []
  try {
    service.dispatch({ type: 'run.start', route, seed })
    while (service.state.phase !== 'ended' && trace.length < maxTurns && service.state.agenda.length > 0) {
      const receipt = service.dispatch({ type: 'turn.spin' })
      if (receipt.draw) trace.push({ turn: service.state.turn, poolId: receipt.draw.poolId, optionId: receipt.draw.optionId, probability: receipt.draw.probability })
    }
  } catch (error) {
    executionIssues.push({
      code: 'journey-exception',
      message: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    })
  }

  let projected = createInitialGameState(v03Content.manifest.contentVersion)
  const issues: AuditIssue[] = [...executionIssues]
  const sideEffectAudit: Array<RunArchive['sideEffectAudit'][number]> = []
  for (const batch of service.eventLog) {
    const effect = optionEffects(batch, projected)
    if (effect) {
      const passed = sameEvents(effect.expected, effect.actual)
      sideEffectAudit.push({ turnId: batch.turnId, ...effect, passed })
      if (!passed) issues.push({
        code: 'option-effect-mismatch',
        message: 'Compiled option effects do not match the committed option segment',
        turnId: batch.turnId,
        poolId: effect.poolId,
        optionId: effect.optionId,
      })
    }
    projected = applyBatch(projected, batch)
    issues.push(...levelIssues(projected, batch.events, batch.turnId))
  }
  const state = service.state
  if (JSON.stringify(projected) !== JSON.stringify(state)) issues.push({ code: 'replay-mismatch', message: 'Event batches did not replay to the committed state' })
  if (state.phase !== 'ended') issues.push({ code: 'incomplete', message: `Journey stopped in ${state.phase} after ${trace.length} turns` })
  if (state.phase === 'ended' && state.agenda.length > 0) issues.push({ code: 'agenda-after-ending', message: 'Ended journey retained scheduled tasks' })
  if (state.phase === 'ended' && !state.ending) issues.push({ code: 'missing-ending', message: 'Ended journey has no ending' })
  const biography = formatBiography(projectGameView(state, service.eventLog, v03Content))
  if (!biography.startsWith('# 无名旅者的人物传记')) issues.push({ code: 'biography-projection', message: 'Biography projection is missing its required heading' })
  return {
    route,
    seed,
    completed: state.phase === 'ended',
    state,
    eventLog: service.eventLog,
    trace,
    biography,
    sideEffectAudit,
    audit: { passed: issues.length === 0, issues },
  }
}

function poolHits(runs: readonly RunArchive[]) {
  const hits = new Map<string, { runs: Set<string>; draws: number; seeds: string[] }>()
  for (const run of runs) {
    for (const entry of run.trace) {
      const value = hits.get(entry.poolId) ?? { runs: new Set<string>(), draws: 0, seeds: [] }
      value.runs.add(run.seed)
      value.draws += 1
      if (value.seeds.length < 10 && !value.seeds.includes(run.seed)) value.seeds.push(run.seed)
      hits.set(entry.poolId, value)
    }
  }
  return hits
}

function controlledEvidence(): Map<string, ControlledEvidence> {
  const evidence = new Map<string, ControlledEvidence>()
  const targetIds = new Set<string>(legacyFlow.pools.map((pool) => pool.activePoolId))
  for (const route of ['human', 'beast', 'random'] as const) {
    for (let index = 1; index <= controlledSeedLimit && evidence.size < targetIds.size; index += 1) {
      const seed = `v03-recovery-controlled-${route}-${String(index).padStart(4, '0')}`
      const run = runJourney(route, seed)
      for (const entry of run.trace) {
        if (!targetIds.has(entry.poolId) || evidence.has(entry.poolId)) continue
        evidence.set(entry.poolId, { route, seed, trace: run.trace, eventLog: run.eventLog })
      }
    }
  }
  return evidence
}

function selectBiographySamples(runs: readonly RunArchive[]): readonly { route: JourneyRoute; seed: string; reasons: readonly string[] }[] {
  const selected = new Map<string, { route: JourneyRoute; seed: string; reasons: string[] }>()
  const add = (run: RunArchive, reason: string) => {
    const value = selected.get(run.seed) ?? { route: run.route, seed: run.seed, reasons: [] }
    if (!value.reasons.includes(reason)) value.reasons.push(reason)
    selected.set(run.seed, value)
  }
  for (const route of ['human', 'beast'] as const) {
    const cohort = runs.filter((run) => run.route === route)
    cohort.slice(0, 20).forEach((run) => add(run, 'fixed-cohort-sample'))
    const alive = cohort.filter((run) => run.state.ending?.alive)
    const dead = cohort.filter((run) => run.state.ending && !run.state.ending.alive)
    if (alive[0]) add(alive[0], 'alive-ending')
    if (dead[0]) add(dead[0], 'death-ending')
    const transformed = cohort.find((run) => run.state.route === 'transformed')
    if (transformed) add(transformed, 'transformation')
    const sorted = [...cohort].sort((left, right) => left.state.progression.combatPower.total - right.state.progression.combatPower.total)
    if (sorted[0]) add(sorted[0], 'minimum-combat-power')
    if (sorted.at(-1)) add(sorted.at(-1)!, 'maximum-combat-power')
  }
  return [...selected.values()].sort((left, right) => left.seed.localeCompare(right.seed))
}

async function main() {
  if (existsSync(root)) throw new Error(`Recovery generation already exists: ${root}`)
  await Promise.all([mkdir(runsDirectory, { recursive: true }), mkdir(findingsDirectory, { recursive: true })])
  const runs = [
    ...Array.from({ length: cohortSize }, (_, index) => runJourney('human', `v03-recovery-human-${String(index + 1).padStart(3, '0')}`)),
    ...Array.from({ length: cohortSize }, (_, index) => runJourney('beast', `v03-recovery-beast-${String(index + 1).padStart(3, '0')}`)),
  ]
  await Promise.all(runs.map(async (run) => {
    const base = `${run.route}-${run.seed.replace(/^v03-recovery-/, '')}`
    await Promise.all([
      writeFile(resolve(runsDirectory, `${base}.json`), `${JSON.stringify(run, null, 2)}\n`),
      writeFile(resolve(runsDirectory, `${base}.txt`), `${run.biography}\n`),
    ])
  }))

  const observed = poolHits(runs)
  const controlled = controlledEvidence()
  const originalPools = legacyFlow.pools
  const composedPoolIds = new Set(originalPools
    .filter((pool) => pool.title === '兽武魂' || pool.title === '器武魂')
    .map((pool) => pool.activePoolId))
  const totalDraws = [...observed.values()].reduce((sum, value) => sum + value.draws, 0)
  const frequency = originalPools.map((pool) => {
    const hit = observed.get(pool.activePoolId)
    const controlledProof = controlled.get(pool.activePoolId)
    const coverageStatus: CoverageStatus = composedPoolIds.has(pool.activePoolId)
      ? 'composed'
      : hit
        ? 'observed'
        : controlledProof
          ? 'controlled'
          : 'blocked'
    return {
      sourcePoolId: pool.sourcePoolId,
      activePoolId: pool.activePoolId,
      title: pool.title,
      runsHit: hit?.runs.size ?? 0,
      drawCount: hit?.draws ?? 0,
      runFrequency: (hit?.runs.size ?? 0) / cohortSize,
      drawFrequency: totalDraws === 0 ? null : (hit?.draws ?? 0) / totalDraws,
      sampleSeeds: hit?.seeds ?? [],
      coverageStatus,
    }
  })
  const coverage = {
    observed: frequency.filter((row) => row.coverageStatus === 'observed').length,
    controlled: frequency.filter((row) => row.coverageStatus === 'controlled').length,
    composed: frequency.filter((row) => row.coverageStatus === 'composed').length,
    blocked: frequency.filter((row) => row.coverageStatus === 'blocked').length,
    rows: frequency.map((row) => ({ sourcePoolId: row.sourcePoolId, activePoolId: row.activePoolId, coverageStatus: row.coverageStatus })),
  }

  const humanRuns = runs.filter((run) => run.route === 'human')
  const godRuns = humanRuns.filter((run) => run.state.ending?.endingId === 'ending.god-ascension' || run.state.ending?.endingId === 'ending.self-created-ascension')
  const godRate = godRuns.length / cohortSize
  const godRateReport = {
    numerator: godRuns.length,
    denominator: cohortSize,
    godRate,
    passed: godRate >= 0.45 && godRate <= 0.55,
    runs: humanRuns.map((run) => ({ seed: run.seed, ending: run.state.ending?.endingId ?? null, path: run.state.progression.godTrial?.origin ?? null })),
  }
  const automatedIssues = runs.flatMap((run) => run.audit.issues.map((issue) => ({ route: run.route, seed: run.seed, ...issue })))
  const biographySamples = selectBiographySamples(runs)
  const passed = automatedIssues.length === 0 && coverage.blocked === 0 && godRateReport.passed && totalDraws > 0
  const manifest = {
    format: 'douluo-spin-v03-recovery',
    status: passed ? 'passed' : 'failed',
    generation,
    commit,
    contentVersion: v03Content.manifest.contentVersion,
    sourceSha256,
    routes: { human: cohortSize, beast: cohortSize },
    seeds: runs.map((run) => ({ route: run.route, seed: run.seed })),
    staticFidelity: { pools: originalPools.length, sourceSha256 },
    coverage: { observed: coverage.observed, controlled: coverage.controlled, composed: coverage.composed, blocked: coverage.blocked },
    frequencySha256: sha256(JSON.stringify(frequency)),
    audits: { passed: runs.filter((run) => run.audit.passed).length, total: runs.length, issues: automatedIssues.length },
    godRate: { numerator: godRuns.length, denominator: cohortSize, value: godRate, passed: godRateReport.passed },
    biographySelection: biographySamples,
  }
  const auditReport = [
    '# v0.3 原版恢复长程审计', '',
    `- Generation: ${generation}`,
    `- Status: ${manifest.status}`,
    `- Content version: ${v03Content.manifest.contentVersion}`,
    `- Automated runs: ${manifest.audits.passed}/${manifest.audits.total}`,
    `- Pool coverage: observed ${coverage.observed}, controlled ${coverage.controlled}, composed ${coverage.composed}, blocked ${coverage.blocked}`,
    `- Human god rate: ${godRuns.length}/${cohortSize} (${(godRate * 100).toFixed(1)}%)`,
    `- Biography review index: ${biographySamples.length} selected records`,
    '',
    'A failed generation is retained as diagnostic evidence and is not release certification.',
    '',
  ].join('\n')
  await Promise.all([
    writeFile(resolve(root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`),
    writeFile(resolve(root, 'pool-frequency.json'), `${JSON.stringify(frequency, null, 2)}\n`),
    writeFile(resolve(root, 'pool-coverage.json'), `${JSON.stringify(coverage, null, 2)}\n`),
    writeFile(resolve(root, 'pool-recovery-ledger.json'), readFileSync('test-results/iterations/v0.3/legacy-migration/pool-recovery-ledger.json', 'utf8')),
    writeFile(resolve(root, 'god-rate.json'), `${JSON.stringify(godRateReport, null, 2)}\n`),
    writeFile(resolve(root, 'findings', 'automated-issues.json'), `${JSON.stringify(automatedIssues, null, 2)}\n`),
    writeFile(resolve(root, 'findings', 'controlled-evidence.json'), `${JSON.stringify([...controlled.entries()], null, 2)}\n`),
    writeFile(resolve(root, 'findings', 'biography-review-index.json'), `${JSON.stringify(biographySamples, null, 2)}\n`),
    writeFile(resolve(root, 'audit-report.md'), auditReport),
  ])
  if (!passed) process.exitCode = 1
  console.log(`${generation}: ${manifest.status}; automated=${manifest.audits.passed}/${manifest.audits.total}; blocked=${coverage.blocked}; godRate=${(godRate * 100).toFixed(1)}%`)
}

await main()
