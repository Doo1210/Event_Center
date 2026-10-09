<template>
  <BaseModal :visible="visible" title="处理流程测试" size="test" @close="$emit('close')">
    <div class="ec-test-grid">
      <section class="ec-test-panel">
        <div class="ec-panel-heading">
          <h3>事件数据</h3>
          <button ref="historyTrigger" type="button" class="ec-link" :aria-expanded="String(showHistory)" @click="showHistory = !showHistory">选择历史事件数据</button>
          <div v-if="showHistory" class="ec-history-picker">
            <strong class="ec-history-picker__title">当前事件：{{ event.name }}</strong>
            <input v-model.trim="historySearch" type="search" placeholder="搜索事件 ID" aria-label="搜索历史事件 ID" />
            <div class="ec-history-picker__list">
              <button v-for="run in filteredHistory" :key="run.id" type="button" @click="selectHistory(run)"><span class="ec-history-picker__row"><strong>{{ run.id }}</strong><time>{{ run.receivedAt }}</time></span><span class="ec-history-picker__summary">{{ historySummary(run.payload) }}</span></button>
              <p v-if="!filteredHistory.length" class="ec-help">{{ history.length ? '未找到匹配的事件' : '暂无可用的历史事件数据' }}</p>
            </div>
          </div>
        </div>
        <textarea v-model="payloadText" spellcheck="false" aria-label="事件数据 JSON" />
      </section>
      <section class="ec-test-panel">
        <div class="ec-panel-heading"><h3>执行详情</h3><span v-if="result" class="ec-test-status"><i />模拟完成</span></div>
        <div class="ec-test-result">
          <p v-if="!result && !error" class="ec-empty-detail">运行一次模拟事件后，查看条件匹配和动作结果。</p>
          <p v-if="error" class="ec-form-error" role="alert">{{ error }}</p>
          <template v-if="result">
            <div v-for="(step, index) in result.trace" :key="index" class="ec-test-step">
              <time>{{ traceTime(step.offsetMs) }}</time><strong>{{ step.title }}</strong><small>{{ step.detail }}</small>
              <div v-if="index === 2 && result.actions.length" class="ec-test-step__actions">
                <article v-for="(action, actionIndex) in result.actions" :key="actionIndex" class="ec-test-action-card">
                  <div><strong>{{ kindName(action.kind) }} · {{ action.name }}</strong><span>模拟命中</span></div>
                  <small>仅计算动作选择，不调用真实服务</small>
                  <details><summary>输入输出</summary><div class="ec-test-action-io"><div><label>{{ typeof action.input === 'string' ? '输入 · 文字指令' : '输入' }}</label><pre>{{ formatValue(action.input) }}</pre></div><div><label>输出</label><p>本次模拟未调用真实动作，无输出数据。</p></div></div></details>
                </article>
              </div>
            </div>
          </template>
        </div>
      </section>
    </div>
    <p class="ec-test-note">测试使用所选版本的配置，不会触发真实动作，也不会计入运行记录和动作统计。</p>
    <template #footer><span></span><div class="ec-modal__footer-actions"><button type="button" class="ec-button" @click="$emit('close')">关闭</button><button type="button" class="ec-button ec-button--primary" :disabled="running" @click="run">{{ running ? '运行中…' : '▷　运行测试' }}</button></div></template>
  </BaseModal>
</template>

<script>
import BaseModal from './BaseModal.vue';
import { parsePayload } from '../domain/model.mjs';

export default {
  name: 'TestDialog',
  components: { BaseModal },
  props: { visible: Boolean, event: { type: Object, required: true }, version: { type: String, required: true }, api: { type: Object, required: true } },
  data() { return { payloadText: '', result: null, error: '', running: false, history: [], historySearch: '', showHistory: false, testStartedAt: null }; },
  computed: { filteredHistory() { const query = this.historySearch.toLowerCase(); return this.history.filter(run => run.id.toLowerCase().includes(query)); } },
  watch: { visible(value) { if (value) this.reset(); } },
  mounted() { document.addEventListener('mousedown', this.closeHistoryOnOutside); document.addEventListener('keydown', this.closeHistoryOnEscape, true); },
  beforeDestroy() { document.removeEventListener('mousedown', this.closeHistoryOnOutside); document.removeEventListener('keydown', this.closeHistoryOnEscape, true); },
  methods: {
    async reset() { this.payloadText = JSON.stringify({ event_id: 'EVT-TEST-0001', device_id: 'MOTOR-A12', temperature: 86.4, voltage: 238, status: 'warning' }, null, 2); this.result = null; this.error = ''; this.historySearch = ''; this.showHistory = false; this.testStartedAt = null; try { const data = await this.api.listRuns(this.event.id, { page: 1, pageSize: 20 }); this.history = data.items.filter(run => run.payload).slice(0, 8); } catch (error) { this.history = []; } },
    async selectHistory(run) { try { const detail = await this.api.getRun(this.event.id, run.id); this.payloadText = JSON.stringify(detail.payload, null, 2); this.result = null; this.error = ''; this.showHistory = false; } catch (error) { this.error = error.message || '读取历史事件数据失败'; } },
    closeHistoryOnOutside(event) { if (this.visible && this.showHistory && this.$el && !this.$el.querySelector('.ec-test-panel .ec-panel-heading').contains(event.target)) this.showHistory = false; },
    closeHistoryOnEscape(event) { if (this.visible && this.showHistory && event.key === 'Escape') { this.showHistory = false; event.stopPropagation(); } },
    historySummary(payload) { const entries = Object.entries(payload && typeof payload === 'object' ? payload : {}).filter(([key]) => !['event_id', 'source'].includes(key)).slice(0, 3); return entries.map(([key, value]) => `${key}: ${String(typeof value === 'object' ? JSON.stringify(value) : value).slice(0, 35)}`).join(' · ') || '点击填入这条事件数据'; },
    kindName(kind) { return { tool: '工具', workflow: '工作流', agent: '智能体', expert: '专家' }[kind] || kind; },
    formatValue(value) { return typeof value === 'string' ? value : JSON.stringify(value, null, 2); },
    traceTime(offsetMs) { const date = new Date(this.testStartedAt + Number(offsetMs || 0)); return [date.getHours(), date.getMinutes(), date.getSeconds()].map(value => String(value).padStart(2, '0')).join(':'); },
    async run() { this.error = ''; this.result = null; let payload; try { payload = parsePayload(this.payloadText); } catch (error) { this.error = error.message; return; } this.running = true; this.testStartedAt = Date.now(); try { this.result = await this.api.simulate(this.event.id, { version: this.version, payload }); this.$emit('tested'); } catch (error) { this.error = error.message || '模拟测试失败'; } finally { this.running = false; } },
  },
};
</script>
