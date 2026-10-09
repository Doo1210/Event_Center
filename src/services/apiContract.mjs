/**
 * @typedef {{items: Array<object>, total: number}} EventListResult
 * @typedef {{items: Array<object>, total: number, page: number, pageSize: number}} RunListResult
 *
 * EventCenterApi 是组件库与宿主之间的能力接口。所有方法返回 Promise；写操作
 * 返回更新后的完整事件，读取失败或写入冲突时 reject 一个带 message 的 Error。
 * 后端的字段命名、鉴权和 URL 均由宿主适配层处理。
 */
export const REQUIRED_API_METHODS = [
  'listEvents', 'getEvent', 'createEvent', 'updateEvent', 'setIntake',
  'duplicateEvent', 'deleteEvent', 'saveDraft', 'publishDraft',
  'publishVersion', 'cancelPublish', 'deleteVersion', 'copyVersionToDraft',
  'updateVersionDescription', 'listResources', 'simulate', 'listRuns',
  'getRun', 'getActionStats',
];

export function assertEventCenterApi(api) {
  const missing = REQUIRED_API_METHODS.filter(name => !api || typeof api[name] !== 'function');
  if (missing.length) throw new Error(`事件中心服务缺少方法：${missing.join('、')}`);
  return api;
}
