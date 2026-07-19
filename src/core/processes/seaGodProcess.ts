import { entityId, signalId } from '../ids'
import { legacyFlow } from '@/content/v03/legacyFlow'
import type { DomainEvent, GameState, SeaGodExamGrade } from '../model/contracts'
import type { ProcessManager } from './processManager'
import { hasSignal, task } from './processHelpers'

type RewardGrade = Exclude<SeaGodExamGrade, 'sea-god'>

export const seaGodProcess: ProcessManager = {
  id: 'sea-god',
  react(state: GameState, events: readonly DomainEvent[]): readonly DomainEvent[] {
    // Sea God Island is a human inheritance route. A beast route may reach
    // the original sea-timeline finale only after its own million-year godhood.
    if (state.route === 'beast') return []
    if (hasSignal(events, signalId('signal.sea-god-island-selected'))) {
      const selected = events.find((event): event is Extract<DomainEvent, { type: 'signal.emitted' }> => event.type === 'signal.emitted' && event.signalId === signalId('signal.sea-god-island-selected'))
      const accepted = selected?.payload?.accepted
      if (typeof accepted !== 'boolean') return []
      const result: DomainEvent[] = [{ type: 'flow.stage-completed', stage: 'sea-god.island' }]
      if (accepted) result.push({ type: 'task.scheduled', task: task('sea-god.tier', legacyFlow.progression.seaGod.tierPoolId, 'sea-god') })
      return result
    }

    if (hasSignal(events, signalId('signal.sea-god-tier-selected'))) {
      const selected = events.find((event): event is Extract<DomainEvent, { type: 'signal.emitted' }> => event.type === 'signal.emitted' && event.signalId === signalId('signal.sea-god-tier-selected'))
      const grade = selected?.payload?.grade
      const total = selected?.payload?.total
      if (!isSeaGodGrade(grade) || typeof total !== 'number' || !Number.isInteger(total) || total < 1 || total > 9) return []
      if (grade === 'sea-god') {
        return [
          { type: 'flow.stage-completed', stage: 'sea-god.nine-exams' },
          {
            type: 'god-trial.started',
            tierId: entityId('entity.legacy.god-tier.first'),
            deityId: legacyFlow.progression.seaGod.inheritanceDeityId,
            total,
            origin: 'inheritance',
          },
          { type: 'stat.changed', stat: 'max-level', before: state.stats['max-level'], after: 139 },
          { type: 'signal.emitted', signalId: signalId('signal.god-trial.started') },
        ]
      }
      return [
        { type: 'sea-god.started', grade, total },
        { type: 'task.scheduled', task: task('sea-god.plan', legacyFlow.progression.seaGod.planPoolId, 'sea-god') },
      ]
    }

    if (hasSignal(events, signalId('signal.sea-god-plan-selected'))) {
      const trial = state.progression.seaGodTrial
      const selected = events.find((event): event is Extract<DomainEvent, { type: 'signal.emitted' }> => event.type === 'signal.emitted' && event.signalId === signalId('signal.sea-god-plan-selected'))
      const failed = selected?.payload?.failed
      const all = selected?.payload?.all
      const requested = selected?.payload?.completed
      if (!trial || !isRewardGrade(trial.grade) || trial.planned != null || typeof failed !== 'boolean' || typeof all !== 'boolean' || (requested != null && typeof requested !== 'number')) return []
      const completed = failed ? 0 : all ? trial.total : Math.min(trial.total, Math.max(0, Math.floor(requested ?? 0)))
      return [
        { type: 'sea-god.plan-selected', completed, failed },
        { type: 'task.scheduled', task: task(`sea-god.${trial.grade}.growth`, legacyFlow.progression.seaGod.growthPoolId, 'sea-god') },
      ]
    }

    if (hasSignal(events, signalId('signal.human.growth-completed'))) {
      const trial = state.progression.seaGodTrial
      if (!trial || !isRewardGrade(trial.grade) || trial.planned == null || seaGodTrialCompleted(state, trial.grade)) return []
      if (trial.planned === 0) return [{ type: 'flow.stage-completed', stage: seaGodCompletionStage(trial.grade) }]
      const reward = seaGodRewardPool(trial.grade, 1)
      if (!reward) throw new Error(`Missing original Sea God ${trial.grade} reward 1`)
      return [{ type: 'task.scheduled', task: task(`sea-god.${trial.grade}.reward.1`, reward, 'sea-god') }]
    }

    if (hasSignal(events, signalId('signal.sea-god-reward-completed'))) {
      const trial = state.progression.seaGodTrial
      if (!trial || !isRewardGrade(trial.grade) || trial.planned == null) return []
      if (trial.completed >= trial.planned) {
        return trial.planned < trial.total
          ? [{ type: 'task.scheduled', task: task(`sea-god.${trial.grade}.completion-gate`, legacyFlow.progression.seaGod.completionGatePoolId, 'sea-god') }]
          : []
      }
      const after = trial.completed + 1
      const result: DomainEvent[] = [{ type: 'sea-god.reward-progressed', before: trial.completed, after }]
      if (after >= trial.planned) {
        if (trial.planned < trial.total) {
          result.push({ type: 'task.scheduled', task: task(`sea-god.${trial.grade}.completion-gate`, legacyFlow.progression.seaGod.completionGatePoolId, 'sea-god') })
          return result
        }
        result.push({ type: 'flow.stage-completed', stage: seaGodCompletionStage(trial.grade) })
        return result
      }
      const reward = seaGodRewardPool(trial.grade, after + 1)
      if (!reward) throw new Error(`Missing original Sea God ${trial.grade} reward ${after + 1}`)
      result.push({ type: 'task.scheduled', task: task(`sea-god.${trial.grade}.reward.${after + 1}`, reward, 'sea-god') })
      return result
    }

    if (hasSignal(events, signalId('signal.sea-god-completion-gate-selected'))) {
      const trial = state.progression.seaGodTrial
      const selected = events.find((event): event is Extract<DomainEvent, { type: 'signal.emitted' }> => event.type === 'signal.emitted' && event.signalId === signalId('signal.sea-god-completion-gate-selected'))
      const accepted = selected?.payload?.accepted
      if (!trial || !isRewardGrade(trial.grade) || trial.planned == null || typeof accepted !== 'boolean') return []
      if (!accepted || trial.planned >= trial.total) return [{ type: 'flow.stage-completed', stage: seaGodCompletionStage(trial.grade) }]
      const reward = seaGodRewardPool(trial.grade, trial.completed + 1)
      if (!reward) throw new Error(`Missing original Sea God ${trial.grade} reward ${trial.completed + 1}`)
      return [
        { type: 'sea-god.plan-extended', before: trial.planned, after: trial.total },
        { type: 'task.scheduled', task: task(`sea-god.${trial.grade}.reward.${trial.completed + 1}`, reward, 'sea-god') },
      ]
    }

    return []
  },
}

function isSeaGodGrade(value: unknown): value is SeaGodExamGrade {
  return value === 'yellow' || value === 'purple' || value === 'black' || value === 'top' || value === 'sea-god'
}

function isRewardGrade(value: SeaGodExamGrade): value is RewardGrade {
  return value !== 'sea-god'
}

function seaGodRewardPool(grade: RewardGrade, exam: number) {
  return legacyFlow.progression.seaGod.rewards.find((entry) => entry.grade === grade && entry.exam === exam)?.poolId
}

function seaGodCompletionStage(grade: RewardGrade) {
  return `sea-god.${grade}.completed`
}

function seaGodTrialCompleted(state: GameState, grade: RewardGrade) {
  return state.progression.completedFlowStages.includes(seaGodCompletionStage(grade))
}
