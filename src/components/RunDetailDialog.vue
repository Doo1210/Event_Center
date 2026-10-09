<template>
  <BaseModal :visible="visible" title="事件详情" size="wide" variant="run-detail" @close="$emit('close')">
    <template v-if="detail">
      <div class="ec-run-overview">
        <div class="ec-run-overview__main">
          <strong class="ec-run-overview__id">{{ detail.id }}</strong>
          <span>版本 {{ detail.version || '—' }} · 接收 {{ detail.receivedAt }} · 总耗时 {{ duration(detail.durationMs) }}</span>
        </div>
        <span class="ec-run-result-chip" :class="`ec-run-result-chip--${detail.result}`">{{ resultName(detail.result) }}</span>
      </div>

      <div class="ec-run-layout">
        <section class="ec-run-panel">
          <header class="ec-run-panel__head"><h3>事件数据</h3><p>接入时收到的事件内容</p></header>
          <div class="ec-run-panel__scroll ec-run-panel__data">
            <dl class="ec-run-meta"><dt>来源</dt><dd>{{ sourceName }}</dd><dt>接收时间</dt><dd>{{ detail.receivedAt }}</dd></dl>
            <div class="ec-run-section-label">接入数据</div>
            <pre class="ec-run-json ec-run-json--payload">{{ formatted(detail.payload) }}</pre>
          </div>
        </section>

        <section class="ec-run-panel">
          <header class="ec-run-panel__head"><h3>执行详情</h3><p>按发生时间记录接入、条件判断和动作执行</p></header>
          <div class="ec-run-panel__scroll ec-run-panel__timeline">
            <div class="ec-run-point"><time>{{ clock(detail.receivedAt) }}</time><strong>接收事件数据</strong><p>来自 {{ sourceName }}</p></div>
            <template v-if="detail.result === 'not_executed'">
              <div class="ec-run-point is-muted"><time>{{ clock(detail.receivedAt) }}</time><strong>未启用处理</strong><p>{{ detail.reason || '当时没有生效的处理版本，本次事件未执行动作。' }}</p></div>
            </template>
            <template v-else>
              <div class="ec-run-point"><time>{{ clock(detail.receivedAt) }}</time><strong>命中分支：{{ detail.branch || '其他情况' }}</strong><p>{{ branchNote }}</p></div>
              <div v-if="detail.result === 'unconfigured'" class="ec-run-point is-muted"><time>{{ clock(detail.receivedAt) }}</time><strong>未配置执行动作</strong><p>命中分支没有配置执行动作，本次仅保留运行记录。</p></div>
              <div v-else class="ec-run-point" :class="{ 'is-failed': detail.result === 'failure' }">
                <time>{{ clock(detail.receivedAt) }}</time><strong>执行动作 · {{ (detail.actions || []).length }} 个并行触发</strong><p>各动作独立记录执行结果与输入输出。</p>
                <div class="ec-run-action-list">
                  <article v-for="(action, index) in detail.actions || []" :key="index" class="ec-run-action-card" :class="{ 'is-failed': action.status === 'failure' }">
                    <div class="ec-run-action-card__top"><strong>{{ kindName(action.kind) }} · {{ action.name }}</strong><span>{{ resultName(action.status) }}</span></div>
                    <div class="ec-run-action-card__time"><template v-if="action.startedAt && action.finishedAt">开始 {{ clock(action.startedAt) }}　完成 {{ clock(action.finishedAt) }}　·　</template>{{ duration(action.durationMs) }}</div>
                    <details class="ec-run-action-details"><summary>输入输出</summary><div class="ec-run-action-io"><div><div class="ec-run-section-label">{{ typeof action.input === 'string' ? '输入 · 文字指令' : '输入' }}</div><pre class="ec-run-json">{{ formatted(action.input) }}</pre></div><div><div class="ec-run-section-label">{{ action.status === 'failure' ? '错误输出' : '输出' }}</div><pre class="ec-run-json">{{ formatted(action.output) }}</pre></div></div></details>
                  </article>
                </div>
              </div>
            </template>
            <div class="ec-run-point is-last" :class="pointTone"><time>{{ finishClock }}</time><strong>本次处理结束 · {{ resultName(detail.result) }}</strong><p>总耗时 {{ duration(detail.durationMs) }}</p></div>
          </div>
        </section>
      </div>
    </template>
    <template #footer><button type="button" class="ec-button ec-button--small" @click="$emit('close')">关闭</button></template>
  </BaseModal>
</template>

<script>
import BaseModal from './BaseModal.vue';

export default {
  name: 'RunDetailDialog',
  components: { BaseModal },
  props: { visible: Boolean, detail: { type: Object, default: null }, event: { type: Object, required: true } },
  computed: {
    sourceName() { return [this.event.sourceType, this.event.sourceSummary].filter(Boolean).join(' / '); },
    pointTone() { return { failure: 'is-failed', not_executed: 'is-muted', unconfigured: 'is-muted' }[this.detail && this.detail.result] || ''; },
    finishClock() { if (!this.detail) return ''; const date = new Date(String(this.detail.receivedAt).replace(' ', 'T')); if (Number.isNaN(date.getTime())) return this.clock(this.detail.receivedAt); date.setMilliseconds(date.getMilliseconds() + Number(this.detail.durationMs || 0)); return [date.getHours(), date.getMinutes(), date.getSeconds()].map(value => String(value).padStart(2, '0')).join(':'); },
    branchNote() { if (!this.detail) return ''; const version = (this.event.versions || []).find(item => item.version === this.detail.version); const branch = version && (version.branches || []).find(item => item.name === this.detail.branch); if (!branch) return '按当时的处理版本完成分支判断。'; if (branch.isDefault) return '前述条件未命中，进入兜底分支。'; const operator = { eq: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤', contains: '包含', in: '属于' }; return '命中条件：' + (branch.conditions || []).map(item => `${item.field} ${operator[item.operator] || item.operator} ${item.value}`).join(branch.logic === 'any' ? ' 或 ' : ' 且 '); },
  },
  methods: {
    resultName(value) { return { success: '执行成功', failure: '执行失败', not_executed: '未执行', unconfigured: '未配置执行动作' }[value] || value; },
    kindName(value) { return { tool: '工具', workflow: '工作流', agent: '智能体', expert: '专家' }[value] || value; },
    duration(milliseconds) { const seconds = Number(milliseconds || 0) / 1000; const value = seconds < 1 ? seconds.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') : seconds.toFixed(1); return `${value || '0'}s`; },
    formatted(value) { return typeof value === 'string' ? value : JSON.stringify(value == null ? {} : value, null, 2); },
    clock(value) { const text = String(value || ''); return text.length >= 19 ? text.slice(11, 19) : text; },
  },
};
</script>
