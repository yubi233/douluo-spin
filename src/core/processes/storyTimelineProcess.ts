import { entityId, poolId, signalId } from '../ids'
import type { DomainEvent, GameState } from '../model/contracts'
import type { ProcessManager } from './processManager'
import { hasSignal, task } from './processHelpers'

export const storyTimelineProcess: ProcessManager = {
  id: 'story-timeline',
  react(state: GameState, events: readonly DomainEvent[]): readonly DomainEvent[] {
    if (hasSignal(events, signalId('signal.story.completed'))) {
      const index = state.progression.storyNodes.length + 1
      return [{ type: 'story.completed', nodeId: entityId(`entity.story-node.${index}`), index }]
    }
    const isHumanAdventure = state.phase === 'adventure.human' || state.phase === 'adventure.transformed'
    if (!isHumanAdventure || !events.some((event) => event.type === 'time.advanced')) return []
    const index = state.progression.storyNodes.length + 1
    if (index > 4 || state.agenda.some((entry) => entry.id === `task.story.${index}`)) return []
    return [{ type: 'task.scheduled', task: task(`story.${index}`, poolId(`pool.story.${index}`), 'story-timeline') }]
  },
}
