<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import { collectionFacts, numericFacts, scalarFacts, type EditorCatalog } from '@/application/editorCatalog'
import type { CollectionFactKey, CompareOperator, FactKey, Predicate, Scalar } from '@/core/model/contracts'

const props = defineProps<{ modelValue: Predicate; catalog: EditorCatalog; depth?: number }>()
const emit = defineEmits<{ 'update:modelValue': [value: Predicate] }>()
const operators: readonly CompareOperator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte']

function firstEntity(fact: CollectionFactKey) {
  const entityType = ({
    'actor.martial-souls': 'martial-soul', 'actor.traits': 'trait', 'actor.domains': 'domain',
    'actor.soul-bones': 'soul-bone', 'actor.beast-types': 'beast-type',
    'actor.beast-species': 'beast-species', 'actor.beast-areas': 'beast-area',
    'actor.beast-bloodlines': 'beast-bloodline', 'story.completed-nodes': 'story-node',
  } as const)[fact]
  return props.catalog.entities.find((entity) => entity.type === entityType)?.id ?? props.catalog.entities[0]?.id ?? 'entity.missing'
}
function entitiesForFact(fact: CollectionFactKey) {
  const entityType = ({
    'actor.martial-souls': 'martial-soul', 'actor.traits': 'trait', 'actor.domains': 'domain',
    'actor.soul-bones': 'soul-bone', 'actor.beast-types': 'beast-type',
    'actor.beast-species': 'beast-species', 'actor.beast-areas': 'beast-area',
    'actor.beast-bloodlines': 'beast-bloodline', 'story.completed-nodes': 'story-node',
  } as const)[fact]
  return props.catalog.entities.filter((entity) => entity.type === entityType)
}

function defaultPredicate(type: Predicate['type']): Predicate {
  if (type === 'all' || type === 'any') return { type, items: [{ type: 'compare', fact: 'actor.level', op: 'gte', value: 1 }] }
  if (type === 'not') return { type, item: { type: 'compare', fact: 'actor.level', op: 'gte', value: 1 } }
  if (type === 'contains') return { type, fact: 'actor.traits', value: firstEntity('actor.traits') as never }
  if (type === 'policy') return { type, policyId: (props.catalog.policies[0] ?? 'policy.identity') as never }
  return { type: 'compare', fact: 'actor.level', op: 'gte', value: 1 }
}

function replaceType(event: Event) { emit('update:modelValue', defaultPredicate((event.target as HTMLSelectElement).value as Predicate['type'])) }
function updateCompare(patch: Partial<Extract<Predicate, { type: 'compare' }>>) {
  if (props.modelValue.type === 'compare') emit('update:modelValue', { ...props.modelValue, ...patch })
}
function updateContains(patch: Partial<Extract<Predicate, { type: 'contains' }>>) {
  if (props.modelValue.type === 'contains') emit('update:modelValue', { ...props.modelValue, ...patch })
}
function updatePolicy(value: string) {
  if (props.modelValue.type === 'policy') emit('update:modelValue', { type: 'policy', policyId: value as never })
}
function updateChild(index: number, value: Predicate) {
  if (props.modelValue.type !== 'all' && props.modelValue.type !== 'any') return
  const items = [...props.modelValue.items]
  items[index] = value
  emit('update:modelValue', { ...props.modelValue, items })
}
function removeChild(index: number) {
  if (props.modelValue.type !== 'all' && props.modelValue.type !== 'any') return
  const items = props.modelValue.items.filter((_, itemIndex) => itemIndex !== index)
  emit('update:modelValue', { ...props.modelValue, items })
}
function addChild() {
  if (props.modelValue.type !== 'all' && props.modelValue.type !== 'any') return
  emit('update:modelValue', { ...props.modelValue, items: [...props.modelValue.items, defaultPredicate('compare')] })
}
function parseScalar(value: string, fact: FactKey): Scalar {
  if (numericFacts.includes(fact as never)) return Number(value)
  if (fact === 'actor.alive' || fact === 'god-trial.active') return value === 'true'
  return value
}
function updateCompareFact(value: string) {
  const fact = value as FactKey
  const current = props.modelValue.type === 'compare' ? props.modelValue.value : null
  const nextValue = numericFacts.includes(fact as never) ? Number(current) || 0 : fact === 'actor.alive' || fact === 'god-trial.active' ? Boolean(current) : String(current ?? '')
  updateCompare({ fact, value: nextValue })
}
function updateContainsFact(value: string) {
  const fact = value as CollectionFactKey
  updateContains({ fact, value: firstEntity(fact) as never })
}
</script>

<template>
  <div class="predicate-editor" :data-depth="depth ?? 0">
    <label><span>条件类型</span><select :value="modelValue.type" @change="replaceType"><option value="compare">比较</option><option value="contains">包含实体</option><option value="all">全部满足</option><option value="any">任一满足</option><option value="not">取反</option><option value="policy">注册规则</option></select></label>
    <template v-if="modelValue.type === 'compare'">
      <label><span>Fact</span><select :value="modelValue.fact" @change="updateCompareFact(($event.target as HTMLSelectElement).value)"><option v-for="fact in scalarFacts" :key="fact" :value="fact">{{ fact }}</option></select></label>
      <label><span>运算</span><select :value="modelValue.op" @change="updateCompare({ op: ($event.target as HTMLSelectElement).value as CompareOperator })"><option v-for="operator in operators" :key="operator" :value="operator">{{ operator }}</option></select></label>
      <label v-if="modelValue.fact === 'actor.alive' || modelValue.fact === 'god-trial.active'"><span>值</span><select :value="String(modelValue.value)" @change="updateCompare({ value: ($event.target as HTMLSelectElement).value === 'true' })"><option value="true">true</option><option value="false">false</option></select></label>
      <label v-else><span>值</span><input :type="numericFacts.includes(modelValue.fact as never) ? 'number' : 'text'" :value="String(modelValue.value ?? '')" @input="updateCompare({ value: parseScalar(($event.target as HTMLInputElement).value, modelValue.fact) })" /></label>
    </template>
    <template v-else-if="modelValue.type === 'contains'">
      <label><span>集合 Fact</span><select :value="modelValue.fact" @change="updateContainsFact(($event.target as HTMLSelectElement).value)"><option v-for="fact in collectionFacts" :key="fact" :value="fact">{{ fact }}</option></select></label>
      <label><span>实体</span><select :value="modelValue.value" @change="updateContains({ value: ($event.target as HTMLSelectElement).value as never })"><option v-for="entity in entitiesForFact(modelValue.fact)" :key="entity.id" :value="entity.id">{{ entity.title }} · {{ entity.id }}</option></select></label>
    </template>
    <template v-else-if="modelValue.type === 'policy'">
      <label><span>Policy</span><select :value="modelValue.policyId" @change="updatePolicy(($event.target as HTMLSelectElement).value)"><option v-for="policy in catalog.policies" :key="policy" :value="policy">{{ policy }}</option></select></label>
    </template>
    <template v-else-if="modelValue.type === 'not'">
      <PredicateEditor :model-value="modelValue.item" :catalog="catalog" :depth="(depth ?? 0) + 1" @update:model-value="emit('update:modelValue', { type: 'not', item: $event })" />
    </template>
    <template v-else>
      <div v-for="(item, index) in modelValue.items" :key="index" class="predicate-child">
        <PredicateEditor :model-value="item" :catalog="catalog" :depth="(depth ?? 0) + 1" @update:model-value="updateChild(index, $event)" />
        <button class="icon-button danger" type="button" title="移除子条件" aria-label="移除子条件" :disabled="modelValue.items.length === 1" @click="removeChild(index)"><Trash2 :size="15" /></button>
      </div>
      <button class="button compact" type="button" @click="addChild"><Plus :size="15" />增加子条件</button>
    </template>
  </div>
</template>
