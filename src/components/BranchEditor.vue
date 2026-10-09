<template>
  <BaseModal :visible="visible" :title="branch ? '编辑分支' : '添加分支'" size="branch" @close="$emit('close')">
    <div class="ec-field"><label for="ec-branch-name">分支名称 <b>*</b></label><input id="ec-branch-name" v-model.trim="form.name" maxlength="50" placeholder="例如：温度预警" /></div>
    <div class="ec-branch-condition-title"><label>判断条件</label><button type="button" class="ec-link" @click="addCondition">＋ 添加条件</button></div>
    <div class="ec-branch-condition-list"><div v-for="(condition, index) in form.conditions" :key="index" class="ec-condition-editor">
      <span class="ec-condition-index">{{ index + 1 }}</span>
      <div class="ec-condition-field-cell"><input v-model.trim="condition.field" aria-label="事件字段" autocomplete="off" placeholder="事件字段，如 temperature" @focus="activeFieldIndex = index" @blur="closeFieldPopup" /><div v-if="activeFieldIndex === index" class="ec-condition-field-popup"><div class="ec-condition-field-popup__head">选择事件数据字段</div><div class="ec-condition-field-popup__list"><button v-for="field in matchingFields(condition.field)" :key="field" type="button" @mousedown.prevent="condition.field = field; activeFieldIndex = -1"><strong>{{ field }}</strong><span :class="{ 'is-number': fieldType(field) === 'Number' }">{{ fieldType(field) }}</span></button><p v-if="!matchingFields(condition.field).length">无匹配字段，可继续手动输入</p></div></div></div>
      <select v-model="condition.operator" aria-label="比较方式"><option v-for="option in operators" :key="option.value" :value="option.value">{{ option.label }}</option></select>
      <input v-model.trim="condition.value" aria-label="比较值" placeholder="比较值" />
      <button type="button" class="ec-icon-button" aria-label="移除条件" :disabled="form.conditions.length === 1" @click="form.conditions.splice(index, 1)">×</button>
    </div></div>
    <p class="ec-branch-form-note">按事件数据字段判断，例如 voltage 大于 250。</p>
    <div v-if="form.conditions.length > 1" class="ec-field ec-branch-logic"><label for="ec-branch-logic">多条件关系</label><select id="ec-branch-logic" v-model="form.logic"><option value="all">同时满足（且）</option><option value="any">满足任一（或）</option></select></div>
    <div class="ec-branch-preview">条件预览：{{ conditionPreview || '填写字段和比较值后显示' }}</div>
    <p v-if="error" class="ec-form-error" role="alert">{{ error }}</p>
    <template #footer><span class="ec-modal__note">保存后可继续配置该分支的执行动作</span><div class="ec-modal__footer-actions"><button type="button" class="ec-button" @click="$emit('close')">取消</button><button type="button" class="ec-button ec-button--primary" @click="save">保存分支</button></div></template>
  </BaseModal>
</template>

<script>
import BaseModal from './BaseModal.vue';
import { clone } from '../domain/model.mjs';

const blankCondition = () => ({ field: '', operator: 'eq', value: '' });
export default {
  name: 'BranchEditor',
  components: { BaseModal },
  props: { visible: Boolean, branch: { type: Object, default: null }, fieldSuggestions: { type: Array, default: () => [] } },
  data() { return { form: { id: '', name: '', isDefault: false, logic: 'all', conditions: [blankCondition()], actions: [] }, error: '', activeFieldIndex: -1, operators: [{ value: 'eq', label: '等于' }, { value: 'ne', label: '不等于' }, { value: 'gt', label: '大于' }, { value: 'gte', label: '大于等于' }, { value: 'lt', label: '小于' }, { value: 'lte', label: '小于等于' }, { value: 'contains', label: '包含' }, { value: 'in', label: '属于' }] }; },
  watch: { visible(value) { if (value) this.reset(); } },
  computed: {
    conditionPreview() {
      return this.form.conditions.filter(item => item.field && String(item.value).trim() !== '').map(item => `${item.field} ${this.operators.find(option => option.value === item.operator)?.label || item.operator} ${item.value}`).join(this.form.logic === 'any' ? ' 或 ' : ' 且 ');
    },
  },
  methods: {
    reset() {
      this.form = this.branch ? clone(this.branch) : { id: `branch-${Date.now()}`, name: '', isDefault: false, logic: 'all', conditions: [blankCondition()], actions: [] };
      if (!this.form.conditions.length) this.form.conditions = [blankCondition()];
      this.error = '';
      this.activeFieldIndex = -1;
    },
    matchingFields(query) { const text = String(query || '').toLowerCase(); return this.fieldSuggestions.filter(field => !text || field.toLowerCase().includes(text)); },
    fieldType(field) { return /temperature|voltage|vibration|amount|pressure/i.test(field) ? 'Number' : 'String'; },
    closeFieldPopup() { setTimeout(() => { this.activeFieldIndex = -1; }, 100); },
    addCondition() { this.form.conditions.push(blankCondition()); },
    save() {
      if (!this.form.name) { this.error = '请输入分支名称'; return; }
      if (this.form.conditions.some(item => !item.field || String(item.value).trim() === '')) { this.error = '请完善每条判断条件'; return; }
      this.$emit('save', clone(this.form));
    },
  },
};
</script>
