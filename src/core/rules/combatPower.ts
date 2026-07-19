import type { EntityId } from '../ids'
import type { CombatPowerSnapshot, GameState } from '../model/contracts'
import { legacyBattleTraitIds, legacyTalentTraitIds } from '@/content/v03/legacyCombatRules'
import { legacyMartialSoulTier } from '@/content/v03/legacyMartialSoulRules'

const tierPower: Readonly<Record<number, number>> = { 1: 0, 2: 3, 3: 8, 4: 15, 5: 25, 6: 45 }
const ringYears: Readonly<Record<string, number>> = {
  'entity.soul-ring.hundred': 100,
  'entity.soul-ring.thousand': 1_000,
  'entity.soul-ring.ten-thousand': 10_000,
}
const soulBoneYears: Readonly<Record<string, number>> = {}

export type CombatPowerBreakdown = CombatPowerSnapshot

export function combatRingPower(years: number): number {
  if (years <= 0) return 0
  if (years < 100) return Math.round(5 + (years - 10) / 90 * 3)
  if (years < 1_000) return Math.round(9 + (years - 100) / 900 * 2)
  if (years < 10_000) return Math.round(12 + (years - 1_000) / 9_000 * 3)
  if (years < 100_000) return Math.round(16 + (years - 10_000) / 90_000 * 4)
  if (years < 1_000_000) return Math.round(21 + (years - 100_000) / 900_000 * 9)
  return Math.round(31 + Math.min(9, (years - 1_000_000) / 1_000_000 * 9))
}

export function combatSoulBonePower(years: number): number {
  if (years <= 0) return 5
  if (years < 10_000) return Math.round(5 + (years - 1_000) / 9_000 * 3)
  if (years < 50_000) return Math.round(8 + (years - 10_000) / 40_000 * 4)
  if (years < 100_000) return Math.round(12 + (years - 50_000) / 50_000 * 4)
  return Math.round(16 + Math.min(4, (years - 100_000) / 400_000 * 4))
}

function knownRingYears(ringId: EntityId): number {
  return ringYears[ringId] ?? 10_000
}

function knownSoulBoneYears(boneId: EntityId): number {
  return soulBoneYears[boneId] ?? 10_000
}

export function calculateCombatPower(state: GameState): CombatPowerBreakdown {
  const levelBase = state.stats.level * state.stats.level / 20
  const ringPower = state.progression.rings.reduce((sum, ring) => sum + combatRingPower(knownRingYears(ring)), 0)
  const martialSoulPower = state.entities['martial-soul']
    .reduce((sum, martialSoul) => sum + (tierPower[legacyMartialSoulTier(martialSoul)] ?? 0), 0)
  const domainPower = state.entities.domain.length * 15
  const soulBonePower = state.entities['soul-bone']
    .reduce((sum, bone) => sum + combatSoulBonePower(knownSoulBoneYears(bone)), 0)
  const talentCoefficient = Math.min(10, state.entities.trait.filter((trait) => legacyTalentTraitIds.has(trait)).length) * 0.005
  const battleTraitCoefficient = Math.min(10, state.entities.trait.filter((trait) => legacyBattleTraitIds.has(trait)).length) * 0.005
  const multiplier = Number((1 + talentCoefficient + battleTraitCoefficient).toFixed(6))
  const rawTotal = Math.round((levelBase + ringPower + martialSoulPower + domainPower + soulBonePower) * multiplier)
  // A newly awakened T1 martial soul at level 1 rounds below one point. It is
  // still a living soul master, so keep the persisted, player-visible score
  // positive while preserving every structural component above.
  const total = state.entities['martial-soul'].length > 0 ? Math.max(1, rawTotal) : rawTotal
  return {
    levelBase,
    ringPower,
    martialSoulPower,
    domainPower,
    soulBonePower,
    talentCoefficient,
    battleTraitCoefficient,
    multiplier,
    total,
  }
}
