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
    <div class="ec-form-grid ec-source-fields" :class="{ 'ec-event-timer-fields': form.sourceType === 'Timer' }">
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
        <div class="ec-field"><label>鉴权方式</label><input value="Bearer 密钥" readonly /></div>
        <div class="ec-field ec-field--full"><label>接入路径 <b>*</b></label><input v-model.trim="form.sourceConfig.path" placeholder="/webhook/orders/update" /><small>完整 Webhook URL 由接入服务生成。</small></div>
        <div class="ec-field ec-field--full"><label>密钥</label><div class="ec-readonly-note">密钥由服务端生成和保管；在接入服务中查看或重置。</div></div>
      </template>

      <template v-else-if="form.sourceType === 'Kafka'">
        <div class="ec-field"><label>服务地址 Bootstrap Servers <b>*</b></label><input v-model.trim="form.sourceConfig.brokers" placeholder="broker-1:9092,broker-2:9092" /><small>多个 Broker 用英文逗号分隔。</small></div>
        <div class="ec-field"><label>订阅主题 Topic <b>*</b></label><input v-model.trim="form.sourceConfig.topic" placeholder="factory.device.events" /></div>
        <div class="ec-field"><label>消费者组 ID <b>*</b></label><input v-model.trim="form.sourceConfig.groupId" placeholder="event-center" /></div>
        <div class="ec-field"><label>消费起始位置</label><input value="最新的数据 (Latest)" readonly /><small>无消费位点时从新消息开始。</small></div>
        <div class="ec-field ec-field--full"><label>鉴权方式</label><div class="ec-event-radio-group"><label><input v-model="form.sourceConfig.authMethod" type="radio" value="none" />无鉴权</label><label><input v-model="form.sourceConfig.authMethod" type="radio" value="plain" />SASL 用户名 / 密码</label></div></div>
        <template v-if="form.sourceConfig.authMethod === 'plain'"><div class="ec-field"><label>用户名</label><input v-model.trim="form.sourceConfig.username" autocomplete="off" /></div><div class="ec-field"><label>密码</label><input v-model="form.sourceConfig.password" type="password" autocomplete="new-password" placeholder="留空表示不更新" /></div></template>
      </template>

      <template v-else-if="form.sourceType === 'MQTT'">
        <div class="ec-field"><label>Broker 地址 <b>*</b></label><input v-model.trim="form.sourceConfig.broker" placeholder="mqtt://emqx.example.local:1883" /><small>支持 mqtt:// 或 mqtts://。</small></div>
        <div class="ec-field"><label>订阅主题 Topic <b>*</b></label><input v-model.trim="form.sourceConfig.topic" placeholder="factory/line1/+/telemetry" /></div>
        <div class="ec-field"><label>Client ID</label><input v-model.trim="form.sourceConfig.clientId" placeholder="event-center-client" /></div>
        <div class="ec-field"><label>QoS</label><select v-model="form.sourceConfig.qos"><option value="0">0 - 最多一次</option><option value="1">1 - 至少一次</option><option value="2">2 - 恰好一次</option></select></div>
        <div class="ec-field"><label>Clean Session</label><select v-model="form.sourceConfig.cleanSession"><option value="false">否，保留会话</option><option value="true">是，清除会话</option></select></div>
        <div class="ec-field"><label>Keep Alive（秒）</label><input v-model.number="form.sourceConfig.keepAlive" type="number" min="10" max="65535" /></div>
        <div class="ec-field ec-field--full"><label>鉴权方式</label><div class="ec-event-radio-group"><label><input v-model="form.sourceConfig.authMethod" type="radio" value="none" />无鉴权</label><label><input v-model="form.sourceConfig.authMethod" type="radio" value="plain" />用户名 / 密码</label></div></div>
        <template v-if="form.sourceConfig.authMethod === 'plain'"><div class="ec-field"><label>用户名</label><input v-model.trim="form.sourceConfig.username" autocomplete="off" /></div><div class="ec-field"><label>密码</label><input v-model="form.sourceConfig.password" type="password" autocomplete="new-password" placeholder="留空表示不更新" /></div></template>
      </template>

      <template v-else>
        <div class="ec-field"><label>服务地址 <b>*</b></label><input v-model.trim="form.sourceConfig.serviceUrl" placeholder="pulsar://pulsar.example.local:6650" /><small>支持 pulsar:// 或 pulsar+ssl://。</small></div>
        <div class="ec-field"><label>订阅主题 Topic <b>*</b></label><input v-model.trim="form.sourceConfig.topic" placeholder="persistent://tenant/namespace/topic" /></div>
        <div class="ec-field ec-field--full"><label>鉴权方式</label><div class="ec-event-radio-group"><label><input v-model="form.sourceConfig.authMethod" type="radio" value="none" />无鉴权</label><label><input v-model="form.sourceConfig.authMethod" type="radio" value="token" />Token 鉴权</label></div></div>
        <div v-if="form.sourceConfig.authMethod === 'token'" class="ec-field ec-field--full"><label>认证 Token</label><input v-model="form.sourceConfig.token" type="password" autocomplete="new-password" placeholder="留空表示不更新" /></div>
      </template>
    </div>
    <template v-if="form.sourceType === 'WebHook'">
      <button type="button" class="ec-event-advanced-toggle" :aria-expanded="String(webhookAdvanced)" @click="webhookAdvanced = !webhookAdvanced"><span>{{ webhookAdvanced ? '▾' : '▸' }}</span>高级设置</button>
      <div v-if="webhookAdvanced" class="ec-event-advanced-body">
        <div class="ec-field"><label>内容类型 Content-Type</label><select v-model="form.sourceConfig.contentType"><option>application/json</option><option>application/x-www-form-urlencoded</option><option>text/plain</option><option>multipart/form-data</option></select></div>
        <div class="ec-event-param-group"><header><strong>Request Body Parameters <span>({{ form.sourceConfig.fieldSchema.length }})</span></strong><button class="ec-link" type="button" @click="form.sourceConfig.fieldSchema.push({ key: '', type: 'String' })">＋ 添加</button></header><div class="ec-event-param-body"><div v-for="(field, index) in form.sourceConfig.fieldSchema" :key="index" class="ec-inline-fields"><input v-model.trim="field.key" placeholder="变量名" /><select v-model="field.type"><option>String</option><option>Number</option><option>Boolean</option></select><button class="ec-icon-button" type="button" aria-label="移除字段" @click="form.sourceConfig.fieldSchema.splice(index, 1)">×</button></div><div v-if="!form.sourceConfig.fieldSchema.length" class="ec-event-empty">暂无参数，按需添加</div></div></div>
      </div>
    </template>
    </section>
    <p v-if="validationError || error" class="ec-form-error" role="alert">{{ validationError || error }}</p>
    <template #footer><span class="ec-event-form-note">{{ event ? '保存后，事件接入和处理开关状态保持不变。' : '创建后默认关闭接入和处理动作。' }}</span><div class="ec-event-form-footer-actions"><button type="button" class="ec-button" @click="$emit('close')">取消</button><button type="button" class="ec-button ec-button--primary" :disabled="busy" @click="submit">{{ busy ? '保存中…' : event ? '保存修改' : '创建事件' }}</button></div></template>
  </BaseModal>
</template>

<script>
import BaseModal from './BaseModal.vue';
import { clone } from '../domain/model.mjs';
import { schedulePreview } from '../domain/schedulePreview.mjs';

const weekdays = [{ value: 'MON', label: '周一' }, { value: 'TUE', label: '周二' }, { value: 'WED', label: '周三' }, { value: 'THU', label: '周四' }, { value: 'FRI', label: '周五' }, { value: 'SAT', label: '周六' }, { value: 'SUN', label: '周日' }];
const splitValues = value => (Array.isArray(value) ? value : String(value || '').split(',')).map(part => String(part).trim()).filter(Boolean);
const defaultConfig = () => ({ timerMode: 'fixed', fixedCycle: 'daily', times: '09:00', weekdays: '', monthDays: '1', lastDay: false, intervalCount: 15, intervalUnit: 'minutes', intervalStartDate: '', intervalTime: '09:00', dayFilter: 'daily', intervalWeekdays: '', windowStart: '08:00', windowEnd: '18:00', cron: '', method: 'POST', path: '', contentType: 'application/json', fieldSchema: [], brokers: '', broker: '', serviceUrl: '', topic: '', groupId: '', clientId: '', qos: '1', cleanSession: 'false', keepAlive: 60, authMethod: 'none', username: '', password: '', token: '' });

export default {
  name: 'EventForm',
  components: { BaseModal },
  props: { visible: Boolean, event: { type: Object, default: null }, busy: Boolean, error: { type: String, default: '' } },
  data() { return { sourceTypes: ['Timer', 'WebHook', 'Pulsar', 'Kafka', 'MQTT'], timerModes: [{ value: 'fixed', label: '指定时间点' }, { value: 'interval', label: '按间隔重复' }, { value: 'cron', label: 'Cron 表达式' }], weekdays, form: { name: '', description: '', sourceType: 'Timer', sourceConfig: defaultConfig() }, newTime: '', webhookAdvanced: false, validationError: '' }; },
  computed: {
    sourceSectionTitle() { return { Timer: '定时触发', WebHook: 'Webhook 接入', Pulsar: 'Pulsar 接入', Kafka: 'Kafka 接入', MQTT: 'MQTT 接入' }[this.form.sourceType]; },
    fixedTimes() { return splitValues(this.form.sourceConfig.times).sort(); },
    chosenWeekdays() { return splitValues(this.form.sourceConfig.weekdays); },
    chosenIntervalWeekdays() { return splitValues(this.form.sourceConfig.intervalWeekdays); },
    chosenMonthDays() { return splitValues(this.form.sourceConfig.monthDays).map(Number).filter(value => value >= 1 && value <= 31); },
    preview() { return schedulePreview(this.form.sourceConfig); },
    timeZone() { return Intl.DateTimeFormat().resolvedOptions().timeZone || '本地时区'; },
  },
  watch: { visible(value) { if (value) this.reset(); } },
  methods: {
    reset() {
      const record = this.event;
      const config = Object.assign(defaultConfig(), record ? clone(record.sourceConfig || {}) : {});
      if (!config.intervalStartDate) {
        const now = new Date();
        config.intervalStartDate = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
      }
      if (!record) config.path = '/webhook/evt_' + Date.now().toString(36);
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
      this.form = { name: record ? record.name : '', description: record ? record.description || '' : '', sourceType: record ? record.sourceType : 'Timer', sourceConfig: config };
      this.newTime = '';
      this.webhookAdvanced = !!config.fieldSchema.length;
      this.validationError = '';
    },
    addTime() { if (!this.newTime || this.fixedTimes.includes(this.newTime)) return; this.form.sourceConfig.times = [...this.fixedTimes, this.newTime].sort().join(','); this.newTime = ''; },
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
        if (config.timerMode === 'interval' && config.intervalUnit === 'days' && (!config.intervalStartDate || !config.intervalTime)) return '请选择起始日期和执行时间';
        if (config.timerMode === 'interval' && config.intervalUnit !== 'days' && config.dayFilter === 'custom' && !this.chosenIntervalWeekdays.length) return '请选择生效星期';
        if (config.timerMode === 'interval' && config.intervalUnit !== 'days' && (!config.windowStart || !config.windowEnd || config.windowEnd <= config.windowStart)) return '结束时间需晚于开始时间';
        if (config.timerMode === 'cron' && (String(config.cron || '').trim().split(/\s+/).length < 5 || String(config.cron || '').trim().split(/\s+/).length > 7)) return '请输入 5–7 段 Cron 表达式';
      }
      if (form.sourceType === 'WebHook' && !/^\/[A-Za-z0-9/_-]+$/.test(config.path)) return 'WebHook 路径应以 / 开头，且只包含字母、数字、斜杠、下划线或连字符';
      if (form.sourceType === 'Kafka' && (!config.brokers || !config.topic || !config.groupId)) return '请填写 Broker、Topic 和 Consumer Group';
      if (form.sourceType === 'MQTT' && (!config.broker || !config.topic)) return '请填写 Broker 和 Topic';
      if (form.sourceType === 'Pulsar' && (!config.serviceUrl || !config.topic)) return '请填写服务地址和 Topic';
      return '';
    },
    submit() {
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
      this.$emit('save', payload);
    },
  },
};
</script>
