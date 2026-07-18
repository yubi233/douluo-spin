import type {
  CollectionFactKey,
  ContentRegistries,
  FactKey,
  GameState,
  JsonObject,
  NumberExpression,
  NumericFactKey,
  Predicate,
  Scalar,
} from '../model/contracts'
import type { EntityId, PolicyId } from '../ids'

export type PolicyEvaluator = (state: GameState, args?: JsonObject) => number | boolean
export type PolicyRegistry = ReadonlyMap<PolicyId, PolicyEvaluator>

function numericFact(state: GameState, fact: NumericFactKey): number {
  switch (fact) {
    case 'actor.age': return state.stats.age
    case 'actor.level': return state.stats.level
    case 'actor.max-level': return state.stats['max-level']
    case 'beast.cultivation': return state.stats['beast-cultivation']
    case 'timeline.tang-age': return state.stats['tang-age']
    case 'progression.ring-count': return state.progression.rings.length
    case 'progression.combat-power': return state.stats.level * state.stats.level / 20
  }
}

function collectionFact(state: GameState, fact: CollectionFactKey): readonly EntityId[] {
  switch (fact) {
    case 'actor.martial-souls': return state.entities['martial-soul']
    case 'actor.traits': return state.entities.trait
    case 'actor.domains': return state.entities.domain
    case 'actor.soul-bones': return state.entities['soul-bone']
    case 'actor.beast-types': return state.entities['beast-type']
    case 'actor.beast-species': return state.entities['beast-species']
    case 'actor.beast-areas': return state.entities['beast-area']
    case 'story.completed-nodes': return state.progression.storyNodes
  }
}

function scalarFact(state: GameState, fact: FactKey): Scalar | readonly EntityId[] {
  if (fact === 'actor.route') return state.route
  if (fact === 'actor.gender') return state.entities.gender[0] ?? null
  if (fact === 'actor.alive') return state.ending?.alive ?? true
  if (fact === 'actor.faction') return state.entities.faction[0] ?? null
  if (fact === 'timeline.canon-phase') return state.stats['tang-age'] >= 26 ? 'post-tang-ascension' : state.stats['tang-age'] >= 24 ? 'tang-ascension-war' : 'pre-tang-ascension'
  if (fact === 'god-trial.active') return state.progression.godTrial != null
  if (fact === 'actor.martial-souls' || fact === 'actor.traits' || fact === 'actor.domains' || fact === 'actor.soul-bones' || fact === 'actor.beast-types' || fact === 'actor.beast-species' || fact === 'actor.beast-areas' || fact === 'story.completed-nodes') {
    return collectionFact(state, fact)
  }
  return numericFact(state, fact)
}

function compare(left: Scalar, op: string, right: Scalar): boolean {
  switch (op) {
    case 'eq': return left === right
    case 'neq': return left !== right
    case 'gt': return typeof left === 'number' && typeof right === 'number' && left > right
    case 'gte': return typeof left === 'number' && typeof right === 'number' && left >= right
    case 'lt': return typeof left === 'number' && typeof right === 'number' && left < right
    case 'lte': return typeof left === 'number' && typeof right === 'number' && left <= right
    default: return false
  }
}

export function evaluatePredicate(predicate: Predicate, state: GameState, policies: PolicyRegistry): boolean {
  switch (predicate.type) {
    case 'all': return predicate.items.every((item) => evaluatePredicate(item, state, policies))
    case 'any': return predicate.items.some((item) => evaluatePredicate(item, state, policies))
    case 'not': return !evaluatePredicate(predicate.item, state, policies)
    case 'compare': {
      const value = scalarFact(state, predicate.fact)
      return !Array.isArray(value) && compare(value as Scalar, predicate.op, predicate.value)
    }
    case 'contains': return collectionFact(state, predicate.fact).includes(predicate.value)
    case 'policy': return Boolean(policies.get(predicate.policyId)?.(state, predicate.args))
  }
}

export function evaluateNumber(expression: NumberExpression, state: GameState, policies: PolicyRegistry): number {
  switch (expression.type) {
    case 'constant': return expression.value
    case 'fact': return numericFact(state, expression.fact)
    case 'add': return expression.items.reduce((sum, item) => sum + evaluateNumber(item, state, policies), 0)
    case 'multiply': return expression.items.reduce((product, item) => product * evaluateNumber(item, state, policies), 1)
    case 'min': return Math.min(...expression.items.map((item) => evaluateNumber(item, state, policies)))
    case 'max': return Math.max(...expression.items.map((item) => evaluateNumber(item, state, policies)))
    case 'clamp': return Math.max(expression.min, Math.min(expression.max, evaluateNumber(expression.value, state, policies)))
    case 'policy': {
      const value = policies.get(expression.policyId)?.(state, expression.args)
      return typeof value === 'number' && Number.isFinite(value) ? value : 0
    }
  }
}

export function createContentRegistries(policies: PolicyRegistry, signals: ReadonlySet<string>): ContentRegistries {
  return {
    facts: new Set<FactKey>([
      'actor.age', 'actor.level', 'actor.max-level', 'beast.cultivation', 'timeline.tang-age',
      'progression.ring-count', 'progression.combat-power', 'actor.route', 'actor.gender', 'actor.alive',
      'actor.faction', 'timeline.canon-phase', 'god-trial.active', 'actor.martial-souls', 'actor.traits',
      'actor.domains', 'actor.soul-bones', 'actor.beast-types', 'actor.beast-species', 'actor.beast-areas',
      'story.completed-nodes',
    ]),
    policies: new Set(policies.keys()),
    signals,
    effects: new Set(['stat.change', 'entity.grant', 'entity.revoke', 'time.advance', 'signal.emit', 'run.finish']),
    maxExpressionDepth: 12,
  }
}
