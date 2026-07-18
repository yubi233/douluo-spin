import { policyId, signalId } from '@/core/ids'
import type { ContentSource, GameState } from '@/core/model/contracts'
import { createContentRegistries, type PolicyRegistry } from '@/core/rules/evaluate'
import { compileContent } from '../compiler/compileContent'
import legacyContent from './legacyContent.generated.json'
import { setupEntities, setupPools } from './setupContent'
import { progressionEndings, progressionEntities, progressionPools } from './progressionContent'
import { postwarEndings, postwarEntities, postwarPools } from './postwarContent'

const legacyPools = legacyContent.pools as unknown as ContentSource['pools']

export const v03Policies: PolicyRegistry = new Map([
  [policyId('policy.identity'), () => 1],
  [policyId('policy.combat-power-growth'), (state: GameState) => Math.max(0.5, Math.min(2, state.stats.level / 50))],
])

export const v03Signals = new Set([
  signalId('signal.setup.gender-selected'),
  signalId('signal.setup.appearance-selected'),
  signalId('signal.setup.martial-type-selected'),
  signalId('signal.setup.martial-soul-selected'),
  signalId('signal.setup.age-selected'),
  signalId('signal.setup.period-selected'),
  signalId('signal.setup.initial-power-selected'),
  signalId('signal.setup.faction-selected'),
  signalId('signal.human.growth-completed'),
  signalId('signal.soul-ring.selected'),
  signalId('signal.story.completed'),
  signalId('signal.beast.period-selected'),
  signalId('signal.beast.gender-selected'),
  signalId('signal.beast.realm-selected'),
  signalId('signal.beast.type-selected'),
  signalId('signal.beast.species-selected'),
  signalId('signal.beast.area-selected'),
  signalId('signal.beast.growth-completed'),
  signalId('signal.beast.tribulation-success'),
  signalId('signal.beast.transform'),
  signalId('signal.beast.remain'),
  signalId('signal.god-trial.exam-completed'),
  signalId('signal.postwar.completed'),
])

export const v03ContentSource: ContentSource = {
  manifest: {
    schemaVersion: 3,
    contentVersion: 'v0.3.0',
    files: ['v03/setupContent.ts', 'v03/progressionContent.ts', 'v03/postwarContent.ts', 'v03/legacyContent.generated.json'],
  },
  entities: [...setupEntities, ...progressionEntities, ...postwarEntities],
  pools: [...setupPools, ...progressionPools, ...postwarPools, ...legacyPools],
  endings: [...progressionEndings, ...postwarEndings],
}

export const v03Registries = createContentRegistries(v03Policies, v03Signals)
export const v03Content = compileContent(v03ContentSource, v03Registries)
