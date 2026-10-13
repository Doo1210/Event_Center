<template>
  <BaseModal :visible="visible" :title="event ? '编辑事件' : '新增事件'" size="wide" variant="event-form" @close="$emit('close')">
    <div class="ec-field ec-event-form-name"><label for="ec-event-name">事件名称 <b>*</b></label><input id="ec-event-name" v-model.trim="form.name" maxlength="80" placeholder="例如：设备温度异常上报" /></div>

    <div class="ec-event-source-wrap">
      <div class="ec-event-source-label">触发源类型 <b>*</b></div>
      <div class="ec-event-source-tabs" role="tablist" aria-label="触发源类型">
        <button v-for="type in sourceTypes" :key="type" type="button" role="tab" class="ec-event-source-tab" :class="{ 'is-active': form.sourceType === type }" :aria-selected="String(form.sourceType === type)" @click="form.sourceType = type">{{ type }}</button>
      </div>
    </div>

    <section class="ec-event-form-section">
      <h3>{{ sourceSectionTitle }}</h3>
    <div v-if="form.sourceType === 'Timer'" class="ec-event-mode-tabs" role="group" aria-label="定时触发方式">
      <button v-for="mode in timerModes" :key="mode.value" type="button" :class="{ 'is-active': form.sourceConfig.timerMode === mode.value }" @click="form.sourceConfig.timerMode = mode.value">{{ mode.label }}</button>
    </div>
    <div class="ec-form-grid ec-source-fields" :class="{ 'ec-event-timer-fields': form.sourceType === 'Timer', 'ec-event-webhook-fields': form.sourceType === 'WebHook' }">
      <template v-if="form.sourceType === 'Timer'">
        <div class="ec-event-timer-controls">
          <template v-if="form.sourceConfig.timerMode === 'fixed'">
            <div class="ec-form-grid">
              <div class="ec-field"><label>执行周期</label><select v-model="form.sourceConfig.fixedCycle"><option value="daily">每天</option><option value="weekly">每周</option><option value="monthly">每月</option></select></div>
              <div class="ec-field"><label>添加时间点</label><div class="ec-event-inline"><input v-model="newTime" type="time" aria-label="新增执行时间" /><button type="button" class="ec-button ec-button--small" @click="addTime">＋ 添加</button></div></div>
            </div>
            <div class="ec-event-time-box"><strong>已设置时间点</strong><div class="ec-event-chip-row"><span v-for="time in fixedTimes" :key="time" class="ec-event-time-chip">{{ time }}<button type="button" :aria-label="'移除 ' + time" @click="removeTime(time)">×</button></span><span v-if="!fixedTimes.length" class="ec-event-help">还没有时间点，请从上方添加。</span></div><span class="ec-event-time-count">{{ fixedTimes.length }} 个</span></div>
            <div v-if="form.sourceConfig.fixedCycle === 'weekly'" class="ec-field ec-event-timer-extra"><label>执行星期 <b>*</b></label><div class="ec-event-chip-row"><button v-for="day in weekdays" :key="day.value" type="button" class="ec-event-day" :class="{ 'is-active': chosenWeekdays.includes(day.value) }" :aria-pressed="String(chosenWeekdays.includes(day.value))" @click="toggleWeekday(day.value)">{{ day.label }}</button></div></div>
            <div v-if="form.sourceConfig.fixedCycle === 'monthly'" class="ec-field ec-event-timer-extra"><label>每月日期 <b>*</b><small>可多选</small></label><div class="ec-event-month-days"><button v-for="day in 31" :key="day" type="button" class="ec-event-month-day" :class="{ 'is-active': chosenMonthDays.includes(day) }" :aria-pressed="String(chosenMonthDays.includes(day))" @click="toggleMonthDay(day)">{{ day }}</button><button type="button" class="ec-event-month-day ec-event-month-day--last" :class="{ 'is-active': form.sourceConfig.lastDay }" @click="form.sourceConfig.lastDay = !form.sourceConfig.lastDay">最后一天</button></div></div>
          </template>
          <template v-else-if="form.sourceConfig.timerMode === 'interval'">
            <div class="ec-event-schedule-rows">
              <div class="ec-event-schedule-row"><span>每隔</span><input v-model.number="form.sourceConfig.intervalCount" type="number" min="1" aria-label="间隔数值" /><select v-model="form.sourceConfig.intervalUnit" aria-label="间隔单位"><option value="minutes">分钟</option><option value="hours">小时</option><option value="days">天</option></select><span>触发</span></div>
              <template v-if="form.sourceConfig.intervalUnit === 'days'"><div class="ec-event-schedule-row"><span>起始日期</span><input v-model="form.sourceConfig.intervalStartDate" type="date" aria-label="起始日期" /></div><div class="ec-event-schedule-row"><span>执行时间</span><input v-model="form.sourceConfig.intervalTime" type="time" aria-label="执行时间" /></div></template>
              <template v-else><div class="ec-event-schedule-row"><span>生效日期</span><select v-model="form.sourceConfig.dayFilter" aria-label="生效日期"><option value="daily">每天</option><option value="custom">指定星期</option></select></div><div v-if="form.sourceConfig.dayFilter === 'custom'" class="ec-event-schedule-row"><span>指定星期</span><div class="ec-event-chip-row"><button v-for="day in weekdays" :key="day.value" type="button" class="ec-event-day" :class="{ 'is-active': chosenIntervalWeekdays.includes(day.value) }" @click="toggleWeekday(day.value, 'intervalWeekdays')">{{ day.label }}</button></div></div><div class="ec-event-schedule-row"><span>运行时段</span><input v-model="form.sourceConfig.windowStart" type="time" aria-label="开始时间" /><span>至</span><input v-model="form.sourceConfig.windowEnd" type="time" aria-label="结束时间" /></div></template>
            </div>
          </template>
          <div v-else class="ec-field"><label>Cron 表达式 <b>*</b></label><input v-model.trim="form.sourceConfig.cron" placeholder="例如 0 0 8 * * ?" /><small>支持常见的 5–7 段表达式；最终以服务端校验和调度为准。</small></div>
        </div>
        <aside class="ec-event-preview"><h4>触发预览</h4><p>{{ preview.summary }}<br />时区：{{ timeZone }}</p><div v-if="preview.error" class="ec-event-help">{{ preview.error }}</div><ol v-else-if="preview.times && preview.times.length"><li v-for="(time, index) in preview.times" :key="index">{{ formatPreviewTime(time) }}</li></ol><div v-else class="ec-event-help">完成设置后展示未来 5 次触发时间。</div></aside>
      </template>

      <template v-else-if="form.sourceType === 'WebHook'">
        <div class="ec-field"><label>请求方式</label><select v-model="form.sourceConfig.method"><option>GET</option><option>POST</option><option>PUT</option></select></div>
        <div class="ec-field"><label for="ec-webhook-url">Webhook URL</label><div class="ec-event-inline"><input id="ec-webhook-url" :value="demoWebhookUrl" readonly /><button type="button" class="ec-button ec-button--small" @click="copyDemo(demoWebhookUrl)">复制</button></div></div>
        <div class="ec-field"><label for="ec-webhook-auth">鉴权方式</label><input id="ec-webhook-auth" :value="'Bearer 密钥'" readonly /></div>
        <div class="ec-field"><label for="ec-webhook-key">密钥</label><div class="ec-event-inline"><input id="ec-webhook-key" :value="demoWebhookKey" readonly /><button type="button" class="ec-button ec-button--small" @click="copyDemo(demoWebhookKey)">复制</button><button type="button" class="ec-button ec-button--small" @click="regenerateDemoKey">重置</button></div><small>请求 Header 需携带 Authorization: Bearer &lt;密钥&gt;。</small></div>
      </template>

      <template v-else-if="form.sourceType === 'Kafka'">
        <div class="ec-field"><label>服务地址 Bootstrap Servers <b>*</b></label><input v-model.trim="form.sourceConfig.brokers" placeholder="broker-1:9092,broker-2:9092" /><small>多个 Broker 用英文逗号分隔。</small></div>
        <div class="ec-field"><label>订阅主题 Topic <b>*</b></label><input v-model.trim="form.sourceConfig.kafkaTopic" placeholder="device_events" /></div>
        <div class="ec-field"><label>消费者组 ID <b>*</b></label><input v-model.trim="form.sourceConfig.groupId" placeholder="event-center" /></div>
        <div class="ec-field"><label>消费起始位置</label><input value="最新的数据 (Latest)" readonly /><small>无消费位点时从新消息开始。</small></div>
        <div class="ec-field ec-field--full"><label>鉴权方式</label><div class="ec-event-radio-group"><label><input v-model="form.sourceConfig.kafkaAuth" type="radio" value="none" />无鉴权</label><label><input v-model="form.sourceConfig.kafkaAuth" type="radio" value="plain" />SASL 用户名 / 密码</label></div></div>
        <template v-if="form.sourceConfig.kafkaAuth === 'plain'"><div class="ec-field"><label>用户名 <b>*</b></label><input v-model.trim="form.sourceConfig.kafkaUsername" autocomplete="off" placeholder="输入用户名" /></div><div class="ec-field"><label>密码 <b>*</b></label><input v-model="form.sourceConfig.kafkaPassword" type="password" autocomplete="new-password" :placeholder="event ? '留空表示不更新' : '输入密码'" /></div></template>
      </template>

      <template v-else-if="form.sourceType === 'MQTT'">
        <div class="ec-field"><label>Broker 地址 <b>*</b></label><input v-model.trim="form.sourceConfig.broker" placeholder="mqtt://192.168.1.100:1883" /><small>支持 mqtt:// 或 mqtts://。</small></div>
        <div class="ec-field"><label>订阅主题 Topic <b>*</b></label><input v-model.trim="form.sourceConfig.mqttTopic" placeholder="factory/line1/+/telemetry" /></div>
        <div class="ec-field"><label>Client ID <b>*</b></label><div class="ec-event-inline"><input v-model.trim="form.sourceConfig.clientId" placeholder="event-center-client" /><button type="button" class="ec-button ec-button--small" @click="regenerateClientId">重新生成</button></div></div>
        <div class="ec-field"><label>QoS</label><select v-model="form.sourceConfig.qos"><option value="0">0 - 最多一次</option><option value="1">1 - 至少一次</option><option value="2">2 - 恰好一次</option></select></div>
        <div class="ec-field"><label>Clean Session</label><select v-model="form.sourceConfig.cleanSession"><option value="false">否，保留会话</option><option value="true">是，清除会话</option></select></div>
        <div class="ec-field"><label>Keep Alive（秒）</label><input v-model.number="form.sourceConfig.keepAlive" type="number" min="10" max="65535" /></div>
        <div class="ec-field ec-field--full"><label>鉴权方式</label><div class="ec-event-radio-group"><label><input v-model="form.sourceConfig.mqttAuth" type="radio" value="none" />无鉴权</label><label><input v-model="form.sourceConfig.mqttAuth" type="radio" value="plain" />用户名 / 密码</label></div></div>
        <template v-if="form.sourceConfig.mqttAuth === 'plain'"><div class="ec-field"><label>用户名 <b>*</b></label><input v-model.trim="form.sourceConfig.mqttUsername" autocomplete="off" placeholder="输入用户名" /></div><div class="ec-field"><label>密码 <b>*</b></label><input v-model="form.sourceConfig.mqttPassword" type="password" autocomplete="new-password" :placeholder="event ? '留空表示不更新' : '输入密码'" /></div></template>
      </template>

      <template v-else>
        <div class="ec-field"><label>服务地址 <b>*</b></label><input v-model.trim="form.sourceConfig.serviceUrl" placeholder="pulsar://pulsar.example.local:6650" /><small>支持 pulsar:// 或 pulsar+ssl://。</small></div>
        <div class="ec-field"><label>订阅主题 Topic <b>*</b></label><input v-model.trim="form.sourceConfig.pulsarTopic" placeholder="persistent://public/default/my-topic" /></div>
        <div class="ec-field ec-field--full"><label>鉴权方式</label><div class="ec-event-radio-group"><label><input v-model="form.sourceConfig.pulsarAuth" type="radio" value="none" />无鉴权</label><label><input v-model="form.sourceConfig.pulsarAuth" type="radio" value="token" />Token 鉴权</label></div></div>
        <div v-if="form.sourceConfig.pulsarAuth === 'token'" class="ec-field ec-field--full"><label>访问凭证 Token <b>*</b></label><input v-model="form.sourceConfig.token" type="password" autocomplete="new-password" :placeholder="event ? '留空表示不更新' : '输入 Token'" /></div>
      </template>
    </div>
    <template v-if="form.sourceType === 'WebHook'">
      <button type="button" class="ec-event-advanced-toggle" :aria-expanded="String(webhookAdvanced)" @click="webhookAdvanced = !webhookAdvanced"><span>{{ webhookAdvanced ? '▾' : '▸' }}</span>高级设置</button>
      <div v-if="webhookAdvanced" class="ec-event-advanced-body">
        <div class="ec-field"><label>内容类型 Content-Type</label><select v-model="form.sourceConfig.contentType"><option>application/json</option><option>application/x-www-form-urlencoded</option><option>text/plain</option><option>multipart/form-data</option></select><small>声明请求 Body 的数据格式；GET 通常无 Body，以 Query 参数为主。</small></div>
        <p class="ec-event-help ec-event-param-intro">声明外部请求中的业务参数，供平台解析引用。鉴权 Header（Authorization）由上方密钥自动处理，无需在此重复声明。</p>
        <div v-for="group in webhookGroups" :key="group.key" class="ec-event-param-group">
          <header><strong>{{ group.title }}</strong><button class="ec-link" type="button" @click="addParam(group.key)">＋ 添加</button></header>
          <div class="ec-event-param-body">
            <div v-for="(row, index) in form.sourceConfig[group.key]" :key="index" class="ec-event-param-row">
              <input v-model.trim="row.name" :aria-label="group.title + ' 第 ' + (index + 1) + ' 个变量名'" placeholder="变量名" />
              <select v-if="group.key !== 'headerParams'" v-model="row.type" :aria-label="group.title + ' 第 ' + (index + 1) + ' 个类型'"><option value="string">String</option><option value="number">Number</option><option value="boolean">Boolean</option></select><span v-else class="ec-event-param-spacer" />
              <label><input v-model="row.required" type="checkbox" />必填</label>
              <button class="ec-icon-button" type="button" :aria-label="'移除 ' + group.title + ' 第 ' + (index + 1) + ' 个参数'" @click="removeParam(group.key, index)">×</button>
            </div>
            <div v-if="!form.sourceConfig[group.key].length" class="ec-event-empty">暂无参数，按需添加</div>
          </div>
        </div>
        <p class="ec-event-help ec-event-raw-note">原始请求仍完整保留为 payload._webhook_raw。</p>
      </div>
    </template>
    </section>
    <p v-if="validationError || error" class="ec-form-error" role="alert">{{ validationError || error }}</p>
    <template #footer>
      <span class="ec-event-form-note">{{ copyMessage || (event ? '保存后，事件接入和执行开关状态保持不变。' : '可选择创建后立即接入；处理动作仍默认关闭。') }}</span>
      <div class="ec-event-form-footer-actions">
        <button type="button" class="ec-button" @click="$emit('close')">取消</button>
        <template v-if="event"><button type="button" class="ec-button ec-button--primary" :disabled="busy" @click="submit(false)">{{ busy ? '保存中…' : '保存修改' }}</button></template>
        <template v-else>
          <button type="button" class="ec-button" :disabled="busy" @click="submit(false)">{{ busy ? '创建中…' : '创建' }}</button>
          <button type="button" class="ec-button ec-button--primary" :disabled="busy" @click="submit(true)">{{ busy ? '创建中…' : '创建并启用接入' }}</button>
        </template>
      </div>
    </template>
  </BaseModal>
</template>

<script>
import BaseModal from './BaseModal.vue';
import { clone } from '../domain/model.mjs';
import { schedulePreview } from '../domain/schedulePreview.mjs';

const weekdays = [{ value: 'MON', label: '周一' }, { value: 'TUE', label: '周二' }, { value: 'WED', label: '周三' }, { value: 'THU', label: '周四' }, { value: 'FRI', label: '周五' }, { value: 'SAT', label: '周六' }, { value: 'SUN', label: '周日' }];
const splitValues = value => (Array.isArray(value) ? value : String(value || '').split(',')).map(part => String(part).trim()).filter(Boolean);
const demoPart = () => Math.random().toString(36).slice(2, 10);
const normalizeParamRows = rows => (Array.isArray(rows) ? rows : []).map(row => ({
  name: String(row.name || row.key || ''),
  type: String(row.type || 'string').toLowerCase(),
  required: !!row.required,
}));
const defaultConfig = () => ({
  timerMode: 'fixed', fixedCycle: 'daily', times: '09:00', weekdays: '', monthDays: '1', lastDay: false,
  intervalCount: 15, intervalUnit: 'minutes', intervalStartDate: '', intervalTime: '09:00',
  dayFilter: 'daily', intervalWeekdays: '', windowStart: '08:00', windowEnd: '18:00', cron: '',
  method: 'POST', path: '', contentType: 'application/json', queryParams: [], headerParams: [], bodyParams: [],
  fieldSchema: [], brokers: '', broker: '', serviceUrl: '', topic: '', kafkaTopic: '', mqttTopic: '',
  pulsarTopic: '', groupId: '', clientId: '', qos: '1', cleanSession: 'false', keepAlive: 60,
  authMethod: 'none', pulsarAuth: 'none', kafkaAuth: 'none', mqttAuth: 'none', username: '', password: '', token: '',
  kafkaUsername: '', kafkaPassword: '', mqttUsername: '', mqttPassword: '',
});

export default {
  name: 'EventForm',
  components: { BaseModal },
  props: { visible: Boolean, event: { type: Object, default: null }, busy: Boolean, error: { type: String, default: '' } },
  data() { return {
    sourceTypes: ['Timer', 'WebHook', 'Pulsar', 'Kafka', 'MQTT'],
    timerModes: [{ value: 'fixed', label: '指定时间点' }, { value: 'interval', label: '按间隔重复' }, { value: 'cron', label: 'Cron 表达式' }],
    webhookGroups: [
      { key: 'queryParams', title: 'Query Parameters' },
      { key: 'headerParams', title: 'Header Parameters' },
      { key: 'bodyParams', title: 'Request Body Parameters' },
    ],
    weekdays, form: { name: '', description: '', sourceType: 'Timer', sourceConfig: defaultConfig() },
    newTime: '', webhookAdvanced: false, demoWebhookKey: '', copyMessage: '', copyTimer: null, validationError: '',
  }; },
  computed: {
    sourceSectionTitle() { return { Timer: '定时触发', WebHook: 'Webhook 接入', Pulsar: 'Pulsar 接入', Kafka: 'Kafka 接入', MQTT: 'MQTT 接入' }[this.form.sourceType]; },
    fixedTimes() { return splitValues(this.form.sourceConfig.times).sort(); },
    chosenWeekdays() { return splitValues(this.form.sourceConfig.weekdays); },
    chosenIntervalWeekdays() { return splitValues(this.form.sourceConfig.intervalWeekdays); },
    chosenMonthDays() { return splitValues(this.form.sourceConfig.monthDays).map(Number).filter(value => value >= 1 && value <= 31); },
    preview() { return schedulePreview(this.form.sourceConfig); },
    timeZone() { return Intl.DateTimeFormat().resolvedOptions().timeZone || '本地时区'; },
    demoWebhookUrl() { return 'https://api.event-platform.local' + (this.form.sourceConfig.path || ''); },
  },
  watch: { visible(value) { if (value) this.reset(); } },
  beforeDestroy() { if (this.copyTimer) clearTimeout(this.copyTimer); },
  methods: {
    reset() {
      const record = this.event;
      const config = Object.assign(defaultConfig(), record ? clone(record.sourceConfig || {}) : {});
      if (!config.intervalStartDate) {
        const now = new Date();
        config.intervalStartDate = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
      }
      if (!config.path) config.path = '/webhook/evt_' + (record ? record.id : Date.now()) + '_' + demoPart().slice(0, 6);
      if (record && record.sourceType === 'Timer' && !(record.sourceConfig || {}).timerMode && config.schedule) {
        const time = config.schedule.match(/\d{2}:\d{2}/);
        if (time) config.times = time[0];
        if (config.schedule.startsWith('每周')) {
          config.fixedCycle = 'weekly';
          const day = weekdays.find(item => config.schedule.includes(item.label));
          if (day) config.weekdays = day.value;
        } else if (config.schedule.startsWith('每月')) {
          config.fixedCycle = 'monthly';
          const date = config.schedule.match(/每月\s*(\d+)/);
          if (date) config.monthDays = date[1];
        }
      }
      config.fieldSchema = Array.isArray(config.fieldSchema) ? config.fieldSchema : [];
      for (const key of ['queryParams', 'headerParams', 'bodyParams']) {
        const raw = key === 'bodyParams' && !(record && record.sourceConfig && Array.isArray(record.sourceConfig.bodyParams))
          ? config.fieldSchema : config[key];
        config[key] = normalizeParamRows(raw);
      }
      if (record && record.sourceType === 'Kafka') {
        config.kafkaTopic = config.kafkaTopic || config.topic;
        if (!config.brokers || /^\d+\s+brokers?$/i.test(config.brokers)) config.brokers = 'kafka-broker-1:9092,kafka-broker-2:9092';
        config.kafkaAuth = config.authMethod === 'plain' ? 'plain' : 'none';
        config.kafkaUsername = config.kafkaUsername || config.username;
      }
      if (record && record.sourceType === 'MQTT') {
        config.mqttTopic = config.mqttTopic || config.topic;
        config.mqttAuth = config.authMethod === 'plain' ? 'plain' : 'none';
        config.mqttUsername = config.mqttUsername || config.username;
      }
      if (record && record.sourceType === 'Pulsar') {
        config.pulsarTopic = config.pulsarTopic || config.topic;
        config.pulsarAuth = config.authMethod === 'token' ? 'token' : 'none';
      }
      if (!config.clientId) config.clientId = 'evt-platform-' + demoPart().slice(0, 6);
      this.form = { name: record ? record.name : '', description: record ? record.description || '' : '', sourceType: record ? record.sourceType : 'Timer', sourceConfig: config };
      this.newTime = '';
      this.webhookAdvanced = !!config.webhookAdvanced || ['queryParams', 'headerParams', 'bodyParams'].some(key => config[key].length);
      this.demoWebhookKey = 'evt_' + demoPart() + demoPart();
      this.copyMessage = '';
      this.validationError = '';
    },
    showFormMessage(message) {
      this.copyMessage = message;
      if (this.copyTimer) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => { this.copyMessage = ''; }, 3000);
    },
    async copyDemo(value) {
      try {
        await navigator.clipboard.writeText(value);
        this.showFormMessage('已复制；正式接入信息以服务端为准。');
      } catch (_) { this.showFormMessage('复制失败，请手动选择内容复制。'); }
    },
    regenerateDemoKey() { this.demoWebhookKey = 'evt_' + demoPart() + demoPart(); this.showFormMessage('密钥已重置；正式密钥由服务端管理。'); },
    regenerateClientId() { this.form.sourceConfig.clientId = 'evt-platform-' + demoPart().slice(0, 6); },
    addParam(key) { this.form.sourceConfig[key].push({ name: '', type: 'string', required: false }); },
    removeParam(key, index) { this.form.sourceConfig[key].splice(index, 1); },
    addTime() {
      if (!this.newTime) { this.showFormMessage('请先选择时间点'); return; }
      if (this.fixedTimes.includes(this.newTime)) { this.showFormMessage('这个时间点已添加'); return; }
      this.form.sourceConfig.times = [...this.fixedTimes, this.newTime].sort().join(',');
      this.newTime = '';
    },
    removeTime(time) { this.form.sourceConfig.times = this.fixedTimes.filter(value => value !== time).join(','); },
    toggleWeekday(day, key = 'weekdays') { const selected = splitValues(this.form.sourceConfig[key]); this.form.sourceConfig[key] = (selected.includes(day) ? selected.filter(value => value !== day) : [...selected, day]).join(','); },
    toggleMonthDay(day) { const selected = this.chosenMonthDays; this.form.sourceConfig.monthDays = (selected.includes(day) ? selected.filter(value => value !== day) : [...selected, day]).sort((a, b) => a - b).join(','); },
    formatPreviewTime(value) { return value.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit' }); },
    validate() {
      const form = this.form; const config = form.sourceConfig;
      if (!form.name) return '请输入事件名称';
      if (form.sourceType === 'Timer') {
        if (config.timerMode === 'fixed' && !this.fixedTimes.length) return '请添加至少一个执行时间点';
        if (config.timerMode === 'fixed' && config.fixedCycle === 'weekly' && !this.chosenWeekdays.length) return '请选择执行星期';
        if (config.timerMode === 'fixed' && config.fixedCycle === 'monthly' && !this.chosenMonthDays.length && !config.lastDay) return '请选择每月日期或最后一天';
        if (config.timerMode === 'interval' && (!Number.isInteger(Number(config.intervalCount)) || Number(config.intervalCount) < 1)) return '间隔数值应为正整数';
        if (config.timerMode === 'interval' && Number(config.intervalCount) > ({ minutes: 1440, hours: 24, days: 365 }[config.intervalUnit] || 0)) return '间隔数值超出当前单位的可用范围';
        if (config.timerMode === 'interval' && config.intervalUnit === 'days' && (!config.intervalStartDate || !config.intervalTime)) return '请选择起始日期和执行时间';
        if (config.timerMode === 'interval' && config.intervalUnit !== 'days' && config.dayFilter === 'custom' && !this.chosenIntervalWeekdays.length) return '请选择生效星期';
        if (config.timerMode === 'interval' && config.intervalUnit !== 'days' && (!config.windowStart || !config.windowEnd || config.windowEnd <= config.windowStart)) return '结束时间需晚于开始时间';
        if (config.timerMode === 'cron' && (String(config.cron || '').trim().split(/\s+/).length < 5 || String(config.cron || '').trim().split(/\s+/).length > 7)) return '请输入 5–7 段 Cron 表达式';
      }
      if (form.sourceType === 'WebHook') {
        if (!/^\/[A-Za-z0-9/_-]+$/.test(config.path)) return 'WebHook 路径应以 / 开头，且只包含字母、数字、斜杠、下划线或连字符';
        for (const group of this.webhookGroups) {
          const names = config[group.key].map(row => String(row.name || '').trim().toLowerCase());
          if (names.some(name => !name)) return group.title + ' 中有未填写的变量名';
          if (new Set(names).size !== names.length) return group.title + ' 中存在重复变量名';
        }
        if (config.headerParams.some(row => row.name.toLowerCase() === 'authorization')) return 'Authorization 由密钥处理，无需重复声明';
      }
      if (form.sourceType === 'Kafka') {
        if (!config.brokers || !config.kafkaTopic || !config.groupId) return '请填写 Broker、Topic 和 Consumer Group';
        if (config.kafkaAuth === 'plain' && !config.kafkaUsername) return '请输入 Kafka 用户名';
        if (config.kafkaAuth === 'plain' && !config.kafkaPassword && !(this.event && this.event.sourceType === 'Kafka' && (this.event.sourceConfig || {}).authMethod === 'plain')) return '请输入 Kafka 密码';
      }
      if (form.sourceType === 'MQTT') {
        if (!/^mqtts?:\/\/.+/i.test(config.broker)) return 'Broker 地址需以 mqtt:// 或 mqtts:// 开头';
        if (!config.mqttTopic) return '请输入订阅主题';
        if (!config.clientId) return '请输入 Client ID';
        if (!Number.isInteger(Number(config.keepAlive)) || Number(config.keepAlive) < 10 || Number(config.keepAlive) > 65535) return 'Keep Alive 应为 10–65535 秒';
        if (config.mqttAuth === 'plain' && !config.mqttUsername) return '请输入 MQTT 用户名';
        if (config.mqttAuth === 'plain' && !config.mqttPassword && !(this.event && this.event.sourceType === 'MQTT' && (this.event.sourceConfig || {}).authMethod === 'plain')) return '请输入 MQTT 密码';
      }
      if (form.sourceType === 'Pulsar') {
        if (!/^pulsar(\+ssl)?:\/\/.+/i.test(config.serviceUrl)) return '服务地址需以 pulsar:// 或 pulsar+ssl:// 开头';
        if (!config.pulsarTopic) return '请输入订阅主题';
        if (config.pulsarAuth === 'token' && !config.token && !(this.event && this.event.sourceType === 'Pulsar' && (this.event.sourceConfig || {}).authMethod === 'token')) return '请输入 Pulsar Token';
      }
      return '';
    },
    submit(enableIntake = false) {
      this.validationError = this.validate();
      if (this.validationError) return;
      const payload = clone(this.form);
      const config = payload.sourceConfig;
      if (payload.sourceType === 'Timer') {
        if (config.timerMode === 'fixed') {
          const cycle = { daily: '每日', weekly: '每周', monthly: '每月' }[config.fixedCycle];
          const days = this.chosenWeekdays.map(code => (weekdays.find(day => day.value === code) || {}).label || code).join('、');
          const monthly = this.chosenMonthDays.join('、') + (this.chosenMonthDays.length ? ' 日' : '') + (config.lastDay ? (this.chosenMonthDays.length ? '、' : '') + '最后一天' : '');
          config.schedule = [cycle, config.fixedCycle === 'weekly' ? days : '', config.fixedCycle === 'monthly' ? monthly : '', this.fixedTimes.join('、')].filter(Boolean).join(' ');
        }
        if (config.timerMode === 'interval') config.schedule = '每隔 ' + config.intervalCount + ' ' + ({ minutes: '分钟', hours: '小时', days: '天' }[config.intervalUnit]) + '触发';
      }
      if (payload.sourceType === 'WebHook') {
        config.webhookAdvanced = this.webhookAdvanced;
        config.fieldSchema = config.bodyParams.map(row => ({ key: row.name.trim(), type: row.type[0].toUpperCase() + row.type.slice(1) }));
      }
      if (payload.sourceType === 'Kafka') {
        config.topic = config.kafkaTopic;
        config.authMethod = config.kafkaAuth;
        config.username = config.kafkaUsername;
        config.password = config.kafkaPassword;
      }
      if (payload.sourceType === 'MQTT') {
        config.topic = config.mqttTopic;
        config.authMethod = config.mqttAuth;
        config.username = config.mqttUsername;
        config.password = config.mqttPassword;
      }
      if (payload.sourceType === 'Pulsar') {
        config.topic = config.pulsarTopic;
        config.authMethod = config.pulsarAuth;
      }
      this.$emit('save', payload, { enableIntake: !this.event && enableIntake });
    },
  },
};
</script>
