import type {
  CompiledContent,
  CollectionFactKey,
  ContentRegistries,
  ContentSource,
  EffectSpec,
  EntityType,
  MechanicsCatalog,
  NumberExpression,
  Predicate,
} from '@/core/model/contracts'
import { ContentValidationError, type ContentIssue } from '@/core/model/errors'

const DEFAULT_MAX_EXPRESSION_DEPTH = 12
const STABLE_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/

function hash(value: string): string {
  let result = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 0x01000193)
  }
  return (result >>> 0).toString(16).padStart(8, '0')
}

function validateExpression(
  expression: NumberExpression,
  path: string,
  registries: ContentRegistries,
  issues: ContentIssue[],
  depth = 1,
) {
  const maxDepth = registries.maxExpressionDepth ?? DEFAULT_MAX_EXPRESSION_DEPTH
  if (depth > maxDepth) {
    issues.push({ path, code: 'expression.depth', message: `Expression exceeds maximum depth ${maxDepth}` })
    return
  }
  if (expression.type === 'constant' && !Number.isFinite(expression.value)) {
    issues.push({ path, code: 'expression.number', message: 'Constant must be finite' })
  }
  if (expression.type === 'fact' && !registries.facts.has(expression.fact)) {
    issues.push({ path, code: 'registry.fact', message: `Unknown fact ${expression.fact}` })
  }
  if (expression.type === 'policy' && !registries.policies.has(expression.policyId)) {
    issues.push({ path, code: 'registry.policy', message: `Unknown policy ${expression.policyId}` })
  }
  if ('items' in expression) {
    if (expression.items.length === 0) {
      issues.push({ path, code: 'expression.empty', message: `${expression.type} requires at least one item` })
    }
    expression.items.forEach((item, index) => validateExpression(item, `${path}.items[${index}]`, registries, issues, depth + 1))
  }
  if (expression.type === 'clamp') {
    if (!Number.isFinite(expression.min) || !Number.isFinite(expression.max) || expression.min > expression.max) {
      issues.push({ path, code: 'expression.clamp', message: 'Clamp bounds must be finite and ordered' })
    }
    validateExpression(expression.value, `${path}.value`, registries, issues, depth + 1)
  }
}

function validatePredicate(
  predicate: Predicate,
  path: string,
  registries: ContentRegistries,
  entityTypes: ReadonlyMap<string, EntityType>,
  issues: ContentIssue[],
  depth = 1,
) {
  const maxDepth = registries.maxExpressionDepth ?? DEFAULT_MAX_EXPRESSION_DEPTH
  if (depth > maxDepth) {
    issues.push({ path, code: 'predicate.depth', message: `Predicate exceeds maximum depth ${maxDepth}` })
    return
  }
  if (predicate.type === 'compare' || predicate.type === 'contains') {
    if (!registries.facts.has(predicate.fact)) {
      issues.push({ path, code: 'registry.fact', message: `Unknown fact ${predicate.fact}` })
    }
  }
  if (predicate.type === 'contains') {
    const actualType = entityTypes.get(predicate.value)
    if (!actualType) {
      issues.push({ path, code: 'reference.entity', message: `Unknown entity ${predicate.value}` })
    } else {
      const expectedType: Record<CollectionFactKey, EntityType> = {
        'actor.martial-souls': 'martial-soul', 'actor.traits': 'trait', 'actor.domains': 'domain',
        'actor.soul-bones': 'soul-bone', 'actor.beast-types': 'beast-type',
        'actor.beast-species': 'beast-species', 'actor.beast-areas': 'beast-area',
        'story.completed-nodes': 'story-node',
      }
      if (actualType !== expectedType[predicate.fact]) {
        issues.push({ path, code: 'reference.entity-type', message: `Entity ${predicate.value} is ${actualType}, expected ${expectedType[predicate.fact]}` })
      }
    }
  }
  if (predicate.type === 'policy' && !registries.policies.has(predicate.policyId)) {
    issues.push({ path, code: 'registry.policy', message: `Unknown policy ${predicate.policyId}` })
  }
  if (predicate.type === 'all' || predicate.type === 'any') {
    if (predicate.items.length === 0) {
      issues.push({ path, code: 'predicate.empty', message: `${predicate.type} requires at least one item` })
    }
    predicate.items.forEach((item, index) => validatePredicate(item, `${path}.items[${index}]`, registries, entityTypes, issues, depth + 1))
  }
  if (predicate.type === 'not') validatePredicate(predicate.item, `${path}.item`, registries, entityTypes, issues, depth + 1)
}

function validateEffect(
  effect: EffectSpec,
  path: string,
  registries: ContentRegistries,
  entityTypes: ReadonlyMap<string, EntityType>,
  endingIds: ReadonlySet<string>,
  issues: ContentIssue[],
) {
  if (!registries.effects.has(effect.type)) {
    issues.push({ path, code: 'registry.effect', message: `Unknown effect ${effect.type}` })
    return
  }
  if (effect.type === 'stat.change') validateExpression(effect.delta, `${path}.delta`, registries, issues)
  if (effect.type === 'time.advance') validateExpression(effect.years, `${path}.years`, registries, issues)
  if (effect.type === 'entity.grant' || effect.type === 'entity.revoke') {
    const actualType = entityTypes.get(effect.entityId)
    if (!actualType) issues.push({ path, code: 'reference.entity', message: `Unknown entity ${effect.entityId}` })
    else if (actualType !== effect.entityType) issues.push({ path, code: 'reference.entity-type', message: `Entity ${effect.entityId} is ${actualType}, expected ${effect.entityType}` })
  }
  if (effect.type === 'signal.emit' && !registries.signals.has(effect.signalId)) {
    issues.push({ path, code: 'registry.signal', message: `Unknown signal ${effect.signalId}` })
  }
  if (effect.type === 'run.finish' && !endingIds.has(effect.endingId)) {
    issues.push({ path, code: 'reference.ending', message: `Unknown ending ${effect.endingId}` })
  }
}

function mechanicsFingerprint(mechanics: Omit<MechanicsCatalog, 'fingerprint'>): string {
  const payload = {
    contentVersion: mechanics.contentVersion,
    pools: [...mechanics.pools.values()].sort((a, b) => a.id.localeCompare(b.id)),
    entities: [...mechanics.entities.entries()].sort(([a], [b]) => a.localeCompare(b)),
    endings: [...mechanics.endings.entries()].sort(([a], [b]) => a.localeCompare(b)),
  }
  return hash(JSON.stringify(payload))
}

export function compileContent(source: ContentSource, registries: ContentRegistries): CompiledContent {
  const issues: ContentIssue[] = []
  if (source.manifest.schemaVersion !== 3) {
    issues.push({ path: 'manifest.schemaVersion', code: 'manifest.schema', message: 'schemaVersion must be 3' })
  }
  if (!source.manifest.contentVersion.trim()) {
    issues.push({ path: 'manifest.contentVersion', code: 'manifest.version', message: 'contentVersion is required' })
  }

  const globallySeen = new Map<string, string>()
  const registerId = (id: string, path: string) => {
    if (typeof id !== 'string' || !STABLE_ID_PATTERN.test(id)) {
      issues.push({ path, code: 'id.invalid', message: `ID must be a stable ASCII identifier: ${String(id)}` })
      return
    }
    const previous = globallySeen.get(id)
    if (previous) issues.push({ path, code: 'id.duplicate', message: `ID ${id} already declared at ${previous}` })
    else globallySeen.set(id, path)
  }

  source.entities.forEach((entity, index) => registerId(entity.id, `entities[${index}].id`))
  source.endings.forEach((ending, index) => registerId(ending.id, `endings[${index}].id`))
  source.pools.forEach((pool, poolIndex) => {
    registerId(pool.id, `pools[${poolIndex}].id`)
    pool.options.forEach((option, optionIndex) => registerId(option.id, `pools[${poolIndex}].options[${optionIndex}].id`))
  })

  const entityTypes = new Map(source.entities.map((entity) => [entity.id as string, entity.entityType]))
  const entityIds = new Set(entityTypes.keys())
  const endingIds = new Set(source.endings.map((ending) => ending.id as string))
  source.pools.forEach((pool, poolIndex) => {
    const poolPath = `pools[${poolIndex}]`
    if (pool.options.length === 0) issues.push({ path: `${poolPath}.options`, code: 'pool.empty', message: 'Pool must contain options' })
    pool.tags.forEach((tag, tagIndex) => {
      if (!entityIds.has(tag)) issues.push({ path: `${poolPath}.tags[${tagIndex}]`, code: 'reference.entity', message: `Unknown entity ${tag}` })
    })
    pool.options.forEach((option, optionIndex) => {
      const optionPath = `${poolPath}.options[${optionIndex}].mechanics`
      if (typeof option.mechanics.enabled !== 'boolean') {
        issues.push({ path: `${optionPath}.enabled`, code: 'enabled.invalid', message: 'enabled must be an explicit boolean' })
      }
      if (!Number.isFinite(option.mechanics.baseWeight) || option.mechanics.baseWeight <= 0) {
        issues.push({ path: `${optionPath}.baseWeight`, code: 'weight.invalid', message: 'baseWeight must be finite and greater than zero' })
      }
      if (!Array.isArray(option.mechanics.effects)) {
        issues.push({ path: `${optionPath}.effects`, code: 'effects.missing', message: 'effects must be explicit, including an empty array for narrative options' })
      } else {
        option.mechanics.effects.forEach((effect, effectIndex) => validateEffect(effect, `${optionPath}.effects[${effectIndex}]`, registries, entityTypes, endingIds, issues))
      }
      if (option.mechanics.availableWhen) validatePredicate(option.mechanics.availableWhen, `${optionPath}.availableWhen`, registries, entityTypes, issues)
      if (option.mechanics.weightModifier) validateExpression(option.mechanics.weightModifier, `${optionPath}.weightModifier`, registries, issues)
    })
  })

  if (issues.length > 0) throw new ContentValidationError(issues)

  const mechanicsWithoutFingerprint = {
    contentVersion: source.manifest.contentVersion,
    pools: new Map(source.pools.map((pool) => [pool.id, {
      id: pool.id,
      tags: [...pool.tags],
      options: pool.options.map((option) => ({ id: option.id, ...option.mechanics })),
    }])),
    entities: new Map(source.entities.map((entity) => [entity.id, entity.entityType])),
    endings: new Map(source.endings.map((ending) => [ending.id, { alive: ending.alive }])),
  } satisfies Omit<MechanicsCatalog, 'fingerprint'>

  return {
    manifest: source.manifest,
    mechanics: {
      ...mechanicsWithoutFingerprint,
      fingerprint: mechanicsFingerprint(mechanicsWithoutFingerprint),
    },
    presentation: {
      pools: new Map(source.pools.map((pool) => [pool.id, pool.presentation])),
      options: new Map(source.pools.flatMap((pool) => pool.options.map((option) => [option.id, option.presentation] as const))),
      entities: new Map(source.entities.map((entity) => [entity.id, entity.presentation])),
      endings: new Map(source.endings.map((ending) => [ending.id, ending.presentation])),
    },
  }
}
