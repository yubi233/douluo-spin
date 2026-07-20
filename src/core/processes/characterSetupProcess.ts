import { entityId, signalId, type PoolId } from '../ids'
import type { DomainEvent, GameState, Task } from '../model/contracts'
import { legacyBeastTypeRequiresArea, legacyFlow, legacyOptionPool, legacyOptionSemantic, legacyPoolForRole } from '@/content/v03/legacyFlow'
import { highestLegacyMartialSoulTier } from '@/content/v03/legacyMartialSoulRules'
import { hasSignal, selectedOption, task } from './processHelpers'
import type { ProcessManager } from './processManager'

const pools = {
  race: legacyFlow.entrypoints.random,
  timeline: legacyPoolForRole('setup-timeline').activePoolId,
  gender: legacyFlow.entrypoints.human[0]!,
  appearance: legacyFlow.entrypoints.human[1]!,
  martialType: legacyFlow.entrypoints.human[2]!,
  specialChance: legacyFlow.entrypoints.human[3]!,
  age: legacyFlow.entrypoints.human[4]!,
  period: legacyFlow.entrypoints.human[5]!,
  specialTalent: legacyPoolForRole('special-talent').activePoolId,
  beastPeriod: legacyFlow.entrypoints.beast[0]!,
  beastGender: legacyFlow.entrypoints.beast[1]!,
  beastRealm: legacyFlow.entrypoints.beast[2]!,
  beastType: legacyFlow.entrypoints.beast[3]!,
}

function setupTask(poolIdValue: PoolId, priority?: Task['priority'], suffix?: string): Task {
  return { id: `task.${poolIdValue}${suffix ? `.${suffix}` : ''}`, poolId: poolIdValue, process: 'character-setup', ...(priority ? { priority } : {}) }
}

function initialPowerPool(state: GameState): PoolId {
  const age = state.stats.age
  const hasUltimate = state.entities['martial-soul-type'].includes(entityId('entity.martial-type.ultimate'))
  if (age === 6 && (hasUltimate || highestLegacyMartialSoulTier(state.entities['martial-soul']) >= 6)) {
    return legacyFlow.progression.ultimateInitialPowerPoolId
  }
  return legacyFlow.progression.initialPowerByAge.find((entry) => entry.age === age)?.poolId
    ?? legacyFlow.progression.initialPowerByAge.find((entry) => entry.age === 18)?.poolId
    ?? legacyFlow.progression.initialPowerByAge[0]!.poolId
}

function factionStage(state: GameState): number {
  return state.stats.age >= 18 ? 18 : state.stats.age >= 12 ? 12 : 6
}

function factionPool(state: GameState): PoolId {
  const stage = factionStage(state)
  return legacyFlow.progression.factionByAge.find((entry) => entry.age === stage)?.poolId
    ?? legacyFlow.progression.factionByAge[0]!.poolId
}

function selectedAccepted(events: readonly DomainEvent[]): boolean {
  const optionId = selectedOption(events)
  return optionId ? legacyOptionSemantic(optionId)?.accepted === true : false
}

export const characterSetupProcess: ProcessManager = {
  id: 'character-setup',
  react(state: GameState, events: readonly DomainEvent[]): readonly DomainEvent[] {
    const started = events.find((event): event is Extract<DomainEvent, { type: 'run.started' }> => event.type === 'run.started')
    if (started?.requestedRoute === 'random') {
      return [{ type: 'task.scheduled', task: setupTask(pools.race) }]
    }
    if (started?.route === 'human') {
      return [{ type: 'task.scheduled', task: setupTask(pools.gender) }]
    }
    if (started?.route === 'beast') {
      return [{ type: 'task.scheduled', task: setupTask(pools.beastPeriod) }]
    }
    if (hasSignal(events, signalId('signal.setup.race-selected'))) {
      const option = selectedOption(events)
      const route = option ? legacyOptionSemantic(option)?.route : undefined
      if (route === 'beast') {
        return [
          { type: 'route.changed', from: state.route ?? 'human', to: 'beast' },
          { type: 'phase.changed', from: state.phase, to: 'setup.beast' },
          { type: 'task.scheduled', task: setupTask(pools.beastPeriod) },
        ]
      }
      return [{ type: 'task.scheduled', task: setupTask(pools.timeline) }]
    }
    if (hasSignal(events, signalId('signal.setup.timeline-selected'))) {
      return [{ type: 'task.scheduled', task: setupTask(pools.gender) }]
    }
    if (hasSignal(events, signalId('signal.setup.gender-selected')) && state.route !== 'beast') {
      return [{ type: 'task.scheduled', task: setupTask(pools.appearance) }]
    }
    if (hasSignal(events, signalId('signal.setup.appearance-selected'))) {
      if (state.route === 'transformed') return [{ type: 'task.scheduled', task: setupTask(factionPool(state)) }]
      return [{ type: 'task.scheduled', task: setupTask(pools.martialType) }]
    }
    if (hasSignal(events, signalId('signal.setup.martial-type-selected'))) {
      const selectedType = [...state.entities['martial-soul-type']]
        .reverse()
        .map((id) => id.replace('entity.martial-type.', ''))
        .find((type) => legacyFlow.progression.martialSoul.selectionPools.some((entry) => entry.type === type))
      const nextPool = selectedType
        ? legacyFlow.progression.martialSoul.selectionPools.find((entry) => entry.type === selectedType)?.poolId
        : undefined
      return nextPool ? [{ type: 'task.scheduled', task: setupTask(nextPool, 'front') }] : []
    }
    if (hasSignal(events, signalId('signal.setup.martial-soul-category-selected'))) {
      const option = selectedOption(events)
      const targetPoolId = option
        ? legacyOptionSemantic(option)?.martialSoulCategoryTargetPoolId
        : undefined
      return targetPoolId ? [{ type: 'task.scheduled', task: setupTask(targetPoolId, 'front') }] : []
    }
    if (hasSignal(events, signalId('signal.setup.martial-soul-selected'))) {
      // Extra martial souls from a special talent were queued ahead of the
      // already-scheduled age task in v0.2. Do not restart the talent chance.
      if (state.agenda.some((entry) => entry.poolId === pools.age)) return []
      return [{ type: 'task.scheduled', task: setupTask(pools.specialChance) }]
    }
    if (hasSignal(events, signalId('signal.setup.special-chance-selected'))) {
      return [{ type: 'task.scheduled', task: setupTask(selectedAccepted(events) ? pools.specialTalent : pools.age) }]
    }
    if (hasSignal(events, signalId('signal.setup.special-talent-selected'))) {
      const option = selectedOption(events)
      const semantic = option ? legacyOptionSemantic(option) : undefined
      const extraSelections = semantic?.specialTalentExtraMartialSoulSelections ?? 0
      const targetPoolId = option
        ? legacyFlow.progression.martialSoul.specialTalentTargets.find((entry) => entry.specialTalentOptionId === option)?.targetPoolId
        : undefined
      const result: DomainEvent[] = [{ type: 'task.scheduled', task: setupTask(pools.age) }]
      if (semantic?.specialTalentBeastCategory === true) {
        result.push(
          { type: 'entity.granted', entityType: 'martial-soul-type', entityId: entityId('entity.martial-type.beast') },
          { type: 'task.scheduled', task: setupTask(legacyFlow.progression.martialSoul.selectionPools.find((entry) => entry.type === 'beast')!.poolId, 'front') },
        )
      }
      for (let index = 0; index < extraSelections; index += 1) {
        result.push({ type: 'task.scheduled', task: setupTask(pools.martialType, 'front', `special-${index + 1}`) })
      }
      if (targetPoolId) {
        result.push(
          { type: 'entity.granted', entityType: 'martial-soul-type', entityId: entityId('entity.martial-type.beast') },
          { type: 'task.scheduled', task: setupTask(targetPoolId, 'front') },
        )
      }
      if (semantic?.godEntry === 'general') {
        result.push({ type: 'task.scheduled', task: setupTask(legacyFlow.progression.god.generalTriggerPoolId, 'front') })
      }
      return result
    }
    if (hasSignal(events, signalId('signal.setup.age-selected'))) {
      return [{ type: 'task.scheduled', task: setupTask(pools.period) }]
    }
    if (hasSignal(events, signalId('signal.setup.period-selected'))) {
      return [{ type: 'task.scheduled', task: setupTask(initialPowerPool(state)) }]
    }
    if (hasSignal(events, signalId('signal.setup.initial-power-selected'))) {
      return [{ type: 'task.scheduled', task: setupTask(factionPool(state)) }]
    }
    if (hasSignal(events, signalId('signal.setup.faction-selected'))) {
      const option = selectedOption(events)
      const semantic = option ? legacyOptionSemantic(option) : undefined
      const stage = option
        ? legacyFlow.progression.factionByAge.find((entry) => entry.poolId === legacyOptionPool(option)?.activePoolId)?.age
        : undefined
      const selected: DomainEvent[] = [
        { type: 'faction.stage-selected', stage: stage ?? factionStage(state) },
        ...(semantic?.branch ? [{ type: 'story.branch-selected' as const, branch: semantic.branch }] : []),
      ]
      if (state.phase === 'setup.human' || state.phase === 'setup.transformed') {
        const phase = state.route === 'transformed' ? 'adventure.transformed' : 'adventure.human'
        selected.push({ type: 'phase.changed', from: state.phase, to: phase })
      }
      return selected
    }
    if (hasSignal(events, signalId('signal.beast.period-selected'))) {
      return [{ type: 'task.scheduled', task: setupTask(pools.beastGender) }]
    }
    if (hasSignal(events, signalId('signal.beast.gender-selected'))) {
      return [{ type: 'task.scheduled', task: setupTask(pools.beastRealm) }]
    }
    if (hasSignal(events, signalId('signal.beast.realm-selected'))) {
      return [{ type: 'task.scheduled', task: setupTask(pools.beastType) }]
    }
    if (hasSignal(events, signalId('signal.beast.type-selected'))) {
      const option = selectedOption(events)
      const semantic = option ? legacyOptionSemantic(option) : undefined
      return semantic?.speciesPoolId
        ? [{ type: 'task.scheduled', task: setupTask(semantic.speciesPoolId) }]
        : []
    }
    if (hasSignal(events, signalId('signal.beast.species-selected'))) {
      const beastType = state.entities['beast-type'][0]
      if (beastType && legacyBeastTypeRequiresArea(beastType) === false) {
        return [
          { type: 'phase.changed', from: state.phase, to: 'adventure.beast' },
          { type: 'task.scheduled', task: taskForBeastCycle(state.progression.growthCycles + 1, state) },
          { type: 'task.scheduled', task: taskForBeastEncounter(state.progression.growthCycles + 1, state) },
        ]
      }
      return [{ type: 'task.scheduled', task: setupTask(legacyFlow.progression.beastSetup.areaPoolId) }]
    }
    if (hasSignal(events, signalId('signal.beast.area-selected'))) {
      return [
        { type: 'phase.changed', from: state.phase, to: 'adventure.beast' },
        { type: 'task.scheduled', task: taskForBeastCycle(state.progression.growthCycles + 1, state) },
        { type: 'task.scheduled', task: taskForBeastEncounter(state.progression.growthCycles + 1, state) },
      ]
    }
    return []
  },
}

function taskForBeastCycle(cycle: number, state: GameState): Task {
  const cultivation = state.stats['beast-cultivation']
  const selected = legacyFlow.progression.beastGrowthByCultivation.find((entry) => cultivation >= entry.min && cultivation <= entry.max)
    ?? legacyFlow.progression.beastGrowthByCultivation.at(-1)!
  return { id: `task.beast.growth.${cycle}`, poolId: selected.poolId, process: 'beast-cultivation' }
}

function taskForBeastEncounter(cycle: number, state: GameState): Task {
  const cultivation = state.stats['beast-cultivation']
  const selected = legacyFlow.progression.beastEncounterByCultivation.find((entry) => cultivation >= entry.min && cultivation <= entry.max)
    ?? legacyFlow.progression.beastEncounterByCultivation.at(-1)!
  return { id: `task.beast.encounter.${cycle}`, poolId: selected.poolId, process: 'beast-cultivation' }
}
