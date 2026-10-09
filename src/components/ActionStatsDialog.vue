<template>
  <BaseModal :visible="visible" title="执行动作统计" size="wide" variant="stats" @close="$emit('close')">
    <div class="ec-stats-head">
      <label class="ec-stats-version"><span>切换版本</span><select :value="version" @change="$emit('version-change', $event.target.value)"><option value="">全部版本</option><option v-for="item in event.versions" :key="item.version" :value="item.version">{{ item.version }}{{ event.currentVersion === item.version ? ' · 当前处理版本' : '' }}</option></select></label>
      <div class="ec-stats-total"><span>触发次数</span><strong>{{ stats ? Number(stats.triggerCount || 0).toLocaleString('zh-CN') : '—' }}</strong></div>
    </div>
    <div class="ec-stats-scroll"><table class="ec-table ec-stats-grid"><thead><tr><th>版本</th><th>命中分支</th><th>动作类型</th><th>动作名称</th><th>成功次数</th><th>异常次数</th></tr></thead><tbody><tr v-if="loading"><td colspan="6" class="ec-table-empty">正在统计…</td></tr><tr v-else-if="!stats || !stats.rows.length"><td colspan="6" class="ec-table-empty">当前版本尚无执行动作统计</td></tr><tr v-for="(row, index) in stats && stats.rows || []" :key="index"><td><span class="ec-version-pill">{{ row.version }}</span></td><td>{{ row.branch }}</td><td>{{ kindName(row.kind) }}</td><td>{{ row.name }}</td><td class="ec-stats-success">{{ row.success }}</td><td class="ec-stats-failure">{{ row.failure }}</td></tr></tbody></table></div>
    <p class="ec-stats-note">触发次数按事件计数；未启用处理期间、历史未执行和未配置执行动作的记录不计入动作次数。一个事件可触发多个动作，各动作次数不相加；模拟测试不计入。</p>
    <p v-if="error" class="ec-form-error" role="alert">{{ error }}</p>
    <template #footer><button type="button" class="ec-button ec-button--small" @click="$emit('close')">关闭</button></template>
  </BaseModal>
</template>

<script>
import BaseModal from './BaseModal.vue';

export default {
  name: 'ActionStatsDialog',
  components: { BaseModal },
  props: { visible: Boolean, event: { type: Object, required: true }, stats: { type: Object, default: null }, version: { type: String, default: '' }, loading: Boolean, error: { type: String, default: '' } },
  methods: { kindName(value) { return { tool: '工具', workflow: '工作流', agent: '智能体', expert: '专家' }[value] || value; } },
};
</script>
