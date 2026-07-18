import { entityId, poolId, signalId, type PoolId } from '../ids'
import type { DomainEvent, GameState, Task } from '../model/contracts'
import { hasSignal } from './processHelpers'
import type { ProcessManager } from './processManager'

const pools = {
  gender: poolId('pool.setup.gender'),
  appearance: poolId('pool.setup.appearance'),
  martialType: poolId('pool.setup.martial-type'),
  age: poolId('pool.setup.age'),
  period: poolId('pool.setup.period'),
  initialPower: poolId('pool.setup.initial-power'),
  faction: poolId('pool.setup.faction'),
  humanGrowth: poolId('pool.human.growth'),
  beastPeriod: poolId('pool.beast.setup.period'),
  beastGender: poolId('pool.beast.setup.gender'),
  beastRealm: poolId('pool.beast.setup.realm'),
  beastType: poolId('pool.beast.setup.type'),
  beastSpecies: poolId('pool.beast.setup.species'),
  beastArea: poolId('pool.beast.setup.area'),
  beastGrowth: poolId('pool.beast.growth'),
}

const martialSoulPools = new Map([
  [entityId('entity.martial-type.beast'), poolId('pool.setup.martial-soul.beast')],
  [entityId('entity.martial-type.tool'), poolId('pool.setup.martial-soul.tool')],
  [entityId('entity.martial-type.mutated'), poolId('pool.setup.martial-soul.mutated')],
  [entityId('entity.martial-type.concept'), poolId('pool.setup.martial-soul.concept')],
  [entityId('entity.martial-type.body'), poolId('pool.setup.martial-soul.body')],
  [entityId('entity.martial-type.ultimate'), poolId('pool.setup.martial-soul.ultimate')],
])

function setupTask(poolIdValue: PoolId): Task {
  return { id: `task.${poolIdValue}`, poolId: poolIdValue, process: 'character-setup' }
}

export const characterSetupProcess: ProcessManager = {
  id: 'character-setup',
  react(state: GameState, events: readonly DomainEvent[]): readonly DomainEvent[] {
    if (events.some((event) => event.type === 'run.started' && event.route === 'human')) {
      return [{ type: 'task.scheduled', task: setupTask(pools.gender) }]
    }
    if (events.some((event) => event.type === 'run.started' && event.route === 'beast')) {
      return [{ type: 'task.scheduled', task: setupTask(pools.beastPeriod) }]
    }
    if (hasSignal(events, signalId('signal.setup.gender-selected')) && state.route !== 'beast') {
      return [{ type: 'task.scheduled', task: setupTask(pools.appearance) }]
    }
    if (hasSignal(events, signalId('signal.setup.appearance-selected'))) {
      if (state.route === 'transformed') return [{ type: 'task.scheduled', task: setupTask(pools.faction) }]
      return [{ type: 'task.scheduled', task: setupTask(pools.martialType) }]
    }
    if (hasSignal(events, signalId('signal.setup.martial-type-selected'))) {
      const selectedType = [...state.entities['martial-soul-type']].reverse().find((id) => martialSoulPools.has(id))
      const nextPool = selectedType ? martialSoulPools.get(selectedType) : undefined
      return nextPool ? [{ type: 'task.scheduled', task: setupTask(nextPool) }] : []
    }
    if (hasSignal(events, signalId('signal.setup.martial-soul-selected'))) {
      return [{ type: 'task.scheduled', task: setupTask(pools.age) }]
    }
    if (hasSignal(events, signalId('signal.setup.age-selected'))) {
      return [{ type: 'task.scheduled', task: setupTask(pools.period) }]
    }
    if (hasSignal(events, signalId('signal.setup.period-selected'))) {
      return [{ type: 'task.scheduled', task: setupTask(pools.initialPower) }]
    }
    if (hasSignal(events, signalId('signal.setup.initial-power-selected'))) {
      return [{ type: 'task.scheduled', task: setupTask(pools.faction) }]
    }
    if (hasSignal(events, signalId('signal.setup.faction-selected'))) {
      const phase = state.route === 'transformed' ? 'adventure.transformed' : 'adventure.human'
      return [{ type: 'phase.changed', from: state.phase, to: phase }]
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
      return [{ type: 'task.scheduled', task: setupTask(pools.beastSpecies) }]
    }
    if (hasSignal(events, signalId('signal.beast.species-selected'))) {
      return [{ type: 'task.scheduled', task: setupTask(pools.beastArea) }]
    }
    if (hasSignal(events, signalId('signal.beast.area-selected'))) {
      return [
        { type: 'phase.changed', from: state.phase, to: 'adventure.beast' },
        { type: 'task.scheduled', task: taskForGrowth('beast', 1) },
      ]
    }
    return []
  },
}

function taskForGrowth(route: 'human' | 'beast' | 'transformed', cycle: number): Task {
  const selectedPool = route === 'beast' ? pools.beastGrowth : pools.humanGrowth
  return { id: `task.${route}.growth.${cycle}`, poolId: selectedPool, process: route === 'beast' ? 'beast-cultivation' : 'human-progression' }
}
