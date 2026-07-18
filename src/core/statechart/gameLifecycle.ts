import { setup, type StateValue } from 'xstate'
import type { GameCommand, GamePhase, Route } from '../model/contracts'

type LifecycleEvent =
  | { type: 'RUN_START'; route: Route }
  | { type: 'TURN_SPIN' }
  | { type: 'TURN_UNDO' }
  | { type: 'RUN_FINISH' }
  | { type: 'RUN_RESET' }

export const gameLifecycleMachine = setup({
  types: {
    context: {} as Record<string, never>,
    events: {} as LifecycleEvent,
  },
  guards: {
    startsHuman: ({ event }) => event.type === 'RUN_START' && event.route === 'human',
    startsBeast: ({ event }) => event.type === 'RUN_START' && event.route === 'beast',
    startsTransformed: ({ event }) => event.type === 'RUN_START' && event.route === 'transformed',
  },
}).createMachine({
  id: 'game-lifecycle',
  context: {},
  initial: 'idle',
  states: {
    idle: {
      on: {
        RUN_START: [
          { guard: 'startsHuman', target: 'running.setup.human' },
          { guard: 'startsBeast', target: 'running.setup.beast' },
          { guard: 'startsTransformed', target: 'running.setup.transformed' },
        ],
        RUN_RESET: { target: 'idle' },
      },
    },
    running: {
      initial: 'setup',
      on: {
        RUN_FINISH: { target: 'ended' },
        RUN_RESET: { target: 'idle' },
        TURN_UNDO: {},
      },
      states: {
        setup: {
          initial: 'human',
          states: {
            human: { on: { TURN_SPIN: {} } },
            beast: { on: { TURN_SPIN: {} } },
            transformed: { on: { TURN_SPIN: {} } },
          },
        },
        adventure: {
          initial: 'human',
          states: {
            human: { on: { TURN_SPIN: {} } },
            beast: { on: { TURN_SPIN: {} } },
            transformed: { on: { TURN_SPIN: {} } },
          },
        },
        godTrial: { on: { TURN_SPIN: {} } },
      },
    },
    ended: {
      on: {
        TURN_UNDO: {},
        RUN_RESET: { target: 'idle' },
        RUN_START: [
          { guard: 'startsHuman', target: 'running.setup.human' },
          { guard: 'startsBeast', target: 'running.setup.beast' },
          { guard: 'startsTransformed', target: 'running.setup.transformed' },
        ],
      },
    },
  },
})

const values: Record<GamePhase, StateValue> = {
  idle: 'idle',
  'setup.human': { running: { setup: 'human' } },
  'setup.beast': { running: { setup: 'beast' } },
  'setup.transformed': { running: { setup: 'transformed' } },
  'adventure.human': { running: { adventure: 'human' } },
  'adventure.beast': { running: { adventure: 'beast' } },
  'adventure.transformed': { running: { adventure: 'transformed' } },
  'god-trial': { running: 'godTrial' },
  ended: 'ended',
}

function lifecycleEvent(command: GameCommand, resolvedRoute?: Route): LifecycleEvent {
  switch (command.type) {
    case 'run.start':
      return { type: 'RUN_START', route: resolvedRoute ?? (command.route === 'random' ? 'human' : command.route) }
    case 'turn.spin': return { type: 'TURN_SPIN' }
    case 'turn.undo': return { type: 'TURN_UNDO' }
    case 'run.finish': return { type: 'RUN_FINISH' }
    case 'run.reset': return { type: 'RUN_RESET' }
  }
}

export function canExecuteCommand(phase: GamePhase, command: GameCommand, resolvedRoute?: Route): boolean {
  const snapshot = gameLifecycleMachine.resolveState({ value: values[phase]!, context: {} })
  return gameLifecycleMachine.getTransitionData(snapshot, lifecycleEvent(command, resolvedRoute)).length > 0
}
