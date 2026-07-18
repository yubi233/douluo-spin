import { describe, expect, it } from 'vitest'
import { GameService } from '@/application/gameService'
import { v03Content, v03Policies } from '@/content/v03/content'
import { compileEffects } from '@/core/effects/compileEffects'
import { entityId, signalId } from '@/core/ids'
import type { CompiledContent, DomainEvent, EffectSpec, GameCommand } from '@/core/model/contracts'
import { ProcessCycleError, UnhandledEffectError } from '@/core/model/errors'
import { settleProcesses, type ProcessManager } from '@/core/processes/processManager'
import { createInitialGameState, reduceEvents } from '@/core/reducer/reducer'
import { canExecuteCommand, gameLifecycleMachine } from '@/core/statechart/gameLifecycle'

function createService() {
  return new GameService(v03Content, v03Policies)
}

function start(service: GameService, seed = 'v03-setup-seed') {
  return service.dispatch({ type: 'run.start', route: 'human', seed })
}

describe('v0.3 game lifecycle statechart', () => {
  it('only validates lifecycle command permissions and contains no actions', () => {
    const startCommand: GameCommand = { type: 'run.start', route: 'human', seed: 'statechart' }
    expect(canExecuteCommand('idle', startCommand, 'human')).toBe(true)
    expect(canExecuteCommand('setup.human', startCommand, 'human')).toBe(false)
    expect(canExecuteCommand('setup.human', { type: 'turn.spin' })).toBe(true)
    expect(canExecuteCommand('ended', { type: 'turn.spin' })).toBe(false)
    const actionCounts: number[] = []
    const visited = new WeakSet<object>()
    const visit = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach(visit)
        return
      }
      if (!value || typeof value !== 'object') return
      if (visited.has(value)) return
      visited.add(value)
      for (const [key, child] of Object.entries(value)) {
        if (key === 'actions' && Array.isArray(child)) actionCounts.push(child.length)
        visit(child)
      }
    }
    visit(gameLifecycleMachine.toJSON())
    expect(actionCounts.length).toBeGreaterThan(0)
    expect(actionCounts.every((count) => count === 0)).toBe(true)
  })
})

describe('v0.3 setup walking skeleton', () => {
  it('runs human gender, appearance, martial type and martial soul as one vertical slice', () => {
    const service = createService()
    const startReceipt = start(service)

    expect(service.state.phase).toBe('setup.human')
    expect(service.state.agenda.map((task) => task.poolId)).toEqual(['pool.setup.gender'])
    expect(startReceipt.batch?.events.map((event) => event.type)).toEqual([
      'run.started', 'phase.changed', 'task.scheduled',
    ])

    const expectedPools = [
      'pool.setup.gender',
      'pool.setup.appearance',
      'pool.setup.martial-type',
    ]
    for (const expectedPool of expectedPools) {
      const receipt = service.dispatch({ type: 'turn.spin' })
      expect(receipt.draw?.poolId).toBe(expectedPool)
      expect(receipt.batch?.events.some((event) => event.type === 'option.selected')).toBe(true)
      expect(receipt.batch?.events.some((event) => event.type === 'entity.granted')).toBe(true)
    }

    const martialSoulReceipt = service.dispatch({ type: 'turn.spin' })
    expect(martialSoulReceipt.draw?.poolId).toMatch(/^pool\.setup\.martial-soul\./)
    expect(service.state.phase).toBe('setup.human')
    expect(service.state.agenda.map((task) => task.poolId)).toEqual(['pool.setup.age'])
    expect(service.state.entities.gender).toHaveLength(1)
    expect(service.state.entities.appearance).toHaveLength(1)
    expect(service.state.entities['martial-soul-type']).toHaveLength(1)
    expect(service.state.entities['martial-soul']).toHaveLength(1)
  })

  it('commits selection, RNG and all effects in one turn batch', () => {
    const service = createService()
    start(service)
    const receipt = service.dispatch({ type: 'turn.spin' })
    const batch = receipt.batch!

    expect(batch.command).toBe('turn.spin')
    expect(batch.rngAfter).not.toBe(batch.rngBefore)
    expect(batch.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'option.selected', poolId: 'pool.setup.gender' }),
      expect.objectContaining({ type: 'entity.granted', entityType: 'gender' }),
      expect.objectContaining({ type: 'signal.emitted', signalId: 'signal.setup.gender-selected' }),
      expect.objectContaining({ type: 'task.scheduled', task: expect.objectContaining({ poolId: 'pool.setup.appearance' }) }),
    ]))
    expect(service.eventLog.at(-1)?.turnId).toBe(batch.turnId)
  })

  it('produces byte-identical logs for the same content, seed and commands', () => {
    const run = () => {
      const service = createService()
      start(service, 'deterministic-v03')
      for (let index = 0; index < 4; index += 1) service.dispatch({ type: 'turn.spin' })
      return JSON.stringify(service.eventLog)
    }
    expect(run()).toBe(run())
  })

  it('undoes three turns by truncating and replaying, then redraws the same options', () => {
    const service = createService()
    start(service, 'undo-v03')
    const originals = Array.from({ length: 3 }, () => service.dispatch({ type: 'turn.spin' }))
    const stateAfterOriginal = service.state

    for (let remaining = 2; remaining >= 0; remaining -= 1) {
      service.dispatch({ type: 'turn.undo' })
      expect(service.state.turn).toBe(remaining)
    }
    const redrawn = Array.from({ length: 3 }, () => service.dispatch({ type: 'turn.spin' }))
    expect(redrawn).toEqual(originals)
    expect(service.state).toEqual(stateAfterOriginal)
  })
})

describe('v0.3 transaction failure boundaries', () => {
  it('records clamped stat facts and omits duplicate entity facts', () => {
    const trait = entityId('tag.setup')
    const state = createInitialGameState(v03Content.manifest.contentVersion)
    const events = compileEffects([
      { type: 'stat.change', stat: 'level', delta: { type: 'constant', value: 999 } },
      { type: 'stat.change', stat: 'level', delta: { type: 'constant', value: -999 } },
      { type: 'entity.grant', entityType: 'trait', entityId: trait },
      { type: 'entity.grant', entityType: 'trait', entityId: trait },
      { type: 'entity.revoke', entityType: 'trait', entityId: trait },
      { type: 'entity.revoke', entityType: 'trait', entityId: trait },
    ], state, v03Policies)
    expect(events).toEqual([
      { type: 'stat.changed', stat: 'level', before: 1, after: 159 },
      { type: 'stat.changed', stat: 'level', before: 159, after: 1 },
      { type: 'entity.granted', entityType: 'trait', entityId: trait },
      { type: 'entity.revoked', entityType: 'trait', entityId: trait },
    ])
    expect(reduceEvents(state, events).stats.level).toBe(1)
    expect(reduceEvents(state, events).entities.trait).toEqual([])
  })

  it('throws on an unhandled effect without changing the supplied state', () => {
    const state = createInitialGameState(v03Content.manifest.contentVersion)
    const before = structuredClone(state)
    expect(() => compileEffects([{ type: 'effect.unknown' } as unknown as EffectSpec], state, v03Policies))
      .toThrow(UnhandledEffectError)
    expect(state).toEqual(before)
  })

  it('cancels a process chain that does not stabilize', () => {
    const cycle: ProcessManager = {
      id: 'cycle-fixture',
      react: () => [{ type: 'signal.emitted', signalId: signalId('signal.setup.gender-selected') }],
    }
    const state = createInitialGameState(v03Content.manifest.contentVersion)
    const events: DomainEvent[] = [{ type: 'signal.emitted', signalId: signalId('signal.setup.gender-selected') }]
    expect(() => settleProcesses(state, events, [cycle], 3)).toThrow(ProcessCycleError)
    expect(state).toEqual(createInitialGameState(v03Content.manifest.contentVersion))
  })

  it('does not commit a spin when effect compilation fails', () => {
    const pools = new Map(v03Content.mechanics.pools)
    const gender = pools.get('pool.setup.gender' as never)!
    pools.set(gender.id, {
      ...gender,
      options: gender.options.map((option) => ({ ...option, effects: [{ type: 'effect.unknown' } as never] })),
    })
    const content: CompiledContent = { ...v03Content, mechanics: { ...v03Content.mechanics, pools } }
    const service = new GameService(content, v03Policies)
    service.dispatch({ type: 'run.start', route: 'human', seed: 'atomic-effect-failure' })
    const beforeState = service.state
    const beforeLog = service.eventLog
    expect(() => service.dispatch({ type: 'turn.spin' })).toThrow(UnhandledEffectError)
    expect(service.state).toEqual(beforeState)
    expect(service.eventLog).toEqual(beforeLog)
  })

  it('does not commit a command when process settlement cycles', () => {
    const cycle: ProcessManager = {
      id: 'service-cycle-fixture',
      react: () => [{ type: 'signal.emitted', signalId: signalId('signal.setup.gender-selected') }],
    }
    const service = new GameService(v03Content, v03Policies, [cycle])
    expect(() => service.dispatch({ type: 'run.start', route: 'human', seed: 'atomic-process-cycle' })).toThrow(ProcessCycleError)
    expect(service.state).toEqual(createInitialGameState(v03Content.manifest.contentVersion))
    expect(service.eventLog).toEqual([])
  })
})
