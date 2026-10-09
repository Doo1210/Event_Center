<template>
  <div class="ec-list-page">
    <section class="ec-list-hero" aria-label="事件中心概览">
      <header class="ec-page-head">
        <h1>事件中心</h1>
        <p>接入事件、配置处理流程，并查看每次触发的执行情况。</p>
      </header>
      <div class="ec-metrics" aria-label="数量总览">
        <div><span>事件数量</span><strong>{{ events.length }}</strong></div>
        <div><span>接入中</span><strong>{{ intakeCount }}</strong></div>
        <div><span>运行中</span><strong>{{ runningCount }}</strong></div>
        <div><span>累计触发</span><strong>{{ triggerCount.toLocaleString('zh-CN') }}</strong></div>
      </div>
    </section>

    <div class="ec-toolbar">
      <div class="ec-toolbar__filters">
        <label class="ec-search"><span class="ec-sr-only">搜索事件名称</span><input v-model.trim="filters.search" type="search" placeholder="搜索事件名称" /></label>
        <label><span class="ec-sr-only">触发源类型</span><select v-model="filters.sourceType"><option value="">全部触发源</option><option v-for="type in sourceTypes" :key="type">{{ type }}</option></select></label>
        <label><span class="ec-sr-only">事件状态</span><select v-model="filters.status"><option value="">全部事件状态</option><option value="running">运行中</option><option value="intake-only">仅接入·未启用处理</option><option value="paused">暂停接入·暂停运行</option><option value="disabled">未接入·未启用处理</option></select></label>
      </div>
      <button type="button" class="ec-button ec-button--primary" @click="$emit('create')">＋ 新增事件</button>
    </div>

    <section class="ec-list-results" aria-label="事件列表">
      <div class="ec-table-wrap">
      <table class="ec-table ec-event-table">
        <thead><tr><th>事件名称</th><th>事件信息</th><th>接入开关</th><th>触发次数</th><th>事件处理</th><th>处理开关</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-if="loading"><td colspan="7" class="ec-table-empty">正在加载事件…</td></tr>
          <tr v-else-if="error"><td colspan="7" class="ec-table-empty">{{ error }} <button class="ec-link" @click="$emit('retry')">重试</button></td></tr>
          <tr v-else-if="!visibleEvents.length"><td colspan="7" class="ec-table-empty">没有符合条件的事件。请调整筛选条件，或新增事件。</td></tr>
          <tr v-for="event in visibleEvents" :key="event.id">
            <td data-label="事件名称"><strong class="ec-event-name">{{ event.name }}</strong><small class="ec-status" :class="statusClass(event)"><i />{{ combinedState(event) }}</small></td>
            <td data-label="事件信息"><div class="ec-event-source"><span class="ec-source-tag">{{ event.sourceType }}</span><span class="ec-muted ec-ellipsis" :title="event.sourceSummary">{{ event.sourceSummary }}</span></div></td>
            <td data-label="接入开关"><button type="button" class="ec-switch" :class="{ 'is-on': event.intakeEnabled }" role="switch" :aria-checked="String(event.intakeEnabled)" :aria-label="event.intakeEnabled ? '暂停接入' : '恢复接入'" @click="$emit('toggle-intake', event)"><span /></button></td>
            <td data-label="触发次数" class="ec-number">{{ Number(event.triggerCount || 0).toLocaleString('zh-CN') }}</td>
            <td data-label="事件处理"><template v-if="processingState(event) === 'running'"><strong>{{ branchCount(event) }} 个流程分支</strong><small class="ec-muted">{{ actionCount(event) }} 个执行动作</small></template><span v-else class="ec-muted">—</span></td>
            <td data-label="处理开关"><button type="button" class="ec-switch" :class="{ 'is-on': processingState(event) === 'running' }" role="switch" :aria-checked="String(processingState(event) === 'running')" :aria-label="processingState(event) === 'running' ? '取消发布运行' : '选择版本并发布运行'" :disabled="processingState(event) !== 'running' && !(event.versions || []).length" :title="!(event.versions || []).length ? '请先配置处理流程并发布版本' : ''" @click="$emit('toggle-processing', event)"><span /></button></td>
            <td data-label="操作"><div class="ec-row-actions"><button type="button" class="ec-link" @click="$emit('config', event)">配置处理</button><button type="button" class="ec-link" @click="$emit('records', event)">事件记录</button><details class="ec-more"><summary aria-label="更多操作">···</summary><div><button type="button" @click="$emit('edit', event)">编辑接入</button><button type="button" @click="$emit('duplicate', event)">复制事件</button><button type="button" class="is-danger" @click="$emit('delete', event)">删除事件</button></div></details></div></td>
          </tr>
        </tbody>
      </table>
      </div>
    </section>
  </div>
</template>

<script>
import { SOURCE_TYPES, combinedState, countActions, eventStatus, processingState } from '../domain/model.mjs';

export default {
  name: 'EventList',
  props: { events: { type: Array, default: () => [] }, loading: Boolean, error: { type: String, default: '' } },
  data() { return { sourceTypes: SOURCE_TYPES, filters: { search: '', sourceType: '', status: '' } }; },
  computed: {
    intakeCount() { return this.events.filter(event => event.intakeEnabled).length; },
    runningCount() { return this.events.filter(event => eventStatus(event) === 'running').length; },
    triggerCount() { return this.events.reduce((sum, event) => sum + Number(event.triggerCount || 0), 0); },
    visibleEvents() {
      const f = this.filters;
      return this.events.filter(event => {
        if (f.search && !event.name.toLowerCase().includes(f.search.toLowerCase())) return false;
        if (f.sourceType && event.sourceType !== f.sourceType) return false;
        return !f.status || eventStatus(event) === f.status;
      });
    },
  },
  methods: {
    combinedState, processingState,
    statusClass(event) { return eventStatus(event); },
    currentBranches(event) { const version = (event.versions || []).find(item => item.version === event.currentVersion); return version ? version.branches : []; },
    branchCount(event) { return this.currentBranches(event).length; },
    actionCount(event) { return countActions(this.currentBranches(event)); },
  },
};
</script>
