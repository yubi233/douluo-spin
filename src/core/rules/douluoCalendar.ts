export const TANG_SAN_BIRTH_YEAR = 2631
export const TANG_SAN_AWAKENING_AGE = 6
export const TANG_SAN_AWAKENING_YEAR = 2637

export interface DouluoCalendarMilestone {
  readonly tangAge: number
  readonly title: string
}

export const DOULUO_CALENDAR_MILESTONES: readonly DouluoCalendarMilestone[] = [
  { tangAge: 0, title: '唐三出生' },
  { tangAge: TANG_SAN_AWAKENING_AGE, title: '武魂觉醒与诺丁学院时期' },
  { tangAge: 12, title: '史莱克入学时期' },
  { tangAge: 14, title: '全大陆高级魂师学院精英大赛时期' },
  { tangAge: 19, title: '史莱克七怪重聚时期' },
  { tangAge: 20, title: '天斗宫变时期' },
  { tangAge: 21, title: '海神岛历练时期' },
  { tangAge: 24, title: '大陆决战前夕' },
  { tangAge: 24.5, title: '第一次嘉陵关大战' },
  { tangAge: 24.8, title: '第二次嘉陵关大战' },
  { tangAge: 25, title: '双神之战与战争终局' },
]

export function douluoYearAtTangAge(tangAge: number): number {
  return TANG_SAN_BIRTH_YEAR + tangAge
}

export function douluoMilestoneAtTangAge(tangAge: number): DouluoCalendarMilestone | null {
  return DOULUO_CALENDAR_MILESTONES.find((milestone) => Math.abs(milestone.tangAge - tangAge) < 0.001) ?? null
}

export function formatDouluoDate(tangAge: number): string {
  const year = douluoYearAtTangAge(tangAge)
  const yearLabel = Number.isInteger(year) ? String(year) : year.toFixed(1)
  const age = Number.isInteger(tangAge) ? String(tangAge) : tangAge.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  if (tangAge < 0) return `斗罗历${yearLabel}年 · 唐三出生前${Math.abs(tangAge)}年`
  return `斗罗历${yearLabel}年 · 唐三${age}岁`
}
