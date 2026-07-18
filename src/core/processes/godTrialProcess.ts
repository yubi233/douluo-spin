import { endingId, entityId, poolId, signalId } from '../ids'
import type { DomainEvent, GameState } from '../model/contracts'
import type { ProcessManager } from './processManager'
import { hasSignal, task } from './processHelpers'

export const godTrialProcess: ProcessManager = {
  id: 'god-trial',
  react(state: GameState, events: readonly DomainEvent[]): readonly DomainEvent[] {
    if (!hasSignal(events, signalId('signal.god-trial.exam-completed'))) return []
    const trial = state.progression.godTrial
    if (!trial) return []
    const after = trial.completed + 1
    const result: DomainEvent[] = [{ type: 'god-trial.progressed', before: trial.completed, after }]
    if (after >= trial.total) {
      const ending = trial.origin === 'self-created' ? endingId('ending.self-created-ascension') : endingId('ending.god-ascension')
      result.push(
        { type: 'entity.granted', entityType: 'godhood', entityId: trial.deityId },
        { type: 'stat.changed', stat: 'level', before: state.stats.level, after: 100 },
        { type: 'run.finished', endingId: ending, alive: true },
      )
    } else {
      result.push({ type: 'task.scheduled', task: task(`god-trial.exam.${after + 1}`, poolId('pool.god-trial.exam'), 'god-trial') })
    }
    return result
  },
}
