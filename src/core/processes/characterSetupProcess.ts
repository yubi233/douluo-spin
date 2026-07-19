import { entityId, poolId, signalId, type PoolId } from '../ids'
import type { DomainEvent, GameState, Task } from '../model/contracts'
import { legacyBeastTypeRequiresArea, legacyFlow, legacyOptionPool, legacyOptionSemantic, legacyPoolForRole } from '@/content/v03/legacyFlow'
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

const martialSoulPools = new Map([
  [entityId('entity.martial-type.beast'), poolId('pool.legacy.f1afa805-95b7-4d54-aea2-d3de15e54c5a')],
  [entityId('entity.martial-type.tool'), poolId('pool.legacy.cb2dce39-17c0-4b0b-9cca-94778d215d7f')],
  [entityId('entity.martial-type.mutated'), poolId('pool.legacy.16e885e9-96bf-4629-9baa-c57e1cbdf571')],
  [entityId('entity.martial-type.concept'), poolId('pool.legacy.ce8c59c8-cd87-487a-b782-4e6587685f63')],
  [entityId('entity.martial-type.body'), poolId('pool.legacy.49e3abc8-1361-4348-94aa-b23c68a53720')],
  [entityId('entity.martial-type.ultimate'), poolId('pool.legacy.8c589787-e43d-4064-8546-8b5b7b403fe2')],
])

function setupTask(poolIdValue: PoolId): Task {
  return { id: `task.${poolIdValue}`, poolId: poolIdValue, process: 'character-setup' }
}

function initialPowerPool(state: GameState): PoolId {
  const age = state.stats.age
  const hasUltimate = state.entities['martial-soul-type'].includes(entityId('entity.martial-type.ultimate'))
  if (age === 6 && hasUltimate) return legacyFlow.progression.ultimateInitialPowerPoolId
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
      const selectedType = [...state.entities['martial-soul-type']].reverse().find((id) => martialSoulPools.has(id))
      const nextPool = selectedType ? martialSoulPools.get(selectedType) : undefined
      return nextPool ? [{ type: 'task.scheduled', task: setupTask(nextPool) }] : []
    }
    if (hasSignal(events, signalId('signal.setup.martial-soul-selected'))) {
      return [{ type: 'task.scheduled', task: setupTask(pools.specialChance) }]
    }
    if (hasSignal(events, signalId('signal.setup.special-chance-selected'))) {
      return [{ type: 'task.scheduled', task: setupTask(selectedAccepted(events) ? pools.specialTalent : pools.age) }]
    }
    if (hasSignal(events, signalId('signal.setup.special-talent-selected'))) {
      return [{ type: 'task.scheduled', task: setupTask(pools.age) }]
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
