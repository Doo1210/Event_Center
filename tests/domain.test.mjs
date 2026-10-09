import test from 'node:test';
import assert from 'node:assert/strict';
import { combinedState, createEmptyDraft, evaluateCondition, eventStatus, selectBranch, validateDraft } from '../src/domain/model.mjs';

test('事件名称与筛选使用相同的四种组合状态', () => {
  const event = { intakeEnabled: false, processEnabled: true, currentVersion: 'v1.0.0' };
  assert.equal(eventStatus(event), 'paused');
  assert.equal(combinedState(event), '暂停接入·暂停运行·v1.0.0');
  event.intakeEnabled = true;
  assert.equal(eventStatus(event), 'running');
  assert.equal(combinedState(event), '运行中·v1.0.0');
  event.processEnabled = false;
  assert.equal(eventStatus(event), 'intake-only');
  assert.equal(combinedState(event), '仅接入·未启用处理');
  event.intakeEnabled = false;
  assert.equal(eventStatus(event), 'disabled');
  assert.equal(combinedState(event), '未接入·未启用处理');
});

test('分支按顺序匹配，条件支持且与或，最后进入兜底', () => {
  const branches = [
    { id: 'severe', name: '严重', logic: 'any', conditions: [{ field: 'temperature', operator: 'gte', value: '90' }, { field: 'status', operator: 'eq', value: 'critical' }], actions: [] },
    { id: 'warning', name: '预警', logic: 'all', conditions: [{ field: 'temperature', operator: 'gt', value: '80' }, { field: 'status', operator: 'eq', value: 'warning' }], actions: [] },
    { id: 'default', name: '其他情况', isDefault: true, conditions: [], actions: [] },
  ];
  assert.equal(selectBranch(branches, { payload: { temperature: 93, status: 'warning' } }).name, '严重');
  assert.equal(selectBranch(branches, { temperature: 84, status: 'warning' }).name, '预警');
  assert.equal(selectBranch(branches, { temperature: 72, status: 'normal' }).name, '其他情况');
  assert.equal(evaluateCondition({ field: 'device_id', operator: 'in', value: 'A01, B02' }, { device_id: 'B02' }), true);
});

test('有条件分支缺少动作时不能发布，兜底允许无动作', () => {
  const draft = createEmptyDraft();
  assert.match(validateDraft(draft), /至少一个执行动作/);
  draft.branches.unshift({ id: 'warning', name: '预警', logic: 'all', conditions: [{ field: 'temperature', operator: 'gt', value: '80' }], actions: [] });
  draft.branches[1].actions.push({ id: 'archive', name: '归档' });
  assert.match(validateDraft(draft), /预警.*执行动作/);
  draft.branches[0].actions.push({ id: 'notify', name: '通知' });
  draft.branches[1].actions = [];
  assert.equal(validateDraft(draft), '');
});
