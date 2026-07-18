import { entityId, poolId, signalId } from '../ids'
import type { DomainEvent, GameState } from '../model/contracts'
import type { ProcessManager } from './processManager'
import { hasSignal, selectedOption, task } from './processHelpers'

const ringByOption = new Map([
  ['option.ring.hundred', entityId('entity.soul-ring.hundred')],
  ['option.ring.thousand', entityId('entity.soul-ring.thousand')],
  ['option.ring.ten-thousand', entityId('entity.soul-ring.ten-thousand')],
])

export const soulRingProcess: ProcessManager = {
  id: 'soul-ring',
  react(state: GameState, events: readonly DomainEvent[]): readonly DomainEvent[] {
    if (hasSignal(events, signalId('signal.soul-ring.selected'))) {
      const option = selectedOption(events)
      const ringId = option ? ringByOption.get(option) : undefined
      return ringId ? [{ type: 'soul-ring.granted', ringId, index: state.progression.rings.length + 1 }] : []
    }
    const isHumanAdventure = state.phase === 'adventure.human' || state.phase === 'adventure.transformed'
    if (!isHumanAdventure) return []
    const changed = events.find((event): event is Extract<DomainEvent, { type: 'stat.changed' }> => event.type === 'stat.changed' && event.stat === 'level')
    const enteredAdventure = events.some((event) => event.type === 'phase.changed' && (event.to === 'adventure.human' || event.to === 'adventure.transformed'))
    if (!changed && !enteredAdventure) return []
    const targetLevel = changed?.after ?? state.stats.level
    const target = Math.min(9, Math.floor(Math.min(99, targetLevel) / 10))
    const scheduled = new Set(state.agenda.filter((entry) => entry.process === 'soul-ring').map((entry) => entry.id))
    const result: DomainEvent[] = []
    for (let index = state.progression.rings.length + 1; index <= target; index += 1) {
      const next = task(`soul-ring.${index}`, poolId('pool.human.soul-ring'), 'soul-ring')
      if (!scheduled.has(next.id)) result.push({ type: 'task.scheduled', task: next })
    }
    return result
  },
}
