import type { DomainEvent, EntityType, EventBatch, GameState, StatId } from '../model/contracts'
import { ContentVersionMismatch } from '../model/errors'

const statBounds: Record<StatId, readonly [number, number]> = {
  age: [0, 10_000],
  level: [1, 159],
  'max-level': [1, 159],
  'appearance-rank': [0, 7],
  'beast-cultivation': [0, 1_000_000],
  'tang-age': [-10_000, 10_000],
}

const entityTypes: readonly EntityType[] = [
  'gender', 'appearance', 'martial-soul-type', 'martial-soul', 'trait', 'domain', 'soul-bone',
  'faction', 'godhood', 'beast-species', 'beast-bloodline',
  'beast-type', 'beast-area', 'soul-ring', 'story-node',
]

export function createInitialGameState(contentVersion: string): GameState {
  return {
    schemaVersion: 3,
    contentVersion,
    phase: 'idle',
    route: null,
    random: { seed: '', state: 0 },
    turn: 0,
    stats: {
      age: 0,
      level: 1,
      'max-level': 99,
      'appearance-rank': 0,
      'beast-cultivation': 0,
      'tang-age': 0,
    },
    entities: Object.fromEntries(entityTypes.map((type) => [type, []])) as unknown as GameState['entities'],
    progression: {
      growthCycles: 0,
      rings: [],
      storyNodes: [],
      pendingTribulation: null,
      resolvedTribulations: [],
      beastRouteChoiceResolved: false,
      godTrial: null,
    },
    agenda: [],
    ending: null,
  }
}

export function clampStatValue(stat: StatId, value: number): number {
  const [minimum, maximum] = statBounds[stat]
  return Math.max(minimum, Math.min(maximum, value))
}

export function reduceEvent(state: GameState, event: DomainEvent): GameState {
  switch (event.type) {
    case 'run.started':
      return { ...state, route: event.route, random: { seed: event.seed, state: state.random.state }, ending: null }
    case 'option.selected':
    case 'signal.emitted':
      return state
    case 'stat.changed':
      return { ...state, stats: { ...state.stats, [event.stat]: clampStatValue(event.stat, event.after) } }
    case 'entity.granted': {
      const current = state.entities[event.entityType]
      if (current.includes(event.entityId)) return state
      return { ...state, entities: { ...state.entities, [event.entityType]: [...current, event.entityId] } }
    }
    case 'entity.revoked':
      return { ...state, entities: { ...state.entities, [event.entityType]: state.entities[event.entityType].filter((id) => id !== event.entityId) } }
    case 'time.advanced':
      return { ...state, stats: { ...state.stats, 'tang-age': clampStatValue('tang-age', event.after) } }
    case 'task.scheduled':
      return state.agenda.some((task) => task.id === event.task.id) ? state : { ...state, agenda: [...state.agenda, event.task] }
    case 'task.completed':
      return { ...state, agenda: state.agenda.filter((task) => task.id !== event.taskId) }
    case 'phase.changed':
      if (state.phase !== event.from) throw new Error(`Phase mismatch: expected ${state.phase}, received ${event.from}`)
      return { ...state, phase: event.to }
    case 'route.changed':
      if (state.route !== event.from) throw new Error(`Route mismatch: expected ${state.route}, received ${event.from}`)
      return { ...state, route: event.to }
    case 'growth.completed':
      if (event.cycle !== state.progression.growthCycles + 1) throw new Error(`Growth cycle mismatch: ${event.cycle}`)
      return { ...state, progression: { ...state.progression, growthCycles: event.cycle } }
    case 'soul-ring.granted':
      if (event.index !== state.progression.rings.length + 1) throw new Error(`Soul ring index mismatch: ${event.index}`)
      return {
        ...state,
        entities: { ...state.entities, 'soul-ring': [...state.entities['soul-ring'], event.ringId] },
        progression: { ...state.progression, rings: [...state.progression.rings, event.ringId] },
      }
    case 'story.completed':
      if (event.index !== state.progression.storyNodes.length + 1) throw new Error(`Story index mismatch: ${event.index}`)
      return {
        ...state,
        entities: { ...state.entities, 'story-node': [...state.entities['story-node'], event.nodeId] },
        progression: { ...state.progression, storyNodes: [...state.progression.storyNodes, event.nodeId] },
      }
    case 'beast.tribulation-requested':
      if (state.progression.pendingTribulation != null) throw new Error('A beast tribulation is already pending')
      return { ...state, progression: { ...state.progression, pendingTribulation: event.threshold } }
    case 'beast.tribulation-resolved':
      if (state.progression.pendingTribulation !== event.threshold) throw new Error(`Tribulation threshold mismatch: ${event.threshold}`)
      return {
        ...state,
        progression: {
          ...state.progression,
          pendingTribulation: null,
          resolvedTribulations: [...state.progression.resolvedTribulations, event.threshold],
        },
      }
    case 'beast.route-choice-resolved':
      return { ...state, progression: { ...state.progression, beastRouteChoiceResolved: true } }
    case 'god-trial.started':
      if (state.progression.godTrial) throw new Error('God trial already active')
      return {
        ...state,
        progression: {
          ...state.progression,
          godTrial: { tierId: event.tierId, deityId: event.deityId, completed: 0, total: event.total, origin: event.origin },
        },
      }
    case 'god-trial.progressed': {
      const trial = state.progression.godTrial
      if (!trial || trial.completed !== event.before || event.after !== event.before + 1 || event.after > trial.total) {
        throw new Error(`God trial progress mismatch: ${event.before}->${event.after}`)
      }
      return { ...state, progression: { ...state.progression, godTrial: { ...trial, completed: event.after } } }
    }
    case 'run.finished':
      return { ...state, phase: 'ended', agenda: [], ending: { endingId: event.endingId, alive: event.alive } }
  }
}

export function reduceEvents(state: GameState, events: readonly DomainEvent[]): GameState {
  return events.reduce(reduceEvent, state)
}

export function applyBatch(state: GameState, batch: EventBatch): GameState {
  if (batch.contentVersion !== state.contentVersion) throw new ContentVersionMismatch(state.contentVersion, batch.contentVersion)
  if (batch.rngBefore !== state.random.state) throw new Error(`RNG receipt mismatch: expected ${state.random.state}, received ${batch.rngBefore}`)
  const reduced = reduceEvents(state, batch.events)
  return { ...reduced, turn: state.turn + (batch.command === 'turn.spin' ? 1 : 0), random: { ...reduced.random, state: batch.rngAfter } }
}
