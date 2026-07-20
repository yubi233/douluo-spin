import { endingId, entityId } from '../ids'
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
      combatPower: {
        levelBase: 0,
        ringPower: 0,
        martialSoulPower: 0,
        domainPower: 0,
        soulBonePower: 0,
        talentCoefficient: 0,
        battleTraitCoefficient: 0,
        multiplier: 1,
        total: 0,
      },
      growthCycles: 0,
      rings: [],
      storyNodes: [],
      storyBranch: null,
      scheduledStoryMilestones: [],
      factionStages: [],
      factionStoryStages: [],
      completedFlowStages: [],
      beastEvolution: { strength: 0, mind: 0, body: 0, defense: 0, speed: 0 },
      beastElements: {
        metal: 0, life: 0, fire: 0, space: 0, moon: 0, wind: 0,
        destruction: 0, time: 0, water: 0, dark: 0, ice: 0, sun: 0,
        wood: 0, lightning: 0, earth: 0, death: 0, light: 0, poison: 0,
      },
      storyMetrics: { negative: 0, combat: 0 },
      pendingTribulation: null,
      resolvedTribulations: [],
      beastRouteChoiceResolved: false,
      seaGodTrial: null,
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
      if (state.route === 'beast' && event.entityType === 'godhood') {
        if (event.entityId !== entityId('entity.godhood.beast')) {
          throw new Error(`A beast cannot inherit or create a human godhood: ${event.entityId}`)
        }
        if (!state.progression.resolvedTribulations.includes(1_000_000)) {
          throw new Error('A beast godhood requires a resolved million-year tribulation')
        }
      }
      const current = state.entities[event.entityType]
      if (current.includes(event.entityId)) return state
      return { ...state, entities: { ...state.entities, [event.entityType]: [...current, event.entityId] } }
    }
    case 'entity.revoked':
      return { ...state, entities: { ...state.entities, [event.entityType]: state.entities[event.entityType].filter((id) => id !== event.entityId) } }
    case 'time.advanced':
      return { ...state, stats: { ...state.stats, 'tang-age': clampStatValue('tang-age', event.after) } }
    case 'task.scheduled':
      if (state.agenda.some((task) => task.id === event.task.id)) return state
      return {
        ...state,
        agenda: event.task.priority === 'front'
          ? [event.task, ...state.agenda]
          : [...state.agenda, event.task],
      }
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
    case 'story.branch-selected':
      return { ...state, progression: { ...state.progression, storyBranch: event.branch } }
    case 'story.milestone-scheduled': {
      const id = `${event.branch}@${event.atTangAge}`
      if (state.progression.scheduledStoryMilestones.includes(id)) return state
      return {
        ...state,
        progression: { ...state.progression, scheduledStoryMilestones: [...state.progression.scheduledStoryMilestones, id] },
      }
    }
    case 'faction.stage-selected':
      if (state.progression.factionStages.includes(event.stage)) return state
      return { ...state, progression: { ...state.progression, factionStages: [...state.progression.factionStages, event.stage] } }
    case 'faction-story.stage-completed': {
      const key = `${event.factionId}:${event.stage}`
      if (state.progression.factionStoryStages.includes(key)) return state
      return { ...state, progression: { ...state.progression, factionStoryStages: [...state.progression.factionStoryStages, key] } }
    }
    case 'flow.stage-completed':
      return state.progression.completedFlowStages.includes(event.stage)
        ? state
        : { ...state, progression: { ...state.progression, completedFlowStages: [...state.progression.completedFlowStages, event.stage] } }
    case 'beast.evolution-advanced': {
      const before = state.progression.beastEvolution[event.kind]
      if (before !== event.before || event.after !== before + 1) throw new Error(`Beast evolution mismatch for ${event.kind}: ${event.before}->${event.after}`)
      return {
        ...state,
        progression: {
          ...state.progression,
          beastEvolution: { ...state.progression.beastEvolution, [event.kind]: event.after },
        },
      }
    }
    case 'beast.element-advanced': {
      const before = state.progression.beastElements[event.element]
      if (before !== event.before || event.after !== before + 1 || event.after > 4) {
        throw new Error(`Beast element evolution mismatch for ${event.element}: ${event.before}->${event.after}`)
      }
      return {
        ...state,
        progression: {
          ...state.progression,
          beastElements: { ...state.progression.beastElements, [event.element]: event.after },
        },
      }
    }
    case 'story.metric-recorded': {
      const before = state.progression.storyMetrics[event.metric]
      if (before !== event.before || event.after !== before + 1) throw new Error(`Story metric mismatch for ${event.metric}: ${event.before}->${event.after}`)
      return {
        ...state,
        progression: { ...state.progression, storyMetrics: { ...state.progression.storyMetrics, [event.metric]: event.after } },
      }
    }
    case 'combat-power.recalculated':
      return { ...state, progression: { ...state.progression, combatPower: event.after } }
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
    case 'sea-god.started':
      if (state.route === 'beast') throw new Error('A beast cannot enter the Sea God inheritance route')
      if (state.progression.seaGodTrial) throw new Error('Sea God trial already active')
      if (!Number.isInteger(event.total) || event.total < 1 || event.total > 9) throw new Error(`Invalid Sea God trial total: ${event.total}`)
      return {
        ...state,
        progression: {
          ...state.progression,
          seaGodTrial: { grade: event.grade, completed: 0, total: event.total, planned: null, failed: false },
        },
      }
    case 'sea-god.plan-selected': {
      const trial = state.progression.seaGodTrial
      if (!trial || trial.planned != null || event.completed < 0 || event.completed > trial.total || (event.failed && event.completed !== 0)) {
        throw new Error(`Sea God plan mismatch: ${event.completed}/${event.failed}`)
      }
      return {
        ...state,
        progression: { ...state.progression, seaGodTrial: { ...trial, planned: event.completed, failed: event.failed } },
      }
    }
    case 'sea-god.plan-extended': {
      const trial = state.progression.seaGodTrial
      if (!trial || trial.planned == null || trial.planned !== event.before || event.after <= event.before || event.after > trial.total) {
        throw new Error(`Sea God plan extension mismatch: ${event.before}->${event.after}`)
      }
      return {
        ...state,
        progression: { ...state.progression, seaGodTrial: { ...trial, planned: event.after } },
      }
    }
    case 'sea-god.reward-progressed': {
      const trial = state.progression.seaGodTrial
      if (!trial || trial.planned == null || trial.completed !== event.before || event.after !== event.before + 1 || event.after > trial.planned) {
        throw new Error(`Sea God reward progress mismatch: ${event.before}->${event.after}`)
      }
      return { ...state, progression: { ...state.progression, seaGodTrial: { ...trial, completed: event.after } } }
    }
    case 'god-trial.started':
      if (state.route === 'beast') throw new Error('A beast cannot enter a human god trial')
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
      if (state.route === 'beast' && event.alive) {
        if (event.endingId === endingId('ending.beast-ascension')) {
          if (!state.progression.resolvedTribulations.includes(1_000_000) || !state.entities.godhood.includes(entityId('entity.godhood.beast'))) {
            throw new Error('A beast ascension ending requires the million-year beast godhood')
          }
        } else if (event.endingId === endingId('ending.beast-immortal')) {
          if (!state.progression.resolvedTribulations.includes(1_000_000) || state.entities.godhood.length > 0) {
            throw new Error('A beast immortal ending requires a million-year survival without godhood')
          }
        } else {
          throw new Error(`A beast cannot finish with a human ascension ending: ${event.endingId}`)
        }
      }
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
