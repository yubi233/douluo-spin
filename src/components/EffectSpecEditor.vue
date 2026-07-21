<script setup lang="ts">
import { entityTypes, statIds, type EditorCatalog } from '@/application/editorCatalog'
import type { EffectSpec, EntityType } from '@/core/model/contracts'
import NumberExpressionEditor from './NumberExpressionEditor.vue'

const props = defineProps<{ modelValue: EffectSpec; catalog: EditorCatalog }>()
const emit = defineEmits<{ 'update:modelValue': [value: EffectSpec] }>()

function firstEntity(type: EntityType) { return props.catalog.entities.find((entity) => entity.type === type)?.id ?? 'entity.missing' }
function entitiesFor(type: EntityType) { return props.catalog.entities.filter((entity) => entity.type === type) }
function create(type: EffectSpec['type']): EffectSpec {
  if (type === 'stat.change') return { type, stat: 'level', delta: { type: 'constant', value: 1 } }
  if (type === 'time.advance') return { type, years: { type: 'constant', value: 1 } }
  if (type === 'entity.grant' || type === 'entity.revoke') return { type, entityType: 'trait', entityId: firstEntity('trait') as never }
  if (type === 'signal.emit') return { type, signalId: (props.catalog.signals[0] ?? 'signal.missing') as never }
  return { type: 'run.finish', endingId: (props.catalog.endings[0]?.id ?? 'ending.missing') as never }
}
function replaceType(event: Event) { emit('update:modelValue', create((event.target as HTMLSelectElement).value as EffectSpec['type'])) }
function updateEntityType(value: string) {
  if (props.modelValue.type !== 'entity.grant' && props.modelValue.type !== 'entity.revoke') return
  const entityType = value as EntityType
  emit('update:modelValue', { ...props.modelValue, entityType, entityId: firstEntity(entityType) as never })
}
</script>

<template>
  <div class="effect-editor">
    <label><span>Effect</span><select :value="modelValue.type" @change="replaceType"><option value="stat.change">修改属性</option><option value="entity.grant">授予实体</option><option value="entity.revoke">移除实体</option><option value="time.advance">推进时间</option><option value="signal.emit">发送信号</option><option value="run.finish">结束模拟</option></select></label>
    <template v-if="modelValue.type === 'stat.change'">
      <label><span>属性</span><select :value="modelValue.stat" @change="emit('update:modelValue', { ...modelValue, stat: ($event.target as HTMLSelectElement).value as never })"><option v-for="stat in statIds" :key="stat" :value="stat">{{ stat }}</option></select></label>
      <NumberExpressionEditor :model-value="modelValue.delta" :catalog="catalog" @update:model-value="emit('update:modelValue', { ...modelValue, delta: $event })" />
    </template>
    <template v-else-if="modelValue.type === 'time.advance'">
      <NumberExpressionEditor :model-value="modelValue.years" :catalog="catalog" @update:model-value="emit('update:modelValue', { ...modelValue, years: $event })" />
    </template>
    <template v-else-if="modelValue.type === 'entity.grant' || modelValue.type === 'entity.revoke'">
      <label><span>实体类型</span><select :value="modelValue.entityType" @change="updateEntityType(($event.target as HTMLSelectElement).value)"><option v-for="type in entityTypes" :key="type" :value="type">{{ type }}</option></select></label>
      <label><span>实体</span><select :value="modelValue.entityId" @change="emit('update:modelValue', { ...modelValue, entityId: ($event.target as HTMLSelectElement).value as never })"><option v-for="entity in entitiesFor(modelValue.entityType)" :key="entity.id" :value="entity.id">{{ entity.title }} · {{ entity.id }}</option></select></label>
    </template>
    <label v-else-if="modelValue.type === 'signal.emit'"><span>Signal</span><select :value="modelValue.signalId" @change="emit('update:modelValue', { type: 'signal.emit', signalId: ($event.target as HTMLSelectElement).value as never })"><option v-for="signal in catalog.signals" :key="signal" :value="signal">{{ signal }}</option></select></label>
    <label v-else><span>结局</span><select :value="modelValue.endingId" @change="emit('update:modelValue', { type: 'run.finish', endingId: ($event.target as HTMLSelectElement).value as never })"><option v-for="ending in catalog.endings" :key="ending.id" :value="ending.id">{{ ending.title }} · {{ ending.id }}</option></select></label>
  </div>
</template>
