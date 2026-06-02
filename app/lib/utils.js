// ── Parse extracted OCR text for invoice fields ──────────────────────────────
export function parseInvoiceText(rawText = "") {
  // Step 1: Fix OCR-broken dollar amounts  e.g. "$ 4 25.00" → "$425.00", "$ 3,711.46" → "$3,711.46"
  const text = rawText.replace(/\$\s+([\d][\d ,]*\.\d{2})/g, (_, n) => "$" + n.replace(/\s+/g, ""));

  const TABLE_HEADERS = new Set(["ITEM","DAY","RATE","TOTAL","DESCRIPTION","QTY","QUANTITY","AMOUNT","PRICE","UNIT","DATE","NO","REF"]);

  // ── Invoice number ──
  let invoiceNumber = "";
  const invM = text.match(/(?:invoice\s*(?:no\.?|num\.?|number|#))[:\s#]*([A-Z0-9][A-Z0-9\-]{0,20})/i);
  if (invM) {
    const candidate = invM[1].trim();
    if (!TABLE_HEADERS.has(candidate.toUpperCase())) invoiceNumber = candidate;
  }

  // ── Date ──
  let date = new Date().toISOString().split("T")[0];
  const datePatterns = [
    /(?:invoice\s+date|date|dated?|bill\s+date|issue\s+date)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(?:invoice\s+date|date|dated?|bill\s+date|issue\s+date)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{1,2}\/\d{1,2}\/\d{2})\b/,
    /([A-Za-z]+ \d{1,2},? \d{4})/,
  ];
  for (const p of datePatterns) {
    const m = text.match(p);
    if (m) { const d = new Date(m[1]); if (!isNaN(d)) { date = d.toISOString().split("T")[0]; break; } }
  }

  // ── Amount — prefer TOTAL keyword, take last/largest match ──
  let amount = 0;
  const totalMs = [...text.matchAll(/(?:total|amount\s+due|balance\s+due|invoice\s+total|grand\s+total)[^\d$\n]{0,20}\$?([\d,]+(?:\.\d{2})?)/gi)];
  if (totalMs.length) {
    const vals = totalMs.map(m => parseFloat(m[1].replace(/,/g, "")));
    amount = Math.max(...vals);
  }
  if (!amount) {
    // Fallback: largest dollar figure in doc
    const allD = [...text.matchAll(/\$([\d,]+\.\d{2})/g)].map(m => parseFloat(m[1].replace(/,/g, "")));
    if (allD.length) amount = Math.max(...allD);
  }

  // ── Company — find RECIPIENT name, not sender ──
  let company = "";

  // Strategy 1: After INVOICE header, find "Name:" label whose VALUE is on the NEXT LINE
  const invoicePos = text.search(/\bINVOICE\b/i);
  if (invoicePos !== -1) {
    const afterInvoice = text.slice(invoicePos + 7);
    const m = afterInvoice.match(/Name:[^\n]*\n[ \t]*([A-Za-z][^\n]{0,50})/i);
    if (m) {
      const raw = m[1]
        .replace(/Address.*/i, "")
        .replace(/invoice.*/i, "")
        .replace(/job\s*(?:name)?[:\s].*/i, "")
        .replace(/Date[:\s].*/i, "")
        .trim();
      if (raw.length > 1 && !/^(date|address|phone|job|name|item|day|rate|total|payment|comments|ach|routing|account|office)$/i.test(raw)) {
        company = raw;
      }
    }
  }

  // Strategy 2: Inline "Name: COMPANY" on same line
  if (!company) {
    const nameMatches = [...text.matchAll(/Name[:\s]+([^\n\r]{2,60})/gi)];
    for (let i = 1; i < nameMatches.length; i++) {
      const raw = nameMatches[i][1]
        .replace(/Date[:\s].*/i, "")
        .replace(/invoice.*/i, "")
        .replace(/job\s*(?:name)?[:\s].*/i, "")
        .replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}.*/,"")
        .trim();
      if (raw && raw.length > 1 && !/^(date|address|phone|job|honda|fax|to|from|dear|attn|n\/a)$/i.test(raw)) {
        company = raw; break;
      }
    }
  }

  // Strategy 3: Explicit customer/client/bill-to keyword
  if (!company) {
    const SKIP = /^(job|name|address|date|invoice|to|from|dear|attn)/i;
    for (const pat of [
      /(?:bill\s*to|billed?\s*to|client|customer)[:\s]+([^\n]{2,60})/im,
      /(?:from|vendor|company)[:\s]+([^\n]{2,60})/im,
    ]) {
      const m = text.match(pat);
      if (m) {
        const candidate = m[1].trim();
        if (!SKIP.test(candidate) && candidate.length > 1) { company = candidate; break; }
      }
    }
  }

  return { company, amount, date, invoiceNumber };
}

// ── Parse timecard OCR text ──────────────────────────────────────────────────
export function parseTimecardText(rawText = "") {
  const text = rawText.replace(/\$\s+([\d][\d ,]*\.\d{2})/g, (_, n) => "$" + n.replace(/\s+/g, ""));
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  let company = "";
  for (const pat of [
    /(?:production\s*company)[:\s]+([^\n]{2,60})/i,
    /(?:client|company|employer|customer|billed?\s*to)[:\s]+([^\n]{2,60})/i,
  ]) {
    const m = text.match(pat);
    if (m) { company = m[1].replace(/\d{1,2}[\/\-]\d.*/,"").trim(); break; }
  }
  if (!company) {
    const NOISE = /^(timecard|timesheet|time\s*card|time\s*sheet|invoice|date|hours?|rate|total|name|employee|description|week|period|from|to|pay|company|client|phone|email|address|signature|approved)$/i;
    for (const line of lines.slice(0, 12)) {
      if (line.length > 1 && line.length < 60 && /[a-zA-Z]/.test(line) && !NOISE.test(line) && !/^\d/.test(line) && !/[@\.\$#]/.test(line)) {
        company = line; break;
      }
    }
  }

  let jobName = "";
  const jobNameM = text.match(/(?:job\s*name)[:\s]+([^\n]{2,80})/i);
  if (jobNameM) {
    jobName = jobNameM[1]
      .replace(/production\s*company.*/i, "")
      .replace(/guar\.?.*/i, "")
      .replace(/rate.*/i, "")
      .replace(/week\s*ending.*/i, "")
      .trim();
  }

  let jobClassification = "";
  const classM = text.match(/(?:job\s*class(?:ification)?)[:\s]+([^\n]{2,60})/i);
  if (classM) jobClassification = classM[1].replace(/union.*/i,"").replace(/occ.*/i,"").trim();

  let guarHours = 0;
  const guarM = text.match(/(?:guar\.?\s*hours?)[:\s]*([\d]+(?:\.\d+)?)/i);
  if (guarM) { const v = parseFloat(guarM[1]); if (v > 0 && v <= 24) guarHours = v; }

  let hours = 0;
  const allTotalMatches = [...text.matchAll(/(?:total\s*hrs?\.?)[:\s]*([\d]+(?:\.\d+)?)/gi)];
  if (allTotalMatches.length) {
    const vals = allTotalMatches.map(m => parseFloat(m[1])).filter(v => v > 0 && v <= 24);
    if (vals.length) hours = parseFloat(vals.reduce((a, b) => a + b, 0).toFixed(2));
  }
  if (!hours) {
    for (const p of [
      /(?:total\s*hours?|hours?\s*worked|hours?\s*logged)[:\s]*([\d]+(?:\.\d+)?)/i,
      /(?:hours?)[:\s]*([\d]+(?:\.\d+)?)/i,
      /([\d]+(?:\.\d+)?)\s*(?:hrs?|hours?)/i,
    ]) {
      const m = text.match(p);
      if (m) { const v = parseFloat(m[1]); if (v > 0 && v <= 999) { hours = v; break; } }
    }
  }

  let hours1x = 0, hours15x = 0, hours2x = 0;
  const h1xM = text.match(/\b1X[:\s]*([\d]+(?:\.\d+)?)/i);
  const h15xM = text.match(/\b1\.5X[:\s]*([\d]+(?:\.\d+)?)/i);
  const h2xM = text.match(/\b2X[:\s]*([\d]+(?:\.\d+)?)/i);
  if (h1xM) hours1x = parseFloat(h1xM[1]) || 0;
  if (h15xM) hours15x = parseFloat(h15xM[1]) || 0;
  if (h2xM) hours2x = parseFloat(h2xM[1]) || 0;

  let rate = 0;
  for (const p of [
    /(?:hourly\s*rate|rate\s*per\s*hour|pay\s*rate|(?:^|\s)rate)[:\s]*\$?([\d,]+(?:\.\d{2})?)/im,
    /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:\/\s*(?:hr|hour))/i,
  ]) {
    const m = text.match(p);
    if (m) { const v = parseFloat(m[1].replace(/,/g,"")); if (v > 0) { rate = v; break; } }
  }

  let date = new Date().toISOString().split("T")[0];
  for (const p of [
    /(?:week\s*ending)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(?:period\s*end(?:ing)?|end\s*date)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(?:date)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{1,2}\/\d{1,2}\/\d{2})\b/,
  ]) {
    const m = text.match(p);
    if (m) { const d = new Date(m[1]); if (!isNaN(d)) { date = d.toISOString().split("T")[0]; break; } }
  }

  let description = "";
  const descM = text.match(/(?:description|notes?|work\s*performed|task)[:\s]+([^\n]{2,100})/i);
  if (descM) description = descM[1].trim();

  return { company, jobName, jobClassification, guarHours, hours, hours1x, hours15x, hours2x, rate, date, description };
}

// ── Parse paystub OCR text ───────────────────────────────────────────────────
export function parsePaystubText(rawText = "") {
  const text = rawText.replace(/\$\s+([\d][\d ,]*\.\d{2})/g, (_, n) => "$" + n.replace(/\s+/g, ""));

  const findAmount = (patterns) => {
    for (const p of patterns) {
      const m = text.match(p);
      if (m) { const v = parseFloat(m[1].replace(/,/g,"")); if (v > 0) return v; }
    }
    return 0;
  };

  const grossPay = findAmount([
    /(?:gross\s*(?:pay|earnings?|wages?))[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
    /(?:total\s*gross)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
    /(?:gross)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
  ]);

  const netPay = findAmount([
    /(?:net\s*(?:pay|wages?|earnings?)|take\s*home|net\s*amount)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
    /(?:net)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
  ]);

  let payDate = new Date().toISOString().split("T")[0];
  for (const p of [
    /(?:pay\s*date|payment\s*date|check\s*date|paid\s*on)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(?:pay\s*date|payment\s*date|check\s*date)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /(?:date)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{1,2}\/\d{1,2}\/\d{2})\b/,
  ]) {
    const m = text.match(p);
    if (m) { const d = new Date(m[1]); if (!isNaN(d)) { payDate = d.toISOString().split("T")[0]; break; } }
  }

  let checkNumber = "";
  const checkM = text.match(/(?:check\s*(?:no\.?|num\.?|number|#)|payment\s*(?:ref|id|no\.?)|confirmation\s*(?:no\.?|#)?)[:\s#]*([A-Z0-9\-]{3,20})/i);
  if (checkM) checkNumber = checkM[1].trim();

  let employer = "";
  for (const p of [
    /(?:employer|company|from|payer|payor)[:\s]+([^\n]{2,60})/i,
    /(?:paid\s*by)[:\s]+([^\n]{2,60})/i,
  ]) {
    const m = text.match(p);
    if (m) { employer = m[1].replace(/\d{1,2}[\/\-]\d.*/,"").trim(); break; }
  }

  return { grossPay, netPay, payDate, checkNumber, employer };
}

// ── Weekly timecard helpers ──────────────────────────────────────────────────
export const DAY_NAMES = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

export function getNextSaturday() {
  const d = new Date();
  const diff = (6 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

export function initWeekDays(weekEnding) {
  const sat = new Date(weekEnding + "T12:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sat);
    d.setDate(sat.getDate() - (6 - i));
    return { date: d.toISOString().split("T")[0], day: DAY_NAMES[d.getDay()], type: "work", call: "", meal1Out: "", meal1In: "", meal2Out: "", meal2In: "", wrap: "", mealPenalty: false, perDiemWork: false, perDiemOff: false, totalHours: 0, hours1x: 0, hours15x: 0, hours2x: 0 };
  });
}

export function parseTimeToMin(str) {
  if (!str) return null;
  const [h, m] = str.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export function calcDayHours(day) {
  const call = parseTimeToMin(day.call), wrap = parseTimeToMin(day.wrap);
  if (call == null || wrap == null) return 0;
  let total = wrap - call;
  if (total <= 0) total += 24 * 60;
  const m1o = parseTimeToMin(day.meal1Out), m1i = parseTimeToMin(day.meal1In);
  if (m1o != null && m1i != null && m1i > m1o) total -= (m1i - m1o);
  const m2o = parseTimeToMin(day.meal2Out), m2i = parseTimeToMin(day.meal2In);
  if (m2o != null && m2i != null && m2i > m2o) total -= (m2i - m2o);
  return Math.max(0, parseFloat((total / 60).toFixed(2)));
}

export function calcOTBreakdown(hours) {
  if (hours <= 8) return { hours1x: hours, hours15x: 0, hours2x: 0 };
  if (hours <= 12) return { hours1x: 8, hours15x: parseFloat((hours - 8).toFixed(2)), hours2x: 0 };
  return { hours1x: 8, hours15x: 4, hours2x: parseFloat((hours - 12).toFixed(2)) };
}

export function calcOTBreakdown6thDay(hours) {
  if (hours <= 12) return { hours1x: 0, hours15x: parseFloat(hours.toFixed(2)), hours2x: 0 };
  return { hours1x: 0, hours15x: 12, hours2x: parseFloat((hours - 12).toFixed(2)) };
}

export function calcOTBreakdown7thDay(hours) {
  return { hours1x: 0, hours15x: 0, hours2x: parseFloat(hours.toFixed(2)) };
}

export function applyWeekOTRules(days, guarHours) {
  const worked = days
    .map((d, i) => ({ i, date: d.date, actualHours: calcDayHours(d) }))
    .filter(x => x.actualHours > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  let sixthDayIdx = null;
  let seventhDayIdx = null;
  if (worked.length >= 7) seventhDayIdx = worked[6].i;
  if (worked.length >= 6) {
    const day5 = days[worked[4].i];
    const day6 = days[worked[5].i];
    sixthDayIdx = worked[5].i;
    if (day5.wrap && day6.call && day5.date && day6.date) {
      const wrapMs = new Date(day5.date + "T" + day5.wrap).getTime();
      const callMs = new Date(day6.date + "T" + day6.call).getTime();
      if ((callMs - wrapMs) / (1000 * 60 * 60) >= 36) sixthDayIdx = null;
    }
  }

  return days.map((d, i) => {
    const actualHours = calcDayHours(d);
    const paidHours = actualHours > 0 ? Math.max(actualHours, guarHours) : 0;
    const breakdown = (i === seventhDayIdx) ? calcOTBreakdown7thDay(paidHours) : (i === sixthDayIdx) ? calcOTBreakdown6thDay(paidHours) : calcOTBreakdown(paidHours);
    return { ...d, totalHours: actualHours, paidHours, ...breakdown };
  });
}

export function get6thDayIndex(days) {
  const worked = days
    .map((d, i) => ({ i, date: d.date, actualHours: calcDayHours(d) }))
    .filter(x => x.actualHours > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (worked.length < 6) return -1;
  const day5 = days[worked[4].i];
  const day6 = days[worked[5].i];
  if (day5.wrap && day6.call && day5.date && day6.date) {
    const wrapMs = new Date(day5.date + "T" + day5.wrap).getTime();
    const callMs = new Date(day6.date + "T" + day6.call).getTime();
    if ((callMs - wrapMs) / (1000 * 60 * 60) >= 36) return -1;
  }
  return worked[5].i;
}

export function get7thDayIndex(days) {
  const worked = days
    .map((d, i) => ({ i, date: d.date, actualHours: calcDayHours(d) }))
    .filter(x => x.actualHours > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (worked.length < 7) return -1;
  return worked[6].i;
}

export function calcTurnaroundViolations(days) {
  const violations = new Set();
  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1];
    const curr = days[i];
    if (!prev.wrap || !curr.call || !prev.date || !curr.date) continue;
    const wrapMs = new Date(prev.date + "T" + prev.wrap).getTime();
    const callMs = new Date(curr.date + "T" + curr.call).getTime();
    if (isNaN(wrapMs) || isNaN(callMs)) continue;
    const gapHours = (callMs - wrapMs) / 3600000;
    if (gapHours > 0 && gapHours < 10) violations.add(i);
  }
  return violations;
}

export function shouldAutoMealPenalty(day) {
  if (!day.call) return false;
  const hours = day.totalHours ?? calcDayHours(day);
  if (hours <= 0) return false;
  if (!day.meal1Out) return hours > 6;
  const toMins = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  let callMins = toMins(day.call);
  let mealMins = toMins(day.meal1Out);
  if (mealMins < callMins) mealMins += 24 * 60;
  return (mealMins - callMins) > 6 * 60;
}

export function downloadCSV(rows, filename) {
  const escape = v => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map(r => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const TAX_RATE = 0.25;
export const IRS_MILEAGE_RATE = 0.70;

export const MACRS_TABLES = {
  "3yr":  [33.33, 44.45, 14.81, 7.41],
  "5yr":  [20.00, 32.00, 19.20, 11.52, 11.52, 5.76],
  "7yr":  [14.29, 24.49, 17.49, 12.49, 8.93, 8.92, 8.93, 4.46],
  "10yr": [10.00, 18.00, 14.40, 11.52, 9.22, 7.37, 6.55, 6.55, 6.56, 6.55, 3.28],
  "15yr": [5.00, 9.50, 8.55, 7.70, 6.93, 6.23, 5.90, 5.90, 5.91, 5.90, 5.91, 5.90, 5.91, 5.90, 5.91, 2.95],
};

export const DEPR_LABELS = {
  "section179": "Sec. 179",
  "bonus": "Bonus",
  "straight-line": "SL",
  "macrs": "MACRS",
};

export function calcEquipDeduction(p, forYear) {
  const cost = parseFloat(p.amount) || 0;
  const method = p.depreciationMethod || "section179";
  const purchaseYear = p.date ? parseInt(p.date.slice(0, 4), 10) : NaN;
  if (!cost || isNaN(purchaseYear)) return 0;
  const yi = forYear - purchaseYear;
  if (method === "section179" || method === "bonus") return yi === 0 ? cost : 0;
  if (method === "straight-line") {
    const life = parseInt(p.usefulLife, 10) || 5;
    return yi >= 0 && yi < life ? cost / life : 0;
  }
  if (method === "macrs") {
    const table = MACRS_TABLES[p.macrsClass || "5yr"] || MACRS_TABLES["5yr"];
    return yi >= 0 && yi < table.length ? cost * (table[yi] / 100) : 0;
  }
  return yi === 0 ? cost : 0;
}

export const PAYMENT_TERMS = [
  { label: "Net 15", days: 15 },
  { label: "Net 30", days: 30 },
  { label: "Net 45", days: 45 },
  { label: "Net 60", days: 60 },
  { label: "Custom", days: null },
];

export function dueDateFromTerms(invoiceDate, terms) {
  const t = PAYMENT_TERMS.find(p => p.label === terms);
  if (!t || t.days == null) return null;
  const d = new Date(invoiceDate + "T12:00");
  if (isNaN(d)) return null;
  d.setDate(d.getDate() + t.days);
  return d.toISOString().split("T")[0];
}

export function calcLateFee(inv) {
  if (!inv.lateFeeType || inv.lateFeeType === "none") return 0;
  const effectiveStatus = computeInvoiceStatus(inv);
  if (effectiveStatus === "Paid") return 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const defaultDue = inv.dueDate || (() => { const d = new Date(inv.date); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; })();
  const due = new Date(defaultDue); due.setHours(0, 0, 0, 0);
  const daysOverdue = Math.max(0, Math.round((today - due) / 86400000));
  if (daysOverdue === 0) return 0;
  const amount = parseFloat(inv.amount) || 0;
  const received = parseFloat(inv.amountReceived) || 0;
  const balance = Math.max(0, amount - received);
  if (balance === 0) return 0;
  if (inv.lateFeeType === "flat") return parseFloat(inv.lateFeeRate) || 0;
  if (inv.lateFeeType === "daily") {
    const dailyRate = (parseFloat(inv.lateFeeRate) || 0) / 100;
    return parseFloat((balance * dailyRate * daysOverdue).toFixed(2));
  }
  return 0;
}

export function computeInvoiceStatus(inv) {
  const received = parseFloat(inv.amountReceived) || 0;
  const total = parseFloat(inv.amount) || 0;
  if (received > 0 && total > 0 && received >= total) return "Paid";
  if (received > 0 && received < total) return "Partially Paid";
  return inv.status || "Unpaid";
}

export function dayRateToHourly(dayRate, type) {
  const dr = parseFloat(dayRate);
  if (!dr || dr <= 0) return "";
  const divisor = type === "12" ? 14 : 11;
  return String(parseFloat((dr / divisor).toFixed(4)));
}

export const FOLDER_NAME = "Have I Been Paid?";

export const SIGNATURE_FONTS = [
  "Dancing Script", "Tangerine", "Great Vibes", "Satisfy",
  "Pinyon Script", "Sacramento", "Clicker Script", "Allura",
  "Alex Brush", "Yellowtail", "Marck Script", "Italianno",
];
