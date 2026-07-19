import { GameService } from '@/application/gameService'
import { v03Content, v03Policies } from '@/content/v03/content'
import { draw } from '@/core/draw/draw'

const route = process.argv[2] === 'beast' ? 'beast' : 'human'
const seed = process.argv[3] ?? 'v03-human-2'
const service = new GameService(v03Content, v03Policies)

service.dispatch({ type: 'run.start', route, seed })
try {
  while (service.state.phase !== 'ended' && service.state.turn < 200) {
    const task = service.state.agenda[0]
    if (!task) break
    const pool = v03Content.mechanics.pools.get(task.poolId)
    if (!pool) throw new Error(`Unknown pool: ${task.poolId}`)
    const candidates = draw(pool, service.state, v03Policies).candidates
    console.log(JSON.stringify({
      turn: service.state.turn + 1,
      task,
      phase: service.state.phase,
      stats: service.state.stats,
      candidates: candidates.map((candidate) => candidate.optionId),
    }))
    service.dispatch({ type: 'turn.spin' })
  }
  console.log(JSON.stringify({ complete: true, state: service.state }))
} catch (error) {
  console.error(JSON.stringify({
    error: error instanceof Error ? { name: error.name, message: error.message } : error,
    state: service.state,
    eventLog: service.eventLog,
  }, null, 2))
  process.exitCode = 1
}
