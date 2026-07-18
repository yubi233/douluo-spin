import { entityId, poolId, signalId } from '../ids'
import type { DomainEvent, GameState } from '../model/contracts'
import type { ProcessManager } from './processManager'
import { hasSignal, task } from './processHelpers'

export const humanProgressionProcess: ProcessManager = {
  id: 'human-progression',
  react(state: GameState, events: readonly DomainEvent[]): readonly DomainEvent[] {
    const enteredAdventure = events.some((event) => event.type === 'phase.changed' && (event.to === 'adventure.human' || event.to === 'adventure.transformed'))
    if (enteredAdventure) {
      const route = state.route === 'transformed' ? 'transformed' : 'human'
      return [{ type: 'task.scheduled', task: task(`${route}.growth.1`, poolId('pool.human.growth'), 'human-progression') }]
    }
    if (!hasSignal(events, signalId('signal.human.growth-completed'))) return []
    const cycle = state.progression.growthCycles + 1
    const completed: DomainEvent = { type: 'growth.completed', route: state.route ?? 'human', cycle }
    if (state.stats.level >= 99) {
      if (state.stats['tang-age'] >= 26) {
        return [
          completed,
          { type: 'task.scheduled', task: task('postwar.1', poolId('pool.postwar.1'), 'postwar-story') },
        ]
      }
      return [
        completed,
        {
          type: 'god-trial.started',
          tierId: entityId('entity.god-tier.sea'),
          deityId: entityId('entity.godhood.sea'),
          total: 3,
          origin: 'inheritance',
        },
        { type: 'phase.changed', from: state.phase, to: 'god-trial' },
        { type: 'task.scheduled', task: task('god-trial.exam.1', poolId('pool.god-trial.exam'), 'god-trial') },
      ]
    }
    return [
      completed,
      { type: 'task.scheduled', task: task(`${state.route}.growth.${cycle + 1}`, poolId('pool.human.growth'), 'human-progression') },
    ]
  },
}
