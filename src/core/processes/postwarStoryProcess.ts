import { endingId, entityId, poolId, signalId } from '../ids'
import type { DomainEvent, GameState } from '../model/contracts'
import type { ProcessManager } from './processManager'
import { hasSignal, task } from './processHelpers'

export const postwarStoryProcess: ProcessManager = {
  id: 'postwar-story',
  react(state: GameState, events: readonly DomainEvent[]): readonly DomainEvent[] {
    if (!hasSignal(events, signalId('signal.postwar.completed'))) return []
    const completed = state.progression.storyNodes.filter((id) => id.startsWith('entity.story-node.postwar.')).length
    const index = completed + 1
    const result: DomainEvent[] = [{ type: 'story.completed', nodeId: entityId(`entity.story-node.postwar.${index}`), index: state.progression.storyNodes.length + 1 }]
    if (index < 4) {
      result.push({ type: 'task.scheduled', task: task(`postwar.${index + 1}`, poolId(`pool.postwar.${index + 1}`), 'postwar-story') })
    } else {
      result.push(
        {
          type: 'god-trial.started',
          tierId: entityId('entity.god-tier.self-created'),
          deityId: entityId('entity.godhood.self-created'),
          total: 3,
          origin: 'self-created',
        },
        { type: 'phase.changed', from: state.phase, to: 'god-trial' },
        { type: 'task.scheduled', task: task('god-trial.self-created.1', poolId('pool.god-trial.exam'), 'god-trial') },
      )
    }
    return result
  },
}
