import { createEmptyDraft, normalizeBranches } from '../domain/model.mjs';

const param = (key, label, type = 'String', required = true) => ({ key, label, type, required });
const operation = (id, groupId, groupName, groupDescription, groupKind, name, detail, params) => ({ id, kind: 'tool', groupId, groupName, groupDescription, groupKind, name, detail, params });
export const resources = [
  { id: 'repair-order', kind: 'workflow', name: '生成设备检修工单', detail: '创建工单', params: [param('deviceId', '设备编号'), param('priority', '优先级', 'String', false)] },
  { id: 'energy-report', kind: 'workflow', name: '能耗巡检报告', detail: '生成并归档', params: [param('deviceId', '设备编号')] },
  { id: 'order-review', kind: 'workflow', name: '大额订单核验', detail: '订单复核', params: [param('orderId', '订单编号'), param('amount', '订单金额', 'Number')] },
  { id: 'sync-order', kind: 'workflow', name: '同步订单状态', detail: '状态同步', params: [param('orderId', '订单编号')] },
  { id: 'archive-flow', kind: 'workflow', name: '环境数据归档', detail: '数据入库', params: [param('deviceId', '设备编号'), param('temperature', '温度', 'Number')] },
  { id: 'inspection-order', kind: 'workflow', name: '生成巡检工单', detail: '创建工单', params: [param('deviceId', '设备编号')] },
  { id: 'device-expert', kind: 'expert', name: '设备诊断专家', detail: '异常诊断与处理建议', promptExample: '请分析设备 {{device_id}} 的电压 {{voltage}}，判断异常原因并给出处理建议。', params: [] },
  { id: 'device-state-expert', kind: 'expert', name: '设备状态检查专家', detail: '设备状态核验', promptExample: '请核验设备 {{device_id}} 上报的状态 {{status}}。', params: [] },
  { id: 'deep-expert', kind: 'expert', name: '故障深度诊断专家', detail: '复杂故障分析', promptExample: '请结合事件数据诊断设备 {{device_id}} 的故障。', params: [] },
  { id: 'inspection-agent', kind: 'agent', name: '设备巡检智能体', detail: '分析巡检事件并生成摘要', promptExample: '请根据设备 {{device_id}} 的事件数据生成巡检摘要。', params: [] },
  { id: 'alert-agent', kind: 'agent', name: '告警分析智能体', detail: '归纳告警并给出处理建议', promptExample: '请分析告警 {{event_id}} 的状态 {{status}} 和指标 {{voltage}}。', params: [] },
  { id: 'work-order-agent', kind: 'agent', name: '工单协作智能体', detail: '整理事件并协助创建工单', promptExample: '请根据事件 {{event_id}} 整理工单所需信息。', params: [] },
  operation('weather-now', 'weather-mcp', '前端测试', '根据地点获取天气信息，包括温度和天气状况描述。', 'MCP', 'getWeatherNow', '根据地点获取当前温度和天气状况描述。', [param('location', '地点')]),
  operation('weather-forecast', 'weather-mcp', '前端测试', '根据地点获取天气信息，包括温度和天气状况描述。', 'MCP', 'getWeatherForecast', '根据地点获取未来几天的天气预报。', [param('location', '地点'), param('days', '预报天数', 'Number', false)]),
  operation('air-quality', 'weather-mcp', '前端测试', '根据地点获取天气信息，包括温度和天气状况描述。', 'MCP', 'getAirQuality', '查询指定地点的空气质量。', [param('location', '地点')]),
  operation('read-device', 'device-mcp', '设备管理 MCP', '读取设备状态、创建告警和发送设备指令。', 'MCP', '读取设备状态', '读取指定设备的最新运行状态。', [param('deviceId', '设备编号')]),
  operation('device-alert', 'device-mcp', '设备管理 MCP', '读取设备状态、创建告警和发送设备指令。', 'MCP', '设备告警接口', '为指定设备创建告警记录。', [param('deviceId', '设备编号')]),
  operation('send-command', 'device-mcp', '设备管理 MCP', '读取设备状态、创建告警和发送设备指令。', 'MCP', '下发设备指令', '向指定设备发送控制指令。', [param('deviceId', '设备编号'), param('command', '指令内容')]),
  operation('send-notice', 'message-mcp', '企业消息工具', '将事件通知发送至企业协作渠道。', 'MCP', '发送告警通知', '发送企业告警消息。', [param('recipient', '接收对象')]),
  operation('send-order-notice', 'message-mcp', '企业消息工具', '将事件通知发送至企业协作渠道。', 'MCP', '发送订单通知', '发送订单状态消息。', [param('orderId', '订单编号')]),
  operation('code-review', 'review-tool', '代码质量工具', '对代码提交执行自动检查。', '插件', '代码评审工具', '对指定仓库启动代码检查。', [param('repository', '代码仓库')]),
];

const eventMap = value => ({ mode: 'event', value });
const fixedMap = value => ({ mode: 'fixed', value });
const alertTool = { id: 'a-alert', kind: 'tool', resourceId: 'device-alert', name: '设备管理 MCP / 设备告警接口', params: { deviceId: eventMap('device_id') }, prompt: '' };
const expertAction = { id: 'a-expert', kind: 'expert', resourceId: 'device-expert', name: '设备诊断专家', params: {}, prompt: '请结合设备 {{device_id}} 的温度 {{temperature}}、状态 {{status}} 和最近告警，判断故障原因并给出处理建议。' };
const archiveAction = { id: 'a-archive', kind: 'workflow', resourceId: 'archive-flow', name: '环境数据归档', params: { deviceId: eventMap('device_id'), temperature: eventMap('temperature') }, prompt: '' };
const orderAction = { id: 'a-order', kind: 'workflow', resourceId: 'order-review', name: '大额订单核验', params: { orderId: eventMap('order_id'), amount: eventMap('amount') }, prompt: '' };
const noticeAction = { id: 'a-notice', kind: 'tool', resourceId: 'send-notice', name: '企业消息工具 / 发送告警通知', params: { recipient: fixedMap('设备值班群') }, prompt: '' };
const repairAction = { id: 'a-repair', kind: 'workflow', resourceId: 'repair-order', name: '生成设备检修工单', params: { deviceId: eventMap('device_id'), priority: fixedMap('P0') }, prompt: '' };
const warningAgent = { id: 'a-warning-agent', kind: 'agent', resourceId: 'alert-agent', name: '告警分析智能体', params: {}, prompt: '请分析设备 {{device_id}} 的温度 {{temperature}} 与电压 {{voltage}}，归纳风险趋势并给出预警建议。' };

const factoryBranches = [
  { id: 'severe', name: '严重异常', isDefault: false, logic: 'any', conditions: [{ field: 'temperature', operator: 'gte', value: '90' }, { field: 'status', operator: 'eq', value: 'critical' }], actions: [repairAction, expertAction, alertTool] },
  { id: 'warning', name: '提前预警', isDefault: false, logic: 'all', conditions: [{ field: 'temperature', operator: 'gt', value: '75' }, { field: 'voltage', operator: 'gt', value: '250' }], actions: [warningAgent, noticeAction] },
  { id: 'default', name: '其他情况', isDefault: true, logic: 'all', conditions: [], actions: [archiveAction] },
];

const factoryHistoryBranches = [
  { id: 'temperature', name: '温度异常', isDefault: false, logic: 'all', conditions: [{ field: 'temperature', operator: 'gt', value: '80' }], actions: [{ ...expertAction, prompt: '请诊断设备 {{device_id}} 的温度异常 {{temperature}} 并给出建议。' }, alertTool] },
  { id: 'default', name: '其他情况', isDefault: true, logic: 'all', conditions: [], actions: [archiveAction] },
];
const factoryDraftBranches = [
  { id: 'vibration', name: '振动异常', isDefault: false, logic: 'all', conditions: [{ field: 'vibration', operator: 'gt', value: '8' }], actions: [] },
  ...factoryBranches,
];

const orderBranches = [
  { id: 'large', name: '大额订单', isDefault: false, logic: 'all', conditions: [{ field: 'amount', operator: 'gte', value: '10000' }], actions: [orderAction, { ...noticeAction, id: 'a-order-notice', resourceId: 'send-order-notice', name: '企业消息工具 / 发送订单通知', params: { orderId: eventMap('order_id') } }] },
  { id: 'default', name: '其他情况', isDefault: true, logic: 'all', conditions: [], actions: [{ id: 'a-sync-order', kind: 'workflow', resourceId: 'sync-order', name: '同步订单状态', params: { orderId: eventMap('order_id') }, prompt: '' }] },
];

const singleBranch = action => [{ id: 'default', name: '其他情况', isDefault: true, logic: 'all', conditions: [], actions: action ? [action] : [] }];

export const seedEvents = [
  {
    id: 'evt-factory', name: '综合处理流程演示', description: '展示条件分支、版本和并行动作',
    sourceType: 'Kafka', sourceConfig: { brokers: '3 brokers', topic: 'factory.device.events', groupId: 'event-center' }, demoSourceSummary: 'factory.device.events · 3 brokers',
    intakeEnabled: true, processEnabled: true, currentVersion: 'v2.1.0', demoTriggerCount: 832,
    draft: { description: '准备增加振动异常识别', tested: false, branches: factoryDraftBranches },
    demoActionStats: [
      { version: 'v2.1.0', count: 453, branches: { 严重异常: { calls: 72, failed: [3, 2, 5] }, 提前预警: { calls: 138, failed: [4, 2] }, 其他情况: { calls: 242, failed: [1] } } },
      { version: 'v2.0.0', count: 303, branches: { 温度异常: { calls: 92, failed: [2, 4] }, 其他情况: { calls: 211, failed: [1] } } },
      { version: 'v1.0.0', count: 75, branches: { 其他情况: { calls: 75, failed: [0] } } },
    ],
    versions: [
      { version: 'v2.1.0', description: '增加严重异常与提前预警分流', createdAt: '2026-09-29 09:20:00', tested: true, branches: factoryBranches },
      { version: 'v2.0.0', description: '按温度异常分流处理', createdAt: '2026-09-18 15:40:00', tested: true, branches: factoryHistoryBranches },
      { version: 'v1.0.0', description: '事件接入后直接归档', createdAt: '2026-09-02 11:15:00', tested: true, branches: singleBranch(archiveAction) },
    ],
  },
  {
    id: 'evt-order', name: '订单状态更新 WebHook', description: '接收订单回调并触发核验', demoSourceSummary: 'POST /webhook/orders/update', demoTriggerCount: 234,
    sourceType: 'WebHook', sourceConfig: { method: 'POST', path: '/webhook/orders/update', contentType: 'application/json' },
    intakeEnabled: true, processEnabled: true, currentVersion: 'v2.0.0',
    draft: { description: '', tested: false, branches: orderBranches },
    versions: [{ version: 'v2.0.0', description: '当前生效配置', createdAt: '2026-09-28 10:20:00', tested: true, branches: orderBranches }, { version: 'v1.9.0', description: '历史配置', createdAt: '2026-09-20 16:45:00', tested: true, branches: orderBranches }],
  },
  {
    id: 'evt-maintain', name: '周末设备保养提醒', description: '按计划提醒产线设备保养',
    sourceType: 'Timer', sourceConfig: { schedule: '每周六 09:00', cron: '0 0 9 ? * SAT' },
    intakeEnabled: false, processEnabled: true, currentVersion: 'v1.0.0', demoTriggerCount: 41, demoSourceSummary: '每周六 09:00',
    draft: { description: '', tested: false, branches: singleBranch({ id: 'a-inspection', kind: 'workflow', resourceId: 'inspection-order', name: '生成巡检工单', params: { deviceId: eventMap('device_id') }, prompt: '' }) }, versions: [{ version: 'v1.0.0', description: '当前生效配置', createdAt: '2026-09-28 10:20:00', tested: true, branches: singleBranch({ id: 'a-inspection', kind: 'workflow', resourceId: 'inspection-order', name: '生成巡检工单', params: { deviceId: eventMap('device_id') }, prompt: '' }) }],
  },
  {
    id: 'evt-mqtt', name: '包装线振动传感器待接入', description: '接入设备振动上报', demoTriggerCount: 0, demoSourceSummary: 'factory/packaging/vibration',
    sourceType: 'MQTT', sourceConfig: { broker: 'mqtt://emqx.factory.local:1883', topic: 'factory/packaging/vibration', qos: '1', clientId: 'event-center-demo' },
    intakeEnabled: false, processEnabled: false, currentVersion: null, draft: createEmptyDraft(), versions: [],
  },
  {
    id: 'evt-pulsar', name: 'SMT贴片机停机信号订阅', description: '预留的 Pulsar 事件来源', demoTriggerCount: 12, demoSourceSummary: 'industrial/smt/stop_code',
    sourceType: 'Pulsar', sourceConfig: { serviceUrl: 'pulsar://pulsar.factory.local:6650', topic: 'industrial/smt/stop_code' },
    intakeEnabled: false, processEnabled: false, currentVersion: null, draft: createEmptyDraft(), versions: [],
  },
];

// The remaining 1023 list examples use the same event-centred model as 1031.
let demoActionId = 0;
function demoAction(kind, name, params = {}, prompt = '') {
  const operationName = name.split(' / ').at(-1);
  const resource = resources.find(item => item.kind === kind && item.name === operationName);
  return { id: `legacy-action-${++demoActionId}`, kind, resourceId: resource?.id || '', name, params, prompt };
}
function demoBranch(id, name, field, operator, value, actions, logic = 'all') {
  return { id, name, isDefault: false, logic, conditions: [{ field, operator, value }], actions };
}
const demoFallback = actions => ({ id: 'default', name: '其他情况', isDefault: true, logic: 'all', conditions: [], actions });
const demoFlow = (...branches) => normalizeBranches(branches);
const demoSourceConfig = (type, info) => {
  if (type === 'Timer') return { schedule: info };
  if (type === 'WebHook') return { method: 'POST', path: info.replace('POST ', '') };
  if (type === 'Kafka') return { topic: info.split(' · ')[0], brokers: info.split(' · ')[1] || '1 broker' };
  if (type === 'MQTT') return { topic: info, broker: 'mqtt://emqx.factory.local:1883' };
  return { topic: info, serviceUrl: 'pulsar://pulsar.factory.local:6650' };
};
const demoRows = [
  { id: 'evt-1', name: '电表电压过高告警订阅', type: 'Pulsar', info: 'persistent://electricity/alert/', count: 1256, intake: true, running: true, version: 'v1.3.0', branches: demoFlow({ id: 'voltage', name: '电压异常', isDefault: false, logic: 'all', conditions: [{ field: 'voltage', operator: 'gt', value: '250' }, { field: 'status', operator: 'eq', value: 'warning' }], actions: [demoAction('expert', '设备诊断专家', {}, '请分析设备 {{device_id}} 的电压 {{voltage}} 与状态 {{status}}，判断异常原因并给出处理建议。'), demoAction('workflow', '生成设备检修工单', { deviceId: eventMap('device_id'), priority: fixedMap('high') }), demoAction('agent', '告警分析智能体', {}, '请根据设备 {{device_id}} 的电压 {{voltage}}V 和状态 {{status}}，归纳告警原因、影响范围与处理建议，并输出简明摘要。')] }, demoFallback([noticeAction])) },
  { id: 'evt-2', name: '每周五能耗巡检报表', type: 'Timer', info: '每周五 22:00', count: 86, intake: true, running: true, version: 'v1.1.0', branches: demoFlow(demoFallback([demoAction('workflow', '能耗巡检报告', { deviceId: eventMap('device_id') }), demoAction('agent', '设备巡检智能体', {}, '请汇总设备 {{device_id}} 本周的巡检与能耗事件，识别异常趋势并生成报告摘要。')])) },
  { id: 'evt-3', name: '每日早班开机状态确认', type: 'Timer', info: '每日 08:30', count: 342, intake: true, running: false, branches: demoFlow(demoFallback([demoAction('expert', '设备状态检查专家', {}, '请核验设备 {{device_id}} 上报的状态 {{status}}，总结风险和建议。')])) },
  { id: 'evt-5', name: 'GitHub 代码提交通知', type: 'WebHook', info: 'POST /webhook/github/commit', count: 56, intake: true, running: true, version: 'v1.0.2', branches: demoFlow(demoBranch('priority', '高优先级提交', 'author', 'in', 'reviewers', [demoAction('tool', '代码质量工具 / 代码评审工具', { repository: eventMap('repository') })]), demoFallback([])) },
  { id: 'evt-7', name: '设备传感器数据流', type: 'Kafka', info: 'iot.sensor.data · 2 brokers', count: 1523, intake: true, running: true, version: 'v1.4.0', branches: demoFlow(demoBranch('heat', '温度预警', 'temperature', 'gt', '80', [expertAction, alertTool, demoAction('agent', '告警分析智能体', {}, '请分析设备 {{device_id}} 的温度 {{temperature}}，判断是否需要升级告警并给出处理建议。')]), demoFallback([])) },
  { id: 'evt-8', name: '产线设备温湿度上报', type: 'MQTT', info: 'factory/line1/+/telemetry', count: 892, intake: true, running: false, version: 'v1.0.0', branches: demoFlow(demoFallback([archiveAction])) },
  { id: 'evt-10', name: '锅炉压力异常订阅', type: 'Pulsar', info: 'persistent://factory/boiler/pressure', count: 730, intake: true, running: false, version: 'v1.2.0', branches: demoFlow(demoBranch('pressure', '压力过高', 'pressure', 'gt', '1.6', [expertAction]), demoFallback([noticeAction])) },
  { id: 'evt-11', name: '供应商回调接入待配置', type: 'WebHook', info: 'POST /webhook/supplier/callback', count: 0, intake: true, running: false },
  { id: 'evt-12', name: '质检结果回传', type: 'WebHook', info: 'POST /webhook/quality/result', count: 151, intake: false, running: false, version: 'v2.1.0', branches: demoFlow(demoFallback([noticeAction])) },
  { id: 'evt-13', name: '仓储温控事件草稿', type: 'Kafka', info: 'warehouse.temperature · 3 brokers', count: 28, intake: true, running: false, branches: demoFlow(demoBranch('hot', '温度超限', 'temperature', 'gt', '30', [expertAction]), demoFallback([])) },
  { id: 'evt-14', name: '旧产线设备状态流', type: 'Kafka', info: 'legacy.line.status · 1 broker', count: 0, intake: false, running: false, version: 'v0.8.0', branches: demoFlow(demoFallback([archiveAction])) },
  { id: 'evt-15', name: '全厂设备遥测汇总', type: 'MQTT', info: 'factory/+/+/telemetry', count: 99999, intake: true, running: true, version: 'v3.2.1', branches: demoFlow(demoBranch('heat', '温度预警', 'temperature', 'gt', '80', [alertTool, expertAction]), demoFallback([archiveAction])) },
  { id: 'evt-17', name: '月度备件盘点', type: 'Timer', info: '每月 1 日 06:00', count: 0, intake: true, running: true, version: 'v1.0.0', branches: demoFlow(demoFallback([demoAction('workflow', '生成巡检工单', { deviceId: eventMap('device_id') })])) },
  { id: 'evt-18', name: '空压机故障码订阅', type: 'Pulsar', info: 'persistent://factory/compressor/fault', count: 23, intake: true, running: true, version: 'v1.0.1', branches: demoFlow(demoBranch('critical', '严重故障', 'level', 'eq', 'critical', [expertAction, noticeAction]), demoFallback([])) },
];
function demoEvent(row) {
  const branches = row.branches || createEmptyDraft().branches;
  const previous = row.version ? row.version.slice(1).split('.').map(Number) : [];
  if (previous[2] > 0) previous[2]--;
  else if (previous[1] > 0) previous[1]--;
  else if (previous[0] > 0) { previous[0]--; previous[1] = 9; }
  const versions = row.version ? [
    { version: row.version, description: '当前生效配置', createdAt: '2026-09-28 10:20:00', tested: true, branches },
    { version: `v${previous.join('.')}`, description: '历史配置', createdAt: '2026-09-20 16:45:00', tested: true, branches },
  ] : [];
  if (row.id === 'evt-1') {
    const longFlow = demoFlow(...Array.from({ length: 10 }, (_, index) => demoBranch(`demo-${index + 1}`, `演示条件 ${index + 1}`, 'voltage', 'gt', String(210 + index * 5), [index % 2 ? demoAction('workflow', '生成巡检工单', { deviceId: eventMap('device_id') }) : demoAction('expert', '设备诊断专家', {}, '请分析设备 {{device_id}} 的电压 {{voltage}} 并给出建议。')])), demoFallback([noticeAction]));
    for (let patch = 11; patch >= 0; patch--) versions.push({ version: `v1.1.${patch}`, description: '演示历史配置', createdAt: '2026-08-28 10:00:00', tested: true, branches: patch === 11 ? longFlow : branches });
    for (let patch = 9; patch >= 0; patch--) versions.push({ version: `v1.0.${patch}`, description: '演示历史配置', createdAt: '2026-08-16 10:00:00', tested: true, branches });
  }
  return { id: row.id, name: row.name, description: '', sourceType: row.type, sourceConfig: demoSourceConfig(row.type, row.info), demoSourceSummary: row.info, demoTriggerCount: row.count, intakeEnabled: row.intake, processEnabled: row.running, currentVersion: row.running ? row.version : null, draft: { description: '', tested: false, branches }, versions };
}
seedEvents.push(...demoRows.map(demoEvent));
const referenceOrder = ['evt-factory', 'evt-1', 'evt-2', 'evt-3', 'evt-pulsar', 'evt-5', 'evt-order', 'evt-7', 'evt-8', 'evt-maintain', 'evt-10', 'evt-11', 'evt-12', 'evt-13', 'evt-14', 'evt-15', 'evt-mqtt', 'evt-17', 'evt-18'];
seedEvents.sort((a, b) => referenceOrder.indexOf(a.id) - referenceOrder.indexOf(b.id));

const coverageLogSpecs = [
  { id: 'EVT-20260929-10542', time: '2026-09-29 14:32:06', version: 'v2.1.0', branch: '严重异常', device: 'COMP-A12', temperature: 96.4, voltage: 263, status: 'critical', recentAlerts: ['轴承温度持续上升', '电压波动'], ms: 3400, outputs: [{ work_order_id: 'WO-10542', priority: 'P0', status: '已创建' }, { diagnosis: '冷却系统效率下降，轴承温度异常', recommendation: '立即停机检查冷却回路', risk_level: '严重' }, { alert_id: 'AL-10542', level: 'critical', status: '已创建' }] },
  { id: 'EVT-20260929-10518', time: '2026-09-29 14:18:42', version: 'v2.1.0', branch: '提前预警', device: 'MOTOR-B07', temperature: 82.1, voltage: 258, status: 'warning', ms: 2100, outputs: [{ risk_level: '中', trend: '温度与电压同时升高', suggestion: '安排下一班次复核' }, { message_id: 'MSG-10518', recipient: '设备值班群', status: '已发送' }] },
  { id: 'EVT-20260929-10487', time: '2026-09-29 13:56:12', version: 'v2.1.0', branch: '严重异常', device: 'COMP-C03', temperature: 103.2, voltage: 271, status: 'critical', ms: 5800, failed: [2], outputs: [{ work_order_id: 'WO-10487', priority: 'P0', status: '已创建' }, { diagnosis: '压缩机过热', recommendation: '停止运行并检查散热风机', risk_level: '严重' }, { error_code: 'SERVICE_UNAVAILABLE', message: '设备管理 MCP 暂时不可用，告警创建失败' }] },
  { id: 'EVT-20260929-10455', time: '2026-09-29 13:40:27', version: 'v2.1.0', branch: '其他情况', device: 'MOTOR-D11', temperature: 63.5, voltage: 226, status: 'normal', ms: 480, outputs: [{ archive_id: 'ARC-10455', status: '已归档' }] },
  { id: 'EVT-20260929-10426', time: '2026-09-29 12:38:55', version: 'v2.1.0', branch: '提前预警', device: 'MOTOR-E09', temperature: 79.8, voltage: 257, status: 'warning', ms: 3900, failed: [0], outputs: [{ error_code: 'AGENT_TIMEOUT', message: '告警分析智能体响应超时' }, { message_id: 'MSG-10426', recipient: '设备值班群', status: '已发送' }] },
  { id: 'EVT-20260929-10381', time: '2026-09-29 11:20:16', version: 'v2.1.0', device: 'MOTOR-F02', temperature: 88.1, voltage: 247, status: 'warning', ms: 12, reason: '处理当时已暂停' },
  { id: 'EVT-20260928-10344', time: '2026-09-28 18:08:02', version: 'v2.0.0', branch: '温度异常', device: 'PUMP-A04', temperature: 87.6, voltage: 231, status: 'warning', ms: 2700, outputs: [{ diagnosis: '泵体散热不足', recommendation: '检查过滤网与风机', risk_level: '中' }, { alert_id: 'AL-10344', level: 'warning', status: '已创建' }] },
  { id: 'EVT-20260928-10308', time: '2026-09-28 16:22:31', version: 'v2.0.0', branch: '温度异常', device: 'PUMP-B15', temperature: 91.3, voltage: 235, status: 'warning', ms: 6200, failed: [1], outputs: [{ diagnosis: '泵体温度超限', recommendation: '检查循环水流量', risk_level: '高' }, { error_code: 'HTTP_503', message: '告警接口返回服务暂不可用' }] },
  { id: 'EVT-20260928-10272', time: '2026-09-28 14:05:19', version: 'v2.0.0', branch: '其他情况', device: 'PUMP-C06', temperature: 52.7, voltage: 223, status: 'normal', ms: 510, outputs: [{ archive_id: 'ARC-10272', status: '已归档' }] },
  { id: 'EVT-20260915-10136', time: '2026-09-15 09:16:48', version: 'v1.0.0', branch: '其他情况', device: 'MOTOR-A12', temperature: 45.2, voltage: 220, status: 'normal', ms: 420, outputs: [{ archive_id: 'ARC-10136', status: '已归档' }] },
  { id: 'EVT-20260901-10003', time: '2026-09-01 08:05:12', device: 'MOTOR-A12', temperature: 76.2, voltage: 229, status: 'warning', ms: 6, reason: '接入时没有生效的处理版本' },
];
const resolveInput = (action, payload) => action.prompt
  ? action.prompt.replace(/\{\{([^}]+)\}\}/g, (_, key) => String(payload[key.trim()] ?? `{{${key}}}`))
  : Object.fromEntries(Object.entries(action.params || {}).map(([key, entry]) => [key, entry.mode === 'event' ? payload[entry.value] : entry.value]));
function coverageRun(spec) {
  const payload = { event_id: spec.id, device_id: spec.device, temperature: spec.temperature, voltage: spec.voltage, status: spec.status };
  if (spec.recentAlerts) payload.recent_alerts = spec.recentAlerts;
  const base = { id: spec.id, eventId: 'evt-factory', receivedAt: spec.time, version: spec.version || null, durationMs: spec.ms, payload };
  if (spec.reason) return { ...base, branch: null, result: 'not_executed', reason: spec.reason, actions: [] };
  const snapshot = seedEvents[0].versions.find(item => item.version === spec.version);
  const selected = snapshot.branches.find(item => item.name === spec.branch);
  const actions = selected.actions.map((action, index) => ({ kind: action.kind, name: action.name, status: spec.failed?.includes(index) ? 'failure' : 'success', durationMs: Math.min(spec.ms, Math.round(spec.ms * (.42 + index * .18))), input: resolveInput(action, payload), output: spec.outputs[index] || {} }));
  return { ...base, branch: spec.branch, result: actions.some(action => action.status === 'failure') ? 'failure' : 'success', actions };
}
const sampleLogTimes = ['2026-09-28 14:32:06', '2026-09-28 14:28:31', '2026-09-28 13:51:10', '2026-09-28 13:22:48', '2026-09-28 12:09:14', '2026-09-28 11:45:03', '2026-09-28 10:51:37', '2026-09-28 10:15:22', '2026-09-28 09:42:09'];
function legacyRuns(event, eventIndex) {
  const count = Math.min(event.demoTriggerCount || 0, event.processEnabled ? 9 : 1);
  return Array.from({ length: count }, (_, index) => {
    const id = `EVT-20260928-${String(10482 - index * 23 + eventIndex * 31).padStart(5, '0')}`;
    const payload = { event_id: id, device_id: `DEVICE-${eventIndex}`, temperature: 82 + index, voltage: 252, status: index % 2 ? 'normal' : 'warning', amount: 12800, order_id: `SO-20260928-${eventIndex}` };
    const base = { id, eventId: event.id, receivedAt: sampleLogTimes[index], version: event.currentVersion, durationMs: index === 2 ? 8100 : 2400, payload };
    if (!event.processEnabled || index === 4 || index === 5) return { ...base, branch: null, result: 'not_executed', reason: !event.processEnabled || index === 5 ? '接入时没有生效的处理版本' : '处理当时已暂停', actions: [] };
    const snapshot = event.versions.find(item => item.version === event.currentVersion);
    const branches = snapshot?.branches || createEmptyDraft().branches;
    const selected = index === 1 || index === 3 || index === 7 ? branches.at(-1) : branches.find(item => !item.isDefault) || branches.at(-1);
    const failed = index === 2;
    const actions = selected.actions.map((action, actionIndex) => ({ kind: action.kind, name: action.name, status: failed && actionIndex === selected.actions.length - 1 ? 'failure' : 'success', durationMs: failed ? 8100 : 600 + actionIndex * 350, input: resolveInput(action, payload), output: failed && actionIndex === selected.actions.length - 1 ? { error_code: 'ACTION_EXECUTION_FAILED', message: '动作执行超时或目标服务返回错误' } : { status: '执行成功', event_id: id } }));
    return { ...base, branch: selected.name, result: failed ? 'failure' : 'success', actions };
  });
}
export const seedRuns = [
  ...coverageLogSpecs.map(coverageRun),
  ...seedEvents.slice(1).flatMap((event, index) => legacyRuns(event, index + 1)),
];


