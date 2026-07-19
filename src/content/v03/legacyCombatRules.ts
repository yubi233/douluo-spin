import legacyContent from './legacyContent.generated.json'
import type { EntityId } from '@/core/ids'

interface LegacyCombatSource {
  readonly combatRules?: {
    readonly talentTraitIds?: readonly EntityId[]
    readonly battleTraitIds?: readonly EntityId[]
  }
}

const rules = (legacyContent as unknown as LegacyCombatSource).combatRules

export const legacyTalentTraitIds = new Set(rules?.talentTraitIds ?? [])
export const legacyBattleTraitIds = new Set(rules?.battleTraitIds ?? [])
