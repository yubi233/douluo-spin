import { GameService } from './gameService'
import type { CompiledContent, EventBatch, GameState, Route } from '@/core/model/contracts'
import type { PolicyRegistry } from '@/core/rules/evaluate'

export interface SimulationTraceEntry {
  readonly turn: number
  readonly poolId: string
  readonly optionId: string
  readonly probability: number
  readonly eventTypes: readonly string[]
}

export interface SimulationIssue {
  readonly code: 'incomplete' | 'agenda-after-ending' | 'route-mismatch' | 'missing-ending' | 'invalid-task-order' | 'incompatible-beast-identity'
  readonly message: string
}

export interface SimulationResult {
  readonly seed: string
  readonly requestedRoute: 'human' | 'beast'
  readonly completed: boolean
  readonly state: GameState
  readonly eventLog: readonly EventBatch[]
  readonly trace: readonly SimulationTraceEntry[]
  readonly audit: { readonly passed: boolean; readonly issues: readonly SimulationIssue[] }
}

export function auditTraceOrder(
  route: GameState['route'],
  trace: readonly SimulationTraceEntry[],
  initialAdventureLevel: number,
): readonly SimulationIssue[] {
  const pools = trace.map((entry) => entry.poolId)
  const faction = pools.indexOf('pool.setup.faction')
  const firstStory = pools.indexOf('pool.story.1')
  const firstRing = pools.indexOf('pool.human.soul-ring')
  const firstGrowth = pools.indexOf('pool.human.growth')
  const appearance = pools.lastIndexOf('pool.setup.appearance')
  const issues: SimulationIssue[] = []
  if ((route === 'human' || route === 'transformed') && firstStory >= 0 && (faction < 0 || firstStory < faction)) {
    issues.push({ code: 'invalid-task-order', message: 'First story task ran before faction setup completed' })
  }
  if (route === 'transformed' && firstRing >= 0 && (appearance < 0 || faction < appearance || firstRing < faction)) {
    issues.push({ code: 'invalid-task-order', message: 'Transformed soul-ring task ran before appearance and faction setup completed' })
  }
  if ((route === 'human' || route === 'transformed') && initialAdventureLevel >= 10 && firstGrowth >= 0 && (firstRing < 0 || firstGrowth < firstRing)) {
    issues.push({ code: 'invalid-task-order', message: 'First growth task ran before initial soul rings were granted' })
  }
  return issues
}

export function auditBeastIdentity(state: GameState): readonly SimulationIssue[] {
  const type = state.entities['beast-type'][0]
  const species = state.entities['beast-species'][0]
  const bloodline = state.entities['beast-bloodline'][0]
  const area = state.entities['beast-area'][0]
  if (!type && !species && !bloodline && !area) return []
  const landValid = type === 'entity.beast-type.land' && species === 'entity.beast-species.wind-wolf'
    && bloodline === 'entity.beast-bloodline.wind-wolf' && area === 'entity.beast-area.forest'
  const seaValid = type === 'entity.beast-type.sea' && species === 'entity.beast-species.spirit-whale'
    && bloodline === 'entity.beast-bloodline.spirit-whale' && area === 'entity.beast-area.ocean'
  return landValid || seaValid ? [] : [{
    code: 'incompatible-beast-identity',
    message: `Incompatible beast identity: type=${type}, species=${species}, bloodline=${bloodline}, area=${area}`,
  }]
}

function levelAtAdventureStart(eventLog: readonly EventBatch[]): number {
  let level = 0
  for (const batch of eventLog) {
    for (const event of batch.events) {
      if (event.type === 'stat.changed' && event.stat === 'level') level = event.after
      if (event.type === 'phase.changed' && (event.to === 'adventure.human' || event.to === 'adventure.transformed')) return level
    }
  }
  return level
}

export function simulateJourney(
  content: CompiledContent,
  policies: PolicyRegistry,
  options: { seed: string; route: 'human' | 'beast'; maxTurns?: number },
): SimulationResult {
  const service = new GameService(content, policies)
  service.dispatch({ type: 'run.start', route: options.route, seed: options.seed })
  const trace: SimulationTraceEntry[] = []
  const maxTurns = options.maxTurns ?? 200
  while (service.state.phase !== 'ended' && trace.length < maxTurns) {
    if (service.state.agenda.length === 0) break
    const receipt = service.dispatch({ type: 'turn.spin' })
    if (receipt.draw && receipt.batch) {
      trace.push({
        turn: service.state.turn,
        poolId: receipt.draw.poolId,
        optionId: receipt.draw.optionId,
        probability: receipt.draw.probability,
        eventTypes: receipt.batch.events.map((event) => event.type),
      })
    }
  }
  const state = service.state
  const issues: SimulationIssue[] = []
  if (state.phase !== 'ended') issues.push({ code: 'incomplete', message: `Journey stopped in ${state.phase} after ${trace.length} turns` })
  if (state.phase === 'ended' && state.agenda.length > 0) issues.push({ code: 'agenda-after-ending', message: 'Ended journey retained scheduled tasks' })
  if (state.phase === 'ended' && !state.ending) issues.push({ code: 'missing-ending', message: 'Ended journey has no ending projection' })
  if (state.route !== options.route && !(options.route === 'beast' && state.route === 'transformed')) {
    issues.push({ code: 'route-mismatch', message: `Requested ${options.route}, projected ${state.route}` })
  }
  issues.push(...auditTraceOrder(state.route, trace, levelAtAdventureStart(service.eventLog)))
  issues.push(...auditBeastIdentity(state))
  return {
    seed: options.seed,
    requestedRoute: options.route,
    completed: state.phase === 'ended',
    state,
    eventLog: service.eventLog,
    trace,
    audit: { passed: issues.length === 0, issues },
  }
}
