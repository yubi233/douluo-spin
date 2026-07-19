import { signalId } from '../ids'
import { legacyFlow } from '@/content/v03/legacyFlow'
import type { DomainEvent, GameState } from '../model/contracts'
import type { ProcessManager } from './processManager'
import { hasSignal, selectedOption, task } from './processHelpers'

export const storyTimelineProcess: ProcessManager = {
  id: 'story-timeline',
  react(state: GameState, events: readonly DomainEvent[]): readonly DomainEvent[] {
    const metric = events.find((event): event is Extract<DomainEvent, { type: 'signal.emitted' }> => event.type === 'signal.emitted' && event.signalId === signalId('signal.story.metric-recorded'))
    if (metric) {
      const kind = metric.payload?.kind
      if (kind === 'negative' || kind === 'combat') {
        const before = state.progression.storyMetrics[kind]
        return [{ type: 'story.metric-recorded', metric: kind, before, after: before + 1 }]
      }
    }
    if (hasSignal(events, signalId('signal.story.completed'))) {
      const option = selectedOption(events)
      const pool = option ? legacyFlow.pools.find((entry) => entry.options.some((candidate) => candidate.activeOptionId === option)) : undefined
      if (!pool?.storyNodeEntityId) return []
      return [{ type: 'story.completed', nodeId: pool.storyNodeEntityId, index: state.progression.storyNodes.length + 1 }]
    }
    const isHumanAdventure = state.phase === 'adventure.human' || state.phase === 'adventure.transformed'
    if (!isHumanAdventure || !events.some((event) => event.type === 'time.advanced')) return []
    const branch = state.progression.storyBranch
    const plan = legacyFlow.progression.storyPlan.find((entry) => entry.branch === branch)
    const milestone = plan?.milestones.find((entry) =>
      state.stats['tang-age'] >= entry.atTangAge
      && !state.progression.scheduledStoryMilestones.includes(`${plan.branch}@${entry.atTangAge}`),
    )
    if (!plan || !milestone) return []
    return [
      { type: 'story.milestone-scheduled', branch: plan.branch, atTangAge: milestone.atTangAge },
      ...milestone.poolIds.map((poolId) => ({
        type: 'task.scheduled' as const,
        task: task(`story.${plan.branch}.${milestone.atTangAge}.${poolId}`, poolId, 'story-timeline'),
      })),
    ]
  },
}
