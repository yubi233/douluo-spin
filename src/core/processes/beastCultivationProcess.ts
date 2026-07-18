import { endingId, entityId, poolId, signalId } from '../ids'
import type { DomainEvent, GameState } from '../model/contracts'
import type { ProcessManager } from './processManager'
import { hasSignal, task } from './processHelpers'

const thresholds = [100_000, 300_000, 600_000, 1_000_000] as const

export const beastCultivationProcess: ProcessManager = {
  id: 'beast-cultivation',
  react(state: GameState, events: readonly DomainEvent[]): readonly DomainEvent[] {
    if (hasSignal(events, signalId('signal.beast.growth-completed'))) {
      const cycle = state.progression.growthCycles + 1
      const nextThreshold = thresholds.find((value) => value <= state.stats['beast-cultivation'] && !state.progression.resolvedTribulations.includes(value))
      const result: DomainEvent[] = [{ type: 'growth.completed', route: 'beast', cycle }]
      if (nextThreshold && state.progression.pendingTribulation == null) {
        result.push(
          { type: 'beast.tribulation-requested', threshold: nextThreshold },
          { type: 'task.scheduled', task: task(`beast.tribulation.${nextThreshold}`, poolId('pool.beast.tribulation'), 'beast-cultivation') },
        )
      } else {
        result.push({ type: 'task.scheduled', task: task(`beast.growth.${cycle + 1}`, poolId('pool.beast.growth'), 'beast-cultivation') })
      }
      return result
    }
    if (hasSignal(events, signalId('signal.beast.tribulation-success'))) {
      const threshold = state.progression.pendingTribulation
      if (threshold == null) return []
      if (threshold >= 1_000_000) {
        return [
          { type: 'beast.tribulation-resolved', threshold },
          { type: 'entity.granted', entityType: 'godhood', entityId: entityId('entity.godhood.beast') },
          { type: 'run.finished', endingId: endingId('ending.beast-ascension'), alive: true },
        ]
      }
      const result: DomainEvent[] = [{ type: 'beast.tribulation-resolved', threshold }]
      if (threshold === 100_000 && !state.progression.beastRouteChoiceResolved) {
        result.push({ type: 'task.scheduled', task: task('beast.route-choice', poolId('pool.beast.route-choice'), 'beast-cultivation') })
      } else {
        result.push({ type: 'task.scheduled', task: task(`beast.growth.${state.progression.growthCycles + 1}`, poolId('pool.beast.growth'), 'beast-cultivation') })
      }
      return result
    }
    if (hasSignal(events, signalId('signal.beast.transform'))) {
      return [
        { type: 'beast.route-choice-resolved', transformed: true },
        { type: 'route.changed', from: 'beast', to: 'transformed' },
        { type: 'stat.changed', stat: 'age', before: state.stats.age, after: 6 },
        { type: 'stat.changed', stat: 'level', before: state.stats.level, after: 10 },
        { type: 'entity.granted', entityType: 'martial-soul-type', entityId: entityId('entity.martial-type.beast') },
        { type: 'entity.granted', entityType: 'martial-soul', entityId: entityId('entity.martial-soul.beast-form') },
        { type: 'phase.changed', from: state.phase, to: 'setup.transformed' },
        { type: 'task.scheduled', task: task('setup.transformed.gender', poolId('pool.setup.gender'), 'character-setup') },
      ]
    }
    if (hasSignal(events, signalId('signal.beast.remain'))) {
      return [
        { type: 'beast.route-choice-resolved', transformed: false },
        { type: 'task.scheduled', task: task(`beast.growth.${state.progression.growthCycles + 1}`, poolId('pool.beast.growth'), 'beast-cultivation') },
      ]
    }
    return []
  },
}
