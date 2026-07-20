import { turnId, type OptionId } from '@/core/ids'
import type {
  CommandReceipt,
  CompiledContent,
  DomainEvent,
  EventBatch,
  GameCommand,
  GameState,
  MechanicsPool,
  Route,
} from '@/core/model/contracts'
import { InvalidCommandError } from '@/core/model/errors'
import { candidateDistribution, draw } from '@/core/draw/draw'
import { compileEffects } from '@/core/effects/compileEffects'
import { characterSetupProcess } from '@/core/processes/characterSetupProcess'
import { beastCultivationProcess } from '@/core/processes/beastCultivationProcess'
import { endingProcess } from '@/core/processes/endingProcess'
import { godTrialProcess } from '@/core/processes/godTrialProcess'
import { humanProgressionProcess } from '@/core/processes/humanProgressionProcess'
import { postwarStoryProcess } from '@/core/processes/postwarStoryProcess'
import { settleProcesses, type ProcessManager } from '@/core/processes/processManager'
import { soulRingProcess } from '@/core/processes/soulRingProcess'
import { seaGodProcess } from '@/core/processes/seaGodProcess'
import { storyTimelineProcess } from '@/core/processes/storyTimelineProcess'
import { hashSeed, nextRandom } from '@/core/random/random'
import { applyBatch, createInitialGameState } from '@/core/reducer/reducer'
import { canExecuteCommand } from '@/core/statechart/gameLifecycle'
import type { PolicyRegistry } from '@/core/rules/evaluate'
import { calculateCombatPower } from '@/core/rules/combatPower'

export class GameService {
  #state: GameState
  #batches: EventBatch[] = []

  constructor(
    readonly content: CompiledContent,
    readonly policies: PolicyRegistry,
    readonly managers: readonly ProcessManager[] = [
      characterSetupProcess,
      soulRingProcess,
      storyTimelineProcess,
      seaGodProcess,
      humanProgressionProcess,
      postwarStoryProcess,
      beastCultivationProcess,
      godTrialProcess,
      endingProcess,
    ],
  ) {
    this.#state = createInitialGameState(content.manifest.contentVersion)
  }

  get state(): GameState {
    return structuredClone(this.#state)
  }

  get eventLog(): readonly EventBatch[] {
    return structuredClone(this.#batches)
  }

  restore(batches: readonly EventBatch[]): void {
    let projected = createInitialGameState(this.content.manifest.contentVersion)
    batches.forEach((batch, index) => {
      const expectedTurnId = `turn.${String(index + 1).padStart(6, '0')}`
      if (batch.turnId !== expectedTurnId) throw new Error(`Turn receipt mismatch: expected ${expectedTurnId}, received ${batch.turnId}`)
      if (index === 0 && batch.command !== 'run.start') throw new Error('Event log must begin with run.start')
      projected = applyBatch(projected, batch)
    })
    this.#batches = [...structuredClone(batches)]
    this.#state = projected
  }

  dispatch(command: GameCommand): CommandReceipt {
    if (command.type === 'turn.undo') return this.undo(command)
    if (command.type === 'run.reset') {
      this.#state = createInitialGameState(this.content.manifest.contentVersion)
      this.#batches = []
      return { batch: null }
    }
    if (command.type === 'run.start') return this.start(command)
    if (command.type === 'turn.spin') return this.spin(command)
    if (!canExecuteCommand(this.#state.phase, command)) throw new InvalidCommandError(command.type, this.#state.phase)
    const ending = this.content.mechanics.endings.get(command.endingId)
    if (!ending) throw new Error(`Unknown ending ${command.endingId}`)
    return this.commit(command, [{ type: 'run.finished', endingId: command.endingId, alive: ending.alive }], this.#state.random.state)
  }

  private start(command: Extract<GameCommand, { type: 'run.start' }>): CommandReceipt {
    // Random runs use the human setup state only as a statechart host. The
    // original race pool selects the actual route before setup continues.
    const resolvedRoute: Route = command.route === 'random' ? 'human' : command.route
    if (!canExecuteCommand(this.#state.phase, command, resolvedRoute)) throw new InvalidCommandError(command.type, this.#state.phase)
    const rng = hashSeed(command.seed)
    return this.commit(command, [
      { type: 'run.started', route: resolvedRoute, requestedRoute: command.route, seed: command.seed },
      { type: 'phase.changed', from: this.#state.phase, to: resolvedRoute === 'beast' ? 'setup.beast' : resolvedRoute === 'transformed' ? 'setup.transformed' : 'setup.human' },
    ], rng)
  }

  private spin(command: Extract<GameCommand, { type: 'turn.spin' }>): CommandReceipt {
    if (!canExecuteCommand(this.#state.phase, command)) throw new InvalidCommandError(command.type, this.#state.phase)
    const task = this.#state.agenda[0]
    if (!task) throw new InvalidCommandError(`${command.type}:no-task`, this.#state.phase)
    const pool = this.content.mechanics.pools.get(task.poolId)
    if (!pool) throw new Error(`Unknown pool ${task.poolId}`)
    const candidateOptionIds = this.drawCandidateOptionIds(pool, task.candidateOptionIds, task.rerollExcludedOptionId)
    const result = draw(pool, this.#state, this.policies, candidateOptionIds)
    const option = pool.options.find((candidate) => candidate.id === result.candidate.optionId)!
    const events: DomainEvent[] = [
      { type: 'option.selected', poolId: pool.id, optionId: option.id, probability: result.candidate.probability },
      { type: 'task.completed', taskId: task.id },
      ...compileEffects(option.effects, this.#state, this.policies, this.content.mechanics.endings),
    ]
    const receipt = this.commit(command, events, result.nextRng)
    return {
      ...receipt,
      draw: {
        poolId: pool.id,
        optionId: option.id,
        probability: result.candidate.probability,
        startAngle: result.candidate.startAngle,
        endAngle: result.candidate.endAngle,
      },
    }
  }

  private undo(command: Extract<GameCommand, { type: 'turn.undo' }>): CommandReceipt {
    if (!canExecuteCommand(this.#state.phase, command)) throw new InvalidCommandError(command.type, this.#state.phase)
    let index = -1
    for (let batchIndex = this.#batches.length - 1; batchIndex >= 0; batchIndex -= 1) {
      if (this.#batches[batchIndex]?.command === 'turn.spin') {
        index = batchIndex
        break
      }
    }
    if (index < 0) throw new InvalidCommandError(`${command.type}:empty`, this.#state.phase)
    const removedBatch = this.#batches[index]!
    this.#batches = this.#batches.slice(0, index)
    this.#state = this.#batches.reduce(applyBatch, createInitialGameState(this.content.manifest.contentVersion))
    const reroll = this.prepareReroll(removedBatch)
    const batch: EventBatch = {
      turnId: turnId(`turn.${String(this.#batches.length + 1).padStart(6, '0')}`),
      command: command.type,
      contentVersion: this.content.manifest.contentVersion,
      rngBefore: this.#state.random.state,
      rngAfter: nextRandom(this.#state.random.state).state,
      events: reroll ? [reroll] : [],
    }
    this.#state = applyBatch(this.#state, batch)
    this.#batches = [...this.#batches, batch]
    return { batch: structuredClone(batch) }
  }

  private prepareReroll(removedBatch: EventBatch): Extract<DomainEvent, { type: 'task.reroll-prepared' }> | null {
    const previous = removedBatch.events.find((event) => event.type === 'option.selected')
    const task = this.#state.agenda[0]
    const pool = task ? this.content.mechanics.pools.get(task.poolId) : undefined
    if (!previous || previous.type !== 'option.selected' || !task || !pool || pool.id !== previous.poolId) return null
    const alternatives = candidateDistribution(pool, this.#state, this.policies, task.candidateOptionIds)
      .filter((candidate) => candidate.optionId !== previous.optionId)
    if (alternatives.length === 0) return null
    return { type: 'task.reroll-prepared', taskId: task.id, excludedOptionId: previous.optionId }
  }

  private drawCandidateOptionIds(
    pool: MechanicsPool,
    candidateOptionIds?: readonly OptionId[],
    excludedOptionId?: OptionId,
  ): readonly OptionId[] {
    const allowed = candidateOptionIds ? new Set(candidateOptionIds) : null
    return pool.options
      .filter((option) => (!allowed || allowed.has(option.id)) && option.id !== excludedOptionId)
      .map((option) => option.id)
  }

  private commit(command: GameCommand, initialEvents: readonly DomainEvent[], rngAfter: number): CommandReceipt {
    const settled = settleProcesses(this.#state, initialEvents, this.managers)
    const events: readonly DomainEvent[] = settled.state.route == null
      ? settled.events
      : [...settled.events, {
        type: 'combat-power.recalculated' as const,
        before: this.#state.progression.combatPower,
        after: calculateCombatPower(settled.state),
        trigger: command.type,
      }]
    const batch: EventBatch = {
      turnId: turnId(`turn.${String(this.#batches.length + 1).padStart(6, '0')}`),
      command: command.type,
      contentVersion: this.content.manifest.contentVersion,
      rngBefore: this.#state.random.state,
      rngAfter,
      events,
    }
    const nextState = applyBatch(this.#state, batch)
    this.#batches = [...this.#batches, batch]
    this.#state = nextState
    return { batch: structuredClone(batch) }
  }
}
