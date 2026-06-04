const MADRID_TIME_ZONE = "Europe/Madrid";

function madridParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MADRID_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function parseDateString(date) {
  const [year, month, day] = String(date).split("-").map(Number);
  return { year, month, day };
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function formatDateParts(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function addCalendarDays(date, days) {
  let { year, month, day } = parseDateString(date);
  let remaining = Number(days || 0);

  while (remaining > 0) {
    const monthDays = daysInMonth(year, month);
    if (day < monthDays) {
      day += 1;
    } else {
      day = 1;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    remaining -= 1;
  }

  while (remaining < 0) {
    if (day > 1) {
      day -= 1;
    } else {
      month -= 1;
      if (month < 1) {
        month = 12;
        year -= 1;
      }
      day = daysInMonth(year, month);
    }
    remaining += 1;
  }

  return formatDateParts(year, month, day);
}

function weekdayMondayFirst(date) {
  const { year, month, day } = parseDateString(date);
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const adjustedYear = month < 3 ? year - 1 : year;
  const sundayFirst = (adjustedYear + Math.floor(adjustedYear / 4) - Math.floor(adjustedYear / 100) + Math.floor(adjustedYear / 400) + offsets[month - 1] + day) % 7;
  return sundayFirst === 0 ? 7 : sundayFirst;
}

function getTodayMadridDateString(date = new Date()) {
  const { year, month, day } = madridParts(date);
  return `${year}-${month}-${day}`;
}

function getMadridDateString(date = new Date()) {
  return getTodayMadridDateString(date);
}

function getTodayLocalDateString() {
  return getMadridDateString();
}

function formatLocalDateString(date) {
  return getTodayMadridDateString(date instanceof Date ? date : new Date(date));
}

function getMadridTimestamp(date = new Date()) {
  const { year, month, day, hour, minute, second } = madridParts(date);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function getMadridTimeString(date = new Date()) {
  const { hour, minute } = madridParts(date);
  return `${hour}:${minute}`;
}

function getTechnicalTimestamp(date = new Date()) {
  return date.toISOString();
}

function formatMadridTime(value) {
  if (!value) return "";
  const storedMadridTime = String(value).match(/^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/);
  if (storedMadridTime) return storedMadridTime[1];

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const time = String(value).match(/T(\d{2}:\d{2})/);
    return time ? time[1] : "";
  }

  return new Intl.DateTimeFormat("es-ES", {
    timeZone: MADRID_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function addLocalDays(date, days) {
  return addCalendarDays(date, days);
}

function getLocalStartOfWeek(date) {
  return addCalendarDays(date, -(weekdayMondayFirst(date) - 1));
}

function getMadridDayOfMonth() {
  return Number(madridParts().day);
}

function getMadridDaysInCurrentMonth() {
  const today = getTodayMadridDateString();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return daysInMonth(year, month);
}

function getDaysInMadridMonth(year, month) {
  return daysInMonth(Number(year), Number(month));
}

export {
  addLocalDays,
  formatLocalDateString,
  formatMadridTime,
  getLocalStartOfWeek,
  getDaysInMadridMonth,
  getMadridDayOfMonth,
  getMadridDaysInCurrentMonth,
  getMadridDateString,
  getMadridTimeString,
  getMadridTimestamp,
  getTechnicalTimestamp,
  getTodayMadridDateString,
  getTodayLocalDateString,
};
