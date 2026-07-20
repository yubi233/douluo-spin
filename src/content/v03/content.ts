import { policyId, signalId, type PolicyId } from '@/core/ids'
import type { BeastElement, ContentSource, GameState, JsonObject } from '@/core/model/contracts'
import { createContentRegistries, type PolicyEvaluator, type PolicyRegistry } from '@/core/rules/evaluate'
import { calculateCombatPower } from '@/core/rules/combatPower'
import { compileContent } from '../compiler/compileContent'
import legacyContent from './legacyContent.generated.json'
import { legacyBeastAreaKind, legacyBeastKind, legacyGodhoodTier, legacyTimelineEraTraitId } from './legacyFlow'
import { hasLegacyMartialSoulAttribute, hasLegacyMartialSoulType, highestLegacyMartialSoulTier } from './legacyMartialSoulRules'
import { setupEntities, setupPools } from './setupContent'
import { progressionEndings, progressionEntities, progressionPools } from './progressionContent'
import { postwarEndings, postwarEntities, postwarPools } from './postwarContent'

const legacySource = legacyContent as unknown as Pick<ContentSource, 'entities' | 'pools'>

function policyStringArgument(args: JsonObject | undefined, name: string): string | null {
  const value = args?.[name]
  return typeof value === 'string' ? value : null
}

function hasMartialSoulType(state: GameState, args?: JsonObject): boolean {
  const type = policyStringArgument(args, 'type')
  if (!type) return false
  return state.entities['martial-soul-type'].includes(`entity.martial-type.${type}` as never)
    || hasLegacyMartialSoulType(state.entities['martial-soul'], type)
}

function hasMartialSoulAttribute(state: GameState, args?: JsonObject): boolean {
  const attribute = policyStringArgument(args, 'attribute')
  return attribute != null && hasLegacyMartialSoulAttribute(state.entities['martial-soul'], attribute)
}

function legacyInnatePowerMultiplier(state: GameState, args?: JsonObject): number {
  const level = args?.level
  if (typeof level !== 'number') return 1
  const tier = highestLegacyMartialSoulTier(state.entities['martial-soul'])
  if (tier >= 6) return 1
  const target = ({ 1: 1, 2: 3, 3: 5, 4: 7, 5: 9 } as Record<number, number>)[tier] ?? 5
  const difference = level - target
  return Math.exp(-(difference * difference) / (2 * 1.8 * 1.8)) * 8
}

const appearanceRankByEntity = new Map([
  ['entity.appearance.f', 0], ['entity.appearance.e', 1], ['entity.appearance.d', 2], ['entity.appearance.c', 3],
  ['entity.appearance.b', 4], ['entity.appearance.a', 5], ['entity.appearance.s', 6], ['entity.appearance.ex', 7],
])

function hasMinimumAppearanceRank(state: GameState, args?: JsonObject): boolean {
  const rank = args?.rank
  if (typeof rank !== 'number') return false
  return state.entities.appearance.some((entityId) => (appearanceRankByEntity.get(entityId) ?? -1) >= rank)
}

function hasMaximumAppearanceRank(state: GameState, args?: JsonObject): boolean {
  const rank = args?.rank
  if (typeof rank !== 'number') return false
  return state.entities.appearance.some((entityId) => (appearanceRankByEntity.get(entityId) ?? Infinity) <= rank)
}

function hasAppearanceRankIn(state: GameState, args?: JsonObject): boolean {
  const ranks = args?.ranks
  if (!Array.isArray(ranks) || !ranks.every((rank) => typeof rank === 'number')) return false
  return state.entities.appearance.some((entityId) => ranks.includes(appearanceRankByEntity.get(entityId) ?? -1))
}

function policyStringSetArgument(args: JsonObject | undefined, name: string): readonly string[] {
  const value = args?.[name]
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : []
}

function hasBeastKind(state: GameState, args?: JsonObject): boolean {
  const expected = policyStringSetArgument(args, 'kinds')
  const kind = state.entities['beast-type'][0] ? legacyBeastKind(state.entities['beast-type'][0]!) : undefined
  if (!kind) return false
  return expected.includes(kind)
    || (expected.includes('dragon') && (kind === 'pure-dragon' || kind === 'sub-dragon'))
    || (expected.includes('sub-dragon-or-above') && (kind === 'pure-dragon' || kind === 'sub-dragon'))
}

function hasBeastArea(state: GameState, args?: JsonObject): boolean {
  const expected = policyStringArgument(args, 'area')
  const area = state.entities['beast-area'][0]
  return expected != null && area != null && legacyBeastAreaKind(area) === expected
}

function hasTimelineEra(state: GameState, args?: JsonObject): boolean {
  const era = policyStringArgument(args, 'era')
  const traitId = era == null ? undefined : legacyTimelineEraTraitId(era)
  return traitId != null && state.entities.trait.includes(traitId)
}

function godTierRank(tier: string | undefined): number {
  return tier === 'third' ? 1 : tier === 'second' ? 2 : tier === 'first' ? 3 : tier === 'king' ? 4 : 0
}

function hasGodTierAtLeast(state: GameState, args?: JsonObject): boolean {
  const required = args?.rank
  if (typeof required !== 'number') return false
  const activeTier = state.progression.godTrial?.tierId.replace('entity.legacy.god-tier.', '')
  const tiers = [activeTier, ...state.entities.godhood.map(legacyGodhoodTier)]
  return tiers.some((tier) => godTierRank(tier) >= required)
}

function hasTraitCountAtLeast(state: GameState, args?: JsonObject): boolean {
  const ids = policyStringSetArgument(args, 'entityIds')
  const minimum = args?.minimum
  return typeof minimum === 'number' && ids.filter((id) => state.entities.trait.includes(id as never)).length >= minimum
}

function hasBeastEvolutionBelow(state: GameState, args?: JsonObject): boolean {
  const kind = policyStringArgument(args, 'kind')
  const maximum = args?.maximum
  return typeof maximum === 'number'
    && (kind === 'strength' || kind === 'mind' || kind === 'body' || kind === 'defense' || kind === 'speed')
    && state.progression.beastEvolution[kind] < maximum
}

function hasBeastEvolutionAtLeast(state: GameState, args?: JsonObject): boolean {
  const kind = policyStringArgument(args, 'kind')
  const minimum = args?.minimum
  return typeof minimum === 'number'
    && (kind === 'strength' || kind === 'mind' || kind === 'body' || kind === 'defense' || kind === 'speed')
    && state.progression.beastEvolution[kind] >= minimum
}

function hasBeastElementBelow(state: GameState, args?: JsonObject): boolean {
  const element = policyStringArgument(args, 'element')
  const maximum = args?.maximum
  return typeof maximum === 'number' && element != null && element in state.progression.beastElements
    && state.progression.beastElements[element as BeastElement] < maximum
}

function hasBeastLawCountAtLeast(state: GameState, args?: JsonObject): boolean {
  const minimum = args?.minimum
  return typeof minimum === 'number'
    && [...Object.values(state.progression.beastEvolution), ...Object.values(state.progression.beastElements)]
      .filter((count) => count >= 4).length >= minimum
}

function hasBeastBloodlineCountAtLeast(state: GameState, args?: JsonObject): boolean {
  const minimum = args?.minimum
  return typeof minimum === 'number' && state.entities['beast-bloodline'].length >= minimum
}

export const v03Policies: PolicyRegistry = new Map<PolicyId, PolicyEvaluator>([
  [policyId('policy.identity'), () => 1],
  [policyId('policy.martial-soul-tier'), (state: GameState) => highestLegacyMartialSoulTier(state.entities['martial-soul'])],
  [policyId('policy.legacy-innate-power'), legacyInnatePowerMultiplier],
  [policyId('policy.martial-soul-type'), hasMartialSoulType],
  [policyId('policy.martial-soul-attribute'), hasMartialSoulAttribute],
  [policyId('policy.has-domain'), (state: GameState) => state.entities.domain.length > 0],
  [policyId('policy.appearance-min-rank'), hasMinimumAppearanceRank],
  [policyId('policy.appearance-max-rank'), hasMaximumAppearanceRank],
  [policyId('policy.appearance-rank-in'), hasAppearanceRankIn],
  [policyId('policy.has-godhood'), (state: GameState) => state.entities.godhood.length > 0],
  [policyId('policy.beast-kind'), hasBeastKind],
  [policyId('policy.beast-area'), hasBeastArea],
  [policyId('policy.timeline-era'), hasTimelineEra],
  [policyId('policy.god-tier-at-least'), hasGodTierAtLeast],
  [policyId('policy.godhood-count-at-least'), (state: GameState, args?: JsonObject) => typeof args?.minimum === 'number' && state.entities.godhood.length >= args.minimum],
  [policyId('policy.trait-count-at-least'), hasTraitCountAtLeast],
  [policyId('policy.beast-evolution-below'), hasBeastEvolutionBelow],
  [policyId('policy.beast-evolution-at-least'), hasBeastEvolutionAtLeast],
  [policyId('policy.beast-element-below'), hasBeastElementBelow],
  [policyId('policy.beast-law-count-at-least'), hasBeastLawCountAtLeast],
  [policyId('policy.beast-bloodline-count-at-least'), hasBeastBloodlineCountAtLeast],
  [policyId('policy.combat-power-growth'), (state: GameState) => Math.max(0.5, Math.min(2, calculateCombatPower(state).total / 250))],
])

export const v03Signals = new Set([
  signalId('signal.setup.race-selected'),
  signalId('signal.setup.timeline-selected'),
  signalId('signal.setup.gender-selected'),
  signalId('signal.setup.appearance-selected'),
  signalId('signal.setup.martial-type-selected'),
  signalId('signal.setup.martial-soul-category-selected'),
  signalId('signal.setup.martial-soul-selected'),
  signalId('signal.setup.special-chance-selected'),
  signalId('signal.setup.special-talent-selected'),
  signalId('signal.setup.age-selected'),
  signalId('signal.setup.period-selected'),
  signalId('signal.setup.initial-power-selected'),
  signalId('signal.setup.faction-selected'),
  signalId('signal.human.growth-completed'),
  signalId('signal.soul-ring.selected'),
  signalId('signal.soul-bone-chance-selected'),
  signalId('signal.special-growth-chance-selected'),
  signalId('signal.human.special-growth-completed'),
  signalId('signal.killing-city-selected'),
  signalId('signal.story.completed'),
  signalId('signal.story.metric-recorded'),
  signalId('signal.beast.period-selected'),
  signalId('signal.beast.gender-selected'),
  signalId('signal.beast.realm-selected'),
  signalId('signal.beast.type-selected'),
  signalId('signal.beast.species-selected'),
  signalId('signal.beast.area-selected'),
  signalId('signal.beast.growth-completed'),
  signalId('signal.beast.tribulation-success'),
  signalId('signal.beast.tribulation-survived'),
  signalId('signal.beast.tribulation-failed'),
  signalId('signal.beast.evolution-completed'),
  signalId('signal.beast.special-growth-chance-selected'),
  signalId('signal.beast.special-growth-selected'),
  signalId('signal.beast.god-choice-selected'),
  signalId('signal.beast.bloodline-refinement-selected'),
  signalId('signal.beast.transform'),
  signalId('signal.beast.remain'),
  signalId('signal.sea-god-island-selected'),
  signalId('signal.sea-god-tier-selected'),
  signalId('signal.sea-god-plan-selected'),
  signalId('signal.sea-god-reward-completed'),
  signalId('signal.sea-god-completion-gate-selected'),
  signalId('signal.god-tier-selected'),
  signalId('signal.god-trial-entry-selected'),
  signalId('signal.god-self-created-selected'),
  signalId('signal.god-offer.resolved'),
  signalId('signal.god-trial.started'),
  signalId('signal.god-trial.progressed'),
  signalId('signal.god-deity-selected'),
  signalId('signal.god-trial.exam-completed'),
  signalId('signal.god-trial.training-completed'),
  signalId('signal.postwar.completed'),
])

export const v03ContentSource: ContentSource = {
  manifest: {
    schemaVersion: 3,
    contentVersion: 'v0.3.13',
    files: [
      'v03/setupContent.ts',
      'v03/progressionContent.ts',
      'v03/postwarContent.ts',
      'v03/legacyMartialSoulRules.ts',
      'v03/legacyCombatRules.ts',
      'v03/legacyContent.source.json',
      'v03/legacyContent.generated.json',
      'v03/legacyFlow.generated.json',
    ],
  },
  entities: [...setupEntities, ...progressionEntities, ...postwarEntities, ...legacySource.entities],
  pools: [...setupPools, ...progressionPools, ...postwarPools, ...legacySource.pools],
  endings: [...progressionEndings, ...postwarEndings],
}

export const v03Registries = createContentRegistries(v03Policies, v03Signals)
export const v03Content = compileContent(v03ContentSource, v03Registries)
