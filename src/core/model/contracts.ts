import type {
  EndingId,
  EntityId,
  OptionId,
  PolicyId,
  PoolId,
  SignalId,
  TurnId,
} from '../ids'

export type JsonScalar = string | number | boolean | null
export type JsonValue = JsonScalar | JsonObject | readonly JsonValue[]
export interface JsonObject { readonly [key: string]: JsonValue }

export type Route = 'human' | 'beast' | 'transformed'
export type StartRoute = Route | 'random'
export type GamePhase =
  | 'idle'
  | 'setup.human'
  | 'setup.beast'
  | 'setup.transformed'
  | 'adventure.human'
  | 'adventure.beast'
  | 'adventure.transformed'
  | 'god-trial'
  | 'ended'

export type NumericFactKey =
  | 'actor.age'
  | 'actor.level'
  | 'actor.max-level'
  | 'beast.cultivation'
  | 'timeline.tang-age'
  | 'progression.ring-count'
  | 'progression.combat-power'
  | 'progression.negative-story-count'
  | 'progression.combat-story-count'

export type CollectionFactKey =
  | 'actor.martial-souls'
  | 'actor.traits'
  | 'actor.domains'
  | 'actor.soul-bones'
  | 'actor.beast-types'
  | 'actor.beast-species'
  | 'actor.beast-areas'
  | 'actor.beast-bloodlines'
  | 'story.completed-nodes'

export type FactKey =
  | NumericFactKey
  | CollectionFactKey
  | 'actor.route'
  | 'actor.gender'
  | 'actor.alive'
  | 'actor.faction'
  | 'timeline.canon-phase'
  | 'god-trial.active'

export type Scalar = string | number | boolean | null
export type CompareOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'

export type Predicate =
  | { readonly type: 'all'; readonly items: readonly Predicate[] }
  | { readonly type: 'any'; readonly items: readonly Predicate[] }
  | { readonly type: 'not'; readonly item: Predicate }
  | { readonly type: 'compare'; readonly fact: FactKey; readonly op: CompareOperator; readonly value: Scalar }
  | { readonly type: 'contains'; readonly fact: CollectionFactKey; readonly value: EntityId }
  | { readonly type: 'policy'; readonly policyId: PolicyId; readonly args?: JsonObject }

export type NumberExpression =
  | { readonly type: 'constant'; readonly value: number }
  | { readonly type: 'fact'; readonly fact: NumericFactKey }
  | { readonly type: 'add' | 'multiply' | 'min' | 'max'; readonly items: readonly NumberExpression[] }
  | { readonly type: 'clamp'; readonly value: NumberExpression; readonly min: number; readonly max: number }
  | { readonly type: 'policy'; readonly policyId: PolicyId; readonly args?: JsonObject }

export type StatId =
  | 'age'
  | 'level'
  | 'max-level'
  | 'appearance-rank'
  | 'beast-cultivation'
  | 'tang-age'

export type EntityType =
  | 'gender'
  | 'appearance'
  | 'martial-soul-type'
  | 'martial-soul'
  | 'trait'
  | 'domain'
  | 'soul-bone'
  | 'faction'
  | 'godhood'
  | 'beast-species'
  | 'beast-bloodline'
  | 'beast-type'
  | 'beast-area'
  | 'soul-ring'
  | 'story-node'

export type EffectSpec =
  | { readonly type: 'stat.change'; readonly stat: StatId; readonly delta: NumberExpression }
  | { readonly type: 'entity.grant'; readonly entityType: EntityType; readonly entityId: EntityId }
  | { readonly type: 'entity.revoke'; readonly entityType: EntityType; readonly entityId: EntityId }
  | { readonly type: 'time.advance'; readonly years: NumberExpression }
  | { readonly type: 'signal.emit'; readonly signalId: SignalId; readonly payload?: JsonObject }
  | { readonly type: 'run.finish'; readonly endingId: EndingId }

export interface ContentManifest {
  readonly schemaVersion: 3
  readonly contentVersion: string
  readonly files: readonly string[]
  readonly checksums?: Readonly<Record<string, string>>
}

export interface PresentationSource {
  readonly title: string
  readonly description?: string
}

export interface OptionSource {
  readonly id: OptionId
  readonly presentation: PresentationSource
  readonly mechanics: {
    readonly enabled: boolean
    readonly baseWeight: number
    readonly availableWhen?: Predicate
    readonly weightModifier?: NumberExpression
    readonly effects: readonly EffectSpec[]
  }
}

export interface PoolSource {
  readonly id: PoolId
  readonly presentation: PresentationSource
  readonly tags: readonly EntityId[]
  readonly options: readonly OptionSource[]
}

export interface EntitySource {
  readonly id: EntityId
  readonly entityType: EntityType
  readonly presentation: PresentationSource
}

export interface EndingSource {
  readonly id: EndingId
  readonly alive: boolean
  readonly presentation: PresentationSource
}

export interface ContentSource {
  readonly manifest: ContentManifest
  readonly pools: readonly PoolSource[]
  readonly entities: readonly EntitySource[]
  readonly endings: readonly EndingSource[]
}

export interface MechanicsOption {
  readonly id: OptionId
  readonly enabled: boolean
  readonly baseWeight: number
  readonly availableWhen?: Predicate
  readonly weightModifier?: NumberExpression
  readonly effects: readonly EffectSpec[]
}

export interface MechanicsPool {
  readonly id: PoolId
  readonly tags: readonly EntityId[]
  readonly options: readonly MechanicsOption[]
}

export interface MechanicsCatalog {
  readonly contentVersion: string
  readonly pools: ReadonlyMap<PoolId, MechanicsPool>
  readonly entities: ReadonlyMap<EntityId, EntityType>
  readonly endings: ReadonlyMap<EndingId, { readonly alive: boolean }>
  readonly fingerprint: string
}

export interface PresentationCatalog {
  readonly pools: ReadonlyMap<PoolId, PresentationSource>
  readonly options: ReadonlyMap<OptionId, PresentationSource>
  readonly entities: ReadonlyMap<EntityId, PresentationSource>
  readonly endings: ReadonlyMap<EndingId, PresentationSource>
}

export interface CompiledContent {
  readonly manifest: ContentManifest
  readonly mechanics: MechanicsCatalog
  readonly presentation: PresentationCatalog
}

export interface ContentRegistries {
  readonly facts: ReadonlySet<string>
  readonly policies: ReadonlySet<string>
  readonly signals: ReadonlySet<string>
  readonly effects: ReadonlySet<EffectSpec['type']>
  readonly maxExpressionDepth?: number
}

export type GameCommand =
  | { readonly type: 'run.start'; readonly route: StartRoute; readonly seed: string }
  | { readonly type: 'turn.spin' }
  | { readonly type: 'turn.undo' }
  | { readonly type: 'run.finish'; readonly endingId: EndingId }
  | { readonly type: 'run.reset' }

export interface Task {
  readonly id: string
  readonly poolId: PoolId
  readonly process: string
  /** Mirrors v0.2 queue.unshift() for setup branches that must resolve first. */
  readonly priority?: 'front'
  readonly candidateOptionIds?: readonly OptionId[]
  readonly rerollExcludedOptionId?: OptionId
  readonly payload?: JsonObject
}

export type BeastEvolutionKind = 'strength' | 'mind' | 'body' | 'defense' | 'speed'
export type BeastElement =
  | 'metal'
  | 'life'
  | 'fire'
  | 'space'
  | 'moon'
  | 'wind'
  | 'destruction'
  | 'time'
  | 'water'
  | 'dark'
  | 'ice'
  | 'sun'
  | 'wood'
  | 'lightning'
  | 'earth'
  | 'death'
  | 'light'
  | 'poison'
export type SeaGodExamGrade = 'yellow' | 'purple' | 'black' | 'top' | 'sea-god'

export type DomainEvent =
  | { readonly type: 'run.started'; readonly route: Route; readonly requestedRoute: StartRoute; readonly seed: string }
  | { readonly type: 'option.selected'; readonly poolId: PoolId; readonly optionId: OptionId; readonly probability: number }
  | { readonly type: 'stat.changed'; readonly stat: StatId; readonly before: number; readonly after: number }
  | { readonly type: 'entity.granted'; readonly entityType: EntityType; readonly entityId: EntityId }
  | { readonly type: 'entity.revoked'; readonly entityType: EntityType; readonly entityId: EntityId }
  | { readonly type: 'time.advanced'; readonly before: number; readonly after: number }
  | { readonly type: 'signal.emitted'; readonly signalId: SignalId; readonly payload?: JsonObject }
  | { readonly type: 'task.scheduled'; readonly task: Task }
  | { readonly type: 'task.reroll-prepared'; readonly taskId: string; readonly excludedOptionId: OptionId }
  | { readonly type: 'task.completed'; readonly taskId: string }
  | { readonly type: 'phase.changed'; readonly from: GamePhase; readonly to: GamePhase }
  | { readonly type: 'route.changed'; readonly from: Route; readonly to: Route }
  | { readonly type: 'growth.completed'; readonly route: Route; readonly cycle: number }
  | { readonly type: 'soul-ring.granted'; readonly ringId: EntityId; readonly index: number }
  | { readonly type: 'story.completed'; readonly nodeId: EntityId; readonly index: number }
  | { readonly type: 'story.branch-selected'; readonly branch: number }
  | { readonly type: 'story.milestone-scheduled'; readonly branch: number; readonly atTangAge: number }
  | { readonly type: 'faction.stage-selected'; readonly stage: number }
  | { readonly type: 'faction-story.stage-completed'; readonly factionId: string; readonly stage: string }
  | { readonly type: 'flow.stage-completed'; readonly stage: string }
  | { readonly type: 'beast.evolution-advanced'; readonly kind: BeastEvolutionKind; readonly before: number; readonly after: number }
  | { readonly type: 'beast.element-advanced'; readonly element: BeastElement; readonly before: number; readonly after: number }
  | { readonly type: 'story.metric-recorded'; readonly metric: 'negative' | 'combat'; readonly before: number; readonly after: number }
  | { readonly type: 'combat-power.recalculated'; readonly before: CombatPowerSnapshot; readonly after: CombatPowerSnapshot; readonly trigger: string }
  | { readonly type: 'beast.tribulation-requested'; readonly threshold: number }
  | { readonly type: 'beast.tribulation-resolved'; readonly threshold: number }
  | { readonly type: 'beast.route-choice-resolved'; readonly transformed: boolean }
  | { readonly type: 'sea-god.started'; readonly grade: SeaGodExamGrade; readonly total: number }
  | { readonly type: 'sea-god.plan-selected'; readonly completed: number; readonly failed: boolean }
  | { readonly type: 'sea-god.plan-extended'; readonly before: number; readonly after: number }
  | { readonly type: 'sea-god.reward-progressed'; readonly before: number; readonly after: number }
  | { readonly type: 'god-trial.started'; readonly tierId: EntityId; readonly deityId: EntityId; readonly total: number; readonly origin: 'inheritance' | 'self-created' }
  | { readonly type: 'god-trial.progressed'; readonly before: number; readonly after: number }
  | { readonly type: 'run.finished'; readonly endingId: EndingId; readonly alive: boolean }

export interface EventBatch {
  readonly turnId: TurnId
  readonly command: GameCommand['type']
  readonly contentVersion: string
  readonly rngBefore: number
  readonly rngAfter: number
  readonly events: readonly DomainEvent[]
}

export interface CombatPowerSnapshot {
  readonly levelBase: number
  readonly ringPower: number
  readonly martialSoulPower: number
  readonly domainPower: number
  readonly soulBonePower: number
  readonly talentCoefficient: number
  readonly battleTraitCoefficient: number
  readonly multiplier: number
  readonly total: number
}

export interface GameState {
  readonly schemaVersion: 3
  readonly contentVersion: string
  readonly phase: GamePhase
  readonly route: Route | null
  readonly random: { readonly seed: string; readonly state: number }
  readonly turn: number
  readonly stats: Readonly<Record<StatId, number>>
  readonly entities: Readonly<Record<EntityType, readonly EntityId[]>>
  readonly progression: {
    readonly combatPower: CombatPowerSnapshot
    readonly growthCycles: number
    readonly rings: readonly EntityId[]
    readonly storyNodes: readonly EntityId[]
    readonly storyBranch: number | null
    readonly scheduledStoryMilestones: readonly string[]
    readonly factionStages: readonly number[]
    readonly factionStoryStages: readonly string[]
    readonly completedFlowStages: readonly string[]
    readonly beastEvolution: Readonly<Record<BeastEvolutionKind, number>>
    readonly beastElements: Readonly<Record<BeastElement, number>>
    readonly storyMetrics: Readonly<{ negative: number; combat: number }>
    readonly pendingTribulation: number | null
    readonly resolvedTribulations: readonly number[]
    readonly beastRouteChoiceResolved: boolean
    readonly seaGodTrial: {
      readonly grade: SeaGodExamGrade
      readonly completed: number
      readonly total: number
      readonly planned: number | null
      readonly failed: boolean
    } | null
    readonly godTrial: {
      readonly tierId: EntityId
      readonly deityId: EntityId
      readonly completed: number
      readonly total: number
      readonly origin: 'inheritance' | 'self-created'
    } | null
  }
  readonly agenda: readonly Task[]
  readonly ending: { readonly endingId: EndingId; readonly alive: boolean } | null
}

export interface DrawReceipt {
  readonly poolId: PoolId
  readonly optionId: OptionId
  readonly probability: number
  readonly startAngle: number
  readonly endAngle: number
}

export interface CommandReceipt {
  readonly batch: EventBatch | null
  readonly draw?: DrawReceipt
}
