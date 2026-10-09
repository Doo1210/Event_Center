<template>
  <div class="ec-flow-page">
    <div v-if="error" class="ec-inline-error" role="alert">{{ error }} <button class="ec-link" type="button" @click="error = ''">关闭</button></div>
    <div class="ec-flow-layout">
      <aside class="ec-version-rail" aria-label="处理版本">
        <div class="ec-rail-heading"><strong>版本</strong></div>
        <button type="button" class="ec-version-entry ec-version-entry--draft" :class="{ 'is-active': selected === 'draft' }" @click="selected = 'draft'"><strong>草稿</strong></button>
        <div class="ec-version-divider" />
        <div class="ec-version-list"><button v-for="version in orderedVersions" :key="version.version" type="button" class="ec-version-entry" :class="{ 'is-active': selected === version.version, 'is-current': model.currentVersion === version.version }" @click="selected = version.version"><strong>{{ version.version }}</strong><span v-if="model.currentVersion === version.version" class="ec-badge ec-badge--success">当前处理版本</span></button></div>
      </aside>

      <div class="ec-flow-workspace">
        <header class="ec-flow-command">
          <div class="ec-flow-command__title"><div class="ec-flow-command__name"><strong>{{ selected === 'draft' ? '草稿' : selected }}</strong></div><div class="ec-flow-description"><span>{{ selectedSnapshot.description || '暂无版本描述' }}</span><button type="button" aria-label="编辑版本描述" title="编辑版本描述" @click="openDescription"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button></div></div>
          <div class="ec-command-actions">
            <button type="button" class="ec-button" :disabled="busy" @click="openTest">测试</button>
            <button v-if="selected === 'draft'" type="button" class="ec-button ec-button--primary" :disabled="busy" @click="openPublish">发布运行</button>
            <template v-else-if="isCurrent"><button type="button" class="ec-button" @click="cancelPublish">取消发布运行</button><button type="button" class="ec-button ec-button--copy" @click="copyToDraft">复制为草稿</button><button type="button" class="ec-button ec-button--danger-text" disabled title="请先取消发布运行">删除版本</button></template>
            <template v-else><button type="button" class="ec-button" @click="openPublish">发布运行</button><button type="button" class="ec-button ec-button--copy" @click="copyToDraft">复制为草稿</button><button type="button" class="ec-button ec-button--danger-text" @click="deleteVersion">删除版本</button></template>
          </div>
        </header>

        <section class="ec-flow-panel">
          <div class="ec-flow-heading"><h3>处理流程</h3><span v-if="branches.length > 1" class="ec-flow-branch-count">{{ branches.length }} 个分支</span><span v-if="!editable" class="ec-badge">只读</span></div>
          <div class="ec-flow-canvas">
          <div v-if="editable" class="ec-flow-toolbar"><button type="button" class="ec-button ec-add-branch-button" @click="openBranch(-1)"><span class="ec-add-branch-button__icon" aria-hidden="true">＋</span><span>添加分支</span></button></div>
          <p class="ec-flow-intro">{{ branches.length > 1 ? '按顺序判断 IF / ELSE IF，未命中时执行 ELSE；命中分支的动作并行执行。' : '事件接入后并行执行下列动作。' }}</p>

          <div class="ec-branch-list" :class="{ 'is-conditional': branches.length > 1 }">
            <div v-for="(branch, index) in branches" :key="branch.id" class="ec-branch-step"><span v-if="branches.length > 1" class="ec-branch-step__number" :class="{ 'is-default': branch.isDefault }">{{ index + 1 }}</span><article class="ec-branch-card" :class="{ 'is-conditional': branches.length > 1 && !branch.isDefault, 'is-default': branches.length > 1 && branch.isDefault, 'is-direct': branches.length === 1 }">
              <div v-if="branches.length > 1" class="ec-branch-heading"><div class="ec-branch-heading__name"><span class="ec-branch-marker" :class="{ 'is-default': branch.isDefault, 'is-else-if': !branch.isDefault && index > 0 }">{{ branch.isDefault ? 'ELSE' : index === 0 ? 'IF' : 'ELSE IF' }}</span><strong>{{ branch.name }}</strong><small v-if="branch.isDefault">未命中前面的分支</small></div><div v-if="editable && !branch.isDefault" class="ec-branch-actions"><button class="ec-link" type="button" @click="openBranch(index)">编辑</button><button class="ec-link" type="button" :disabled="index === 0" @click="moveBranch(index, -1)">上移</button><button class="ec-link" type="button" :disabled="index >= branches.length - 2" @click="moveBranch(index, 1)">下移</button><button class="ec-link is-danger" type="button" @click="removeBranch(index)">移除</button></div></div>
              <div v-if="!branch.isDefault" class="ec-branch-conditions"><span>执行条件</span><div><template v-for="(condition, conditionIndex) in branch.conditions"><span v-if="conditionIndex" :key="`logic-${conditionIndex}`" class="ec-logic">{{ branch.logic === 'any' ? '或' : '且' }}</span><span :key="`condition-${conditionIndex}`" class="ec-condition-pill">{{ conditionText(condition) }}</span></template></div></div>
              <div class="ec-branch-execution"><span class="ec-branch-label">执行动作 · 并行执行</span><div class="ec-action-cards"><div v-for="(action, actionIndex) in branch.actions" :key="action.id" class="ec-action-card"><div class="ec-action-card__head"><span class="ec-action-kind" :class="`ec-action-kind--${action.kind}`">{{ kindName(action.kind).slice(0, 1) }}</span><span class="ec-action-card__type">{{ kindName(action.kind) }}</span><template v-if="action.kind === 'tool' && action.name.includes(' / ')"><strong class="ec-action-card__parent" :title="action.name.split(' / ')[0]">{{ action.name.split(' / ')[0] }}</strong><span class="ec-action-card__separator">/</span><span class="ec-action-card__operation" :title="action.name.split(' / ').slice(1).join(' / ')">{{ action.name.split(' / ').slice(1).join(' / ') }}</span></template><strong v-else :title="action.name">{{ action.name }}</strong></div><div class="ec-action-card__controls"><button type="button" :aria-label="`${editable ? '编辑' : '查看'}动作 ${action.name}`" :title="editable ? '编辑动作' : '查看配置'" @click="openAction(index, actionIndex)"><span v-if="editable">✎</span><svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12c2.6-4 6-6 10-6s7.4 2 10 6c-2.6 4-6 6-10 6s-7.4-2-10-6Z"/><circle cx="12" cy="12" r="2.5"/></svg></button><button v-if="editable" type="button" :aria-label="`移除动作 ${action.name}`" title="移除动作" @click="removeAction(index, actionIndex)">×</button></div><small :title="actionSummary(action)">{{ actionSummary(action) }}</small></div><button v-if="editable" type="button" class="ec-add-action" @click="openAction(index, -1)">＋ 添加执行动作</button><p v-if="!branch.actions.length && !editable" class="ec-help">未配置执行动作</p></div></div>
            </article></div>
          </div>
          </div>
        </section>
      </div>
    </div>

    <BranchEditor :visible="branchVisible" :branch="editingBranch" :field-suggestions="fieldSuggestions" @close="branchVisible = false" @save="saveBranch" />
    <ActionEditor :visible="actionVisible" :action="editingAction" :resources="resources" :readonly="!editable" @close="actionVisible = false" @save="saveAction" />
    <TestDialog :visible="testVisible" :event="model" :version="selected" :api="api" @close="testVisible = false" @tested="refreshAfterTest" />

    <BaseModal :visible="publishVisible" :title="selected === 'draft' ? '发布草稿' : '发布历史版本'" size="publish" @close="publishVisible = false">
      <div class="ec-field"><label>版本号</label><input v-if="selected === 'draft'" v-model.trim="publishForm.version" placeholder="例如 v1.2.3" /><input v-else :value="selected" readonly /></div>
      <div class="ec-field"><label>版本描述</label><input v-model.trim="publishForm.description" maxlength="80" placeholder="简要说明配置变更" /></div>
      <p v-if="!selectedSnapshot.tested" class="ec-warning">此版本尚未测试。建议先测试分支判断和动作选择，再决定是否发布。</p>
      <p v-if="publishError" class="ec-form-error" role="alert">{{ publishError }}</p>
      <template #footer><span></span><div class="ec-modal__footer-actions"><button type="button" class="ec-button" @click="publishVisible = false">取消</button><button v-if="!selectedSnapshot.tested" type="button" class="ec-button" @click="publishVisible = false; testVisible = true">先去测试</button><button type="button" class="ec-button ec-button--primary" :disabled="busy" @click="confirmPublish">{{ busy ? '发布中…' : '继续发布' }}</button></div></template>
    </BaseModal>

    <BaseModal :visible="descriptionVisible" title="编辑版本描述" size="description" @close="descriptionVisible = false"><div class="ec-field"><label>版本描述</label><input v-model.trim="descriptionText" maxlength="80" placeholder="简要说明此版本的配置" /></div><template #footer><span class="ec-modal__note">描述会显示在版本号下方</span><div class="ec-modal__footer-actions"><button type="button" class="ec-button" @click="descriptionVisible = false">取消</button><button type="button" class="ec-button ec-button--primary" @click="saveDescription">保存</button></div></template></BaseModal>
    <BaseModal :visible="!!confirmation" :title="confirmation ? confirmation.title : ''" size="confirm" @close="confirmation = null"><p class="ec-confirm-message">{{ confirmation ? confirmation.message : '' }}</p><template #footer><span></span><div class="ec-modal__footer-actions"><button type="button" class="ec-button" @click="confirmation = null">取消</button><button type="button" class="ec-button ec-button--danger-text" @click="executeConfirmed">确认</button></div></template></BaseModal>
  </div>
</template>

<script>
import BaseModal from './BaseModal.vue';
import BranchEditor from './BranchEditor.vue';
import ActionEditor from './ActionEditor.vue';
import TestDialog from './TestDialog.vue';
import { clone, normalizeBranches, validateDraft } from '../domain/model.mjs';

export default {
  name: 'FlowEditor',
  components: { BaseModal, BranchEditor, ActionEditor, TestDialog },
  props: { event: { type: Object, required: true }, api: { type: Object, required: true }, resources: { type: Array, default: () => [] } },
  data() { return { model: clone(this.event), selected: this.event.currentVersion || 'draft', busy: false, error: '', branchVisible: false, branchIndex: -1, actionVisible: false, actionBranchIndex: -1, actionIndex: -1, testVisible: false, publishVisible: false, publishForm: { version: '', description: '' }, publishError: '', descriptionVisible: false, descriptionText: '', confirmation: null }; },
  computed: {
    editable() { return this.selected === 'draft'; },
    isCurrent() { return !!this.model.currentVersion && this.selected === this.model.currentVersion; },
    orderedVersions() { const list = [...(this.model.versions || [])]; return list.sort((a, b) => a.version === this.model.currentVersion ? -1 : b.version === this.model.currentVersion ? 1 : b.version.localeCompare(a.version, undefined, { numeric: true })); },
    selectedSnapshot() { return this.selected === 'draft' ? this.model.draft : (this.model.versions || []).find(item => item.version === this.selected) || this.model.draft; },
    branches() { return normalizeBranches(this.selectedSnapshot.branches); },
    draftProblem() { return validateDraft(this.model.draft); },
    fieldSuggestions() { const schema = (this.model.sourceConfig && this.model.sourceConfig.fieldSchema || []).map(field => field.key).filter(Boolean); return [...new Set(['event_id', 'device_id', 'voltage', 'temperature', 'vibration', 'status', 'location', 'timestamp', 'payload.device_id', 'payload.voltage', 'payload.status', 'amount', 'order_id', ...schema])]; },
    editingBranch() { return this.branchIndex >= 0 ? this.branches[this.branchIndex] : null; },
    editingAction() { return this.actionBranchIndex >= 0 && this.actionIndex >= 0 ? this.branches[this.actionBranchIndex].actions[this.actionIndex] : null; },
  },
  watch: {
    event(next, previous) { const changedEvent = !previous || next.id !== previous.id; this.model = clone(next); if (changedEvent) this.selected = next.currentVersion || 'draft'; else if (this.selected !== 'draft' && !next.versions.some(item => item.version === this.selected)) this.selected = next.currentVersion || 'draft'; },
  },
  methods: {
    notify(message) { this.$emit('toast', message); },
    sync(updated, selection) { this.model = clone(updated); if (selection) this.selected = selection; this.$emit('changed', updated); },
    fail(error) { this.error = error.message || '操作失败，请重试'; },
    kindName(kind) { return { tool: '工具', workflow: '工作流', agent: '智能体', expert: '专家' }[kind] || kind; },
    conditionText(condition) { const op = { eq: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤', contains: '包含', in: '属于' }[condition.operator] || condition.operator; return `${condition.field} ${op} ${condition.value}`; },
    actionSummary(action) { if (action.prompt) return `指令：${action.prompt}`; return Object.entries(action.params || {}).map(([key, map]) => `${key} = ${map.mode === 'event' ? `{{${map.value}}}` : map.value}`).join(' | ') || '无需输入参数'; },
    openBranch(index) { this.branchIndex = index; this.branchVisible = true; },
    async persistDraft(branches) { this.busy = true; try { const draft = { ...this.model.draft, branches: normalizeBranches(branches), tested: false }; const updated = await this.api.saveDraft(this.model.id, draft); this.sync(updated, 'draft'); this.error = ''; this.notify('草稿已保存'); } catch (error) { this.fail(error); } finally { this.busy = false; } },
    saveBranch(branch) { const branches = this.branches; const duplicate = branches.some((item, index) => index !== this.branchIndex && !item.isDefault && item.name === branch.name); if (duplicate) { this.error = '分支名称已存在'; return; } if (this.branchIndex >= 0) branches.splice(this.branchIndex, 1, branch); else branches.splice(branches.length - 1, 0, branch); this.branchVisible = false; this.persistDraft(branches); },
    moveBranch(index, direction) { const branches = this.branches; const target = index + direction; if (target < 0 || target >= branches.length - 1) return; [branches[index], branches[target]] = [branches[target], branches[index]]; this.persistDraft(branches); },
    removeBranch(index) { const branch = this.branches[index]; this.confirmation = { title: '移除分支', message: `确定移除“${branch.name}”及其条件和动作吗？`, run: () => { const branches = this.branches; branches.splice(index, 1); return this.persistDraft(branches); } }; },
    openAction(branchIndex, actionIndex) { this.actionBranchIndex = branchIndex; this.actionIndex = actionIndex; this.actionVisible = true; },
    saveAction(action) { const branches = this.branches; const actions = branches[this.actionBranchIndex].actions; if (this.actionIndex >= 0) actions.splice(this.actionIndex, 1, action); else actions.push(action); this.actionVisible = false; this.persistDraft(branches); },
    removeAction(branchIndex, actionIndex) { const action = this.branches[branchIndex].actions[actionIndex]; this.confirmation = { title: '移除执行动作', message: `确定移除“${action.name}”及其参数配置吗？`, run: () => { const branches = this.branches; branches[branchIndex].actions.splice(actionIndex, 1); return this.persistDraft(branches); } }; },
    async refreshAfterTest() { try { this.sync(await this.api.getEvent(this.model.id)); } catch (error) { this.fail(error); } },
    warnIncompleteDraft() { this.notify(`${this.draftProblem}。草稿可继续编辑，完成配置后即可发布。`); },
    openTest() { if (this.selected === 'draft' && this.draftProblem) { this.warnIncompleteDraft(); return; } this.testVisible = true; },
    openPublish() { if (this.selected === 'draft' && this.draftProblem) { this.warnIncompleteDraft(); return; } this.publishForm = { version: this.selected === 'draft' ? '' : this.selected, description: this.selectedSnapshot.description || '' }; this.publishError = ''; this.publishVisible = true; },
    async confirmPublish() { const version = this.publishForm.version.trim(); if (this.selected === 'draft' && !/^v\d+\.\d+\.\d+$/.test(version)) { this.publishError = '版本号格式应为 v1.2.3'; return; } if (this.selected === 'draft' && this.model.versions.some(item => item.version === version)) { this.publishError = '该版本号已存在'; return; } this.busy = true; try { let updated; if (this.selected === 'draft') updated = await this.api.publishDraft(this.model.id, { version, description: this.publishForm.description }); else { if (this.publishForm.description !== this.selectedSnapshot.description) await this.api.updateVersionDescription(this.model.id, version, this.publishForm.description); updated = await this.api.publishVersion(this.model.id, version); } this.sync(updated, version); this.publishVisible = false; this.notify(`${version} 已发布运行；接入状态保持不变`); } catch (error) { this.publishError = error.message || '发布失败'; } finally { this.busy = false; } },
    cancelPublish() { this.confirmation = { title: '取消发布运行', message: `取消 ${this.model.currentVersion} 的发布运行后，版本会保留在历史列表，接入状态不变。`, run: async () => { const updated = await this.api.cancelPublish(this.model.id); this.sync(updated, 'draft'); this.notify('已取消发布运行；接入状态保持不变'); } }; },
    copyToDraft() { this.confirmation = { title: '复制为草稿', message: `继续后将用 ${this.selected} 的配置覆盖当前草稿，草稿测试状态也会清除。`, run: async () => { const updated = await this.api.copyVersionToDraft(this.model.id, this.selected); this.sync(updated, 'draft'); this.notify('已复制为草稿'); } }; },
    deleteVersion() { if (this.isCurrent) return; this.confirmation = { title: '删除版本', message: `确定删除 ${this.selected} 吗？此操作不会删除历史运行记录。`, run: async () => { const updated = await this.api.deleteVersion(this.model.id, this.selected); this.sync(updated, this.model.currentVersion || 'draft'); this.notify('版本已删除'); } }; },
    openDescription() { this.descriptionText = this.selectedSnapshot.description || ''; this.descriptionVisible = true; },
    async saveDescription() { try { const updated = this.selected === 'draft' ? await this.api.saveDraft(this.model.id, { ...this.model.draft, description: this.descriptionText }) : await this.api.updateVersionDescription(this.model.id, this.selected, this.descriptionText); this.sync(updated); this.descriptionVisible = false; this.notify('版本描述已保存'); } catch (error) { this.fail(error); } },
    async executeConfirmed() { const choice = this.confirmation; this.confirmation = null; if (!choice) return; try { await choice.run(); } catch (error) { this.fail(error); } },
  },
};
</script>

