import type { BeastElement, BeastEvolutionKind, SeaGodExamGrade } from '@/core/model/contracts'
import type { EntityId, OptionId, PoolId } from '@/core/ids'
import rawFlow from './legacyFlow.generated.json'

export interface LegacyOptionSemantic {
  readonly accepted?: boolean
  readonly age?: number
  readonly appearance?: string
  readonly beastAreaEntityId?: EntityId
  readonly beastAreaKind?: string
  readonly beastBloodlineEntityId?: EntityId
  readonly beastMartialSoulEntityId?: EntityId
  readonly beastSpeciesEntityId?: EntityId
  readonly beastTypeEntityId?: EntityId
  readonly beastKind?: string
  readonly beastEvolutionKind?: BeastEvolutionKind
  readonly beastEvolutionAction?: 'elemental' | 'bloodline' | 'native-bloodline'
  readonly beastEvolutionTargetPoolId?: PoolId
  readonly beastElement?: BeastElement
  readonly beastElementTraitId?: EntityId
  readonly beastExtremeTraitId?: EntityId
  readonly beastLawSeedTraitId?: EntityId
  readonly beastLawTraitId?: EntityId
  readonly beastSpecialAction?: 'evolution' | 'elemental' | 'bloodline' | 'native-bloodline' | 'dragon-bloodline' | 'domain'
  readonly beastSpeciesGroup?: string
  readonly beastTimelineEventId?: string
  readonly beastTimelineAtTangAge?: number
  readonly beastTimelineAfterYears?: number
  readonly beastTimelineEra?: string
  readonly beastTimelineSpeciesGroup?: string
  readonly branch?: number
  readonly completeDomain?: boolean
  readonly cultivation?: number
  readonly factionEntityId?: string
  readonly factionStoryId?: string
  readonly factionStoryStage?: string
  readonly godDeityEntityId?: EntityId
  readonly godEntry?: 'general' | 'ninety-nine' | 'self-created'
  readonly gender?: string
  readonly godTier?: string
  readonly godTrialTotal?: number
  readonly godRewardExam?: number
  readonly level?: number
  readonly martialSoulType?: string
  readonly martialSoulCategoryTargetPoolId?: PoolId
  readonly specialTalentBeastCategory?: boolean
  readonly specialTalentExtraMartialSoulSelections?: number
  readonly specialTalentSpeciesKind?: 'true-dragon' | 'sub-dragon' | 'earth-dragon'
  readonly grantedMartialSoulEntityId?: EntityId
  readonly grantedMartialSoulType?: string
  readonly ringYears?: number
  readonly ringEntityId?: EntityId
  readonly route?: string
  readonly requiresArea?: boolean
  readonly requiredLevel?: number
  readonly seaGodEntry?: boolean
  readonly seaGodCompletionGate?: boolean
  readonly seaGodGrade?: SeaGodExamGrade
  readonly seaGodTotal?: number
  readonly seaGodPlanAll?: boolean
  readonly seaGodPlanCompleted?: number
  readonly seaGodPlanFailed?: boolean
  readonly seaGodRewardExam?: number
  readonly seaGodInheritanceDeity?: boolean
  readonly speciesPoolId?: PoolId
  readonly tangAge?: number
  readonly timelineEra?: string
  readonly timelineEraTraitId?: EntityId
  readonly soulBoneEntityId?: EntityId
  readonly transform?: boolean
  readonly tribulationSuccess?: boolean
  readonly tribulationOutcome?: 'success' | 'ascended' | 'survived' | 'failed'
  readonly years?: number
}

export interface LegacyFlowPool {
  readonly sourcePoolId: string
  readonly activePoolId: PoolId
  readonly title: string
  readonly canonicalTangAge?: number
  readonly ringIndex?: number
  readonly soulBoneYears?: number
  readonly auxiliaryKind?: string
  readonly storyNodeEntityId?: EntityId
  readonly role: string
  readonly route: string
  readonly trigger: string
  readonly sourceOptionCount: number
  readonly options: readonly {
    readonly sourceOptionId: string
    readonly activeOptionId: OptionId
    readonly semantic: LegacyOptionSemantic
  }[]
}

interface LegacyFlowDocument {
  readonly entrypoints: {
    readonly random: PoolId
    readonly human: readonly PoolId[]
    readonly beast: readonly PoolId[]
  }
  readonly progression: {
    readonly initialPowerByAge: readonly { readonly age: number; readonly poolId: PoolId }[]
    readonly ultimateInitialPowerPoolId: PoolId
    readonly factionByAge: readonly { readonly age: number; readonly poolId: PoolId }[]
    readonly factionStories: readonly {
      readonly id: string
      readonly poolId: PoolId
      readonly stages: readonly {
        readonly id: string
        readonly minAge: number
        readonly maxAge?: number
        readonly minLevel?: number
        readonly optionIds: readonly OptionId[]
      }[]
    }[]
    readonly soulRingByIndex: readonly { readonly index: number; readonly poolId: PoolId }[]
    readonly martialSoul: {
      readonly selectionPools: readonly { readonly type: string; readonly poolId: PoolId }[]
      readonly categoryTargets: readonly { readonly categoryOptionId: OptionId; readonly targetPoolId: PoolId }[]
      readonly specialTalentTargets: readonly { readonly specialTalentOptionId: OptionId; readonly targetPoolId: PoolId }[]
      readonly firearmStoryPoolId: PoolId
      readonly firearmMartialSoulEntityIds: readonly EntityId[]
    }
    readonly humanGrowthByAge: readonly { readonly minAge: number; readonly maxAge?: number; readonly poolId: PoolId }[]
    readonly humanGrowthByTangAge: readonly { readonly branch: number; readonly minTangAge: number; readonly maxTangAge: number; readonly poolId: PoolId }[]
    readonly humanGrowthByLevel: readonly { readonly minLevel: number; readonly maxLevel: number; readonly poolId: PoolId }[]
    readonly humanEncounterByLevel: readonly { readonly minLevel: number; readonly maxLevel: number; readonly poolId: PoolId }[]
    readonly humanGrowthPoolIds: readonly PoolId[]
    readonly beastGrowthByCultivation: readonly { readonly min: number; readonly max: number; readonly poolId: PoolId }[]
    readonly beastGrowthPoolIds: readonly PoolId[]
    readonly beastEncounterByCultivation: readonly { readonly min: number; readonly max: number; readonly poolId: PoolId }[]
    readonly beastEncounterPoolIds: readonly PoolId[]
    readonly soulRingPoolIds: readonly PoolId[]
    readonly beastSetup: {
      readonly areaPoolId: PoolId
      readonly routeChoicePoolId: PoolId
      readonly evolutionPoolId: PoolId
      readonly specialGrowthChancePoolId: PoolId
      readonly specialGrowthPoolId: PoolId
      readonly elementalEvolutionPoolId: PoolId
      readonly bloodlineFusionPoolId: PoolId
      readonly dragonBloodlinePoolId: PoolId
      readonly postGodChoicePoolId: PoolId
      readonly timelineEvents: readonly {
        readonly eventId: string
        readonly poolId: PoolId
        readonly atTangAge?: number
        readonly afterYears?: number
        readonly era?: string
        readonly speciesGroup?: string
      }[]
      readonly tribulationPoolIds: readonly { readonly threshold: number; readonly poolId: PoolId }[]
    }
    readonly storyPlan: readonly {
      readonly branch: number
      readonly tag: string
      readonly milestones: readonly { readonly atTangAge: number; readonly from: number; readonly to: number; readonly poolIds: readonly PoolId[] }[]
    }[]
    readonly god: {
      readonly generalTriggerPoolId: PoolId
      readonly ninetyNineTriggerPoolId: PoolId
      readonly selfCreatedPoolId: PoolId
    }
    readonly godRewards: readonly {
      readonly tier: 'king' | 'first' | 'second' | 'third'
      readonly exam: number
      readonly minLevel: number
      readonly poolId: PoolId
    }[]
    readonly seaGod: {
      readonly tierPoolId: PoolId
      readonly planPoolId: PoolId
      readonly growthPoolId: PoolId
      readonly trainingPoolId: PoolId
      readonly completionGatePoolId: PoolId
      readonly inheritanceDeityId: EntityId
      readonly rewards: readonly {
        readonly grade: Exclude<SeaGodExamGrade, 'sea-god'>
        readonly exam: number
        readonly poolId: PoolId
      }[]
    }
  }
  readonly pools: readonly LegacyFlowPool[]
  readonly virtualPools: readonly LegacyFlowPool[]
}

export const legacyFlow = rawFlow as unknown as LegacyFlowDocument

const allFlowPools = [...legacyFlow.pools, ...legacyFlow.virtualPools]
const poolsById = new Map(allFlowPools.map((pool) => [pool.activePoolId, pool]))
const optionsById = new Map(
  allFlowPools.flatMap((pool) => pool.options.map((option) => [option.activeOptionId, { pool, semantic: option.semantic }] as const)),
)

export function legacyPoolForRole(role: string): LegacyFlowPool {
  const pool = legacyFlow.pools.find((candidate) => candidate.role === role)
  if (!pool) throw new Error(`Missing generated legacy flow role: ${role}`)
  return pool
}

export function legacyPoolsForRole(role: string): readonly LegacyFlowPool[] {
  return legacyFlow.pools.filter((pool) => pool.role === role)
}

export function legacyFlowPool(poolId: PoolId): LegacyFlowPool | undefined {
  return poolsById.get(poolId)
}

export function legacyOptionSemantic(optionId: OptionId): LegacyOptionSemantic | undefined {
  return optionsById.get(optionId)?.semantic
}

export function legacyOptionPool(optionId: OptionId): LegacyFlowPool | undefined {
  return optionsById.get(optionId)?.pool
}

export function legacyFactionStoryId(entityId: EntityId): string | undefined {
  return allFlowPools
    .flatMap((pool) => pool.options)
    .find((option) => option.semantic.factionEntityId === entityId)?.semantic.factionStoryId
}

export function legacyFactionStoryStage(optionId: OptionId): { readonly factionId: string; readonly stage: string } | undefined {
  const semantic = legacyOptionSemantic(optionId)
  return semantic?.factionStoryId && semantic.factionStoryStage
    ? { factionId: semantic.factionStoryId, stage: semantic.factionStoryStage }
    : undefined
}

export function legacyBeastTypeRequiresArea(entityId: EntityId): boolean | null {
  const match = legacyFlow.pools
    .flatMap((pool) => pool.options)
    .find((option) => option.semantic.beastTypeEntityId === entityId)
  return match?.semantic.requiresArea ?? null
}

export function legacyBeastKind(entityId: EntityId): string | undefined {
  return allFlowPools
    .flatMap((pool) => pool.options)
    .find((option) => option.semantic.beastTypeEntityId === entityId)?.semantic.beastKind
}

export function legacyBeastAreaKind(entityId: EntityId): string | undefined {
  return allFlowPools
    .flatMap((pool) => pool.options)
    .find((option) => option.semantic.beastAreaEntityId === entityId)?.semantic.beastAreaKind
}

export function legacyGodhoodTier(entityId: EntityId): string | undefined {
  return allFlowPools
    .flatMap((pool) => pool.options)
    .find((option) => option.semantic.godDeityEntityId === entityId)?.semantic.godTier
}

export function legacyTimelineEraTraitId(era: string): EntityId | undefined {
  return allFlowPools
    .flatMap((pool) => pool.options)
    .find((option) => option.semantic.timelineEra === era)?.semantic.timelineEraTraitId
}

export function legacyBeastTypeSpeciesPool(entityId: EntityId): PoolId | null {
  const match = legacyFlow.pools
    .flatMap((pool) => pool.options)
    .find((option) => option.semantic.beastTypeEntityId === entityId)
  return match?.semantic.speciesPoolId ?? null
}

export function legacyBeastSpeciesSemantic(entityId: EntityId): LegacyOptionSemantic | undefined {
  return legacyFlow.pools
    .flatMap((pool) => pool.options)
    .find((option) => option.semantic.beastSpeciesEntityId === entityId)?.semantic
}

export function legacyBeastSpeciesPoolId(entityId: EntityId): PoolId | undefined {
  return allFlowPools.find((pool) => pool.options.some((option) => option.semantic.beastSpeciesEntityId === entityId))?.activePoolId
}

export function legacyGodDeityPool(tier: 'king' | 'first' | 'second' | 'third'): PoolId | null {
  return legacyFlow.pools.find((pool) => pool.role === 'god-deity' && pool.options.some((option) => option.semantic.godTier === tier))?.activePoolId ?? null
}
