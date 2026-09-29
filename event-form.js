// Event intake form used by the static prototype. All dates in the preview use
// the browser's local time zone, matching the time controls in the dialog.
function eventFormCronSet(raw, min, max, names) {
  if (raw === "*" || raw === "?") return new Set(Array.from(
    { length: max - min + 1 }, function (_, index) { return min + index; }));
  const values = new Set();
  for (const token of raw.toUpperCase().split(",")) {
    const parts = token.split("/");
    if (parts.length > 2) return null;
    const step = parts.length === 2 ? Number(parts[1]) : 1;
    if (!Number.isInteger(step) || step < 1) return null;
    let from, to;
    if (parts[0] === "*") { from = min; to = max; }
    else if (parts[0].includes("-")) {
      const range = parts[0].split("-");
      if (range.length !== 2) return null;
      from = names && names[range[0]] || Number(range[0]);
      to = names && names[range[1]] || Number(range[1]);
    } else {
      from = names && names[parts[0]] || Number(parts[0]);
      to = parts.length === 2 ? max : from;
    }
    if (!Number.isInteger(from) || !Number.isInteger(to) ||
        from < min || to > max || from > to) return null;
    for (let number = from; number <= to; number += step) values.add(number);
  }
  return values;
}

function eventFormCronTimes(expression, now) {
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 7) return { error: "请输入 5–7 段 Cron 表达式。" };
  const fields = parts.length === 5 ? ["0"].concat(parts) : parts;
  const second = fields[0] === "*" ? 0 : Number(fields[0]);
  if (!Number.isInteger(second) || second < 0 || second > 59)
    return { error: "当前预览需要具体的秒数。" };
  const days = eventFormCronSet(fields[3], 1, 31);
  const months = eventFormCronSet(fields[4], 1, 12);
  const weekdays = eventFormCronSet(fields[5], 1, 7, {
    SUN: 1, MON: 2, TUE: 3, WED: 4, THU: 5, FRI: 6, SAT: 7
  });
  const hours = eventFormCronSet(fields[2], 0, 23);
  const minutes = eventFormCronSet(fields[1], 0, 59);
  if ((!days && fields[3] !== "L") || !months || !weekdays || !hours || !minutes)
    return { error: "此 Cron 写法暂无法预览，可检查表达式后保存。" };
  const results = [];
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let offset = 0; offset < 2000 && results.length < 5; offset++) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    if (fields[6] && fields[6] !== "*" && Number(fields[6]) !== date.getFullYear()) continue;
    if (!months.has(date.getMonth() + 1) || !weekdays.has(date.getDay() + 1)) continue;
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    if (fields[3] === "L" ? date.getDate() !== lastDay : !days.has(date.getDate())) continue;
    for (const hour of hours) {
      for (const minute of minutes) {
        const candidate = new Date(date.getFullYear(), date.getMonth(),
          date.getDate(), hour, minute, second);
        if (candidate > now) results.push(candidate);
        if (results.length >= 5) break;
      }
      if (results.length >= 5) break;
    }
  }
  return { times: results.sort(function (a, b) { return a - b; }).slice(0, 5) };
}

function eventFormDayLabel(day) {
  return {
    Mon: "周一", Tue: "周二", Wed: "周三", Thu: "周四",
    Fri: "周五", Sat: "周六", Sun: "周日"
  }[day] || day;
}

function eventFormTimerPreview(form) {
  const now = new Date();
  const times = [];
  const label = {
    daily: "每天", weekly: "每周", monthly: "每月",
    minutes: "分钟", hours: "小时", days: "天"
  };
  let summary = "";
  if (form.timerMode === "cron") {
    summary = form.cronExpression.trim() || "请输入 Cron 表达式";
    return Object.assign({ summary: summary }, form.cronExpression.trim()
      ? eventFormCronTimes(form.cronExpression, now) : { times: [] });
  }
  if (form.timerMode === "fixed") {
    const selectedTimes = form.times.filter(function (time) { return /^\d{2}:\d{2}$/.test(time); }).sort();
    summary = label[form.fixedCycle] + " " + selectedTimes.join("、");
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthDays = String(form.monthDays).split(",").map(function (value) {
      return Number(value.trim());
    }).filter(function (value) { return value >= 1 && value <= 31; });
    if (form.fixedCycle === "weekly")
      summary = "每周 " + form.weekdays.map(eventFormDayLabel).join("、") +
        " · " + selectedTimes.join("、");
    if (form.fixedCycle === "monthly") {
      const dateText = monthDays.length ? monthDays.join("、") + " 日" : "";
      summary = "每月 " + dateText +
        (form.lastDay ? (dateText ? "、" : "") + "最后一天" : "") +
        " · " + selectedTimes.join("、");
    }
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let offset = 0; offset < 400 && times.length < 5; offset++) {
      const date = new Date(start);
      date.setDate(start.getDate() + offset);
      if (form.fixedCycle === "weekly" && !form.weekdays.includes(dayNames[date.getDay()])) continue;
      if (form.fixedCycle === "monthly") {
        const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        if (!monthDays.includes(date.getDate()) && !(form.lastDay && date.getDate() === last)) continue;
      }
      for (const time of selectedTimes) {
        const pieces = time.split(":").map(Number);
        const candidate = new Date(date.getFullYear(), date.getMonth(),
          date.getDate(), pieces[0], pieces[1]);
        if (candidate > now) times.push(candidate);
        if (times.length >= 5) break;
      }
    }
  } else {
    const count = Number(form.intervalCount);
    summary = "每隔 " + (count || "—") + " " + (label[form.intervalUnit] || "分钟");
    if (!Number.isInteger(count) || count < 1) return { summary: summary, times: [] };
    if (form.intervalUnit === "days") {
      summary += "，自 " + form.intervalStartDate + " " + form.intervalTime + " 起";
      const start = new Date(form.intervalStartDate + "T" + form.intervalTime);
      if (Number.isNaN(start.getTime())) return { summary: summary, times: [] };
      for (let index = 0; index < 400 && times.length < 5; index++) {
        const candidate = new Date(start);
        candidate.setDate(start.getDate() + index * count);
        if (candidate > now) times.push(candidate);
      }
    } else {
      summary += " · " + (form.windowMode === "range"
        ? form.windowStart + "–" + form.windowEnd : "全天");
      if (form.dayFilter === "custom")
        summary += " · " + form.intervalWeekdays.map(eventFormDayLabel).join("、");
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const step = count * (form.intervalUnit === "hours" ? 60 : 1);
      const startParts = (form.windowMode === "range" ? form.windowStart : "00:00").split(":").map(Number);
      const endParts = (form.windowMode === "range" ? form.windowEnd : "23:59").split(":").map(Number);
      const startMinute = startParts[0] * 60 + startParts[1];
      const endMinute = endParts[0] * 60 + endParts[1];
      if (endMinute < startMinute) return { summary: summary, times: [] };
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      for (let offset = 0; offset < 60 && times.length < 5; offset++) {
        const day = new Date(start);
        day.setDate(start.getDate() + offset);
        const weekday = dayNames[day.getDay()];
        if (form.dayFilter === "custom" && !form.intervalWeekdays.includes(weekday)) continue;
        for (let minute = startMinute; minute <= endMinute && times.length < 5; minute += step) {
          const candidate = new Date(day.getFullYear(), day.getMonth(),
            day.getDate(), Math.floor(minute / 60), minute % 60);
          if (candidate > now) times.push(candidate);
        }
      }
    }
  }
  return { summary: summary, times: times.slice(0, 5) };
}

function openEventForm(id) {
  const record = events.find(function (item) { return item.id === id; });
  const editing = !!record;
  const randomPart = function () { return Math.random().toString(36).slice(2, 10); };
  const today = new Date();
  const localDate = today.getFullYear() + "-" +
    String(today.getMonth() + 1).padStart(2, "0") + "-" +
    String(today.getDate()).padStart(2, "0");
  const form = Object.assign({
    type: record ? record.type : "Timer", timerMode: "fixed", fixedCycle: "daily",
    times: ["09:00"], weekdays: [], monthDays: "1", lastDay: false,
    intervalCount: "15", intervalUnit: "minutes", dayFilter: "daily",
    intervalWeekdays: [], windowMode: "range", windowStart: "08:00",
    windowEnd: "18:00", intervalStartDate: localDate, intervalTime: "09:00",
    cronExpression: "",
    serviceUrl: "", topic: "", authMethod: "none", credential: "",
    kafkaBootstrapServers: "", kafkaTopic: "", kafkaGroupId: "",
    kafkaAuth: "none", kafkaUsername: "", kafkaPassword: "",
    mqttBroker: "", mqttTopic: "", mqttClientId: "", mqttQos: "1",
    mqttCleanSession: "false", mqttKeepAlive: "60", mqttAuth: "none",
    mqttUsername: "", mqttPassword: "",
    webhookPath: "", webhookMethod: "POST", webhookApiKey: "",
    webhookContentType: "application/json", webhookAdvanced: false,
    queryParams: [], headerParams: [], bodyParams: []
  }, record && record.sourceConfig
    ? JSON.parse(JSON.stringify(record.sourceConfig)) : {});
  if (record && !record.sourceConfig) {
    if (record.type === "Pulsar") {
      form.topic = record.info;
      form.serviceUrl = record.id === 1
        ? "pulsar://10.0.1.2:6650" : "pulsar://pulsar.factory.local:6650";
    }
    if (record.type === "Kafka") {
      form.kafkaTopic = record.info.split(" · ")[0];
      form.kafkaBootstrapServers = "kafka-broker-1:9092,kafka-broker-2:9092";
      form.kafkaGroupId = "event-center-" + record.id;
    }
    if (record.type === "MQTT") {
      form.mqttTopic = record.info;
      form.mqttBroker = "mqtt://emqx.factory.local:1883";
    }
    if (record.type === "WebHook") {
      const match = record.info.match(/^(GET|POST|PUT)\s+(.+)$/);
      if (match) { form.webhookMethod = match[1]; form.webhookPath = match[2]; }
    }
    if (record.type === "Timer") {
      if (record.info.startsWith("Cron:")) {
        form.timerMode = "cron";
        form.cronExpression = record.info.slice(5).trim();
      } else {
        const time = record.info.match(/\d{2}:\d{2}/);
        if (time) form.times = [time[0]];
        if (record.info.startsWith("每周")) {
          form.fixedCycle = "weekly";
          form.weekdays = ["Fri"];
        } else if (record.info.startsWith("每月")) form.fixedCycle = "monthly";
        else if (record.info.startsWith("每小时")) {
          form.timerMode = "interval";
          form.intervalUnit = "hours";
          form.intervalCount = "1";
        }
      }
    }
  }
  ["times", "weekdays", "intervalWeekdays"].forEach(function (key) {
    form[key] = Array.isArray(form[key]) ? form[key].slice() : [];
  });
  if (form.dayFilter === "workdays") {
    form.dayFilter = "custom";
    form.intervalWeekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  }
  ["queryParams", "headerParams", "bodyParams"].forEach(function (key) {
    form[key] = Array.isArray(form[key]) ? form[key].map(function (row) {
      return {
        name: row.name || "", type: row.type || "string", required: !!row.required
      };
    }) : [];
  });
  form.monthDays = String(form.monthDays == null ? "" : form.monthDays);
  if (form.windowMode === "all") {
    form.windowMode = "range";
    form.windowStart = "00:00";
    form.windowEnd = "23:59";
  }
  if (!form.webhookPath) form.webhookPath = "/webhook/evt_" +
    (record ? record.id : Date.now()) + "_" + randomPart().slice(0, 6);
  if (!form.webhookApiKey) form.webhookApiKey = "evt_" + randomPart() + randomPart();
  if (!form.mqttClientId) form.mqttClientId = "evt-platform-" + randomPart().slice(0, 6);

  const body = '<div class="form-field"><label>事件名称 <span class="event-required">*</span></label>' +
    '<input id="eventNameInput" value="' + esc(record ? record.name : "") +
    '" placeholder="例如：设备温度异常上报"></div>' +
    '<div class="event-source-wrap"><div class="event-source-label">触发源类型 ' +
    '<span class="event-required">*</span></div>' +
    '<div class="event-source-tabs" id="eventSourceTabs" role="tablist" aria-label="触发源类型">' +
    ["Timer", "WebHook", "Pulsar", "Kafka", "MQTT"].map(function (type) {
      return '<button class="event-source-tab ' + (form.type === type ? "active" : "") +
        '" type="button" role="tab" aria-selected="' + (form.type === type) +
        '" data-source-type="' + type + '">' + type + '</button>';
    }).join("") + '</div></div>' +
    '<div id="eventTypeFields"></div>';
  const foot = '<span class="flow-note">' +
    (editing ? "保存后，事件接入和执行开关状态保持不变。" :
      "创建后默认关闭接入和执行动作。") +
    '</span><div class="right"><button class="btn btn-small" data-close>取消</button>' +
    '<button class="btn btn-primary btn-small" id="saveEventBtn">' +
    (editing ? "保存修改" : "创建事件") + '</button></div>';
  openModal(editing ? "编辑事件" : "新增事件", body, foot, false);
  document.getElementById("modal").classList.add("event-dialog");
  const fields = document.getElementById("eventTypeFields");

  function field(label, key, placeholder, required, type, hint) {
    return '<div class="form-field"><label>' + label +
      (required ? ' <span class="event-required">*</span>' : "") +
      '</label><input data-field="' + key + '" type="' + (type || "text") +
      '" value="' + esc(form[key] == null ? "" : form[key]) +
      '" placeholder="' + esc(placeholder || "") + '">' +
      (hint ? '<div class="event-help">' + hint + '</div>' : "") + '</div>';
  }
  function selectField(label, key, options, hint) {
    return '<div class="form-field"><label>' + label + '</label><select data-field="' +
      key + '">' + options.map(function (option) {
        return '<option value="' + option[0] + '" ' +
          (String(form[key]) === String(option[0]) ? "selected" : "") +
          '>' + option[1] + '</option>';
      }).join("") + '</select>' +
      (hint ? '<div class="event-help">' + hint + '</div>' : "") + '</div>';
  }
  function radioField(label, key, options) {
    return '<div class="form-field"><label>' + label + '</label>' +
      '<div class="event-radio-group" role="radiogroup" aria-label="' + label + '">' +
      options.map(function (option) {
        const active = form[key] === option[0];
        return '<label class="event-radio ' + (active ? "active" : "") + '">' +
          '<input type="radio" name="event-' + key + '" data-field="' + key +
          '" value="' + option[0] + '" ' + (active ? "checked" : "") +
          '><span>' + option[1] + '</span></label>';
      }).join("") + '</div></div>';
  }
  function weekButtons(target) {
    return '<div class="event-chip-row">' +
      [["Mon", "周一"], ["Tue", "周二"], ["Wed", "周三"], ["Thu", "周四"],
        ["Fri", "周五"], ["Sat", "周六"], ["Sun", "周日"]].map(function (day) {
        return '<button class="event-day ' +
          (form[target].includes(day[0]) ? "active" : "") +
          '" type="button" data-action="toggle-day" data-target="' +
          target + '" data-day="' + day[0] + '">' + day[1] + '</button>';
      }).join("") + '</div>';
  }
  function renderPreview() {
    const target = document.getElementById("timerPreview");
    if (!target) return;
    const result = eventFormTimerPreview(form);
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "本地时区";
    target.innerHTML = '<h5>触发预览</h5><p>' + esc(result.summary) +
      '<br>时区：' + esc(zone) + '</p>' +
      (result.error ? '<div class="event-help">' + esc(result.error) + '</div>' :
        result.times && result.times.length
          ? '<ol>' + result.times.map(function (date) {
            return '<li>' + esc(date.toLocaleString("zh-CN", {
              year: "numeric", month: "2-digit", day: "2-digit",
              weekday: "short", hour: "2-digit", minute: "2-digit"
            })) + '</li>';
          }).join("") + '</ol>'
          : '<div class="event-help">完成设置后展示未来 5 次触发时间。</div>');
  }

  function timerControls() {
    const modeTabs = '<div class="event-mode-tabs">' +
      [["fixed", "指定时间点"], ["interval", "按间隔重复"], ["cron", "Cron 表达式"]]
        .map(function (item) {
          return '<button type="button" data-action="timer-mode" data-mode="' +
            item[0] + '" class="' + (form.timerMode === item[0] ? "active" : "") +
            '">' + item[1] + '</button>';
        }).join("") + '</div>';
    let controls = "";
    if (form.timerMode === "fixed") {
      controls += '<div class="event-form-grid">' +
        selectField("执行周期", "fixedCycle",
          [["daily", "每天"], ["weekly", "每周"], ["monthly", "每月"]]) +
        '<div class="form-field"><label>添加时间点</label><div class="event-inline">' +
        '<input id="newTimerTime" type="time" aria-label="新增执行时间">' +
        '<button class="btn btn-small" type="button" data-action="add-time">＋ 添加</button>' +
        '</div></div></div>';
      controls += '<div class="event-time-box"><strong class="event-time-label">' +
        '已设置时间点</strong><div class="event-chip-row">' +
        (form.times.length ? form.times.map(function (time, index) {
          return '<span class="event-chip">' + esc(time) +
            '<button type="button" data-action="remove-time" data-index="' +
            index + '" aria-label="移除时间点">×</button></span>';
        }).join("") : '<span class="event-help">还没有时间点，请从上方添加。</span>') +
        '</div><span class="event-time-count">' + form.times.length + ' 个</span></div>';
      if (form.fixedCycle === "weekly") {
        controls += '<div class="form-field event-timer-extra"><label>执行星期 ' +
          '<span class="event-required">*</span></label>' + weekButtons("weekdays") + '</div>';
      }
      if (form.fixedCycle === "monthly") {
        const selectedDays = form.monthDays.split(",").map(function (value) {
          return Number(value.trim());
        }).filter(function (value) { return value >= 1 && value <= 31; });
        controls += '<div class="form-field event-timer-extra">' +
          '<label>每月日期 <span class="event-required">*</span>' +
          '<span class="event-help" style="display:inline;margin-left:6px">可多选</span></label>' +
          '<div class="event-month-days">' +
          Array.from({ length: 31 }, function (_, index) {
            const day = index + 1, active = selectedDays.includes(day);
            return '<button class="event-month-day ' + (active ? "active" : "") +
              '" type="button" data-action="toggle-month-day" data-day="' + day +
              '" aria-pressed="' + active + '">' + day + '</button>';
          }).join("") +
          '<button class="event-month-day last ' + (form.lastDay ? "active" : "") +
          '" type="button" data-action="toggle-last-day" aria-pressed="' +
          !!form.lastDay + '">最后一天</button></div></div>';
      }
    } else if (form.timerMode === "interval") {
      controls += '<div class="event-schedule-rows"><div class="event-schedule-row">' +
        '<span class="event-schedule-label">每隔</span>' +
        '<input data-field="intervalCount" type="number" min="1" ' +
        'aria-label="间隔数值" value="' + esc(form.intervalCount) + '">' +
        '<select data-field="intervalUnit" aria-label="间隔单位">' +
        [["minutes", "分钟"], ["hours", "小时"], ["days", "天"]].map(function (item) {
          return '<option value="' + item[0] + '" ' +
            (form.intervalUnit === item[0] ? "selected" : "") +
            '>' + item[1] + '</option>';
        }).join("") + '</select><span>触发</span></div>';
      if (form.intervalUnit === "days") {
        controls += '<div class="event-schedule-row"><span class="event-schedule-label">' +
          '起始日期</span><input data-field="intervalStartDate" type="date" ' +
          'aria-label="起始日期" value="' + esc(form.intervalStartDate) + '"></div>' +
          '<div class="event-schedule-row"><span class="event-schedule-label">' +
          '执行时间</span><input data-field="intervalTime" type="time" ' +
          'aria-label="执行时间" value="' + esc(form.intervalTime) + '"></div>';
      } else {
        controls += '<div class="event-schedule-row"><span class="event-schedule-label">' +
          '生效日期</span><select data-field="dayFilter" aria-label="生效日期">' +
          [["daily", "每天"], ["custom", "指定星期"]]
            .map(function (item) {
              return '<option value="' + item[0] + '" ' +
                (form.dayFilter === item[0] ? "selected" : "") +
                '>' + item[1] + '</option>';
            }).join("") + '</select></div>';
        if (form.dayFilter === "custom") {
          controls += '<div class="event-schedule-row"><span class="event-schedule-label">' +
            '指定星期</span>' + weekButtons("intervalWeekdays") + '</div>';
        }
        controls += '<div class="event-schedule-row"><span class="event-schedule-label">' +
          '运行时段</span><input data-field="windowStart" type="time" ' +
          'aria-label="开始时间" value="' + esc(form.windowStart) + '">' +
          '<span>至</span><input data-field="windowEnd" type="time" ' +
          'aria-label="结束时间" value="' + esc(form.windowEnd) + '"></div>';
      }
      controls += '</div>';
    } else {
      controls += field("Cron 表达式", "cronExpression", "例如：0 0 8 * * ?",
        true, "text", "支持常见的 5–7 段表达式；特殊写法可在运行服务中校验。");
    }
    return '<section class="event-section"><h4>定时触发</h4>' +
      modeTabs + '<div class="event-timer-layout"><div>' + controls +
      '</div><aside class="event-preview" id="timerPreview"></aside></div></section>';
  }

  function paramGroup(title, list, note) {
    const rows = form[list].map(function (row, index) {
      const typeInput = list === "headerParams" ? '<span></span>' :
        '<select data-list="' + list + '" data-index="' + index + '" data-prop="type">' +
        [["string", "String"], ["number", "Number"], ["boolean", "Boolean"]]
          .map(function (option) {
            return '<option value="' + option[0] + '" ' +
              (row.type === option[0] ? "selected" : "") +
              '>' + option[1] + '</option>';
          }).join("") + '</select>';
      return '<div class="event-param-row"><input data-list="' + list +
        '" data-index="' + index + '" data-prop="name" value="' +
        esc(row.name || "") + '" placeholder="变量名">' + typeInput +
        '<label><input type="checkbox" data-list="' + list +
        '" data-index="' + index + '" data-prop="required" ' +
        (row.required ? "checked" : "") + '>必填</label>' +
        '<button class="close-x" type="button" data-action="remove-param" data-list="' +
        list + '" data-index="' + index + '" aria-label="移除参数">×</button></div>';
    }).join("");
    return '<div class="event-param-group"><header><strong>' + title +
      ' <span style="color:#9aa8ba">(' + form[list].length + ')</span></strong>' +
      '<button class="link-btn" type="button" data-action="add-param" data-list="' +
      list + '">＋ 添加</button></header><div class="event-param-body">' +
      (note ? '<div class="event-help" style="margin:0 0 7px">' + note + '</div>' : "") +
      (rows || '<div class="event-empty">暂无参数，按需添加</div>') +
      '</div></div>';
  }

  function renderTypeFields() {
    let html = "";
    if (form.type === "Timer") html = timerControls();
    if (form.type === "Pulsar") {
      html = '<section class="event-section"><h4>Pulsar 接入</h4>' +
        '<div class="event-form-grid">' +
        field("服务地址", "serviceUrl", "pulsar://10.0.1.2:6650", true, "text",
          "支持 pulsar:// 或 pulsar+ssl://。") +
        field("订阅主题 Topic", "topic", "persistent://public/default/my-topic", true) +
        '<div class="span-2">' +
          radioField("鉴权方式", "authMethod",
            [["none", "无鉴权"], ["token", "Token 鉴权"]]) +
        '</div>' +
        (form.authMethod === "token"
          ? '<div class="span-2">' +
            field("访问凭证 Token", "credential", "输入 Token", true, "password") +
            '</div>' : "") +
        '</div></section>';
    }
    if (form.type === "Kafka") {
      html = '<section class="event-section"><h4>Kafka 接入</h4>' +
        '<div class="event-form-grid">' +
        field("服务地址 Bootstrap Servers", "kafkaBootstrapServers",
          "broker-1:9092,broker-2:9092", true, "text", "多个 Broker 用英文逗号分隔。") +
        field("订阅主题 Topic", "kafkaTopic", "device_events", true) +
        field("消费者组 ID", "kafkaGroupId", "event-center-device-v1", true) +
        '<div class="form-field"><label>消费起始位置</label>' +
        '<input value="最新的数据 (Latest)" readonly>' +
        '<div class="event-help">无消费位点时从新消息开始。</div></div>' +
        '<div class="span-2">' +
          radioField("鉴权方式", "kafkaAuth",
            [["none", "无鉴权"], ["sasl", "SASL 用户名 / 密码"]]) +
        '</div>' +
        (form.kafkaAuth === "sasl"
          ? field("用户名", "kafkaUsername", "输入用户名", true) +
            field("密码", "kafkaPassword", "输入密码", true, "password") : "") +
        '</div></section>';
    }
    if (form.type === "MQTT") {
      html = '<section class="event-section"><h4>MQTT 接入</h4>' +
        '<div class="event-form-grid">' +
        field("Broker 地址", "mqttBroker", "mqtt://192.168.1.100:1883", true, "text",
          "支持 mqtt:// 或 mqtts://。") +
        field("订阅主题 Topic", "mqttTopic", "factory/line1/+/telemetry", true) +
        '<div class="form-field"><label>Client ID <span class="event-required">*</span></label>' +
        '<div class="event-inline"><input data-field="mqttClientId" value="' +
        esc(form.mqttClientId) + '"><button class="btn btn-small" type="button" ' +
        'data-action="regen-client">重新生成</button></div></div>' +
        selectField("QoS", "mqttQos",
          [["0", "0 - 最多一次"], ["1", "1 - 至少一次"], ["2", "2 - 恰好一次"]]) +
        selectField("Clean Session", "mqttCleanSession",
          [["false", "否，保留会话"], ["true", "是，清除会话"]]) +
        field("Keep Alive（秒）", "mqttKeepAlive", "60", false, "number") +
        '<div class="span-2">' +
          radioField("鉴权方式", "mqttAuth",
            [["none", "无鉴权"], ["username", "用户名 / 密码"]]) +
        '</div>' +
        (form.mqttAuth === "username"
          ? field("用户名", "mqttUsername", "输入用户名", true) +
            field("密码", "mqttPassword", "输入密码", true, "password") : "") +
        '</div></section>';
    }
    if (form.type === "WebHook") {
      const url = "https://api.event-platform.local" + form.webhookPath;
      html = '<section class="event-section"><h4>Webhook 接入</h4>' +
        '<div class="event-form-grid">' +
        selectField("请求方式", "webhookMethod",
          [["GET", "GET"], ["POST", "POST"], ["PUT", "PUT"]]) +
        '<div class="form-field"><label>鉴权方式</label>' +
        '<input value="Bearer 密钥" readonly></div>' +
        '<div class="form-field span-2"><label>Webhook URL</label>' +
        '<div class="event-inline"><input value="' + esc(url) +
        '" readonly><button class="btn btn-small" type="button" ' +
        'data-action="copy-url">复制</button></div></div>' +
        '<div class="form-field span-2"><label>密钥</label><div class="event-inline">' +
        '<input value="' + esc(form.webhookApiKey) +
        '" readonly><button class="btn btn-small" type="button" ' +
        'data-action="copy-key">复制</button><button class="btn btn-small" type="button" ' +
        'data-action="regen-key">重置</button></div><div class="event-help">' +
        '请求 Header 需携带 Authorization: Bearer &lt;密钥&gt;。</div></div></div>' +
        '<button class="event-advanced-toggle" type="button" ' +
        'data-action="toggle-webhook-advanced" aria-expanded="' +
        !!form.webhookAdvanced + '">' +
        '<span class="event-advanced-arrow" aria-hidden="true">' +
        (form.webhookAdvanced ? "▾" : "▸") + '</span>高级设置</button>' +
        (form.webhookAdvanced ? '<div style="margin-top:13px">' +
          selectField("内容类型 Content-Type", "webhookContentType",
            [["application/json", "application/json"],
              ["application/x-www-form-urlencoded", "application/x-www-form-urlencoded"],
              ["text/plain", "text/plain"],
              ["multipart/form-data", "multipart/form-data"]]) +
          paramGroup("Query Parameters", "queryParams", "URL 查询参数。") +
          paramGroup("Header Parameters", "headerParams",
            "Authorization 已由密钥处理。") +
          paramGroup("Request Body Parameters", "bodyParams",
            "GET 请求通常不需要 Body 参数。") +
          '<div class="event-help" style="margin-top:9px">' +
          '原始请求仍完整保留为 payload._webhook_raw。</div></div>' : "") +
        '</section>';
    }
    if (!form.type) {
      html = '<section class="event-section"><div class="event-help">' +
        '选择触发源类型后，这里会显示对应的接入设置。</div></section>';
    }
    fields.innerHTML = html;
    if (form.type === "Timer") renderPreview();
  }

  let previewTimer = null;
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 120);
  }
  function syncField(ev) {
    const input = ev.target;
    if (input.dataset.field) {
      const key = input.dataset.field;
      form[key] = input.type === "checkbox" ? input.checked : input.value;
      if (ev.type === "change" && [
        "fixedCycle", "intervalUnit", "dayFilter", "windowMode",
        "authMethod", "kafkaAuth", "mqttAuth"
      ].includes(key)) renderTypeFields();
      else if (form.type === "Timer") schedulePreview();
    }
    if (input.dataset.list && input.dataset.prop) {
      const item = form[input.dataset.list][Number(input.dataset.index)];
      if (item) item[input.dataset.prop] =
        input.type === "checkbox" ? input.checked : input.value;
    }
  }
  fields.addEventListener("input", syncField);
  fields.addEventListener("change", syncField);
  document.getElementById("eventSourceTabs").addEventListener("click", function (ev) {
    const tab = ev.target.closest("[data-source-type]");
    if (!tab || tab.dataset.sourceType === form.type) return;
    form.type = tab.dataset.sourceType;
    document.querySelectorAll("#eventSourceTabs [data-source-type]").forEach(function (item) {
      const active = item.dataset.sourceType === form.type;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    });
    renderTypeFields();
  });
  fields.addEventListener("click", function (ev) {
    if (ev.target.matches && ev.target.matches('input[type="time"]')) {
      if (typeof ev.target.showPicker === "function") {
        try { ev.target.showPicker(); } catch (_) { ev.target.focus(); }
      } else ev.target.focus();
      return;
    }
    const button = ev.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "timer-mode") {
      form.timerMode = button.dataset.mode;
      renderTypeFields();
    }
    if (action === "add-time") {
      const input = document.getElementById("newTimerTime");
      const value = input ? input.value : "";
      if (!value) { showToast("请先选择时间点"); return; }
      if (form.times.includes(value)) { showToast("这个时间点已添加"); return; }
      form.times.push(value);
      form.times.sort();
      renderTypeFields();
    }
    if (action === "remove-time") {
      form.times.splice(Number(button.dataset.index), 1);
      renderTypeFields();
    }
    if (action === "toggle-day") {
      const selected = form[button.dataset.target];
      const index = selected.indexOf(button.dataset.day);
      if (index >= 0) selected.splice(index, 1);
      else selected.push(button.dataset.day);
      renderTypeFields();
    }
    if (action === "toggle-month-day") {
      const day = Number(button.dataset.day);
      const selected = form.monthDays.split(",").map(function (value) {
        return Number(value.trim());
      }).filter(function (value) { return value >= 1 && value <= 31; });
      const index = selected.indexOf(day);
      if (index >= 0) selected.splice(index, 1);
      else selected.push(day);
      form.monthDays = selected.sort(function (a, b) { return a - b; }).join(",");
      renderTypeFields();
    }
    if (action === "toggle-last-day") {
      form.lastDay = !form.lastDay;
      renderTypeFields();
    }
    if (action === "toggle-webhook-advanced") {
      form.webhookAdvanced = !form.webhookAdvanced;
      renderTypeFields();
    }
    if (action === "add-param") {
      form[button.dataset.list].push({ name: "", type: "string", required: false });
      renderTypeFields();
    }
    if (action === "remove-param") {
      form[button.dataset.list].splice(Number(button.dataset.index), 1);
      renderTypeFields();
    }
    if (action === "regen-client") {
      form.mqttClientId = "evt-platform-" + randomPart().slice(0, 6);
      renderTypeFields();
    }
    if (action === "regen-key") {
      form.webhookApiKey = "evt_" + randomPart() + randomPart();
      renderTypeFields();
    }
    if (action === "copy-url" || action === "copy-key") {
      const value = action === "copy-url"
        ? "https://api.event-platform.local" + form.webhookPath
        : form.webhookApiKey;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(function () {
          showToast("已复制");
        }).catch(function () { showToast("复制失败，请手动选择内容"); });
      } else showToast("请手动选择内容复制");
    }
  });

  function invalid(message, key) {
    showToast(message);
    const input = key ? fields.querySelector('[data-field="' + key + '"]')
      : document.getElementById("eventNameInput");
    if (input) {
      input.focus();
      input.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    return false;
  }
  function validParamList(list, label) {
    const names = form[list].map(function (row) { return (row.name || "").trim(); });
    const missing = names.findIndex(function (name) { return !name; });
    const lower = names.map(function (name) { return name.toLowerCase(); });
    const duplicate = lower.findIndex(function (name, index) {
      return lower.indexOf(name) !== index;
    });
    const badIndex = missing >= 0 ? missing : duplicate;
    if (badIndex >= 0) {
      showToast(label + (missing >= 0 ? "中有未填写的变量名" : "中存在重复变量名"));
      const input = fields.querySelector('[data-list="' + list +
        '"][data-index="' + badIndex + '"][data-prop="name"]');
      if (input) {
        input.focus();
        input.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return false;
    }
    return true;
  }
  document.getElementById("saveEventBtn").addEventListener("click", function () {
    const name = document.getElementById("eventNameInput").value.trim();
    if (!name) return invalid("请输入事件名称");
    if (!form.type) return invalid("请选择触发源类型");
    let info = "";
    if (form.type === "Timer") {
      if (form.timerMode === "fixed") {
        if (!form.times.length) return invalid("请添加至少一个执行时间点");
        if (form.fixedCycle === "weekly" && !form.weekdays.length)
          return invalid("请选择执行星期");
        if (form.fixedCycle === "monthly") {
          const days = form.monthDays.split(",").map(function (value) {
            return value.trim();
          }).filter(Boolean);
          if (!days.length && !form.lastDay)
            return invalid("请输入每月日期或选择最后一天", "monthDays");
          if (days.some(function (value) {
            return !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 31;
          })) return invalid("每月日期应为 1–31", "monthDays");
        }
        const cycle = { daily: "每日", weekly: "每周", monthly: "每月" };
        const chosenDates = form.monthDays.split(",").map(function (value) {
          return value.trim();
        }).filter(Boolean).join("、");
        info = cycle[form.fixedCycle] + " " +
          (form.fixedCycle === "weekly"
            ? form.weekdays.map(eventFormDayLabel).join("、") + " " : "") +
          (form.fixedCycle === "monthly"
            ? (chosenDates ? chosenDates + " 日" : "") + (form.lastDay
              ? (chosenDates ? "、" : "") + "最后一天" : "") + " " : "") +
          form.times.join("、");
      } else if (form.timerMode === "interval") {
        const count = Number(form.intervalCount);
        if (!Number.isInteger(count) || count < 1)
          return invalid("间隔数值应为正整数", "intervalCount");
        const max = { minutes: 1440, hours: 24, days: 365 }[form.intervalUnit];
        if (!max || count > max)
          return invalid("间隔数值超出当前单位的可用范围", "intervalCount");
        if (form.intervalUnit === "days") {
          if (!form.intervalStartDate || !form.intervalTime)
            return invalid("请选择起始日期和执行时间", "intervalStartDate");
        } else {
          if (form.dayFilter === "custom" && !form.intervalWeekdays.length)
            return invalid("请选择生效星期");
          if (form.windowMode === "range" &&
              (!form.windowStart || !form.windowEnd ||
               form.windowEnd <= form.windowStart))
            return invalid("结束时间需晚于开始时间", "windowEnd");
        }
        info = "每隔 " + count + " " +
          ({ minutes: "分钟", hours: "小时", days: "天" }[form.intervalUnit] || "分钟");
        if (form.windowMode === "range" && form.intervalUnit !== "days")
          info += " · " + form.windowStart + "–" + form.windowEnd;
      } else {
        const cron = form.cronExpression.trim();
        if (cron.split(/\s+/).length < 5 || cron.split(/\s+/).length > 7)
          return invalid("请输入 5–7 段 Cron 表达式", "cronExpression");
        info = "Cron: " + cron;
      }
    } else if (form.type === "Pulsar") {
      if (!/^pulsar(\+ssl)?:\/\/.+/i.test(form.serviceUrl.trim()))
        return invalid("服务地址需以 pulsar:// 或 pulsar+ssl:// 开头", "serviceUrl");
      if (!form.topic.trim()) return invalid("请输入订阅主题", "topic");
      if (form.authMethod === "token" && !form.credential.trim())
        return invalid("请输入 Pulsar Token", "credential");
      info = form.topic.trim();
    } else if (form.type === "Kafka") {
      if (!form.kafkaBootstrapServers.trim())
        return invalid("请输入 Kafka 服务地址", "kafkaBootstrapServers");
      if (!form.kafkaTopic.trim()) return invalid("请输入订阅主题", "kafkaTopic");
      if (!form.kafkaGroupId.trim())
        return invalid("请输入消费者组 ID", "kafkaGroupId");
      if (form.kafkaAuth === "sasl" &&
          (!form.kafkaUsername.trim() || !form.kafkaPassword))
        return invalid("请输入 Kafka 用户名和密码", "kafkaUsername");
      info = form.kafkaTopic.trim() + " · " +
        form.kafkaBootstrapServers.split(",").length + " brokers";
    } else if (form.type === "MQTT") {
      if (!/^mqtts?:\/\/.+/i.test(form.mqttBroker.trim()))
        return invalid("Broker 地址需以 mqtt:// 或 mqtts:// 开头", "mqttBroker");
      if (!form.mqttTopic.trim()) return invalid("请输入订阅主题", "mqttTopic");
      if (!form.mqttClientId.trim())
        return invalid("请输入 Client ID", "mqttClientId");
      if (Number(form.mqttKeepAlive) < 10 || Number(form.mqttKeepAlive) > 65535)
        return invalid("Keep Alive 应为 10–65535 秒", "mqttKeepAlive");
      if (form.mqttAuth === "username" &&
          (!form.mqttUsername.trim() || !form.mqttPassword))
        return invalid("请输入 MQTT 用户名和密码", "mqttUsername");
      info = form.mqttTopic.trim();
    } else {
      if (!validParamList("queryParams", "Query Parameters") ||
          !validParamList("headerParams", "Header Parameters") ||
          !validParamList("bodyParams", "Body Parameters")) return;
      if (form.headerParams.some(function (row) {
        return row.name.toLowerCase() === "authorization";
      })) return invalid("Authorization 由密钥处理，无需重复声明");
      info = form.webhookMethod + " " + form.webhookPath;
    }
    const description = editing ? record.description || "" : "";
    const sourceConfig = JSON.parse(JSON.stringify(form));
    if (editing) {
      record.name = name;
      record.description = description;
      record.type = form.type;
      record.info = info;
      record.sourceConfig = sourceConfig;
    } else {
      events.unshift({
        id: Date.now(), name: name, description: description, type: form.type,
        info: info, sourceConfig: sourceConfig, status: false, actionsOn: false,
        count: 0, config: "draft", version: "-", branches: [],
        publishedBranches: [], draft: {branches:[{name:"其他情况",conditions:["所有事件"],logic:"",actions:[],isDefault:true}],tested:false,dirty:false}, versions: [], logs: []
      });
    }
    persist();
    closeModal();
    renderList();
    if (editing && currentEventId === record.id &&
        !document.getElementById("detailPage").classList.contains("hidden")) renderDetail();
    showToast(editing ? "事件接入配置已保存" : "事件已创建");
  });
  renderTypeFields();
}
