<template>
  <div class="event-center-root" :class="{ 'ec-with-sidebar': showSidebar, 'ec-list-view': view === 'list' }">
    <SidebarNav v-if="showSidebar" :open="sidebarOpen" @close="sidebarOpen = false" @center="onSidebarCenter" @static-click="onStaticNavClick" />
    <main class="ec-main">
      <button v-if="showSidebar" type="button" class="ec-mobile-menu" :aria-expanded="String(sidebarOpen)" :aria-label="sidebarOpen ? '关闭导航' : '打开导航'" @click="sidebarOpen = !sidebarOpen">☰</button>
      <div v-if="!showSidebar" class="ec-shell-label"><span>工业智能协作平台</span><span class="ec-shell-label__divider">/</span><strong>事件中心</strong></div>

    <EventList v-if="view === 'list'" :events="events" :loading="loading" :error="error" @retry="loadEvents" @create="openForm(null)" @edit="openForm" @duplicate="duplicateEvent" @delete="deleteEvent" @toggle-intake="toggleIntake" @toggle-processing="toggleProcessing" @config="openView($event, 'config')" @records="openView($event, 'records')" />

    <div v-else-if="selectedEvent" class="ec-detail-page" :class="{ 'ec-detail-page--records': view === 'records', 'ec-detail-page--config': view === 'config' }">
      <header class="ec-detail-head">
        <button type="button" class="ec-back" aria-label="返回事件中心" @click="backToList">‹</button>
        <div class="ec-detail-head__title">
          <h1>{{ view === 'config' ? '配置处理流程' : '事件记录' }}</h1>
          <p class="ec-detail-event-name">{{ selectedEvent.name }}</p>
        </div>
        <button type="button" class="ec-detail-jump" @click="switchDetail">
          <svg v-if="view === 'config'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 14h7"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4v16M5 8h8m-8 8h8"/><circle cx="16" cy="8" r="3"/><circle cx="16" cy="16" r="3"/></svg>
          <span>{{ view === 'config' ? '事件记录' : '配置处理流程' }}</span>
          <svg class="ec-detail-jump__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
        </button>
      </header>
      <FlowEditor v-if="view === 'config'" :key="`flow-${selectedEvent.id}`" :event="selectedEvent" :api="api" :resources="resources" @changed="onEventChanged" @toast="notify" />
      <RunRecords v-else :key="`runs-${selectedEvent.id}`" :event="selectedEvent" :api="api" />
    </div>

    <EventForm :visible="formVisible" :event="editingEvent" :busy="busy" :error="formError" @close="closeForm" @save="saveEvent" />

    <BaseModal :visible="!!versionChoice" title="选择要发布的版本" @close="versionChoice = null"><p class="ec-help">选择版本并确认后才会开启处理。接入开关保持原状态。</p><div v-if="versionChoice" class="ec-version-choices"><label v-for="version in versionChoice.versions" :key="version.version"><input v-model="chosenVersion" type="radio" :value="version.version" /><span><strong>{{ version.version }}</strong><small>{{ version.description || '无版本描述' }}{{ version.tested ? '' : ' · 尚未测试' }}</small></span></label></div><template #footer><button type="button" class="ec-button" @click="versionChoice = null">取消</button><button type="button" class="ec-button ec-button--primary" :disabled="busy || !chosenVersion" @click="publishChosenVersion">确认发布运行</button></template></BaseModal>
    <BaseModal :visible="!!confirmation" :title="confirmation ? confirmation.title : ''" @close="confirmation = null"><p>{{ confirmation ? confirmation.message : '' }}</p><template #footer><button type="button" class="ec-button" @click="confirmation = null">取消</button><button type="button" class="ec-button ec-button--danger" :disabled="busy" @click="executeConfirmed">确认</button></template></BaseModal>
    <div v-if="toast" class="ec-toast" role="status">{{ toast }}</div>
    </main>
  </div>
</template>

<script>
import EventList from './components/EventList.vue';
import EventForm from './components/EventForm.vue';
import FlowEditor from './components/FlowEditor.vue';
import RunRecords from './components/RunRecords.vue';
import BaseModal from './components/BaseModal.vue';
import SidebarNav from './components/SidebarNav.vue';
import { processingState } from './domain/model.mjs';
import { assertEventCenterApi } from './services/apiContract.mjs';
import './styles.css';

export default {
  name: 'EventCenter',
  components: { EventList, EventForm, FlowEditor, RunRecords, BaseModal, SidebarNav },
  props: {
    api: { type: Object, required: true },
    initialEventId: { type: [String, Number], default: '' },
    initialView: { type: String, default: 'list' },
    showSidebar: { type: Boolean, default: false },
  },
  data() { return { view: 'list', selectedEvent: null, events: [], resources: [], loading: false, error: '', busy: false, formVisible: false, editingEvent: null, formError: '', versionChoice: null, chosenVersion: '', confirmation: null, toast: '', toastTimer: null, sidebarOpen: false }; },
  watch: {
    initialEventId() { this.syncIncomingRoute(); },
    initialView() { this.syncIncomingRoute(); },
  },
  async mounted() { try { assertEventCenterApi(this.api); } catch (error) { this.error = error.message; return; } await Promise.all([this.loadEvents(), this.loadResources()]); await this.syncIncomingRoute(); },
  beforeDestroy() { if (this.toastTimer) clearTimeout(this.toastTimer); },
  methods: {
    async loadEvents() { this.loading = true; this.error = ''; try { const result = await this.api.listEvents(); this.events = result.items || []; } catch (error) { this.error = error.message || '加载事件失败'; } finally { this.loading = false; } },
    async loadResources() { try { this.resources = await this.api.listResources(); } catch (error) { this.notify(error.message || '加载动作资源失败'); this.resources = []; } },
    async syncIncomingRoute() { if (!this.initialEventId || this.initialView === 'list') { this.view = 'list'; return; } await this.openView({ id: this.initialEventId }, this.initialView === 'records' ? 'records' : 'config', false); },
    async openView(event, view, emit = true) { try { this.selectedEvent = await this.api.getEvent(event.id); this.view = view; this.scrollToTop(); if (emit) this.$emit('navigate', { view, eventId: this.selectedEvent.id }); } catch (error) { this.notify(error.message || '读取事件失败'); } },
    backToList() { this.view = 'list'; this.selectedEvent = null; this.loadEvents(); this.scrollToTop(); this.$emit('navigate', { view: 'list', eventId: null }); },
    onSidebarCenter() { this.sidebarOpen = false; this.backToList(); },
    onStaticNavClick() { this.sidebarOpen = false; this.notify('此原型聚焦事件中心'); },
    switchDetail() { if (!this.selectedEvent) return; this.view = this.view === 'config' ? 'records' : 'config'; this.scrollToTop(); this.$emit('navigate', { view: this.view, eventId: this.selectedEvent.id }); },
    scrollToTop() { this.$nextTick(() => { const main = this.$el.querySelector('.ec-main'); if (main) main.scrollTop = 0; if (typeof window !== 'undefined') window.scrollTo(0, 0); }); },
    async onEventChanged(updated) { this.selectedEvent = updated; await this.loadEvents(); },
    notify(message) { this.toast = message; if (this.toastTimer) clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => { this.toast = ''; }, 3500); },
    openForm(event) { this.editingEvent = event || null; this.formError = ''; this.formVisible = true; },
    closeForm() { this.formVisible = false; this.editingEvent = null; this.formError = ''; },
    async saveEvent(payload) { this.busy = true; this.formError = ''; const editing = !!this.editingEvent; try { const updated = editing ? await this.api.updateEvent(this.editingEvent.id, payload) : await this.api.createEvent(payload); this.closeForm(); await this.loadEvents(); if (this.selectedEvent && this.selectedEvent.id === updated.id) this.selectedEvent = updated; this.notify(editing ? '事件接入配置已保存' : '事件已创建，默认未接入·未启用处理'); } catch (error) { this.formError = error.message || '保存事件失败'; } finally { this.busy = false; } },
    async toggleIntake(event) { try { await this.api.setIntake(event.id, !event.intakeEnabled); await this.loadEvents(); this.notify(event.intakeEnabled ? '已暂停接入；处理状态保持不变' : '已恢复接入；处理状态保持不变'); } catch (error) { this.notify(error.message || '修改接入状态失败'); } },
    toggleProcessing(event) { if (processingState(event) === 'running') { this.confirmation = { title: '取消发布运行', message: `取消 ${event.currentVersion} 的发布运行后，版本保留在历史列表，接入状态不变。`, run: async () => { await this.api.cancelPublish(event.id); await this.loadEvents(); this.notify('已取消发布运行；接入状态保持不变'); } }; return; } if (!(event.versions || []).length) { this.notify('请先进入配置处理，创建并发布一个版本'); return; } this.versionChoice = event; this.chosenVersion = event.versions[0].version; },
    async publishChosenVersion() { if (!this.versionChoice || !this.chosenVersion) return; const eventId = this.versionChoice.id; const version = this.chosenVersion; const snapshot = this.versionChoice.versions.find(item => item.version === version); const run = async () => { await this.api.publishVersion(eventId, version); await this.loadEvents(); this.notify('版本已发布运行；接入状态保持不变'); }; this.versionChoice = null; if (snapshot && !snapshot.tested) { this.confirmation = { title: '发布未测试版本', message: `${version} 尚未测试。建议先测试分支判断和执行动作；确认后仍可继续发布。`, run }; return; } this.busy = true; try { await run(); } catch (error) { this.notify(error.message || '发布失败'); } finally { this.busy = false; } },
    duplicateEvent(event) { this.confirmation = { title: '复制事件', message: `创建“${event.name}”的副本？副本默认未接入·未启用处理。`, run: async () => { await this.api.duplicateEvent(event.id); await this.loadEvents(); this.notify('事件副本已创建'); } }; },
    deleteEvent(event) { this.confirmation = { title: '删除事件', message: `确定删除“${event.name}”吗？历史运行记录应由服务端保留。`, run: async () => { await this.api.deleteEvent(event.id); await this.loadEvents(); this.notify('事件已删除'); } }; },
    async executeConfirmed() { const choice = this.confirmation; this.confirmation = null; if (!choice) return; this.busy = true; try { await choice.run(); } catch (error) { this.notify(error.message || '操作失败'); } finally { this.busy = false; } },
  },
};
</script>
