import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockEventCenterApi } from '../src/services/mockApi.mjs';

test('发布只改变处理状态，生成空白草稿并保留接入状态', async () => {
  const api = createMockEventCenterApi();
  const before = await api.getEvent('evt-13');
  assert.equal(before.intakeEnabled, true);
  const published = await api.publishDraft(before.id, { version: 'v1.0.0', description: '首次运行' });
  assert.equal(published.currentVersion, 'v1.0.0');
  assert.equal(published.processEnabled, true);
  assert.equal(published.intakeEnabled, true);
  assert.equal(published.draft.branches.length, 1);
  assert.equal(published.draft.branches[0].actions.length, 0);
  await assert.rejects(api.publishDraft(before.id, { version: 'v1.0.0' }), /已存在|至少一个执行动作/);
  const cancelled = await api.cancelPublish(before.id);
  assert.equal(cancelled.processEnabled, false);
  assert.equal(cancelled.intakeEnabled, true);
  assert.ok(cancelled.versions.some(version => version.version === 'v1.0.0'));
});

test('模拟测试不会新增正式记录或动作统计', async () => {
  const api = createMockEventCenterApi();
  const beforeRuns = await api.listRuns('evt-factory');
  const beforeStats = await api.getActionStats('evt-factory');
  const result = await api.simulate('evt-factory', { version: 'draft', payload: { device_id: 'A12', temperature: 95, status: 'critical' } });
  assert.equal(result.branch, '严重异常');
  assert.ok(result.actions.every(action => action.status === 'simulated'));
  assert.equal((await api.listRuns('evt-factory')).total, beforeRuns.total);
  assert.deepEqual(await api.getActionStats('evt-factory'), beforeStats);
  assert.equal((await api.getEvent('evt-factory')).draft.tested, true);
});

test('复制历史版本只覆盖草稿；凭据不留在演示数据中', async () => {
  const api = createMockEventCenterApi();
  const original = await api.getEvent('evt-factory');
  const copied = await api.copyVersionToDraft(original.id, 'v2.0.0');
  assert.equal(copied.currentVersion, original.currentVersion);
  assert.equal(copied.draft.tested, false);
  assert.equal(copied.draft.branches.length, 2);
  const created = await api.createEvent({ name: '新接入', sourceType: 'Kafka', sourceConfig: { brokers: 'broker:9092', topic: 'topic', groupId: 'group', password: 'do-not-store' } });
  assert.equal(created.sourceConfig.password, undefined);
  assert.equal(created.intakeEnabled, false);
  assert.equal(created.processEnabled, false);
});

test('统计按事件计数，多个并行动作分别统计', async () => {
  const api = createMockEventCenterApi();
  const stats = await api.getActionStats('evt-factory', 'v2.1.0');
  assert.equal(stats.triggerCount, 453);
  assert.equal(stats.rows.reduce((sum, row) => sum + row.success + row.failure, 0), 734);
});

test('1023 演示场景的事件、版本、目录与历史输入一致', async () => {
  const api = createMockEventCenterApi();
  const { items } = await api.listEvents();
  assert.equal(items.length, 19);
  assert.equal(items[0].name, '综合处理流程演示');
  assert.equal(items[0].triggerCount, 832);
  assert.equal(items[0].draft.branches.length, 4);
  assert.equal(items[0].draft.branches[0].name, '振动异常');
  assert.equal(items[0].versions.length, 3);
  assert.equal(items[0].versions[0].branches[0].actions.length, 3);
  const longVersion = await api.getEvent('evt-1');
  assert.equal(longVersion.versions.find(item => item.version === 'v1.1.11').branches.length, 11);
  const resources = await api.listResources();
  assert.ok(resources.some(item => item.groupName === '前端测试' && item.name === 'getWeatherNow'));
  assert.ok(resources.some(item => item.groupName === '设备管理 MCP' && item.name === '设备告警接口'));
  assert.equal((await api.listRuns(items[0].id)).total, 11);
  const testResult = await api.simulate(items[0].id, { version: 'v2.1.0', payload: { device_id: 'COMP-A12', temperature: 96.4, voltage: 263, status: 'critical' } });
  assert.equal(testResult.branch, '严重异常');
  assert.equal(testResult.actions.length, 3);
  assert.match(testResult.actions[1].input, /COMP-A12/);
  assert.equal(testResult.trace.length, 4);
});
