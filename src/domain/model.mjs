/** 事件中心的纯业务规则。运行与发布的最终判定仍以服务端为准。 */

export const SOURCE_TYPES = ['Timer', 'WebHook', 'Kafka', 'MQTT', 'Pulsar'];
export const ACTION_KINDS = ['tool', 'workflow', 'agent', 'expert'];

export const clone = value => JSON.parse(JSON.stringify(value));

export function createEmptyDraft() {
  return {
    description: '',
    tested: false,
    branches: [{ id: 'default', name: '其他情况', isDefault: true, logic: 'all', conditions: [], actions: [] }],
  };
}

export function normalizeBranches(branches) {
  const source = Array.isArray(branches) ? clone(branches) : [];
  const conditional = source.filter(branch => !branch.isDefault);
  const fallback = source.find(branch => branch.isDefault) || createEmptyDraft().branches[0];
  conditional.forEach((branch, index) => {
    branch.id = branch.id || `branch-${index + 1}`;
    branch.conditions = Array.isArray(branch.conditions) ? branch.conditions : [];
    branch.actions = Array.isArray(branch.actions) ? branch.actions : [];
    branch.logic = branch.logic === 'any' ? 'any' : 'all';
  });
  fallback.id = fallback.id || 'default';
  fallback.name = '其他情况';
  fallback.isDefault = true;
  fallback.conditions = [];
  fallback.actions = Array.isArray(fallback.actions) ? fallback.actions : [];
  return [...conditional, fallback];
}

export function countActions(branches) {
  return normalizeBranches(branches).reduce((count, branch) => count + branch.actions.length, 0);
}

export function validateDraft(draft) {
  const branches = normalizeBranches(draft && draft.branches);
  if (!countActions(branches)) return '请先添加至少一个执行动作';
  for (const branch of branches) {
    if (branch.isDefault) continue;
    if (!String(branch.name || '').trim()) return '请填写分支名称';
    if (!branch.conditions.length) return `请为“${branch.name}”添加条件`;
    if (!branch.actions.length) return `请为“${branch.name}”添加执行动作`;
    if (branch.conditions.some(condition => !condition.field || !condition.operator || String(condition.value).trim() === '')) {
      return `请完善“${branch.name}”的判断条件`;
    }
  }
  return '';
}

export function processingState(event) {
  return event && event.processEnabled && event.currentVersion ? 'running' : 'pending';
}

export function eventStatus(event) {
  const processingEnabled = processingState(event) === 'running';
  if (event.intakeEnabled) return processingEnabled ? 'running' : 'intake-only';
  return processingEnabled ? 'paused' : 'disabled';
}

export function combinedState(event) {
  switch (eventStatus(event)) {
    case 'running': return `运行中·${event.currentVersion}`;
    case 'intake-only': return '仅接入·未启用处理';
    case 'paused': return `暂停接入·暂停运行·${event.currentVersion}`;
    default: return '未接入·未启用处理';
  }
}

function valueAt(data, field) {
  const path = String(field || '').replace(/^payload\./, '');
  const root = data && data.payload && typeof data.payload === 'object' ? data.payload : data;
  return path.split('.').reduce((value, key) => value == null ? undefined : value[key], root);
}

export function evaluateCondition(condition, payload) {
  const actual = valueAt(payload, condition.field);
  if (actual === undefined || actual === null) return false;
  const expected = condition.value;
  const left = Number(actual);
  const right = Number(expected);
  const numeric = String(actual).trim() !== '' && String(expected).trim() !== '' && Number.isFinite(left) && Number.isFinite(right);
  switch (condition.operator) {
    case 'eq': return String(actual) === String(expected);
    case 'ne': return String(actual) !== String(expected);
    case 'gt': return numeric && left > right;
    case 'gte': return numeric && left >= right;
    case 'lt': return numeric && left < right;
    case 'lte': return numeric && left <= right;
    case 'contains': return String(actual).includes(String(expected));
    case 'in': return String(expected).split(',').map(value => value.trim()).includes(String(actual));
    default: return false;
  }
}

export function selectBranch(branches, payload) {
  const ordered = normalizeBranches(branches);
  for (const branch of ordered) {
    if (branch.isDefault) continue;
    const outcomes = branch.conditions.map(condition => evaluateCondition(condition, payload));
    if (outcomes.length && (branch.logic === 'any' ? outcomes.some(Boolean) : outcomes.every(Boolean))) return branch;
  }
  return ordered[ordered.length - 1];
}

export function parsePayload(text) {
  let value;
  try { value = JSON.parse(text); } catch (error) { throw new Error('请输入有效的 JSON 对象'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('事件数据必须是 JSON 对象');
  return value;
}

export function sourceSummary(type, config = {}) {
  if (type === 'Timer') return (config.timerMode === 'cron' ? config.cron : config.schedule) || config.cron || '未配置触发时间';
  if (type === 'WebHook') return `${config.method || 'POST'} ${config.path || '/webhook/...'}`;
  if (type === 'Kafka') return `${config.topic || '未配置 Topic'} · ${config.brokers || '未配置 Broker'}`;
  if (type === 'MQTT') return `${config.topic || '未配置主题'} · ${config.broker || '未配置 Broker'}`;
  if (type === 'Pulsar') return `${config.topic || '未配置 Topic'} · ${config.serviceUrl || '未配置服务地址'}`;
  return '';
}

export function stripCredentials(config) {
  const result = clone(config || {});
  for (const key of Object.keys(result)) {
    if (/password|secret|apikey|api_key|credential|token/i.test(key)) delete result[key];
  }
  return result;
}
