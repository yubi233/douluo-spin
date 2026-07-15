import type { WheelOption } from './types'

export const BEAST_MARTIAL_SOUL_CATEGORY_POOL = '兽武魂分类'
export const BEAST_MARTIAL_SOUL_POOL_PREFIX = '兽武魂：'
export const TOOL_MARTIAL_SOUL_CATEGORY_POOL = '器武魂分类'
export const TOOL_MARTIAL_SOUL_POOL_PREFIX = '器武魂：'

export const BEAST_MARTIAL_SOUL_CATEGORIES = [
  '龙族',
  '亚龙族',
  '猫科',
  '犬狼狐',
  '鸟禽飞行',
  '爬行水生',
  '虫蛛节肢',
  '熊猿猴',
  '蹄角大型兽',
  '小型奇兽',
  '其他奇兽',
] as const

export type BeastMartialSoulCategory = typeof BEAST_MARTIAL_SOUL_CATEGORIES[number]

export const TOOL_MARTIAL_SOUL_CATEGORIES = [
  '剑类',
  '刀镰类',
  '枪矛戟类',
  '斧类',
  '锤类',
  '棍棒类',
  '匕首短兵',
  '弓弩类',
  '拳套类',
  '盾甲防具',
  '塔鼎容器',
  '杖书法器',
  '乐器扇具',
  '披风锁链',
  '神话奇物',
] as const

export type ToolMartialSoulCategory = typeof TOOL_MARTIAL_SOUL_CATEGORIES[number]

export function beastMartialSoulPoolName(category: string) {
  return `${BEAST_MARTIAL_SOUL_POOL_PREFIX}${category}`
}

export function toolMartialSoulPoolName(category: string) {
  return `${TOOL_MARTIAL_SOUL_POOL_PREFIX}${category}`
}

export function classifyBeastMartialSoul(option: WheelOption): BeastMartialSoulCategory {
  const name = option.name
  if (/地龙|霸王龙|迅猛龙|翼龙|蛇颈龙|剑龙|甲龙|白甲地龙|山龙王/.test(name)) return '亚龙族'
  if (/龙|青龙/.test(name)) return '龙族'
  if (/虎|狮|豹|猫/.test(name)) return '猫科'
  if (/狼|狐|獒/.test(name)) return '犬狼狐'
  if (/凤凰|燕|天鹅|翼龙|狮鹫/.test(name)) return '鸟禽飞行'
  if (/蛇|龟|玄武|鳄|蛇颈龙|甲龙/.test(name)) return '爬行水生'
  if (/蚁|蝎|蚕|蛛|蜘蛛/.test(name)) return '虫蛛节肢'
  if (/熊|猩猩|猴|猿/.test(name)) return '熊猿猴'
  if (/犀|猛犸|牛|马|猪|鹿/.test(name)) return '蹄角大型兽'
  if (/兔|蟾/.test(name)) return '小型奇兽'
  return '其他奇兽'
}

export function classifyToolMartialSoul(option: WheelOption): ToolMartialSoulCategory {
  const name = option.name
  if (/剑/.test(name)) return '剑类'
  if (/刀|镰|斩月/.test(name)) return '刀镰类'
  if (/枪|矛|画戟/.test(name)) return '枪矛戟类'
  if (/斧/.test(name)) return '斧类'
  if (/锤/.test(name)) return '锤类'
  if (/棍|棒/.test(name)) return '棍棒类'
  if (/匕|冰针/.test(name)) return '匕首短兵'
  if (/弓|弩/.test(name)) return '弓弩类'
  if (/拳套/.test(name)) return '拳套类'
  if (/盾|甲/.test(name)) return '盾甲防具'
  if (/塔|鼎|瓶|琉璃塔|镇妖塔/.test(name)) return '塔鼎容器'
  if (/杖|笔记/.test(name)) return '杖书法器'
  if (/笛|萧|扇/.test(name)) return '乐器扇具'
  if (/披风|锁/.test(name)) return '披风锁链'
  return '神话奇物'
}
