import { describe, expect, it } from 'vitest'
import { createInitialState, drawActiveTask, machineStates, transition } from '@/domain/machine'
import type { MachineState, RollTask } from '@/domain/types'

function startHuman(seed = 'fixed-seed') {
  const result = transition(createInitialState(), { type: 'START', route: 'human', seed })
  expect(result.accepted).toBe(true)
  return result.state
}

describe('finite state machine', () => {
  it('declares every application state once', () => {
    expect(new Set(machineStates).size).toBe(11)
    expect(machineStates).toContain('rolling')
    expect(machineStates).toContain('godTrial')
    expect(machineStates).toContain('ending')
  })

  it('rejects events that are invalid for the current state', () => {
    const initial = createInitialState()
    const result = transition(initial, {
      type: 'RESOLVE',
      option: { id: 'invalid', name: '不应被处理' },
      probability: 1,
    })
    expect(result.accepted).toBe(false)
    expect(result.state).toBe(initial)
  })

  it('runs a setup task through rolling and back to human setup', () => {
    let state = startHuman()
    expect(state.value).toBe('humanSetup')

    state = transition(state, { type: 'ROLL' }).state
    expect(state.value).toBe('rolling')
    expect(state.context.activeTask?.handler).toBe('gender')

    state = transition(state, {
      type: 'RESOLVE',
      option: { id: 'male', name: '男' },
      probability: 0.5,
    }).state
    expect(state.value).toBe('humanSetup')
    expect(state.context.gender).toBe('男')
    expect(state.context.step).toBe(1)
  })

  it('reproduces a draw when seed and action order are equal', () => {
    const firstRolling = transition(startHuman('repeatable'), { type: 'ROLL' }).state
    const secondRolling = transition(startHuman('repeatable'), { type: 'ROLL' }).state
    const first = drawActiveTask(firstRolling).draw
    const second = drawActiveTask(secondRolling).draw
    expect(first.option.id).toBe(second.option.id)
    expect(first.nextRng).toBe(second.nextRng)
  })

  it('starts every supported entry route without changing the state-machine contract', () => {
    for (const route of ['random', 'human', 'beast'] as const) {
      const result = transition(createInitialState(), { type: 'START', route, seed: `route-${route}` })
      expect(result.accepted).toBe(true)
      expect(['humanSetup', 'beastSetup']).toContain(result.state.value)
      expect(result.state.context.queue.length).toBeGreaterThan(0)
    }
  })

  it('moves lethal outcomes to the ending state', () => {
    const state = startHuman() as MachineState
    const deathTask: RollTask = {
      id: 'death-task',
      tag: '流浪or不参与主线独立剧情',
      pool: '11-20级菜鸟的遭遇剧情（每次经历时间跳跃可抽取该池）',
      handler: 'humanEncounter',
    }
    state.value = 'humanAdventure'
    state.context.queue = [deathTask]
    const rolling = transition(state, { type: 'ROLL' }).state
    const ended = transition(rolling, {
      type: 'RESOLVE',
      option: { id: 'death', name: '执行任务时，你被魂兽击杀' },
      probability: 0.1,
    }).state
    expect(ended.value).toBe('ending')
    expect(ended.context.alive).toBe(false)
    expect(ended.context.queue).toHaveLength(0)
  })

  it('schedules the matching original-story milestone before another time jump', () => {
    const state = startHuman() as MachineState
    state.value = 'humanAdventure'
    state.context.queue = []
    state.context.level = 1
    state.context.age = 20
    state.context.tangAge = 20
    state.context.branch = 1
    state.context.flags = {
      'faction:12': true,
      'faction:18': true,
      slaughter: true,
      'story:1@12': true,
      'story:1@14': true,
      'story:1@19': true,
    }
    const rolling = transition(state, { type: 'ROLL' }).state
    expect(rolling.context.activeTask?.pool).toContain('剧情14:是否参与天斗宫变')
    expect(rolling.context.queue.some((item) => item.pool.includes('剧情15:唐三重建唐门'))).toBe(true)
  })
})
