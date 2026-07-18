import type { DomainEvent, GameState } from '../model/contracts'
import type { ProcessManager } from './processManager'

export const endingProcess: ProcessManager = {
  id: 'ending',
  react(state: GameState, events: readonly DomainEvent[]): readonly DomainEvent[] {
    if (state.ending || events.filter((event) => event.type === 'run.finished').length <= 1) return []
    throw new Error('A turn cannot finish the run more than once')
  },
}
