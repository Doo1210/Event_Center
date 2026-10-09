<template>
  <BaseModal :visible="visible" :title="readonly ? '查看执行动作配置' : (action ? '编辑执行动作' : '添加执行动作')" :size="action ? 'action-edit' : 'action-create'" @close="$emit('close')">
    <div class="ec-action-editor" :class="{ 'is-edit': !!action }">
      <div v-if="!action" class="ec-action-picker">
        <div class="ec-kind-tabs" role="tablist" aria-label="动作类型"><button v-for="item in kinds" :key="item.value" type="button" :class="{ 'is-active': form.kind === item.value }" :disabled="readonly" @click="selectKind(item.value)">{{ item.label }}</button></div>
        <input v-model.trim="search" class="ec-resource-search" type="search" :placeholder="`搜索${kindLabel}`" />
        <div class="ec-resource-list">
          <template v-if="form.kind === 'tool'"><div v-for="group in filteredToolGroups" :key="group.id" class="ec-tool-group"><button type="button" class="ec-tool-parent" :class="{ 'is-active': group.resources.some(item => item.id === form.resourceId), 'is-expanded': expandedToolId === group.id }" :aria-expanded="String(expandedToolId === group.id)" @click="expandedToolId = expandedToolId === group.id ? '' : group.id"><span class="ec-resource-icon ec-resource-icon--tool">工</span><span class="ec-resource-copy"><strong>{{ group.name }}</strong><small>{{ group.description }}</small></span><span class="ec-tool-type">{{ group.kind }} · {{ group.resources.length }}</span><span class="ec-tool-chevron">›</span></button><div v-if="expandedToolId === group.id || search" class="ec-tool-operations"><button v-for="resource in group.resources" :key="resource.id" type="button" class="ec-tool-operation" :class="{ 'is-active': form.resourceId === resource.id }" @click="selectResource(resource)"><span class="ec-tool-operation__dot" /><span class="ec-resource-copy"><strong>{{ resource.name }}</strong><small>{{ resource.detail }}</small></span></button></div></div></template>
          <template v-else><button v-for="resource in filteredResources" :key="resource.id" type="button" :class="{ 'is-active': form.resourceId === resource.id }" @click="selectResource(resource)"><span class="ec-resource-icon" :class="`ec-resource-icon--${resource.kind}`">{{ kindLabel.slice(0, 1) }}</span><span class="ec-resource-copy"><strong>{{ resource.name }}</strong><small>{{ resource.detail }}</small></span></button></template>
          <p v-if="form.kind === 'tool' ? !filteredToolGroups.length : !filteredResources.length" class="ec-help">没有找到匹配的资源</p>
        </div>
      </div>
      <div class="ec-action-config">
        <template v-if="selectedResource">
          <div class="ec-action-config__head"><strong>{{ selectedResource.groupName || `${selectedResource.name} · ${kindLabel}` }}</strong><small>{{ selectedResource.groupDescription || selectedResource.detail }}</small></div>
          <div v-if="selectedResource.groupName" class="ec-action-operation-head"><strong>{{ selectedResource.name }}</strong><small>{{ selectedResource.detail }}</small></div>
          <div v-if="form.kind === 'agent' || form.kind === 'expert'" class="ec-action-prompt"><div class="ec-action-prompt__head"><label for="ec-action-prompt">指令 <b>*</b></label><button v-if="!readonly" type="button" class="ec-link" @click="showPromptFields = !showPromptFields">＋ 插入事件数据字段</button></div><div v-if="showPromptFields" class="ec-prompt-fields"><button v-for="field in eventFields" :key="field" type="button" @click="insertPromptField(field)">{{ field }}</button></div><textarea id="ec-action-prompt" ref="promptInput" v-model="form.prompt" rows="8" :readonly="readonly" :placeholder="selectedResource.promptExample || '请输入指令，例如：请分析设备 {{device_id}} 的状态。'" /><small v-if="!readonly">输入 <code v-text="'{{'"></code> 可引用事件数据字段，也可手动填写字段名。</small></div>
          <template v-else-if="selectedResource.params.length"><div class="ec-action-map-heading"><span>输入参数</span><span>类型</span><span>映射方式</span><span>参数值</span></div><div class="ec-action-map-body"><div v-for="param in selectedResource.params" :key="param.key" class="ec-param-row"><label>{{ param.label }} <b v-if="param.required">*</b><small>{{ param.key }}</small></label><span class="ec-param-type">{{ param.type || 'String' }}</span><select :value="mapping(param.key).mode" :disabled="readonly" @change="setMappingMode(param.key, $event.target.value)"><option value="event">事件字段</option><option value="fixed">自定义值</option></select><input :value="mapping(param.key).value" :readonly="readonly" :list="mapping(param.key).mode === 'event' ? 'ec-mapping-fields' : null" :placeholder="mapping(param.key).mode === 'event' ? '例如 device_id' : '输入固定值'" @input="setMappingValue(param.key, $event.target.value)" /></div><datalist id="ec-mapping-fields"><option v-for="field in eventFields" :key="field" :value="field" /></datalist><p v-if="!readonly" class="ec-action-map-hint">事件字段可从建议中选择，也可手动输入字段路径。</p></div></template>
          <p v-else class="ec-help">此动作无需配置输入参数。</p>
        </template>
        <div v-else class="ec-action-empty">从左侧选择一个执行动作，配置后加入处理流程。</div>
      </div>
    </div>
    <p v-if="error" class="ec-form-error" role="alert">{{ error }}</p>
    <template #footer><span></span><div class="ec-modal__footer-actions"><button type="button" class="ec-button" @click="$emit('close')">{{ readonly ? '关闭' : '取消' }}</button><button v-if="!readonly" type="button" class="ec-button ec-button--primary" :disabled="!selectedResource" @click="save">{{ action ? '保存动作' : '添加执行动作' }}</button></div></template>
  </BaseModal>
</template>

<script>
import BaseModal from './BaseModal.vue';
import { clone } from '../domain/model.mjs';

export default {
  name: 'ActionEditor',
  components: { BaseModal },
  props: { visible: Boolean, action: { type: Object, default: null }, resources: { type: Array, default: () => [] }, readonly: Boolean },
  data() { return { kinds: [{ value: 'tool', label: '工具' }, { value: 'workflow', label: '工作流' }, { value: 'agent', label: '智能体' }, { value: 'expert', label: '专家' }], form: { id: '', kind: 'tool', resourceId: '', name: '', params: {}, prompt: '' }, search: '', expandedToolId: '', showPromptFields: false, eventFields: ['event_id', 'device_id', 'voltage', 'temperature', 'vibration', 'status', 'location', 'timestamp', 'payload.device_id', 'payload.voltage', 'payload.status'], error: '' }; },
  computed: {
    kindLabel() { const kind = this.kinds.find(item => item.value === this.form.kind); return kind ? kind.label : '动作'; },
    filteredResources() { const text = this.search.toLowerCase(); return this.resources.filter(item => item.kind === this.form.kind && (!text || `${item.name} ${item.detail}`.toLowerCase().includes(text))); },
    filteredToolGroups() {
      const text = this.search.toLowerCase();
      const groups = new Map();
      this.resources.filter(item => item.kind === 'tool').forEach(item => {
        const id = item.groupId || 'other-tools';
        if (!groups.has(id)) groups.set(id, { id, name: item.groupName || '其他工具', description: item.groupDescription || '', kind: item.groupKind || '工具', resources: [] });
        groups.get(id).resources.push(item);
      });
      return [...groups.values()].map(group => ({ ...group, resources: text && !`${group.name} ${group.description}`.toLowerCase().includes(text) ? group.resources.filter(item => `${item.name} ${item.detail}`.toLowerCase().includes(text)) : group.resources })).filter(group => group.resources.length);
    },
    selectedResource() { return this.resources.find(item => item.id === this.form.resourceId) || (this.action ? { id: this.action.resourceId, kind: this.action.kind, name: this.action.name, detail: '资源已不在当前目录中，保留已保存的参数配置供查看。', params: Object.keys(this.action.params || {}).map(key => ({ key, label: key, required: false })) } : null); },
  },
  watch: { visible(value) { if (value) this.reset(); } },
  methods: {
    reset() { this.form = this.action ? clone(this.action) : { id: `action-${Date.now()}`, kind: 'tool', resourceId: '', name: '', params: {}, prompt: '' }; this.search = ''; this.expandedToolId = this.action ? this.resources.find(item => item.id === this.action.resourceId)?.groupId || '' : ''; this.showPromptFields = false; this.error = ''; },
    selectKind(kind) { this.form.kind = kind; this.form.resourceId = ''; this.form.name = ''; this.form.params = {}; this.form.prompt = ''; this.search = ''; this.expandedToolId = ''; this.showPromptFields = false; },
    selectResource(resource) { this.form.resourceId = resource.id; this.form.name = resource.groupName ? `${resource.groupName} / ${resource.name}` : resource.name; this.form.params = {}; (resource.params || []).forEach(param => this.$set(this.form.params, param.key, { mode: 'event', value: '' })); },
    insertPromptField(field) { const input = this.$refs.promptInput; const start = input?.selectionStart ?? this.form.prompt.length; const end = input?.selectionEnd ?? start; const insert = `{{${field}}}`; this.form.prompt = `${this.form.prompt.slice(0, start)}${insert}${this.form.prompt.slice(end)}`; this.showPromptFields = false; this.$nextTick(() => { input?.focus(); input?.setSelectionRange(start + insert.length, start + insert.length); }); },
    mapping(key) { return this.form.params[key] || { mode: 'event', value: '' }; },
    setMappingMode(key, mode) { if (!this.readonly) this.$set(this.form.params, key, { mode, value: this.mapping(key).value }); },
    setMappingValue(key, value) { if (!this.readonly) this.$set(this.form.params, key, { mode: this.mapping(key).mode, value }); },
    save() {
      const resource = this.selectedResource;
      if (!resource) { this.error = '请选择执行动作'; return; }
      if ((this.form.kind === 'agent' || this.form.kind === 'expert') && !this.form.prompt.trim()) { this.error = '请输入指令'; return; }
      for (const param of resource.params || []) {
        if (param.required && !String(this.mapping(param.key).value || '').trim()) { this.error = `请填写${param.label}`; return; }
      }
      this.$emit('save', clone(this.form));
    },
  },
};
</script>
