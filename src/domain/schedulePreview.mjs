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

const weekdayCode = value => {
  const key = String(value || '').trim().slice(0, 3).toLowerCase();
  return key ? key[0].toUpperCase() + key.slice(1) : '';
};
const codes = value => (Array.isArray(value) ? value : String(value || '').split(','))
  .map(weekdayCode).filter(Boolean);

export function schedulePreview(config) {
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return eventFormTimerPreview({
    timerMode: config.timerMode || 'fixed',
    fixedCycle: config.fixedCycle || 'daily',
    times: (Array.isArray(config.times) ? config.times : String(config.times || '').split(',')).map(value => String(value).trim()).filter(Boolean),
    weekdays: codes(config.weekdays),
    monthDays: String(config.monthDays || ''),
    lastDay: !!config.lastDay,
    intervalCount: config.intervalCount,
    intervalUnit: config.intervalUnit || 'minutes',
    intervalStartDate: config.intervalStartDate || localDate,
    intervalTime: config.intervalTime || '09:00',
    dayFilter: config.dayFilter || 'daily',
    intervalWeekdays: codes(config.intervalWeekdays),
    windowMode: 'range',
    windowStart: config.windowStart || '08:00',
    windowEnd: config.windowEnd || '18:00',
    cronExpression: config.cron || '',
  });
}