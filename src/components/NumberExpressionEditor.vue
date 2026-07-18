<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import { numericFacts, type EditorCatalog } from '@/application/editorCatalog'
import type { NumberExpression } from '@/core/model/contracts'

const props = defineProps<{ modelValue: NumberExpression; catalog: EditorCatalog; depth?: number }>()
const emit = defineEmits<{ 'update:modelValue': [value: NumberExpression] }>()

function create(type: NumberExpression['type']): NumberExpression {
  if (type === 'constant') return { type, value: 1 }
  if (type === 'fact') return { type, fact: 'actor.level' }
  if (type === 'policy') return { type, policyId: (props.catalog.policies[0] ?? 'policy.identity') as never }
  if (type === 'clamp') return { type, value: { type: 'constant', value: 1 }, min: 0, max: 100 }
  return { type, items: [{ type: 'constant', value: 1 }] }
}
function replaceType(event: Event) { emit('update:modelValue', create((event.target as HTMLSelectElement).value as NumberExpression['type'])) }
function updateItem(index: number, value: NumberExpression) {
  if (!('items' in props.modelValue)) return
  const items = [...props.modelValue.items]
  items[index] = value
  emit('update:modelValue', { ...props.modelValue, items })
}
function removeItem(index: number) {
  if (!('items' in props.modelValue)) return
  emit('update:modelValue', { ...props.modelValue, items: props.modelValue.items.filter((_, itemIndex) => itemIndex !== index) })
}
function addItem() {
  if (!('items' in props.modelValue)) return
  emit('update:modelValue', { ...props.modelValue, items: [...props.modelValue.items, { type: 'constant', value: 1 }] })
}
</script>

<template>
  <div class="expression-editor" :data-depth="depth ?? 0">
    <label><span>数值类型</span><select :value="modelValue.type" @change="replaceType"><option value="constant">常量</option><option value="fact">Fact</option><option value="add">相加</option><option value="multiply">相乘</option><option value="min">最小值</option><option value="max">最大值</option><option value="clamp">限制范围</option><option value="policy">注册规则</option></select></label>
    <label v-if="modelValue.type === 'constant'"><span>值</span><input type="number" step="any" :value="modelValue.value" @input="emit('update:modelValue', { type: 'constant', value: Number(($event.target as HTMLInputElement).value) })" /></label>
    <label v-else-if="modelValue.type === 'fact'"><span>Fact</span><select :value="modelValue.fact" @change="emit('update:modelValue', { type: 'fact', fact: ($event.target as HTMLSelectElement).value as never })"><option v-for="fact in numericFacts" :key="fact" :value="fact">{{ fact }}</option></select></label>
    <label v-else-if="modelValue.type === 'policy'"><span>Policy</span><select :value="modelValue.policyId" @change="emit('update:modelValue', { type: 'policy', policyId: ($event.target as HTMLSelectElement).value as never })"><option v-for="policy in catalog.policies" :key="policy" :value="policy">{{ policy }}</option></select></label>
    <template v-else-if="modelValue.type === 'clamp'">
      <label><span>最小值</span><input type="number" step="any" :value="modelValue.min" @input="emit('update:modelValue', { ...modelValue, min: Number(($event.target as HTMLInputElement).value) })" /></label>
      <label><span>最大值</span><input type="number" step="any" :value="modelValue.max" @input="emit('update:modelValue', { ...modelValue, max: Number(($event.target as HTMLInputElement).value) })" /></label>
      <NumberExpressionEditor :model-value="modelValue.value" :catalog="catalog" :depth="(depth ?? 0) + 1" @update:model-value="emit('update:modelValue', { ...modelValue, value: $event })" />
    </template>
    <template v-else>
      <div v-for="(item, index) in modelValue.items" :key="index" class="expression-child">
        <NumberExpressionEditor :model-value="item" :catalog="catalog" :depth="(depth ?? 0) + 1" @update:model-value="updateItem(index, $event)" />
        <button class="icon-button danger" type="button" title="移除数值项" aria-label="移除数值项" :disabled="modelValue.items.length === 1" @click="removeItem(index)"><Trash2 :size="15" /></button>
      </div>
      <button class="button compact" type="button" @click="addItem"><Plus :size="15" />增加数值项</button>
    </template>
  </div>
</template>
