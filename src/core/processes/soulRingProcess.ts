import { signalId } from '../ids'
import { legacyFlow, legacyOptionSemantic, legacyPoolsForRole } from '@/content/v03/legacyFlow'
import type { DomainEvent, GameState } from '../model/contracts'
import type { ProcessManager } from './processManager'
import { hasSignal, selectedOption, task } from './processHelpers'

export const soulRingProcess: ProcessManager = {
  id: 'soul-ring',
  react(state: GameState, events: readonly DomainEvent[]): readonly DomainEvent[] {
    if (hasSignal(events, signalId('signal.soul-ring.selected'))) {
      const option = selectedOption(events)
      const semantic = option ? legacyOptionSemantic(option) : undefined
      const ringId = semantic?.ringEntityId
      if (!ringId) return []
      const index = state.progression.rings.length + 1
      const result: DomainEvent[] = [{ type: 'soul-ring.granted', ringId, index }]
      const speciesPool = legacyPoolsForRole('ring-species').find((pool) => pool.ringIndex === index)
      if (speciesPool) result.push({ type: 'task.scheduled', task: task(`ring-species.${index}`, speciesPool.activePoolId, 'soul-ring') })
      const soulBonePool = soulBoneChancePool(semantic.ringYears ?? 0)
      if (soulBonePool) result.push({ type: 'task.scheduled', task: task(`soul-bone-chance.${index}`, soulBonePool.activePoolId, 'soul-ring') })
      if ((semantic.ringYears ?? 0) >= 100_000 && state.stats.level < 80) {
        const bonusPool = legacyPoolsForRole('ring-bonus')[0]
        if (bonusPool) result.push({ type: 'task.scheduled', task: task(`ring-bonus.${index}`, bonusPool.activePoolId, 'soul-ring') })
      }
      return result
    }
    if (hasSignal(events, signalId('signal.soul-bone-chance-selected'))) {
      const option = selectedOption(events)
      if (!option || legacyOptionSemantic(option)?.accepted !== true) return []
      const pool = legacyPoolsForRole('soul-bone')[0]
      return pool ? [{ type: 'task.scheduled', task: task(`soul-bone.${state.progression.rings.length}`, pool.activePoolId, 'soul-ring') }] : []
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
      const poolId = legacyFlow.progression.soulRingByIndex.find((entry) => entry.index === index)?.poolId
      if (!poolId) break
      const next = task(`soul-ring.${index}`, poolId, 'soul-ring')
      if (!scheduled.has(next.id)) result.push({ type: 'task.scheduled', task: next })
    }
    return result
  },
}

function soulBoneChancePool(ringYears: number) {
  const threshold = ringYears < 100 ? 10 : ringYears < 1_000 ? 100 : ringYears < 10_000 ? 1_000 : 10_000
  return legacyPoolsForRole('soul-bone-chance').find((pool) => pool.soulBoneYears === threshold)
}
