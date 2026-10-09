<template>
  <div class="ec-records-page">
    <div class="ec-record-toolbar"><div class="ec-record-filters"><label><span class="ec-sr-only">搜索事件 ID</span><input v-model.trim="filters.search" type="search" placeholder="搜索事件 ID" @input="filterChanged" /></label><label><span class="ec-sr-only">开始日期</span><input v-model="filters.from" type="date" @change="filterChanged" /></label><span class="ec-muted">至</span><label><span class="ec-sr-only">结束日期</span><input v-model="filters.to" type="date" @change="filterChanged" /></label><label><span class="ec-sr-only">处理流程版本</span><select v-model="filters.version" @change="filterChanged"><option value="">全部版本</option><option v-for="version in event.versions" :key="version.version" :value="version.version">{{ version.version }}{{ event.currentVersion === version.version ? ' · 当前处理版本' : '' }}</option></select></label><label><span class="ec-sr-only">运行结果</span><select v-model="filters.result" @change="filterChanged"><option value="">全部运行结果</option><option value="success">执行成功</option><option value="failure">执行失败</option><option value="not_executed">未执行</option><option value="unconfigured">未配置执行动作</option></select></label></div><button type="button" class="ec-button ec-button--primary ec-button--small" @click="openStats">执行动作统计</button></div>

    <p v-if="error" class="ec-inline-error" role="alert">{{ error }} <button class="ec-link" type="button" @click="load">重试</button></p>
    <section class="ec-record-results" aria-label="事件记录列表">
    <div class="ec-table-wrap"><table class="ec-table ec-record-table"><thead><tr><th>事件 ID</th><th>接收时间</th><th>处理流程版本</th><th>命中分支</th><th>运行结果</th><th>耗时</th><th>操作</th></tr></thead><tbody><tr v-if="loading"><td colspan="7" class="ec-table-empty">正在加载事件记录…</td></tr><tr v-else-if="!rows.length"><td colspan="7" class="ec-table-empty">{{ hasFilters ? '没有符合条件的事件记录，请调整筛选条件。' : '暂无事件记录。接入成功后可在这里查看。' }}</td></tr><tr v-for="run in rows" :key="run.id"><td><code class="ec-record-id">{{ run.id }}</code></td><td>{{ run.receivedAt }}</td><td><span class="ec-version-pill">{{ run.version || '—' }}</span></td><td>{{ run.branch || '—' }}</td><td><span class="ec-result" :class="`ec-result--${run.result}`">{{ resultName(run.result) }}</span></td><td>{{ duration(run.durationMs) }}</td><td><button type="button" class="ec-link" @click="openDetail(run)">查看详情</button></td></tr></tbody></table></div>
    <footer class="ec-pagination"><span>共 {{ total }} 条记录</span><div class="ec-page-controls"><span>每页 10 条</span><button type="button" class="ec-page-button" aria-label="上一页" :disabled="page === 1" @click="goToPage(page - 1)">‹</button><button v-for="pageNumber in visiblePages" :key="pageNumber" type="button" class="ec-page-button" :class="{ 'is-active': pageNumber === page }" :aria-current="pageNumber === page ? 'page' : null" :aria-label="`第 ${pageNumber} 页`" @click="goToPage(pageNumber)">{{ pageNumber }}</button><button type="button" class="ec-page-button" aria-label="下一页" :disabled="page >= pageCount" @click="goToPage(page + 1)">›</button></div></footer>
    </section>

    <RunDetailDialog :visible="!!detail" :detail="detail" :event="event" @close="detail = null" />

    <ActionStatsDialog :visible="statsVisible" :event="event" :stats="stats" :version="statsVersion" :loading="statsLoading" :error="statsError" @version-change="changeStatsVersion" @close="statsVisible = false" />
  </div>
</template>

<script>
import RunDetailDialog from './RunDetailDialog.vue';
import ActionStatsDialog from './ActionStatsDialog.vue';

export default {
  name: 'RunRecords',
  components: { RunDetailDialog, ActionStatsDialog },
  props: { event: { type: Object, required: true }, api: { type: Object, required: true } },
  data() { return { filters: { search: '', from: '', to: '', version: '', result: '' }, rows: [], total: 0, page: 1, loading: false, error: '', detail: null, statsVisible: false, statsVersion: '', stats: null, statsLoading: false, statsError: '' }; },
  computed: {
    pageCount() { return Math.max(1, Math.ceil(this.total / 10)); },
    hasFilters() { return Object.values(this.filters).some(Boolean); },
    visiblePages() { const count = Math.min(5, this.pageCount); const start = Math.max(1, Math.min(this.page - 2, this.pageCount - count + 1)); return Array.from({ length: count }, (_, index) => start + index); },
  },
  watch: { 'event.id'() { this.page = 1; this.filters = { search: '', from: '', to: '', version: '', result: '' }; this.load(); } },
  mounted() { this.load(); },
  methods: {
    filterChanged() { this.page = 1; this.load(); },
    goToPage(target) { if (target < 1 || target > this.pageCount || target === this.page) return; this.page = target; this.load(); },
    async load() { this.loading = true; this.error = ''; try { const result = await this.api.listRuns(this.event.id, { ...this.filters, page: this.page, pageSize: 10 }); this.rows = result.items || []; this.total = Number(result.total || 0); } catch (error) { this.error = error.message || '加载事件记录失败'; this.rows = []; this.total = 0; } finally { this.loading = false; } },
    async openDetail(run) { try { this.detail = await this.api.getRun(this.event.id, run.id); } catch (error) { this.error = error.message || '读取事件详情失败'; } },
    async openStats() { this.statsVisible = true; this.statsVersion = ''; await this.loadStats(); },
    changeStatsVersion(version) { this.statsVersion = version; this.loadStats(); },
    async loadStats() { this.statsLoading = true; this.statsError = ''; try { this.stats = await this.api.getActionStats(this.event.id, this.statsVersion); } catch (error) { this.statsError = error.message || '读取动作统计失败'; this.stats = null; } finally { this.statsLoading = false; } },
    resultName(value) { return { success: '执行成功', failure: '执行失败', not_executed: '未执行', unconfigured: '未配置执行动作' }[value] || value; },
    kindName(value) { return { tool: '工具', workflow: '工作流', agent: '智能体', expert: '专家' }[value] || value; },
    duration(milliseconds) { const seconds = Number(milliseconds || 0) / 1000; const value = seconds < 1 ? seconds.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') : seconds.toFixed(1); return `${value || '0'}s`; },
    formatted(value) { return typeof value === 'string' ? value : JSON.stringify(value == null ? {} : value, null, 2); },
  },
};
</script>
