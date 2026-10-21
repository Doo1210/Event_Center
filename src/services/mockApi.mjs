import { clone, createEmptyDraft, normalizeBranches, selectBranch, sourceSummary, stripCredentials, validateDraft } from '../domain/model.mjs';
import { resources, seedEvents, seedRuns } from '../data/fixtures.mjs';

/**
 * 仅供本目录独立演示。数据只保存在当前 JS 实例的内存中；不请求网络，
 * 不触发真实动作，也不将接入凭据写入 localStorage。
 */
export function createMockEventCenterApi() {
  let events = clone(seedEvents);
  const runs = clone(seedRuns);
  let sequence = 100;
  const nextId = prefix => `${prefix}-${++sequence}`;
  const now = () => new Date().toLocaleString('sv-SE').replace('T', ' ');
  const eventValue = (payload, path) => String(path || '').replace(/^payload\./, '').split('.').reduce((value, key) => value?.[key], payload);
  const actionInput = (action, payload) => action.prompt
    ? action.prompt.replace(/\{\{([^}]+)\}\}/g, (_, key) => String(eventValue(payload, key.trim()) ?? `{{${key}}}`))
    : Object.fromEntries(Object.entries(action.params || {}).map(([key, value]) => [key, value.mode === 'event' ? eventValue(payload, value.value) : value.value]));
  // Sample run data for the standalone frontend prototype. A backend adapter
  // replaces these action results when the component is connected to services.
  const sampleActionRun = (action, payload, started) => {
    const resolvedInput = actionInput(action, payload);
    const suffix = String(payload.event_id || 'TEST-0001').split('-').at(-1);
    const durationMs = ({ 'repair-order': 1400, 'device-expert': 2000, 'device-alert': 2700, 'archive-flow': 480, 'alert-agent': 1800, 'send-notice': 420 }[action.resourceId]) || 750;
    const output = {
      'repair-order': { work_order_id: `WO-TEST-${suffix}`, priority: resolvedInput.priority || 'P1', status: '已创建' },
      'device-expert': { diagnosis: '设备运行指标异常', recommendation: '检查设备状态并安排维护', risk_level: payload.status === 'critical' ? '严重' : '中' },
      'device-alert': { alert_id: `AL-TEST-${suffix}`, level: payload.status === 'critical' ? 'critical' : 'warning', status: '已创建' },
      'archive-flow': { archive_id: `ARC-TEST-${suffix}`, device_id: payload.device_id || null, status: '已归档' },
      'alert-agent': { risk_level: '中', trend: '温度与电压指标需要持续关注', suggestion: '安排下一班次复核' },
      'send-notice': { message_id: `MSG-TEST-${suffix}`, recipient: resolvedInput.recipient, status: '已发送' },
      'order-review': { order_id: resolvedInput.orderId, checked: true },
    }[action.resourceId] || { status: '执行成功', action: action.name, event_id: payload.event_id || null };
    return { kind: action.kind, name: action.name, status: 'success', input: resolvedInput, output, startedAt: new Date(started + 30).toISOString(), finishedAt: new Date(started + 30 + durationMs).toISOString(), durationMs };
  };
  const findEvent = id => {
    const event = events.find(item => String(item.id) === String(id) && !item.archived);
    if (!event) throw new Error('事件不存在或已删除');
    return event;
  };
  const present = event => ({
    ...clone(event),
    sourceSummary: event.demoSourceSummary || sourceSummary(event.sourceType, event.sourceConfig),
    triggerCount: event.demoTriggerCount ?? runs.filter(run => run.eventId === event.id).length,
  });

  return {
    async listEvents(query = {}) {
      let items = events.filter(event => !event.archived).map(present);
      const keyword = String(query.search || '').trim().toLowerCase();
      if (keyword) items = items.filter(event => event.name.toLowerCase().includes(keyword));
      if (query.sourceType) items = items.filter(event => event.sourceType === query.sourceType);
      if (query.intake) items = items.filter(event => event.intakeEnabled === (query.intake === 'on'));
      if (query.processing) items = items.filter(event => (event.processEnabled && event.currentVersion ? 'running' : 'pending') === query.processing);
      return { items, total: items.length };
    },

    async getEvent(id) { return present(findEvent(id)); },

    async createEvent(input) {
      if (!String(input.name || '').trim()) throw new Error('请输入事件名称');
      const event = {
        id: nextId('evt'), name: String(input.name).trim(), description: String(input.description || '').trim(),
        sourceType: input.sourceType,
        sourceConfig: stripCredentials(input.sourceConfig),
        intakeEnabled: false, processEnabled: false, currentVersion: null,
        draft: createEmptyDraft(), versions: [],
      };
      events.unshift(event);
      return present(event);
    },

    async updateEvent(id, input) {
      const event = findEvent(id);
      if (!String(input.name || '').trim()) throw new Error('请输入事件名称');
      event.name = String(input.name).trim();
      event.description = String(input.description || '').trim();
      event.sourceType = input.sourceType;
      event.sourceConfig = stripCredentials(input.sourceConfig);
      delete event.demoSourceSummary;
      return present(event);
    },

    async setIntake(id, enabled) {
      const event = findEvent(id);
      event.intakeEnabled = !!enabled;
      return present(event);
    },

    async duplicateEvent(id) {
      const source = findEvent(id);
      const copy = clone(source);
      copy.id = nextId('evt');
      copy.name += '（副本）';
      copy.intakeEnabled = false;
      copy.processEnabled = false;
      copy.currentVersion = null;
      delete copy.demoTriggerCount;
      delete copy.demoActionStats;
      copy.draft = { description: '', tested: false, branches: normalizeBranches(source.draft && source.draft.branches || source.versions[0] && source.versions[0].branches) };
      copy.versions = clone(source.versions || []);
      events.unshift(copy);
      return present(copy);
    },

    async deleteEvent(id) {
      findEvent(id).archived = true;
      return { ok: true };
    },

    async saveDraft(id, draft) {
      const event = findEvent(id);
      event.draft = { description: String(draft.description || ''), tested: false, branches: normalizeBranches(draft.branches) };
      return present(event);
    },

    async publishDraft(id, input) {
      const event = findEvent(id);
      const version = String(input.version || '').trim();
      if (!/^v\d+\.\d+\.\d+$/.test(version)) throw new Error('版本号格式应为 v1.2.3');
      if (event.versions.some(item => item.version === version)) throw new Error('该版本号已存在');
      const problem = validateDraft(event.draft);
      if (problem) throw new Error(problem);
      event.versions.unshift({ version, description: String(input.description || '').trim(), createdAt: now(), tested: !!event.draft.tested, branches: normalizeBranches(event.draft.branches) });
      event.currentVersion = version;
      event.processEnabled = true;
      event.draft = createEmptyDraft();
      return present(event);
    },

    async publishVersion(id, version) {
      const event = findEvent(id);
      if (!event.versions.some(item => item.version === version)) throw new Error('版本不存在');
      event.currentVersion = version;
      event.processEnabled = true;
      return present(event);
    },

    async cancelPublish(id) {
      const event = findEvent(id);
      event.currentVersion = null;
      event.processEnabled = false;
      return present(event);
    },

    async deleteVersion(id, version) {
      const event = findEvent(id);
      if (event.currentVersion === version) throw new Error('请先取消发布运行，再删除当前版本');
      event.versions = event.versions.filter(item => item.version !== version);
      return present(event);
    },

    async copyVersionToDraft(id, version) {
      const event = findEvent(id);
      const snapshot = event.versions.find(item => item.version === version);
      if (!snapshot) throw new Error('版本不存在');
      event.draft = { description: '', tested: false, branches: normalizeBranches(snapshot.branches) };
      return present(event);
    },

    async updateVersionDescription(id, version, description) {
      const event = findEvent(id);
      const snapshot = event.versions.find(item => item.version === version);
      if (!snapshot) throw new Error('版本不存在');
      snapshot.description = String(description || '').trim();
      return present(event);
    },

    async listResources() { return clone(resources); },

    async simulate(id, input) {
      const event = findEvent(id);
      const isDraft = input.version === 'draft';
      const snapshot = isDraft ? event.draft : event.versions.find(item => item.version === input.version);
      if (!snapshot) throw new Error('所选版本不存在');
      const started = Date.now();
      const startedAt = new Date(started).toISOString();
      const branch = selectBranch(snapshot.branches, input.payload);
      const actions = clone(branch.actions).map(action => sampleActionRun(action, input.payload, started));
      const result = !actions.length ? 'unconfigured' : actions.some(action => action.status === 'failure') ? 'failure' : 'success';
      const durationMs = 130 + Math.max(0, ...actions.map(action => action.durationMs));
      const finishedAt = new Date(started + durationMs).toISOString();
      if (isDraft) event.draft.tested = true;
      else snapshot.tested = true;
      const direct = snapshot.branches.length === 1 && branch.isDefault;
      const operators = { eq: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤', contains: '包含', in: 'in' };
      const conditions = branch.conditions.map(condition => `${condition.field} ${operators[condition.operator] || condition.operator} ${condition.value}`).join(branch.logic === 'any' ? ' 或 ' : ' 且 ');
      return {
        version: input.version,
        branch: branch.name,
        conditions: clone(branch.conditions),
        actions,
        result,
        startedAt,
        finishedAt,
        durationMs,
        trace: [
          { offsetMs: 0, title: '接收事件数据', detail: `JSON 解析成功 · ${Object.keys(input.payload).length} 个字段` },
          { offsetMs: 20, title: `命中分支：${direct ? '直接处理' : branch.name}`, detail: branch.isDefault ? (direct ? '此流程直接处理所有事件。' : '未命中其他条件，进入默认分支。') : `命中条件：${conditions}` },
          { offsetMs: 30, title: actions.length ? `执行动作 · ${actions.length} 个并行触发` : '未配置执行动作', detail: actions.length ? '各动作独立记录执行结果与输入输出。' : '命中分支没有配置动作。' },
          { offsetMs: durationMs, title: `本次处理结束 · ${result === 'success' ? '执行成功' : result === 'failure' ? '执行失败' : '未配置执行动作'}`, detail: `总耗时 ${(durationMs / 1000).toFixed(1)}s` },
        ],
      };
    },

    async listRuns(id, query = {}) {
      findEvent(id);
      let items = runs.filter(run => run.eventId === id);
      if (query.search) items = items.filter(run => run.id.toLowerCase().includes(String(query.search).toLowerCase()));
      if (query.version) items = items.filter(run => run.version === query.version);
      if (query.result) items = items.filter(run => run.result === query.result);
      if (query.from) items = items.filter(run => run.receivedAt.slice(0, 10) >= query.from);
      if (query.to) items = items.filter(run => run.receivedAt.slice(0, 10) <= query.to);
      items = items.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
      const page = Math.max(1, Number(query.page) || 1);
      const pageSize = Math.max(1, Number(query.pageSize) || 10);
      return { items: clone(items.slice((page - 1) * pageSize, page * pageSize)), total: items.length, page, pageSize };
    },

    async getRun(id, runId) {
      findEvent(id);
      const run = runs.find(item => item.eventId === id && item.id === runId);
      if (!run) throw new Error('事件记录不存在');
      return clone(run);
    },

    async getActionStats(id, version = '') {
      const event = findEvent(id);
      if (event.demoActionStats) {
        const selected = event.demoActionStats.filter(item => !version || item.version === version);
        const rows = selected.flatMap(item => {
          const snapshot = event.versions.find(entry => entry.version === item.version);
          return Object.entries(item.branches).flatMap(([branchName, counts]) => {
            const branch = snapshot?.branches.find(entry => entry.name === branchName);
            return (branch?.actions || []).map((action, index) => ({ version: item.version, branch: branchName, kind: action.kind, name: action.name, success: counts.calls - (counts.failed[index] || 0), failure: counts.failed[index] || 0 }));
          });
        });
        return { triggerCount: version ? selected.reduce((sum, item) => sum + item.count, 0) : event.demoTriggerCount, rows };
      }
      const selected = runs.filter(run => run.eventId === id && (!version || run.version === version));
      const groups = new Map();
      selected.forEach(run => (run.actions || []).forEach(action => {
        const key = [run.version || '—', run.branch || '—', action.kind, action.name].join('|');
        if (!groups.has(key)) groups.set(key, { version: run.version || '—', branch: run.branch || '—', kind: action.kind, name: action.name, success: 0, failure: 0 });
        const row = groups.get(key);
        if (action.status === 'success') row.success++;
        if (action.status === 'failure') row.failure++;
      }));
      return { triggerCount: selected.length, rows: [...groups.values()] };
    },
  };
}
