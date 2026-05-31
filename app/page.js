"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  CheckCircle,
  Clock,
  UploadCloud,
  FileText,
  ExternalLink,
  Trash2,
  Loader2,
  Plus,
  LogOut,
  Eye,
  X,
  AlertCircle,
  Briefcase,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  Package,
  Wrench,
  Search,
  CalendarClock,
  Pencil,
  Download,
  MapPin,
  Car,
  Fuel,
  RefreshCw,
  CloudOff,
  Lock,
  LockOpen,
  Layers,
  Calendar,
  ChevronLeft,
  FileDown,
  Copy,
  Utensils,
  Moon,
  Sun,
  Calculator,
  PenLine,
  CreditCard,
  Receipt,
} from "lucide-react";

const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700 ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, disabled, variant = "primary", className = "" }) => {
  const base = "inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";
  const v = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    outline: "border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 dark:border-slate-600 dark:text-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    danger: "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30",
    ghost: "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700",
  };
  return <button onClick={onClick} disabled={disabled} className={`${base} ${v[variant]} ${className}`}>{children}</button>;
};

const Input = ({ type = "text", value, onChange, placeholder, className = "", disabled = false }) => (
  <input type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}
    className={`flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500 dark:disabled:bg-slate-800 ${className}`} />
);

// ── Parse extracted OCR text for invoice fields ──────────────────────────────
function parseInvoiceText(rawText = "") {
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
  // (common in two-column form PDFs where OCR puts label and value on separate lines)
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

  // Strategy 2: Inline "Name: COMPANY" on same line (classic invoice layout)
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
function parseTimecardText(rawText = "") {
  const text = rawText.replace(/\$\s+([\d][\d ,]*\.\d{2})/g, (_, n) => "$" + n.replace(/\s+/g, ""));
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // ── Production Company (crew timecard format: "PRODUCTION COMPANY") ──
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

  // ── Job Name (crew timecard: "JOB NAME") ──
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

  // ── Job Classification ──
  let jobClassification = "";
  const classM = text.match(/(?:job\s*class(?:ification)?)[:\s]+([^\n]{2,60})/i);
  if (classM) jobClassification = classM[1].replace(/union.*/i,"").replace(/occ.*/i,"").trim();

  // ── Guaranteed Hours ──
  let guarHours = 0;
  const guarM = text.match(/(?:guar\.?\s*hours?)[:\s]*([\d]+(?:\.\d+)?)/i);
  if (guarM) { const v = parseFloat(guarM[1]); if (v > 0 && v <= 24) guarHours = v; }

  // ── Total Hours — sum all daily TOTAL HRS entries ──
  let hours = 0;
  // Try labeled total first
  const totalHrsPatterns = [
    /(?:total\s*hrs?\.?)[:\s]*([\d]+(?:\.\d+)?)/gi,
    /(?:total\s*hours?|hours?\s*worked|hours?\s*logged)[:\s]*([\d]+(?:\.\d+)?)/i,
  ];
  const allTotalMatches = [...text.matchAll(/(?:total\s*hrs?\.?)[:\s]*([\d]+(?:\.\d+)?)/gi)];
  if (allTotalMatches.length) {
    // Sum all daily totals (7-day crew card has one per day)
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

  // ── Overtime breakdown (1X, 1.5X, 2X) ──
  let hours1x = 0, hours15x = 0, hours2x = 0;
  const h1xM = text.match(/\b1X[:\s]*([\d]+(?:\.\d+)?)/i);
  const h15xM = text.match(/\b1\.5X[:\s]*([\d]+(?:\.\d+)?)/i);
  const h2xM = text.match(/\b2X[:\s]*([\d]+(?:\.\d+)?)/i);
  if (h1xM) hours1x = parseFloat(h1xM[1]) || 0;
  if (h15xM) hours15x = parseFloat(h15xM[1]) || 0;
  if (h2xM) hours2x = parseFloat(h2xM[1]) || 0;

  // ── Rate ──
  let rate = 0;
  const ratePatterns = [
    /(?:hourly\s*rate|rate\s*per\s*hour|pay\s*rate|(?:^|\s)rate)[:\s]*\$?([\d,]+(?:\.\d{2})?)/im,
    /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:\/\s*(?:hr|hour))/i,
  ];
  for (const p of ratePatterns) {
    const m = text.match(p);
    if (m) { const v = parseFloat(m[1].replace(/,/g,"")); if (v > 0) { rate = v; break; } }
  }

  // ── Date — prefer "WEEK ENDING" for crew timecards ──
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

  // ── Description / Notes ──
  let description = "";
  const descM = text.match(/(?:description|notes?|work\s*performed|task)[:\s]+([^\n]{2,100})/i);
  if (descM) description = descM[1].trim();

  return { company, jobName, jobClassification, guarHours, hours, hours1x, hours15x, hours2x, rate, date, description };
}

// ── Parse paystub OCR text ───────────────────────────────────────────────────
function parsePaystubText(rawText = "") {
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
const DAY_NAMES = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

function getNextSaturday() {
  const d = new Date();
  const diff = (6 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function initWeekDays(weekEnding) {
  // weekEnding is the Saturday date string; builds Sun–Sat array
  const sat = new Date(weekEnding + "T12:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sat);
    d.setDate(sat.getDate() - (6 - i));
    return { date: d.toISOString().split("T")[0], day: DAY_NAMES[d.getDay()], type: "work", call: "", meal1Out: "", meal1In: "", meal2Out: "", meal2In: "", wrap: "", mealPenalty: false, perDiemWork: false, perDiemOff: false, totalHours: 0, hours1x: 0, hours15x: 0, hours2x: 0 };
  });
}

function parseTimeToMin(str) {
  if (!str) return null;
  const [h, m] = str.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function calcDayHours(day) {
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

function calcOTBreakdown(hours) {
  // Film/TV industry standard: 0–8h straight, 8–12h at 1.5×, 12h+ at 2×
  if (hours <= 8) return { hours1x: hours, hours15x: 0, hours2x: 0 };
  if (hours <= 12) return { hours1x: 8, hours15x: parseFloat((hours - 8).toFixed(2)), hours2x: 0 };
  return { hours1x: 8, hours15x: 4, hours2x: parseFloat((hours - 12).toFixed(2)) };
}

function calcOTBreakdown6thDay(hours) {
  // 6th-day premium: first 12h all at 1.5×, beyond 12h at 2×
  if (hours <= 12) return { hours1x: 0, hours15x: parseFloat(hours.toFixed(2)), hours2x: 0 };
  return { hours1x: 0, hours15x: 12, hours2x: parseFloat((hours - 12).toFixed(2)) };
}

function calcOTBreakdown7thDay(hours) {
  // 7th-day: ALL hours at 2× double time
  return { hours1x: 0, hours15x: 0, hours2x: parseFloat(hours.toFixed(2)) };
}

function applyWeekOTRules(days, guarHours) {
  // Find worked days sorted by date to determine 5th and 6th
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
    // Check if 36+ hours of rest between day5 wrap and day6 call — if so, treat normally
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

function get6thDayIndex(days) {
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

function get7thDayIndex(days) {
  const worked = days
    .map((d, i) => ({ i, date: d.date, actualHours: calcDayHours(d) }))
    .filter(x => x.actualHours > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (worked.length < 7) return -1;
  return worked[6].i;
}

// Returns a Set of day indices where turnaround from previous day's wrap is < 10 hours
function calcTurnaroundViolations(days) {
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

// Returns true if meal penalty should be auto-flagged (>6h worked, no meal break logged)
function shouldAutoMealPenalty(day) {
  if (!day.call) return false;
  const hours = day.totalHours ?? calcDayHours(day);
  if (hours <= 0) return false;
  // No meal break recorded at all and worked more than 6 hours
  if (!day.meal1Out) return hours > 6;
  // Meal recorded — check if it started within 6 hours of call
  const toMins = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  let callMins = toMins(day.call);
  let mealMins = toMins(day.meal1Out);
  if (mealMins < callMins) mealMins += 24 * 60; // handle overnight
  return (mealMins - callMins) > 6 * 60;
}

// Generates a CSV string from an array of row arrays and triggers a download
function downloadCSV(rows, filename) {
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

const TAX_RATE = 0.25;
const IRS_MILEAGE_RATE = 0.70; // 2025 IRS standard mileage rate ($/mi)

// ── Depreciation helpers ─────────────────────────────────────────
const MACRS_TABLES = {
  "3yr":  [33.33, 44.45, 14.81, 7.41],
  "5yr":  [20.00, 32.00, 19.20, 11.52, 11.52, 5.76],
  "7yr":  [14.29, 24.49, 17.49, 12.49, 8.93, 8.92, 8.93, 4.46],
  "10yr": [10.00, 18.00, 14.40, 11.52, 9.22, 7.37, 6.55, 6.55, 6.56, 6.55, 3.28],
  "15yr": [5.00, 9.50, 8.55, 7.70, 6.93, 6.23, 5.90, 5.90, 5.91, 5.90, 5.91, 5.90, 5.91, 5.90, 5.91, 2.95],
};
const DEPR_LABELS = {
  "section179": "Sec. 179",
  "bonus": "Bonus",
  "straight-line": "SL",
  "macrs": "MACRS",
};
function calcEquipDeduction(p, forYear) {
  const cost = parseFloat(p.amount) || 0;
  const method = p.depreciationMethod || "section179";
  const purchaseYear = p.date ? parseInt(p.date.slice(0, 4), 10) : NaN;
  if (!cost || isNaN(purchaseYear)) return 0;
  const yi = forYear - purchaseYear; // 0-based year index
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

const PAYMENT_TERMS = [
  { label: "Net 15", days: 15 },
  { label: "Net 30", days: 30 },
  { label: "Net 45", days: 45 },
  { label: "Net 60", days: 60 },
  { label: "Custom", days: null },
];

// Calculate due date from invoice date + payment terms
function dueDateFromTerms(invoiceDate, terms) {
  const t = PAYMENT_TERMS.find(p => p.label === terms);
  if (!t || t.days == null) return null;
  const d = new Date(invoiceDate + "T12:00");
  if (isNaN(d)) return null;
  d.setDate(d.getDate() + t.days);
  return d.toISOString().split("T")[0];
}

// Calculate late fee for an invoice
function calcLateFee(inv) {
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

// Derive display status from invoice data (partial payments override manual status)
function computeInvoiceStatus(inv) {
  const received = parseFloat(inv.amountReceived) || 0;
  const total = parseFloat(inv.amount) || 0;
  if (received > 0 && total > 0 && received >= total) return "Paid";
  if (received > 0 && received < total) return "Partially Paid";
  return inv.status || "Unpaid";
}

// Day rate → hourly rate conversion
// 10hr guarantee: 8h@1x + 2h@1.5x = 11 × hourly
// 12hr guarantee: 8h@1x + 4h@1.5x = 14 × hourly
function dayRateToHourly(dayRate, type) {
  const dr = parseFloat(dayRate);
  if (!dr || dr <= 0) return "";
  const divisor = type === "12" ? 14 : 11;
  return String(parseFloat((dr / divisor).toFixed(4)));
}
const FOLDER_NAME = "Have I Been Paid?";

const SIGNATURE_FONTS = [
  "Dancing Script", "Tangerine", "Great Vibes", "Satisfy",
  "Pinyon Script", "Sacramento", "Clicker Script", "Allura",
  "Alex Brush", "Yellowtail", "Marck Script", "Italianno",
];

export default function App() {
  const [invoices, setInvoices] = useState([]);
  const [timecards, setTimecards] = useState([]);
  const [activeTab, setActiveTab] = useState("invoices");
  const [darkMode, setDarkMode] = useState(false);
  const [folderId, setFolderId] = useState(null);
  const [dataFileId, setDataFileId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [isUploadingTimecard, setIsUploadingTimecard] = useState(false);
  const [uploadTimecardStatus, setUploadTimecardStatus] = useState("");
  const [paystubUploading, setPaystubUploading] = useState(null); // invoiceId being processed
  const [syncStatus, setSyncStatus] = useState("Not synced");
  const [previewItem, setPreviewItem] = useState(null);
  const [newTimecard, setNewTimecard] = useState(() => { const we = getNextSaturday(); return { company: "", jobName: "", jobClassification: "", guarHours: "10", rate: "", dayRate: "", dayRateType: "10", weekEnding: we, days: initWeekDays(we), description: "", jobId: "", workerName: "", workerEmail: "", last4SS: "", mileage: "", workPerDiem: "", daysOffPerDiem: "", kitRentalRate: "", signatureFont: "Dancing Script", signatureDate: new Date().toISOString().split("T")[0] }; });
  const [editingTimecard, setEditingTimecard] = useState(null);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [holdDays, setHoldDays] = useState([]);
  const [calSelectMode, setCalSelectMode] = useState(false);
  const [calSelectedDates, setCalSelectedDates] = useState([]);
  const [calendarNotes, setCalendarNotes] = useState({});
  const [calNoteDate, setCalNoteDate] = useState(null);
  const [calNoteEditing, setCalNoteEditing] = useState(false);
  const [calNoteDraft, setCalNoteDraft] = useState("");
  const [holdNamePrompt, setHoldNamePrompt] = useState(false);
  const [holdNameInput, setHoldNameInput] = useState("");
  const [holdTypeInput, setHoldTypeInput] = useState("hold");
  const [holdReleaseModal, setHoldReleaseModal] = useState(null); // { holdId, date }
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportEntry, setExportEntry] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [jobs, setJobs] = useState([]);
  const [classifications, setClassifications] = useState([]);
  const [showClassificationManager, setShowClassificationManager] = useState(false);
  const [newClassificationName, setNewClassificationName] = useState("");
  const [expandedJobs, setExpandedJobs] = useState(new Set());
  const [newJobName, setNewJobName] = useState("");
  const [showNewJobForm, setShowNewJobForm] = useState(false);
  const [uploadJobId, setUploadJobId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [highlightedId, setHighlightedId] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [purchaseSubTab, setPurchaseSubTab] = useState("expendables");
  const [purchaseGroupBy, setPurchaseGroupBy] = useState("job"); // "job" | "vendor"
  const [newPurchase, setNewPurchase] = useState({ name: "", vendor: "", amount: "", date: new Date().toISOString().split("T")[0], notes: "", serial: "", category: "expendables", mealType: "business_meeting", jobId: "", isKit: false, kitDailyRate: "", kitWeeklyRate: "" });
  const [mileageLogs, setMileageLogs] = useState([]);
  const [newMileage, setNewMileage] = useState({ date: new Date().toISOString().split("T")[0], miles: "", purpose: "", company: "", jobId: "", vehicle: "" });
  const [vehicles, setVehicles] = useState([]);
  const [showVehicleManager, setShowVehicleManager] = useState(false);
  const [newVehicleName, setNewVehicleName] = useState("");
  const [vehicleExpenses, setVehicleExpenses] = useState([]);
  const [newVehicleExpense, setNewVehicleExpense] = useState({ date: new Date().toISOString().split("T")[0], category: "maintenance", amount: "", notes: "", vehicle: "", odometer: "" });
  const [mileageSubTab, setMileageSubTab] = useState("mileage");
  const [gasLogs, setGasLogs] = useState([]);
  const [newGasLog, setNewGasLog] = useState({ date: new Date().toISOString().split("T")[0], vehicle: "", station: "", pricePerGallon: "", amount: "", notes: "" });
  const [kitPackages, setKitPackages] = useState([]);
  const [newPackage, setNewPackage] = useState({ name: "", dailyRate: "", weeklyRate: "", notes: "", barcode: "", itemIds: [] });
  const [kitSubTab, setKitSubTab] = useState("items");

  // ── INVOICE GENERATOR ───────────────────────────────────────────────────────
  const [showInvoiceGenerator, setShowInvoiceGenerator] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState(null);
  const [clients, setClients] = useState([]);
  const [showClientManager, setShowClientManager] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", address: "", city: "", state: "", zip: "", email: "", phone: "" });
  const [pkgQaId, setPkgQaId] = useState("");
  const [pkgQaRateType, setPkgQaRateType] = useState("daily");
  const [pkgQaQty, setPkgQaQty] = useState("1");
  const [pkgQaExpand, setPkgQaExpand] = useState(false);



  // Local blob URL cache: itemId → { url, type }
  const blobCache = useRef(new Map());
  const [hydrated, setHydrated] = useState(false);
  const reportIframeRef = useRef(null);
  const reportHtmlRef = useRef(null);
  const [showReportOverlay, setShowReportOverlay] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  useEffect(() => () => blobCache.current.forEach(v => URL.revokeObjectURL(v.url)), []);
  useEffect(() => {
    const saved = localStorage.getItem("hibp_dark_mode");
    if (saved === "true") { setDarkMode(true); document.documentElement.classList.add("dark"); }
  }, []);
  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("hibp_dark_mode", String(next));
  };
  useEffect(() => {
    if (showReportOverlay && reportIframeRef.current && reportHtmlRef.current) {
      const doc = reportIframeRef.current.contentDocument;
      doc.open(); doc.write(reportHtmlRef.current); doc.close();
    }
  }, [showReportOverlay]);

  // Drive connection state (service account configured and reachable)
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveEmail, setDriveEmail] = useState("");
  const [showDriveSetup, setShowDriveSetup] = useState(false);
  const [customFolderInput, setCustomFolderInput] = useState("");
  const [savedCustomFolderId, setSavedCustomFolderId] = useState("");
  const [relinkPreview, setRelinkPreview] = useState(null); // parsed JSON waiting for confirm
  const [markPaidModal, setMarkPaidModal] = useState(null); // { id, idx, amount, existingPayments } | null
  const [markPaidPartialAmt, setMarkPaidPartialAmt] = useState("");
  const [markPaidMode, setMarkPaidMode] = useState(null); // "full" | "partial" | null
  const [markPaidDate, setMarkPaidDate] = useState("");
  const [markPaidMethod, setMarkPaidMethod] = useState("");
  const [editingInvoiceId, setEditingInvoiceId] = useState(null); // id of invoice being edited (null = create new)
  const [driveCheckStatus, setDriveCheckStatus] = useState("idle"); // idle | checking | ok | error
  const [driveCheckError, setDriveCheckError] = useState("");
  const relinkInputRef = useRef(null);
  const [lastSynced, setLastSynced] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [yearFolderIds, setYearFolderIds] = useState({});

  // ── LOAD FROM LOCALSTORAGE ON MOUNT ─────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem("hibp_data");
      if (stored) {
        const d = JSON.parse(stored);
        if (Array.isArray(d.invoices)) setInvoices(d.invoices);
        if (Array.isArray(d.timecards)) setTimecards(d.timecards);
        if (Array.isArray(d.jobs)) setJobs(d.jobs);
        if (Array.isArray(d.purchases)) setPurchases(d.purchases);
        if (Array.isArray(d.classifications)) setClassifications(d.classifications);
        if (Array.isArray(d.mileageLogs)) setMileageLogs(d.mileageLogs);
        if (Array.isArray(d.vehicleExpenses)) setVehicleExpenses(d.vehicleExpenses);
        if (Array.isArray(d.vehicles)) setVehicles(d.vehicles);
        if (Array.isArray(d.gasLogs)) setGasLogs(d.gasLogs);
        if (Array.isArray(d.kitPackages)) setKitPackages(d.kitPackages);
        if (Array.isArray(d.clients)) setClients(d.clients);
        if (Array.isArray(d.holdDays)) setHoldDays(d.holdDays);
        if (d.calendarNotes && typeof d.calendarNotes === "object" && !Array.isArray(d.calendarNotes)) setCalendarNotes(d.calendarNotes);
      }
      const ls = localStorage.getItem("hibp_last_synced");
      if (ls) setLastSynced(ls);
      const cf = localStorage.getItem("hibp_custom_folder_id");
      if (cf) { setCustomFolderInput(cf); setSavedCustomFolderId(cf); }
    } catch {}
    // setHydrated(true) triggers a re-render where state is fully loaded
    // auto-save will only fire after that re-render, never with empty initial state
    setHydrated(true);
    // Check if service account Drive is configured
    fetch("/api/drive?action=ping")
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setDriveConnected(true);
          setDriveEmail(data.email || "");
          setDriveCheckStatus("ok");
          initDrive().catch(() => {});
        }
      }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-usable ping → initDrive sequence (used by modal Verify button + Use Folder)
  const checkDriveConnection = async () => {
    setDriveCheckStatus("checking");
    setDriveCheckError("");
    try {
      const data = await fetch("/api/drive?action=ping").then(r => r.json());
      if (data.ok) {
        setDriveConnected(true);
        setDriveEmail(data.email || "");
        setDriveCheckStatus("ok");
        await initDrive();
      } else {
        setDriveConnected(false);
        setDriveCheckStatus("error");
        setDriveCheckError(
          data.error === "not_configured"
            ? "Service account not found. Make sure GOOGLE_SERVICE_ACCOUNT_JSON is set in .env.local and the app was restarted."
            : "Credentials found but invalid. Check your service account JSON."
        );
      }
    } catch {
      setDriveConnected(false);
      setDriveCheckStatus("error");
      setDriveCheckError("Could not reach the server. Is the app running?");
    }
  };

  // ── DRIVE HELPERS ───────────────────────────────────────────────────────────
  // All Drive operations go through /api/drive (service account, server-side)
  const drivePost = (body) =>
    fetch("/api/drive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => r.json());

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Silently convert HEIC/HEIF → JPEG using the browser's full image pipeline
  // (Electron on macOS uses OS-level HEIC codecs via <img> element loading).
  const normalizeReceiptFile = async (file) => {
    const isHeic = /\.heic$/i.test(file.name) || /\.heif$/i.test(file.name)
      || file.type === "image/heic" || file.type === "image/heif";
    if (!isHeic) return file;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/heic-convert", { method: "POST", body: fd });
      if (!res.ok) return file;
      const { base64 } = await res.json();
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "image/jpeg" });
      return new File(
        [blob],
        file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg"),
        { type: "image/jpeg" }
      );
    } catch {
      return file;
    }
  };

  // ── DRIVE INIT / SYNC ───────────────────────────────────────────────────────
  const initDrive = async () => {
    try {
      // If the user has shared their own Drive folder with the service account, use it directly
      const customId = localStorage.getItem("hibp_custom_folder_id");
      if (customId) {
        setFolderId(customId);
        await loadManifest(customId);
        return;
      }
      // Otherwise find or create the app folder in the service account's Drive
      const data = await drivePost({
        action: "listFiles",
        q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      });
      if (data.error) throw new Error(data.error);
      let fId = data.files?.[0]?.id;
      if (!fId) {
        const cd = await drivePost({ action: "createFolder", name: FOLDER_NAME });
        if (!cd.id) throw new Error("Could not create Drive folder: " + JSON.stringify(cd));
        fId = cd.id;
      }
      setFolderId(fId);
      await loadManifest(fId);
    } catch (err) {
      console.error("Drive init error:", err.message);
    }
  };

  const getOrCreateYearFolder = async (rootId, year) => {
    if (yearFolderIds[year]) return yearFolderIds[year];
    const data = await drivePost({
      action: "listFiles",
      q: `name='${year}' and mimeType='application/vnd.google-apps.folder' and '${rootId}' in parents and trashed=false`,
    });
    let yId = data.files?.[0]?.id;
    if (!yId) {
      const cd = await drivePost({ action: "createFolder", name: String(year), parents: [rootId] });
      yId = cd.id;
    }
    setYearFolderIds(prev => ({ ...prev, [year]: yId }));
    return yId;
  };

  const loadManifest = async (fId) => {
    // Only look up the Drive file ID so syncToDrive knows where to write.
    // Data is never loaded from Drive automatically — localStorage is always authoritative.
    const d = await drivePost({ action: "listFiles", q: `name='data.json' and '${fId}' in parents and trashed=false` });
    if (d.files?.length > 0) {
      setDataFileId(d.files[0].id);
    }
  };

  const saveManifest = async (inv, tc, j, pur) => {
    // saveManifest is kept as a no-op alias; actual Drive push is done via syncToDrive
    void inv; void tc; void j; void pur;
  };

  // Auto-save all data to localStorage whenever anything changes.
  // Depends on `hydrated` so it only fires after the load effect's setState calls have rendered.
  useEffect(() => {
    if (!hydrated) return;
    const data = { invoices, timecards, jobs, purchases, classifications, mileageLogs, vehicleExpenses, vehicles, gasLogs, kitPackages, clients, holdDays, calendarNotes };
    try { localStorage.setItem("hibp_data", JSON.stringify(data)); } catch {}
  }, [hydrated, invoices, timecards, jobs, purchases, classifications, mileageLogs, vehicleExpenses, vehicles, gasLogs, kitPackages, clients, holdDays, calendarNotes]);

  // ── EXPORT / RELINK ──────────────────────────────────────────────────────────
  const exportData = () => {
    const data = { invoices, timecards, jobs, purchases, classifications, mileageLogs, vehicleExpenses, vehicles, gasLogs, kitPackages, clients };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hibp-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRelinkFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        // Accept either the full object or a legacy array of invoices
        if (Array.isArray(d)) { setRelinkPreview({ invoices: d }); }
        else if (d && typeof d === "object") { setRelinkPreview(d); }
        else { alert("Unrecognized file format."); }
      } catch { alert("Could not parse the file. Make sure it is a valid HIBP backup JSON."); }
    };
    reader.readAsText(file);
  };

  const confirmRelink = () => {
    const d = relinkPreview;
    if (!d) return;
    const newInvoices = Array.isArray(d.invoices) ? d.invoices : invoices;
    const newTimecards = Array.isArray(d.timecards) ? d.timecards : timecards;
    const newJobs = Array.isArray(d.jobs) ? d.jobs : jobs;
    const newPurchases = Array.isArray(d.purchases) ? d.purchases : purchases;
    const newClassifications = Array.isArray(d.classifications) ? d.classifications : classifications;
    const newMileageLogs = Array.isArray(d.mileageLogs) ? d.mileageLogs : mileageLogs;
    const newVehicleExpenses = Array.isArray(d.vehicleExpenses) ? d.vehicleExpenses : vehicleExpenses;
    const newVehicles = Array.isArray(d.vehicles) ? d.vehicles : vehicles;
    const newGasLogs = Array.isArray(d.gasLogs) ? d.gasLogs : gasLogs;
    const newKitPackages = Array.isArray(d.kitPackages) ? d.kitPackages : kitPackages;
    setInvoices(newInvoices);
    setTimecards(newTimecards);
    setJobs(newJobs);
    setPurchases(newPurchases);
    setClassifications(newClassifications);
    setMileageLogs(newMileageLogs);
    setVehicleExpenses(newVehicleExpenses);
    setVehicles(newVehicles);
    setGasLogs(newGasLogs);
    setKitPackages(newKitPackages);
    // Write directly to localStorage so data persists immediately
    try {
      localStorage.setItem("hibp_data", JSON.stringify({
        invoices: newInvoices, timecards: newTimecards, jobs: newJobs, purchases: newPurchases,
        classifications: newClassifications, mileageLogs: newMileageLogs,
        vehicleExpenses: newVehicleExpenses, vehicles: newVehicles, gasLogs: newGasLogs, kitPackages: newKitPackages,
      }));
    } catch {}
    setRelinkPreview(null);
  };

  // ── SYNC TO DRIVE (manual) ───────────────────────────────────────────────────
  const syncToDrive = async () => {
    setIsSyncing(true);
    setSyncStatus("Syncing...");
    try {
      let rFolderId = folderId;
      if (!rFolderId) { await initDrive(); rFolderId = folderId; }
      const data = { invoices, timecards, jobs, purchases, classifications, mileageLogs, vehicleExpenses, vehicles, gasLogs, kitPackages };
      // Root data.json
      if (dataFileId) {
        await drivePost({ action: "updateFile", fileId: dataFileId, content: data });
      } else {
        const m = await drivePost({ action: "createFile", name: "data.json", parents: [rFolderId], content: data });
        setDataFileId(m.id);
      }
      // Per-year data snapshots in subfolders
      const getYearLocal = (dateStr) => { const d = new Date(dateStr); return isNaN(d) ? null : d.getFullYear(); };
      const years = [...new Set([
        ...invoices.map(i => getYearLocal(i.date)),
        ...timecards.map(t => getYearLocal(t.weekEnding)),
        ...purchases.map(p => getYearLocal(p.date)),
        ...mileageLogs.map(m => getYearLocal(m.date)),
        ...vehicleExpenses.map(v => getYearLocal(v.date)),
        ...gasLogs.map(g => getYearLocal(g.date)),
      ].filter(y => y && y > 2000))];
      for (const year of years) {
        const yFId = await getOrCreateYearFolder(rFolderId, year);
        const yearData = {
          invoices: invoices.filter(i => getYearLocal(i.date) === year),
          timecards: timecards.filter(t => getYearLocal(t.weekEnding) === year),
          jobs,
          purchases: purchases.filter(p => getYearLocal(p.date) === year),
          classifications,
          mileageLogs: mileageLogs.filter(m => getYearLocal(m.date) === year),
          vehicleExpenses: vehicleExpenses.filter(v => getYearLocal(v.date) === year),
          gasLogs: gasLogs.filter(g => getYearLocal(g.date) === year),
          vehicles,
          syncedAt: new Date().toISOString(),
        };
        const yFileKey = `hibp_yfid_${year}`;
        const existingYFId = localStorage.getItem(yFileKey);
        if (existingYFId) {
          await drivePost({ action: "updateFile", fileId: existingYFId, content: yearData });
        } else {
          const ym = await drivePost({ action: "createFile", name: `data_${year}.json`, parents: [yFId], content: yearData });
          localStorage.setItem(yFileKey, ym.id);
        }
      }
      // Upload generated invoice HTML files to Drive (invoices subfolder per year)
      const generatedToUpload = invoices.filter(i => i.generated && i.fileName && !i.driveInvoiceFileId);
      if (generatedToUpload.length > 0) {
        const invYearFolders = {};
        const getInvYearFolder = async (year) => {
          if (invYearFolders[year]) return invYearFolders[year];
          const yFId = await getOrCreateYearFolder(rFolderId, year);
          // get or create "invoices" subfolder under the year folder
          const listRes = await drivePost({ action: "listFiles", q: `name='invoices' and mimeType='application/vnd.google-apps.folder' and '${yFId}' in parents and trashed=false` });
          let invFId = listRes.files?.[0]?.id;
          if (!invFId) {
            const cd = await drivePost({ action: "createFolder", name: "invoices", parents: [yFId] });
            invFId = cd.id;
          }
          invYearFolders[year] = invFId;
          return invFId;
        };
        for (const inv of generatedToUpload) {
          try {
            const fileRes = await fetch(`/api/files?name=${encodeURIComponent(inv.fileName)}`);
            if (!fileRes.ok) continue;
            const buf = await fileRes.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
            const year = new Date(inv.date).getFullYear();
            const invFolderId = await getInvYearFolder(isNaN(year) ? "misc" : year);
            const m = await drivePost({ action: "uploadBinary", fileName: inv.fileName, fileBase64: base64, mimeType: "text/html", parents: [invFolderId] });
            if (m.id) {
              setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, driveInvoiceFileId: m.id } : i));
            }
          } catch (err) { console.warn("Invoice Drive upload failed:", err.message); }
        }
      }
      const now = new Date().toLocaleString();
      setLastSynced(now);
      localStorage.setItem("hibp_last_synced", now);
      setSyncStatus("Synced");
    } catch (err) {
      setSyncStatus("Sync Failed");
      alert("Drive sync failed: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const addJob = (name) => {
    if (!name.trim()) return;
    const job = { id: crypto.randomUUID(), name: name.trim(), timestamp: Date.now() };
    setJobs(prev => [...prev, job]);
    return job.id;
  };

  const addMileageLog = () => {
    if (!newMileage.miles || parseFloat(newMileage.miles) <= 0) return;
    setMileageLogs(prev => [{ id: crypto.randomUUID(), date: newMileage.date, miles: parseFloat(newMileage.miles), purpose: newMileage.purpose, company: newMileage.company, jobId: newMileage.jobId, vehicle: newMileage.vehicle, timestamp: Date.now() }, ...prev]);
    setNewMileage(p => ({ ...p, miles: "", purpose: "", company: "" }));
  };

  const addVehicleExpense = () => {
    if (!newVehicleExpense.amount || parseFloat(newVehicleExpense.amount) <= 0) return;
    setVehicleExpenses(prev => [{ id: crypto.randomUUID(), date: newVehicleExpense.date, category: newVehicleExpense.category, amount: parseFloat(newVehicleExpense.amount), notes: newVehicleExpense.notes, vehicle: newVehicleExpense.vehicle, odometer: newVehicleExpense.odometer, receiptFileId: "", timestamp: Date.now() }, ...prev]);
    setNewVehicleExpense(p => ({ ...p, amount: "", notes: "", odometer: "" }));
  };

  const uploadReceiptForExpense = async (expenseId, file) => {
    if (!folderId) { alert("Drive not configured. Set up Drive to save receipts."); return; }
    try {
      file = await normalizeReceiptFile(file);
      const fileBase64 = await fileToBase64(file);
      const res = await drivePost({ action: "uploadBinary", fileName: `receipt_${file.name}`, fileBase64, mimeType: file.type, parents: [folderId] });
      if (res.id) setVehicleExpenses(prev => prev.map(v => v.id === expenseId ? { ...v, receiptFileId: res.id } : v));
    } catch (err) { alert("Receipt upload failed: " + err.message); }
  };

  const addGasLog = () => {
    if (!newGasLog.amount || parseFloat(newGasLog.amount) <= 0) return;
    setGasLogs(prev => [{ id: crypto.randomUUID(), date: newGasLog.date, vehicle: newGasLog.vehicle, station: newGasLog.station, pricePerGallon: newGasLog.pricePerGallon, amount: parseFloat(newGasLog.amount), notes: newGasLog.notes, receiptFileId: "", timestamp: Date.now() }, ...prev]);
    setNewGasLog(p => ({ ...p, amount: "", notes: "", pricePerGallon: "" }));
  };

  const uploadReceiptForGas = async (gasId, file) => {
    if (!folderId) { alert("Drive not configured. Set up Drive to save receipts."); return; }
    try {
      file = await normalizeReceiptFile(file);
      const fileBase64 = await fileToBase64(file);
      const res = await drivePost({ action: "uploadBinary", fileName: `gas_receipt_${file.name}`, fileBase64, mimeType: file.type, parents: [folderId] });
      if (res.id) setGasLogs(prev => prev.map(g => g.id === gasId ? { ...g, receiptFileId: res.id } : g));
    } catch (err) { alert("Receipt upload failed: " + err.message); }
  };

  const deleteJob = (id) => {
    if (!window.confirm("Delete this job? Its entries will be unassigned but not deleted.")) return;
    setJobs(prev => prev.filter(j => j.id !== id));
    // unassign items from the deleted job
    setInvoices(prev => prev.map(i => i.jobId === id ? { ...i, jobId: "" } : i));
    setTimecards(prev => prev.map(t => t.jobId === id ? { ...t, jobId: "" } : t));
    setPurchases(prev => prev.map(p => p.jobId === id ? { ...p, jobId: "" } : p));
  };

  const toggleJobExpanded = (id) => {
    setExpandedJobs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── DRIVE OCR ───────────────────────────────────────────────────────────────
  // Shared OCR helper — returns raw text from Drive's built-in OCR engine
  const performOCR = async (file) => {
    const fileBase64 = await fileToBase64(file);
    const res = await drivePost({ action: "ocrFile", fileBase64, mimeType: file.type, parents: folderId ? [folderId] : [] });
    if (res.error) throw new Error(res.error);
    return res.text || "";
  };

  const extractWithDriveOCR = async (file) => {
    const text = await performOCR(file);
    console.log("=== RAW OCR TEXT ===\n", text, "\n===================");
    return parseInvoiceText(text);
  };

  // Save a file to the local offline_files folder via the API
  const saveFileLocally = async (file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/files", { method: "POST", body: form });
    if (!res.ok) throw new Error("Local file save failed");
    return file.name;
  };

  // ── UPLOAD ───────────────────────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    e.target.value = "";

    setIsUploading(true);
    setUploadError("");

    for (const file of files) {
      const itemId = crypto.randomUUID();

      // 1. Store a local blob URL so preview works immediately
      const blobUrl = URL.createObjectURL(file);
      blobCache.current.set(itemId, { url: blobUrl, type: file.type });

      // 2. Save file to local offline_files folder
      setUploadStatus(`Saving ${file.name}...`);
      const driveFileId = null;
      try {
        await saveFileLocally(file);
      } catch (err) {
        console.warn("Local file save error:", err.message);
      }

      // 3. OCR extraction (if Drive is configured)
      setUploadStatus(`Reading ${file.name}...`);
      let extracted = { company: "", amount: 0, date: new Date().toISOString().split("T")[0], invoiceNumber: "" };
      if (driveConnected) {
        try {
          const result = await extractWithDriveOCR(file);
          if (result) extracted = result;
        } catch (err) {
          console.warn("OCR failed:", err.message);
          extracted.company = file.name.replace(/\.[^.]+$/, "").replace(/[_\-]+/g, " ");
        }
      }

      // Fill any still-empty company with filename
      if (!extracted.company) {
        extracted.company = file.name.replace(/\.[^.]+$/, "").replace(/[_\-]+/g, " ");
      }

      setInvoices(prev => [{
        id: itemId,
        fileId: driveFileId,
        fileName: file.name,
        fileType: file.type,
        company: extracted.company || "",
        amount: extracted.amount || 0,
        date: extracted.date || new Date().toISOString().split("T")[0],
        invoiceNumber: extracted.invoiceNumber || "",
        status: "Pending",
        jobId: uploadJobId || "",
        locked: true,
        paymentTerms: "Net 30",
        lateFeeType: "none",
        lateFeeRate: 0,
        amountReceived: 0,
        timestamp: Date.now(),
      }, ...prev]);
      if (uploadJobId) setExpandedJobs(prev => { const n = new Set(prev); n.add(uploadJobId); return n; });
    }

    setIsUploading(false);
    setUploadStatus("");
  };

  const deleteInvoice = (id) => {
    const inv = invoices.find(i => i.id === id);
    if (inv?.locked) { alert("Unlock this entry before deleting it."); return; }
    if (!window.confirm("Delete this invoice entry? This cannot be undone.")) return;
    URL.revokeObjectURL(blobCache.current.get(id)?.url);
    URL.revokeObjectURL(blobCache.current.get("paystub_" + id)?.url);
    blobCache.current.delete(id);
    blobCache.current.delete("paystub_" + id);
    setInvoices(prev => prev.filter(i => i.id !== id));
  };

  // ── PAYSTUB UPLOAD ───────────────────────────────────────────────────────────
  const handlePaystubUpload = async (invoiceId, file) => {
    if (!file) return;
    setPaystubUploading(invoiceId);

    // Store blob for immediate local preview
    const blobUrl = URL.createObjectURL(file);
    blobCache.current.set("paystub_" + invoiceId, { url: blobUrl, type: file.type });

    // Save paystub to local offline_files folder
    let driveFileId = null;
    try {
      await saveFileLocally(new File([file], "paystub_" + file.name, { type: file.type }));
    } catch (err) { console.warn("Paystub local save error:", err.message); }

    // OCR extraction (if Drive is configured)
    let extracted = { grossPay: 0, netPay: 0, payDate: new Date().toISOString().split("T")[0], checkNumber: "", employer: "" };
    if (driveConnected) {
      try {
        const text = await performOCR(file);
        console.log("=== PAYSTUB OCR ===\n", text);
        extracted = parsePaystubText(text);
      } catch (err) { console.warn("Paystub OCR error:", err); }
    }

    setInvoices(prev => prev.map(inv => inv.id === invoiceId ? {
      ...inv,
      paystub: {
        fileId: driveFileId,
        fileName: file.name,
        fileType: file.type,
        grossPay: extracted.grossPay,
        netPay: extracted.netPay,
        payDate: extracted.payDate,
        checkNumber: extracted.checkNumber,
        employer: extracted.employer,
      },
      // Update amount with gross pay if we got a real value
      ...(extracted.grossPay > 0 ? { amount: extracted.grossPay } : {}),
    } : inv));

    setPaystubUploading(null);
  };

  // ── TIMECARD UPLOAD ──────────────────────────────────────────────────────────
  const handleTimecardUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    e.target.value = "";

    setIsUploadingTimecard(true);
    for (const file of files) {
      const itemId = crypto.randomUUID();
      const blobUrl = URL.createObjectURL(file);
      blobCache.current.set(itemId, { url: blobUrl, type: file.type });

      setUploadTimecardStatus(`Saving ${file.name}...`);
      let driveFileId = null;
      try {
        await saveFileLocally(file);
      } catch (err) { console.warn("Timecard local save error:", err.message); }

      setUploadTimecardStatus(`Reading ${file.name}...`);
      let extracted = { company: "", hours: 0, rate: 0, date: new Date().toISOString().split("T")[0], description: "" };
      if (driveConnected) {
        try {
          const text = await performOCR(file);
          const result = parseTimecardText(text);
          if (result) extracted = result;
        } catch (err) {
          console.warn("Timecard OCR failed:", err.message);
          extracted.company = file.name.replace(/\.[^.]+$/, "").replace(/[_\-]+/g, " ");
        }
      }
      if (!extracted.company) extracted.company = file.name.replace(/\.[^.]+$/, "").replace(/[_\-]+/g, " ");

      const hours = extracted.hours || 0;
      const rate = extracted.rate || 0;
      const guarHours = extracted.guarHours || 0;
      const weekEnding = extracted.date || new Date().toISOString().split("T")[0];
      setTimecards(prev => [{
        id: itemId,
        fileId: driveFileId,
        fileName: file.name,
        fileType: file.type,
        company: extracted.company || "",
        jobName: extracted.jobName || "",
        jobClassification: extracted.jobClassification || "",
        guarHours,
        hours,
        hours1x: extracted.hours1x || 0,
        hours15x: extracted.hours15x || 0,
        hours2x: extracted.hours2x || 0,
        rate,
        total: parseFloat((hours * rate).toFixed(2)),
        date: weekEnding,
        days: initWeekDays(weekEnding),
        description: extracted.description || "",
        status: "Unpaid",
        jobId: uploadJobId || "",
        timestamp: Date.now(),
      }, ...prev]);
      if (uploadJobId) setExpandedJobs(prev => { const n = new Set(prev); n.add(uploadJobId); return n; });
    }
    setIsUploadingTimecard(false);
    setUploadTimecardStatus("");
  };
  const addTimecard = () => {
    const rate = parseFloat(newTimecard.rate);
    if (!newTimecard.company || isNaN(rate) || rate <= 0) return;
    const guarHours = parseFloat(newTimecard.guarHours) || 0;
    const days = applyWeekOTRules(newTimecard.days, guarHours);
    const hours = parseFloat(days.reduce((a, d) => a + (d.paidHours ?? d.totalHours), 0).toFixed(2));
    const mealPenaltyPay = parseFloat(days.reduce((a, d) => a + (d.mealPenalty ? rate : 0), 0).toFixed(2));
    const workPerDiem = parseFloat(newTimecard.workPerDiem) || 0;
    const daysOffPerDiem = parseFloat(newTimecard.daysOffPerDiem) || 0;
    const perDiemTotal = parseFloat(days.reduce((a, d) => a + (d.perDiemWork ? workPerDiem : 0) + (d.perDiemOff ? daysOffPerDiem : 0), 0).toFixed(2));
    const kitRentalRate = parseFloat(newTimecard.kitRentalRate) || 0;
    const kitRentalDays = days.filter(d => d.totalHours > 0 || d.call).length;
    const kitRentalPay = parseFloat((kitRentalRate * kitRentalDays).toFixed(2));
    const total = parseFloat((days.reduce((a, d) => a + (d.hours1x * rate) + (d.hours15x * rate * 1.5) + (d.hours2x * rate * 2), 0) + mealPenaltyPay + perDiemTotal + kitRentalPay).toFixed(2));
    setTimecards(prev => [{ id: crypto.randomUUID(), company: newTimecard.company, jobName: newTimecard.jobName, jobClassification: newTimecard.jobClassification, guarHours, hours, rate, dayRate: parseFloat(newTimecard.dayRate) || 0, dayRateType: newTimecard.dayRateType || "10", total, mealPenaltyPay, workPerDiem, daysOffPerDiem, perDiemTotal, kitRentalRate, kitRentalPay, date: newTimecard.weekEnding, days, description: newTimecard.description, status: "Unpaid", jobId: newTimecard.jobId || "", workerName: newTimecard.workerName || "", workerEmail: newTimecard.workerEmail || "", last4SS: newTimecard.last4SS || "", mileage: parseFloat(newTimecard.mileage) || 0, signatureName: newTimecard.workerName || "", signatureFont: newTimecard.signatureFont || "Dancing Script", signatureDate: newTimecard.signatureDate || "", locked: false, timestamp: Date.now() }, ...prev]);
    if (newTimecard.jobId) setExpandedJobs(prev => { const n = new Set(prev); n.add(newTimecard.jobId); return n; });
    setNewTimecard(p => { const we = p.weekEnding; return { company: "", jobName: "", jobClassification: "", guarHours: p.guarHours, rate: "", dayRate: "", dayRateType: p.dayRateType || "10", weekEnding: we, days: initWeekDays(we), description: "", jobId: p.jobId, workerName: p.workerName, workerEmail: p.workerEmail, last4SS: p.last4SS, mileage: "", workPerDiem: p.workPerDiem, daysOffPerDiem: p.daysOffPerDiem, kitRentalRate: p.kitRentalRate, signatureFont: p.signatureFont, signatureDate: new Date().toISOString().split("T")[0] }; });
  };

  const saveTimecardEdit = () => {
    if (!editingTimecard) return;
    const rate = parseFloat(editingTimecard.rate);
    if (!editingTimecard.company || isNaN(rate) || rate <= 0) return;
    const guarHours = parseFloat(editingTimecard.guarHours) || 0;
    const days = applyWeekOTRules(editingTimecard.days, guarHours);
    const hours = parseFloat(days.reduce((a, d) => a + (d.paidHours ?? d.totalHours), 0).toFixed(2));
    const mealPenaltyPay = parseFloat(days.reduce((a, d) => a + (d.mealPenalty ? rate : 0), 0).toFixed(2));
    const workPerDiem = parseFloat(editingTimecard.workPerDiem) || 0;
    const daysOffPerDiem = parseFloat(editingTimecard.daysOffPerDiem) || 0;
    const perDiemTotal = parseFloat(days.reduce((a, d) => a + (d.perDiemWork ? workPerDiem : 0) + (d.perDiemOff ? daysOffPerDiem : 0), 0).toFixed(2));
    const kitRentalRate = parseFloat(editingTimecard.kitRentalRate) || 0;
    const kitRentalDays = days.filter(d => d.totalHours > 0 || d.call).length;
    const kitRentalPay = parseFloat((kitRentalRate * kitRentalDays).toFixed(2));
    const total = parseFloat((days.reduce((a, d) => a + (d.hours1x * rate) + (d.hours15x * rate * 1.5) + (d.hours2x * rate * 2), 0) + mealPenaltyPay + perDiemTotal + kitRentalPay).toFixed(2));
    setTimecards(prev => prev.map(tc => tc.id !== editingTimecard.id ? tc : {
      ...tc, company: editingTimecard.company, jobName: editingTimecard.jobName,
      jobClassification: editingTimecard.jobClassification, guarHours, rate, dayRate: parseFloat(editingTimecard.dayRate) || 0, dayRateType: editingTimecard.dayRateType || "10", date: editingTimecard.weekEnding,
      days, hours, total, mealPenaltyPay, workPerDiem, daysOffPerDiem, perDiemTotal, kitRentalRate, kitRentalPay, description: editingTimecard.description, jobId: editingTimecard.jobId || "",
      workerName: editingTimecard.workerName || "", workerEmail: editingTimecard.workerEmail || "", last4SS: editingTimecard.last4SS || "",
      signatureName: editingTimecard.workerName || "", signatureFont: editingTimecard.signatureFont || "Dancing Script", signatureDate: editingTimecard.signatureDate || "",
      mileage: parseFloat(editingTimecard.mileage) || 0,
    }));
    setEditingTimecard(null);
  };

  const downloadTimecardPDF = (entry) => {
    const days = entry.days || [];
    const dateStr = entry.date ? new Date(entry.date + "T12:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
    const rowsHtml = days.map((d, i) => {
      const isWeekend = i === 0 || i === 6;
      const hasWork = d.totalHours > 0 || d.call;
      const paidH = d.paidHours ?? d.totalHours;
      const rowBg = isWeekend ? "#fffbeb" : hasWork ? "#eff6ff" : "#ffffff";
      const otStr = d.hours2x > 0 ? `${d.hours2x}\u00d72 ` : d.hours15x > 0 ? `${d.hours15x}\u00d71.5` : d.totalHours > 0 ? "St" : "\u2014";
      const mpCell = d.mealPenalty ? `<span style='color:#c2410c;font-weight:bold;'>&#9888; Yes</span>` : `<span style='color:#cbd5e1;'>\u2014</span>`;
      const rate = entry.rate || 0;
      const dayPay = (d.hours1x || 0) * rate + (d.hours15x || 0) * rate * 1.5 + (d.hours2x || 0) * rate * 2 + (d.mealPenalty ? rate : 0);
      const is6th = (() => { const idx = get6thDayIndex(days); return idx >= 0 && idx === i; })();
      const dailyTotalCell = paidH > 0
        ? `<span style="font-weight:bold;color:#166534;">$${dayPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>${is6th ? ` <span style="font-size:9px;color:#0e7490;font-weight:bold;">(6th day)</span>` : ""}`
        : `<span style='color:#cbd5e1;'>\u2014</span>`;
      return `<tr style="background:${rowBg};border-bottom:1px solid #e2e8f0;">
        <td style="padding:5px 8px;font-weight:600;">${d.day} ${new Date(d.date + "T12:00").toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}</td>
        <td style="padding:5px 8px;text-align:center;">${d.call || "\u2014"}</td>
        <td style="padding:5px 8px;text-align:center;">${d.meal1Out && d.meal1In ? d.meal1Out + "\u2013" + d.meal1In : "\u2014"}</td>
        <td style="padding:5px 8px;text-align:center;">${d.meal2Out && d.meal2In ? d.meal2Out + "\u2013" + d.meal2In : "\u2014"}</td>
        <td style="padding:5px 8px;text-align:center;">${d.wrap || "\u2014"}</td>
        <td style="padding:5px 8px;text-align:center;font-weight:bold;">${d.totalHours > 0 ? d.totalHours + "h" : "\u2014"}</td>
        <td style="padding:5px 8px;text-align:center;font-size:10px;">${otStr}</td>
        <td style="padding:5px 8px;text-align:center;font-size:10px;">${mpCell}</td>
        <td style="padding:5px 8px;text-align:center;font-size:11px;">${dailyTotalCell}</td>
      </tr>`;
    }).join("");
    const wageSubtotal = (entry.total || 0) - (entry.mealPenaltyPay || 0) - (entry.perDiemTotal || 0) - (entry.kitRentalPay || 0);
    const perDiemWorkDays = entry.days.filter(d => d.perDiemWork).length;
    const perDiemOffDays = entry.days.filter(d => d.perDiemOff).length;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Timecard \u2013 ${entry.company}</title><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/><link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Allura&family=Clicker+Script&family=Dancing+Script:wght@700&family=Great+Vibes&family=Italianno&family=Marck+Script&family=Pinyon+Script&family=Sacramento&family=Satisfy&family=Tangerine:wght@700&family=Yellowtail&display=swap" rel="stylesheet"/><style>body{font-family:Arial,sans-serif;margin:40px;font-size:12px;color:#1e293b;}table{width:100%;border-collapse:collapse;}th{background:#1e40af;color:#fff;padding:7px 8px;font-size:10px;text-transform:uppercase;text-align:center;}th:first-child{text-align:left;}tfoot td{background:#1e40af;color:#fff;font-weight:bold;padding:7px 8px;}@media print{body{margin:20px;}}</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1e40af;padding-bottom:12px;margin-bottom:16px;">
  <div><div style="font-size:9px;font-weight:bold;text-transform:uppercase;color:#64748b;letter-spacing:1px;">CREW TIME CARD</div><h1 style="margin:4px 0;font-size:20px;">${entry.company || ""}</h1>${entry.jobName ? `<div style="color:#2563eb;font-weight:600;font-size:13px;">${entry.jobName}</div>` : ""}</div>
  <div style="text-align:right;"><div style="font-size:9px;font-weight:bold;text-transform:uppercase;color:#64748b;">Week Ending</div><div style="font-size:14px;font-weight:bold;">${dateStr}</div>${entry.guarHours > 0 ? `<div style="font-size:11px;color:#64748b;margin-top:4px;">Guaranteed: ${entry.guarHours}h/day</div>` : ""}</div>
</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
  ${entry.workerName ? `<div><div style="font-size:9px;font-weight:bold;text-transform:uppercase;color:#64748b;">Name</div><div style="font-size:13px;font-weight:600;">${entry.workerName}</div></div>` : ""}
  ${entry.workerEmail ? `<div><div style="font-size:9px;font-weight:bold;text-transform:uppercase;color:#64748b;">Email</div><div style="font-size:13px;font-weight:600;">${entry.workerEmail}</div></div>` : ""}
  ${entry.last4SS ? `<div><div style="font-size:9px;font-weight:bold;text-transform:uppercase;color:#64748b;">SS Last 4</div><div style="font-size:13px;font-weight:600;">XXX-XX-${entry.last4SS}</div></div>` : ""}
  ${entry.jobClassification ? `<div><div style="font-size:9px;font-weight:bold;text-transform:uppercase;color:#64748b;">Classification</div><div style="font-size:13px;font-weight:600;">${entry.jobClassification}</div></div>` : ""}
  ${entry.rate > 0 ? `<div><div style="font-size:9px;font-weight:bold;text-transform:uppercase;color:#64748b;">Rate</div><div style="font-size:13px;font-weight:600;">$${entry.rate}/hr</div></div>` : ""}
</div>
<table><thead><tr><th>Day</th><th>Call</th><th>Meal 1</th><th>Meal 2</th><th>Wrap</th><th>Hrs Worked</th><th>OT</th><th>Meal Penalty</th><th>Daily Total</th></tr></thead><tbody>${rowsHtml}</tbody><tfoot><tr><td colspan="5" style="text-align:left;">WEEK TOTAL (Wages)</td><td style="text-align:center;">${entry.hours}h</td><td colspan="2" style="text-align:center;">&nbsp;</td><td style="text-align:center;font-weight:bold;">$${wageSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>${perDiemWorkDays > 0 ? `<tr><td colspan="5" style="text-align:left;">Per Diem \u2014 Work Days (${perDiemWorkDays} day${perDiemWorkDays !== 1 ? "s" : ""} \u00d7 $${(entry.workPerDiem || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}/day)</td><td colspan="3" style="text-align:center;">&nbsp;</td><td style="text-align:center;">$${((entry.workPerDiem || 0) * perDiemWorkDays).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>` : ""}${perDiemOffDays > 0 ? `<tr><td colspan="5" style="text-align:left;">Per Diem \u2014 Days Off (${perDiemOffDays} day${perDiemOffDays !== 1 ? "s" : ""} \u00d7 $${(entry.daysOffPerDiem || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}/day)</td><td colspan="3" style="text-align:center;">&nbsp;</td><td style="text-align:center;">$${((entry.daysOffPerDiem || 0) * perDiemOffDays).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>` : ""}${(entry.mealPenaltyPay || 0) > 0 ? `<tr><td colspan="5" style="text-align:left;">Meal Penalty (${entry.days.filter(d => d.mealPenalty).length} day${entry.days.filter(d => d.mealPenalty).length !== 1 ? "s" : ""} \u00d7 1hr base)</td><td colspan="3" style="text-align:center;">&nbsp;</td><td style="text-align:center;">$${(entry.mealPenaltyPay).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>` : ""}${(entry.kitRentalPay || 0) > 0 ? `<tr><td colspan="5" style="text-align:left;">Kit/Box Rental (${entry.days.filter(d => d.totalHours > 0 || d.call).length} day${entry.days.filter(d => d.totalHours > 0 || d.call).length !== 1 ? "s" : ""} \u00d7 $${(entry.kitRentalRate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}/day)</td><td colspan="3" style="text-align:center;">&nbsp;</td><td style="text-align:center;">$${(entry.kitRentalPay).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>` : ""}${((entry.mealPenaltyPay || 0) > 0 || (entry.perDiemTotal || 0) > 0 || (entry.kitRentalPay || 0) > 0) ? `<tr><td colspan="5" style="text-align:left;font-size:13px;">TOTAL DUE</td><td colspan="3" style="text-align:center;">&nbsp;</td><td style="text-align:center;font-size:13px;">$${(entry.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>` : ""}</tfoot></table>
${entry.description ? `<div style="margin-top:12px;font-size:11px;color:#475569;"><strong>Notes:</strong> ${entry.description}</div>` : ""}
<div style="margin-top:36px;border-top:1px solid #cbd5e1;padding-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:40px;">
  <div>
    ${entry.signatureName && entry.signatureFont ? `<div style="font-family:'${entry.signatureFont}',cursive;font-size:30px;color:#1e293b;line-height:1.3;">${entry.signatureName}</div><div style="font-size:11px;color:#64748b;margin-top:2px;">${entry.signatureDate ? new Date(entry.signatureDate + "T12:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}) : ""}</div>` : `<div style="min-height:44px;"></div>`}
    <div style="border-top:1px solid #1e293b;margin-top:8px;padding-top:4px;font-size:10px;color:#64748b;">Employee Signature / Date</div>
  </div>
  <div>
    <div style="min-height:44px;"></div>
    <div style="border-top:1px solid #1e293b;margin-top:8px;padding-top:4px;font-size:10px;color:#64748b;">Production Approval / Date</div>
  </div>
</div>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) { alert("Please allow pop-ups for this site to download the PDF."); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };
  const deleteTimecard = (id) => {
    const tc = timecards.find(t => t.id === id);
    if (tc?.locked) { alert("Unlock this entry before deleting it."); return; }
    if (!window.confirm("Delete this timecard? This cannot be undone.")) return;
    URL.revokeObjectURL(blobCache.current.get(id)?.url);
    URL.revokeObjectURL(blobCache.current.get("tc_paystub_" + id)?.url);
    blobCache.current.delete(id);
    blobCache.current.delete("tc_paystub_" + id);
    setTimecards(prev => prev.filter(t => t.id !== id));
  };

  // ── PAYROLL PORTAL CSV EXPORT ───────────────────────────────────────────────
  const generatePayrollTimecard = (entry, format) => {
    const e = entry || {};
    const days = Array.isArray(e.days) ? e.days : [];
    const fD = iso => { if (!iso) return ""; try { return new Date(iso + "T12:00").toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" }); } catch { return iso; } };
    const fT = v => v || "";
    const fn = v => { const n = parseFloat(v) || 0; return n ? (n % 1 === 0 ? String(n) : n.toFixed(2)) : ""; };
    const weekYear = e.date ? new Date(e.date + "T12:00").getFullYear() : "";
    const totalST = days.reduce((a, d) => a + (d.hours1x || 0), 0);
    const totalOT = days.reduce((a, d) => a + (d.hours15x || 0), 0);
    const totalDT = days.reduce((a, d) => a + (d.hours2x || 0), 0);
    const totalMP = days.filter(d => d.mealPenalty).length;
    const gross = (e.total || 0).toFixed(2);
    const perD = (e.perDiemTotal || 0).toFixed(2);
    const mpPay = (e.mealPenaltyPay || 0).toFixed(2);
    const sigFont = e.signatureFont || "Dancing Script";
    const sigName = e.signatureName || e.workerName || "";
    const sigDate = e.signatureDate ? new Date(e.signatureDate + "T12:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
    const sigHtml = sigName
      ? `<div style="font-family:'${sigFont}',cursive;font-size:28px;color:#1e293b;line-height:1.2;">${sigName}</div><div style="font-size:9px;color:#555;margin-top:1px;">${sigDate}</div>`
      : `<div style="min-height:36px;"></div>`;
    const sigFontImport = `@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(sigFont).replace(/%20/g,'+')}&display=swap');`;
    const C = "border:1px solid #000;";
    const FD = "border:1px solid #000;padding:3px 4px;font-size:9px;vertical-align:middle;";
    const printStyle = "@page{size:letter landscape;margin:0.4in;}@media print{body{padding:0;}print-color-adjust:exact;-webkit-print-color-adjust:exact;}";

    let html = "";

    // ── CAPS Crew Time Card ───────────────────────────────────────────────────
    if (format === "caps") {
      const HDR = `${C}background:#1a1a1a;color:#fff;font-weight:700;font-size:8px;text-align:center;padding:3px 2px;`;
      const capsRows = days.map(d => {
        const abbrev = (d.day || "").substring(0, 3).toUpperCase();
        const m1 = (d.meal1Out && d.meal1In) ? `${d.meal1Out}&ndash;${d.meal1In}` : "";
        const m2 = (d.meal2Out && d.meal2In) ? `${d.meal2Out}&ndash;${d.meal2In}` : "";
        const bg = d.type === "hold" ? "background:#fffbeb;" : d.type === "travel" ? "background:#f5f3ff;" : d.type === "off" ? "background:#f9fafb;" : "";
        return `<tr style="${bg}">
            <td rowspan="2" style="${FD}text-align:center;font-weight:800;">${abbrev}</td>
            <td rowspan="2" style="${FD}text-align:center;">${fD(d.date)}</td>
            <td rowspan="2" style="${FD}"></td>
            <td rowspan="2" style="${FD}"></td>
            <td rowspan="2" style="${FD}text-align:right;">$${e.rate || ""}</td>
            <td rowspan="2" style="${FD}text-align:center;">${fT(d.call)}</td>
            <td style="${C}padding:2px 4px;font-size:9px;border-bottom:none;">${m1}</td>
            <td rowspan="2" style="${FD}text-align:center;">${fT(d.wrap)}</td>
            <td rowspan="2" style="${FD}text-align:center;">${fn(d.hours1x)}</td>
            <td rowspan="2" style="${FD}text-align:center;">${fn(d.hours15x)}</td>
            <td rowspan="2" style="${FD}text-align:center;">${fn(d.hours2x)}</td>
            <td rowspan="2" style="${FD}"></td>
            <td rowspan="2" style="${FD}text-align:center;">${d.mealPenalty ? "1" : ""}</td>
            <td rowspan="2" style="${FD}"></td>
          </tr><tr style="${bg}"><td style="${C}padding:2px 4px;font-size:9px;border-top:none;">${m2}</td></tr>`;
      }).join("");
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>CAPS Crew Time Card</title><style>
${sigFontImport}
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,Helvetica,sans-serif;font-size:9px;color:#000;background:#fff;padding:10px 14px;}
table{width:100%;border-collapse:collapse;}td,th{border:1px solid #000;padding:3px 4px;vertical-align:top;}
.nb{border:none!important;}.lbl{font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.2px;color:#444;display:block;margin-bottom:1px;}
${printStyle}</style></head><body>
<table style="border:none;margin-bottom:4px;"><tr>
  <td class="nb" style="width:15%;vertical-align:middle;"><span style="font-size:28px;font-weight:900;font-style:italic;letter-spacing:-1px;">CAPS</span><br/><span style="font-size:7px;color:#666;">A Cast &amp; Crew Entertainment Company</span></td>
  <td class="nb" style="width:28%;font-size:8px;vertical-align:top;padding-top:2px;">2300 Empire Ave., 5th Floor<br/>Burbank, CA 91504<br/>(310) 280-0755<br/><strong>Check Inquiries: (310) 736-2146</strong></td>
  <td class="nb" style="width:28%;font-size:8px;vertical-align:top;padding-top:2px;">65 Bleecker Street, 13th Floor<br/>New York, NY 10012<br/>(212) 925-1415<br/><strong>Check Inquiries: (212) 925-1415 X4105</strong></td>
  <td class="nb" style="width:29%;text-align:right;vertical-align:top;"><span style="font-size:21px;font-weight:900;letter-spacing:0.5px;">CREW TIME CARD</span><br/><span style="font-size:8px;font-weight:700;">Employer: CAPS, LLC, FEIN: 27-4217142</span></td>
</tr></table>
<table><tr>
  <td style="width:38%;"><span class="lbl">Production Co.</span>${e.company || ""}</td>
  <td style="width:26%;"><span class="lbl">Job Name/Number</span>${e.jobName || ""}</td>
  <td style="width:10%;"><span class="lbl">Union</span></td>
  <td style="width:12%;"><span class="lbl">Contract Type</span></td>
  <td style="width:14%;"><span class="lbl">Occupation</span>${e.jobClassification || ""}</td>
</tr></table>
<table><tr>
  <td style="width:33%;"><span class="lbl">Employee Name</span>${e.workerName || ""}</td>
  <td style="width:5%;font-size:8px;text-align:center;">M &#9633;<br/>F &#9633;</td>
  <td style="width:18%;"><span class="lbl">Social Security Number</span>${e.last4SS ? `XXX &ndash; XX &ndash; ${e.last4SS}` : "&mdash;"}</td>
  <td style="width:16%;"><span class="lbl">Telephone</span></td>
  <td style="width:28%;"><span class="lbl">Email</span>${e.workerEmail || ""}</td>
</tr><tr>
  <td><span class="lbl">Loan Out</span></td>
  <td colspan="2"><span class="lbl">Federal I.D. Number</span></td>
  <td colspan="2"><span class="lbl">Rate</span>$${e.rate || ""} PER &nbsp;&#9745; HOUR &nbsp;&#9633; DAY &nbsp;&#9633; OTHER</td>
</tr></table>
<table><thead>
  <tr>
    <th style="${HDR}width:4%;" rowspan="2">&nbsp;</th>
    <th style="${HDR}width:8%;" rowspan="2">DATE</th>
    <th style="${HDR}width:12%;" rowspan="2">LOCATION<br/>ZIP CODE</th>
    <th style="${HDR}width:6%;" rowspan="2">AICP</th>
    <th style="${HDR}width:7%;" rowspan="2">RATE</th>
    <th style="${HDR}width:7%;" rowspan="2">START</th>
    <th style="${HDR}width:10%;">1st MEAL</th>
    <th style="${HDR}width:7%;" rowspan="2">END</th>
    <th style="${HDR}width:6%;" rowspan="2">ST</th>
    <th style="${HDR}width:6%;" rowspan="2">1.5X</th>
    <th style="${HDR}width:5%;" rowspan="2">2X</th>
    <th style="${HDR}width:5%;" rowspan="2">&nbsp;</th>
    <th style="${HDR}width:5%;" rowspan="2">MP</th>
    <th style="${HDR}" rowspan="2">COMMENTS</th>
  </tr>
  <tr><th style="${HDR}">2nd MEAL</th></tr>
</thead><tbody>${capsRows}</tbody>
<tfoot><tr>
  <td colspan="2"><span class="lbl">YEAR</span>${weekYear}</td>
  <td colspan="9" style="text-align:right;font-weight:700;font-size:8px;padding-right:8px;">TOTALS</td>
  <td style="text-align:center;font-weight:700;">${fn(totalST)}</td>
  <td style="text-align:center;font-weight:700;">${fn(totalOT)}</td>
  <td style="text-align:center;font-weight:700;">${totalMP || ""}</td>
  <td style="font-weight:700;"><span class="lbl">GROSS</span>$${gross}</td>
</tr></tfoot></table>
<table style="margin-top:0;"><tr>
  <td style="width:8%;"><span class="lbl">AICP #</span></td>
  <td style="width:12%;"><span class="lbl">Box Rental</span>$</td>
  <td style="width:8%;"><span class="lbl">AICP #</span></td>
  <td style="width:14%;"><span class="lbl">Mileage Non-Taxable</span>$${e.mileage || ""}</td>
  <td style="width:12%;"><span class="lbl">Mileage Taxable</span>$</td>
  <td style="width:8%;"><span class="lbl">AICP #</span></td>
  <td style="width:9%;"><span class="lbl">Advance</span>$</td>
  <td style="width:8%;"><span class="lbl">AICP #</span></td>
  <td style="width:21%;"><span class="lbl">Gross w/ Box Rental &amp; Mileage</span>$${gross}</td>
</tr><tr>
  <td><span class="lbl">AICP #</span></td>
  <td><span class="lbl">Car Allowance</span>$</td>
  <td><span class="lbl">AICP #</span></td>
  <td><span class="lbl">Per Diem Non-Taxable</span>$${perD}</td>
  <td><span class="lbl">Per Diem Taxable</span>$</td>
  <td><span class="lbl">AICP #</span></td>
  <td><span class="lbl">Other</span>$</td>
  <td><span class="lbl">AICP #</span></td>
  <td></td>
</tr></table>
<div style="display:flex;gap:20px;margin-top:8px;">
  <div style="flex:1;">
    ${sigHtml}
    <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:8px;font-weight:700;">EMPLOYEE SIGNATURE</div>
  </div>
  <div style="flex:1;">
    <div style="min-height:36px;"></div>
    <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:8px;font-weight:700;">APPROVED</div>
  </div>
</div>
<p style="font-size:7px;color:#444;line-height:1.5;margin-top:6px;">Attention all CA employees: Effective 2/14/2014, CAPS, A Cast &amp; Crew Company has established a Medical Provider Network (MPN) for all work-related injuries and/or illnesses. In the event of an injury, your care will be directed to a physician within the MPN and you have the right to pre-designate a doctor. For further information, please email MPN@capspayroll.com.</p>
</body></html>`;

    // ── EP Non-Union Crew Time Card ───────────────────────────────────────────
    } else if (format === "ep") {
      const EPHDR = `${C}background:#000;color:#fff;font-weight:700;font-size:7.5px;text-align:center;padding:2px 1px;`;
      const ords = ["1ST", "2ND", "3RD", "4TH", "5TH", "6TH", "7TH"];
      const epRows = days.map((d, i) => {
        const bg = d.type === "hold" ? "background:#fffbeb;" : d.type === "travel" ? "background:#f5f3ff;" : d.type === "off" ? "background:#f9fafb;" : "";
        const wages = (((d.hours1x || 0) + (d.hours15x || 0) * 1.5 + (d.hours2x || 0) * 2) * (e.rate || 0)).toFixed(2);
        return `<tr style="${bg}">
          <td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td>
          <td style="${FD}text-align:center;">${fD(d.date)}</td>
          <td style="${FD}"></td>
          <td style="${FD}text-align:center;font-weight:700;font-size:8px;">${ords[i] || ""}<br/><span style="font-weight:400;font-size:7px;">${(d.day || "").substring(0, 3)}</span></td>
          <td style="${FD}text-align:center;">${fT(d.call)}</td>
          <td style="${FD}text-align:center;">${fT(d.meal1Out)}</td>
          <td style="${FD}text-align:center;">${fT(d.meal1In)}</td>
          <td style="${FD}text-align:center;">${fT(d.meal2Out)}</td>
          <td style="${FD}text-align:center;">${fT(d.meal2In)}</td>
          <td style="${FD}text-align:center;">${fT(d.wrap)}</td>
          <td style="${FD}"></td>
          <td style="${FD}"></td>
          <td style="${FD}text-align:center;">${fn(d.totalHours)}</td>
          <td style="${FD}text-align:center;">${fn(d.hours1x)}</td>
          <td style="${FD}text-align:center;">${fn(d.hours15x)}</td>
          <td style="${FD}text-align:center;">${fn(d.hours2x)}</td>
          <td style="${FD}text-align:center;">${d.mealPenalty ? "1" : ""}</td>
          <td style="${FD}"></td>
          <td style="${FD}text-align:right;">$${e.rate || ""}</td>
          <td style="${FD}"></td>
          <td style="${FD}text-align:center;">${fn(d.totalHours)}</td>
          <td style="${FD}text-align:right;font-weight:700;">$${wages}</td>
        </tr>`;
      }).join("");
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>EP Non-Union Crew Time Card</title><style>
${sigFontImport}
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,Helvetica,sans-serif;font-size:9px;color:#000;background:#fff;padding:10px 14px;}
table{width:100%;border-collapse:collapse;}td,th{border:1px solid #000;padding:2px 3px;vertical-align:middle;}
.nb{border:none!important;}.lbl{font-size:7px;font-weight:700;text-transform:uppercase;color:#444;display:block;margin-bottom:1px;}
${printStyle}</style></head><body>
<table style="border:none;margin-bottom:6px;"><tr>
  <td class="nb" style="width:55%;vertical-align:middle;"><span style="display:inline-flex;align-items:center;gap:8px;"><span style="font-size:18px;font-weight:900;background:#e31e24;color:#fff;padding:3px 8px;border-radius:3px;">ep</span><span style="font-size:17px;font-weight:900;letter-spacing:0.5px;">NON-UNION CREW TIME CARD</span></span></td>
  <td class="nb" style="text-align:right;font-size:8px;vertical-align:middle;">EP-1002 Electronic (2016)</td>
</tr></table>
<table><tr>
  <td style="width:30%;"><span class="lbl">Picture</span>${e.company || ""}</td>
  <td style="width:20%;"><span class="lbl">Prod #</span>${e.jobName || e.jobId || ""}</td>
  <td style="width:13%;"><span class="lbl">Guar. Hours</span>${e.guarHours || ""}</td>
  <td style="width:13%;"><span class="lbl">Rate</span>$${e.rate || ""}/hr</td>
  <td style="width:24%;"><span class="lbl">Week Ending</span>${e.date || ""}</td>
</tr><tr>
  <td><span class="lbl">Name</span>${e.workerName || ""}</td>
  <td><span class="lbl">Social Security #</span>XXX-XX-${e.last4SS || "____"}</td>
  <td colspan="2"><span class="lbl">Job Classification / Occ. Code</span>${e.jobClassification || ""}</td>
  <td><span class="lbl">Account #</span></td>
</tr><tr>
  <td><span class="lbl">Loan-Out</span></td>
  <td><span class="lbl">Federal I.D. #</span></td>
  <td colspan="3"><span class="lbl">Location</span></td>
</tr></table>
<table><thead>
  <tr>
    <th colspan="6" style="${EPHDR}">WORK</th>
    <th style="${EPHDR}" rowspan="2">CALL</th>
    <th colspan="2" style="${EPHDR}">MEAL 1</th>
    <th colspan="2" style="${EPHDR}">MEAL 2</th>
    <th style="${EPHDR}" rowspan="2">WRAP</th>
    <th style="${EPHDR}" rowspan="2">RE-RATE</th>
    <th style="${EPHDR}" rowspan="2">OCC. CODE</th>
    <th style="${EPHDR}" rowspan="2">TOTAL HRS.</th>
    <th style="${EPHDR}" rowspan="2">1X</th>
    <th style="${EPHDR}" rowspan="2">1.5X</th>
    <th style="${EPHDR}" rowspan="2">2X</th>
    <th style="${EPHDR}" rowspan="2">MEAL PNLTY</th>
    <th style="${EPHDR}" rowspan="2">ACCT</th>
    <th style="${EPHDR}" rowspan="2">RATE</th>
    <th style="${EPHDR}" rowspan="2">TYPE</th>
    <th style="${EPHDR}" rowspan="2">HRS</th>
    <th style="${EPHDR}" rowspan="2">TOTAL</th>
  </tr>
  <tr>
    <th style="${EPHDR}">STATE</th>
    <th style="${EPHDR}">CITY</th>
    <th style="${EPHDR}">ACCT. CODE</th>
    <th style="${EPHDR}">DATE</th>
    <th style="${EPHDR}">LOC</th>
    <th style="${EPHDR}">DAY</th>
    <th style="${EPHDR}">OUT</th>
    <th style="${EPHDR}">IN</th>
    <th style="${EPHDR}">OUT</th>
    <th style="${EPHDR}">IN</th>
  </tr>
</thead><tbody>${epRows}</tbody>
<tfoot>
  <tr>
    <td colspan="4" style="font-size:8px;"><span class="lbl">Layoff/Termination Date</span>&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/</td>
    <td colspan="9" style="text-align:right;font-weight:700;font-size:8px;padding-right:6px;">TOTAL HOURS</td>
    <td style="text-align:center;font-weight:700;">${fn(e.hours || 0)}</td>
    <td style="text-align:center;font-weight:700;">${fn(totalST)}</td>
    <td style="text-align:center;font-weight:700;">${fn(totalOT)}</td>
    <td style="text-align:center;font-weight:700;">${fn(totalDT)}</td>
    <td style="text-align:center;font-weight:700;">${totalMP || ""}</td>
    <td colspan="4"></td>
    <td style="text-align:right;font-weight:700;background:#f0f0f0;">$${gross}</td>
  </tr>
  <tr>
    <td colspan="22" style="height:20px;vertical-align:top;font-weight:700;font-size:8px;">COMMENTS:</td>
    <td style="font-size:8px;font-weight:700;text-align:right;">TOTAL<br/>AMOUNT<br/>$${gross}</td>
  </tr>
</tfoot></table>
<p style="font-size:7.5px;color:#444;margin-top:8px;">IN SIGNING BELOW, THE EMPLOYEE/LOAN-OUT AND SUPERVISOR/PRODUCTION APPROVER EACH CERTIFY THAT THE INFORMATION PROVIDED IS CORRECT AND COMPLETE.</p>
<div style="display:flex;gap:20px;margin-top:6px;">
  <div style="flex:1.5;">
    ${sigHtml}
    <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:8px;font-weight:700;">EMPLOYEE/LOAN-OUT SIGNATURE &nbsp;X</div>
  </div>
  <div style="flex:1;">
    <div style="min-height:36px;"></div>
    <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:8px;font-weight:700;">APPROVED &nbsp;X</div>
  </div>
</div>
</body></html>`;

    // ── GreenSlate Crew Time Card ─────────────────────────────────────────────
    } else if (format === "greenslate") {
      const GSHDR = `${C}background:#e0e0e0;font-weight:700;font-size:7.5px;text-align:center;padding:2px 2px;`;
      const st1 = days.reduce((a, d) => a + (d.hours1x || 0), 0);
      const st15 = days.reduce((a, d) => a + (d.hours15x || 0), 0);
      const st2 = days.reduce((a, d) => a + (d.hours2x || 0), 0);
      const w1 = (st1 * (e.rate || 0)).toFixed(2);
      const w15 = (st15 * 1.5 * (e.rate || 0)).toFixed(2);
      const w2 = (st2 * 2 * (e.rate || 0)).toFixed(2);
      const gsRows = days.map(d => {
        const abbrev = (d.day || "").substring(0, 3);
        const bg = d.type === "hold" ? "background:#fffbeb;" : d.type === "travel" ? "background:#f5f3ff;" : d.type === "off" ? "background:#f9fafb;" : "";
        return `<tr style="${bg}">
          <td style="${FD}text-align:center;font-weight:700;">${abbrev}</td>
          <td style="${FD}text-align:center;">${fD(d.date)}</td>
          <td style="${FD}text-align:center;">${fT(d.call)}</td>
          <td style="${FD}text-align:center;">${fT(d.meal1Out)}</td>
          <td style="${FD}text-align:center;">${fT(d.meal1In)}</td>
          <td style="${FD}text-align:center;">${fT(d.meal2Out)}</td>
          <td style="${FD}text-align:center;">${fT(d.meal2In)}</td>
          <td style="${FD}text-align:center;">${fT(d.wrap)}</td>
          <td style="${FD}text-align:center;">${fn(d.totalHours)}</td>
          <td style="${FD}font-size:8px;text-align:center;">L ${d.mealPenalty ? "&#9745;" : "&#9633;"}<br/>D &#9633;</td>
          <td style="${FD}text-align:center;">${d.mealPenalty ? "$" + (e.rate || 0).toFixed(2) : ""}</td>
          <td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td>
          <td style="${FD}text-align:center;">${fn(d.hours1x)}</td>
          <td style="${FD}text-align:center;">${fn(d.hours15x)}</td>
          <td style="${FD}text-align:center;">${fn(d.hours2x)}</td>
          <td style="${FD}"></td><td style="${FD}"></td>
        </tr>`;
      }).join("");
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>GreenSlate Crew Time Card</title><style>
${sigFontImport}
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,Helvetica,sans-serif;font-size:9px;color:#000;background:#fff;padding:10px 14px;}
table{width:100%;border-collapse:collapse;}td,th{border:1px solid #000;padding:2px 3px;vertical-align:top;}
.nb{border:none!important;}.lbl{font-size:7px;font-weight:700;text-transform:uppercase;color:#444;display:block;margin-bottom:1px;}
${printStyle}</style></head><body>
<table style="border:none;margin-bottom:5px;"><tr>
  <td class="nb" style="width:30%;vertical-align:middle;"><span style="color:#2e7d32;font-weight:900;font-size:18px;letter-spacing:0.5px;">&#9671; GREENSLATE</span></td>
  <td class="nb" style="width:40%;text-align:center;vertical-align:middle;"><span style="font-size:15px;font-weight:900;letter-spacing:1px;">CREW TIME CARD</span></td>
  <td class="nb" style="width:30%;text-align:right;font-size:8px;vertical-align:top;">150 West 30th Street&ndash;Suite 405<br/>New York, NY 10001<br/>(212) 206-1724 Tel &nbsp;&bull;&nbsp; (212) 206-1070 Fax</td>
</tr></table>
<table><tr>
  <td style="width:35%;"><span class="lbl">Employee Name</span>${e.workerName || ""}</td>
  <td style="width:25%;"><span class="lbl">SS# XXX-XX-${e.last4SS || "____"}</span><span style="font-size:7px;color:#666;">(last 4 digits only)</span></td>
  <td style="width:40%;"><span class="lbl">Production</span>${e.company || ""}</td>
</tr><tr>
  <td><span class="lbl">Loan Out Corp</span></td>
  <td><span class="lbl">Fed ID#</span></td>
  <td><span class="lbl">Company</span>${e.company || ""}</td>
</tr><tr>
  <td style="width:14%;"><span class="lbl">Work State</span></td>
  <td style="width:14%;"><span class="lbl">Union</span></td>
  <td style="width:24%;"><span class="lbl">Pay Rate</span>$${e.rate || ""}/hr</td>
  <td style="width:22%;"><span class="lbl">Position</span>${e.jobClassification || ""}</td>
  <td style="width:26%;"><span class="lbl">Week Ending</span>${e.date || ""}</td>
</tr></table>
<table style="margin-top:2px;"><thead>
  <tr>
    <th style="${GSHDR}width:4%;" rowspan="2">DAY</th>
    <th style="${GSHDR}width:7%;" rowspan="2">DATE</th>
    <th style="${GSHDR}width:5%;" rowspan="2">IN</th>
    <th colspan="2" style="${GSHDR}">MEAL #1</th>
    <th colspan="2" style="${GSHDR}">MEAL #2</th>
    <th style="${GSHDR}width:5%;" rowspan="2">OUT</th>
    <th style="${GSHDR}width:6%;" rowspan="2">TOTAL HOURS</th>
    <th style="${GSHDR}width:8%;" rowspan="2">MEAL PENALTIES</th>
    <th style="${GSHDR}width:6%;" rowspan="2">MP AMOUNT</th>
    <th style="${GSHDR}width:7%;" rowspan="2">ACCOUNT CODE</th>
    <th style="${GSHDR}width:5%;" rowspan="2">SET CODE</th>
    <th style="${GSHDR}width:6%;" rowspan="2">TAX CREDIT CODE</th>
    <th colspan="5" style="${GSHDR}">HOURS</th>
  </tr>
  <tr>
    <th style="${GSHDR}width:5%;">OUT</th><th style="${GSHDR}width:5%;">IN</th>
    <th style="${GSHDR}width:5%;">OUT</th><th style="${GSHDR}width:5%;">IN</th>
    <th style="${GSHDR}width:5%;">1X</th><th style="${GSHDR}width:5%;">1.5X</th>
    <th style="${GSHDR}width:5%;">2X</th><th style="${GSHDR}width:5%;">2.5X</th><th style="${GSHDR}width:5%;">3X</th>
  </tr>
</thead><tbody>${gsRows}</tbody>
<tfoot><tr>
  <td colspan="8" style="text-align:right;font-weight:700;font-size:8px;padding-right:6px;">TOTAL:</td>
  <td style="text-align:center;font-weight:700;">${fn(e.hours || 0)}</td>
  <td colspan="5"></td>
  <td style="text-align:center;font-weight:700;">${fn(totalST)}</td>
  <td style="text-align:center;font-weight:700;">${fn(totalOT)}</td>
  <td style="text-align:center;font-weight:700;">${fn(totalDT)}</td>
  <td></td><td></td>
</tr></tfoot></table>
<table style="margin-top:4px;"><tr>
  <td style="width:26%;vertical-align:top;">
    <strong style="font-size:8px;">GROSS HOURS</strong>
    <table style="width:100%;margin-top:3px;"><thead>
      <tr><th style="${GSHDR}">Rate</th><th style="${GSHDR}">Hours</th><th style="${GSHDR}">Rate</th><th style="${GSHDR}">Total</th></tr>
    </thead><tbody>
      <tr><td style="${FD}">1X</td><td style="${FD}text-align:center;">${fn(st1)}</td><td style="${FD}text-align:right;">$${e.rate || ""}</td><td style="${FD}text-align:right;">$${w1}</td></tr>
      <tr><td style="${FD}">1.5X</td><td style="${FD}text-align:center;">${fn(st15)}</td><td style="${FD}text-align:right;">$${((e.rate || 0) * 1.5).toFixed(2)}</td><td style="${FD}text-align:right;">$${w15}</td></tr>
      <tr><td style="${FD}">2X</td><td style="${FD}text-align:center;">${fn(st2)}</td><td style="${FD}text-align:right;">$${((e.rate || 0) * 2).toFixed(2)}</td><td style="${FD}text-align:right;">$${w2}</td></tr>
      <tr><td style="${FD}">2.5X</td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td></tr>
      <tr><td style="${FD}">3X</td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td></tr>
      <tr><td style="${FD}">MP</td><td colspan="2" style="${FD}font-size:8px;">L&nbsp;/&nbsp;D</td><td style="${FD}text-align:right;">$${mpPay}</td></tr>
      <tr><td colspan="3" style="${FD}text-align:right;font-weight:700;">SUB-TOTAL:</td><td style="${FD}text-align:right;font-weight:700;">$${gross}</td></tr>
    </tbody></table>
  </td>
  <td style="width:38%;vertical-align:top;">
    <strong style="font-size:8px;">OTHER EARNINGS</strong>
    <table style="width:100%;margin-top:3px;"><thead>
      <tr><th style="${GSHDR}">Item</th><th style="${GSHDR}">Acct Code</th><th style="${GSHDR}">Days</th><th style="${GSHDR}">Rate</th><th style="${GSHDR}">Total</th></tr>
    </thead><tbody>
      <tr><td style="${FD}font-size:8px;">Box Rental</td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td></tr>
      <tr><td style="${FD}font-size:8px;">Camera Bump</td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td></tr>
      <tr><td style="${FD}font-size:8px;">Car Rental</td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td></tr>
      <tr><td style="${FD}font-size:8px;">Mileage</td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}text-align:right;">$${e.mileage || ""}</td></tr>
      <tr><td style="${FD}font-size:8px;">Meal Allow/Money</td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td></tr>
      <tr><td style="${FD}font-size:8px;">Production Fee</td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td></tr>
      <tr><td style="${FD}font-size:8px;">Vacation</td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td></tr>
      <tr><td colspan="4" style="${FD}text-align:right;font-weight:700;font-size:8px;">OTHER EARNINGS TOTAL:</td><td style="${FD}text-align:right;font-weight:700;">$</td></tr>
    </tbody></table>
  </td>
  <td style="width:36%;vertical-align:top;">
    <strong style="font-size:8px;">HOUSING / PER DIEM</strong>
    <table style="width:100%;margin-top:3px;"><thead>
      <tr><th style="${GSHDR}">Item</th><th style="${GSHDR}">Acct Code</th><th style="${GSHDR}">Days</th><th style="${GSHDR}">Rate</th><th style="${GSHDR}">Total</th></tr>
    </thead><tbody>
      <tr><td style="${FD}font-size:8px;">Per Diem (Allow)</td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}text-align:right;">$${e.workPerDiem || ""}</td><td style="${FD}text-align:right;">$${perD}</td></tr>
      <tr><td style="${FD}font-size:8px;">Per Diem (Taxable)</td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td></tr>
      <tr><td style="${FD}font-size:8px;">Housing (Allow)</td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td></tr>
      <tr><td style="${FD}font-size:8px;">Housing (Taxable)</td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td><td style="${FD}"></td></tr>
      <tr><td colspan="4" style="${FD}text-align:right;font-weight:700;font-size:8px;">HOUSING / PER DIEM TOTAL:</td><td style="${FD}text-align:right;font-weight:700;">$${perD}</td></tr>
    </tbody></table>
    <div style="margin-top:6px;border:2px solid #000;padding:6px;text-align:center;">
      <div style="font-size:8px;font-weight:900;letter-spacing:0.3px;">TOTAL GROSS AMOUNT<br/>OF ALL EARNINGS:</div>
      <div style="font-size:16px;font-weight:900;margin-top:4px;">$${gross}</div>
    </div>
  </td>
</tr></table>
<div style="display:flex;gap:20px;margin-top:8px;border-top:1px solid #000;padding-top:6px;">
  <div style="flex:1;">
    ${sigHtml}
    <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:8px;font-weight:700;">Employee Signature &amp; Date</div>
  </div>
  <div style="flex:1;">
    <div style="min-height:36px;"></div>
    <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:8px;font-weight:700;">Department Head Signature &amp; Date</div>
  </div>
  <div style="flex:1;">
    <div style="min-height:36px;"></div>
    <div style="border-top:1px solid #000;margin-top:4px;padding-top:3px;font-size:8px;font-weight:700;">Authorized Signature &amp; Date</div>
  </div>
</div>
</body></html>`;
    }

    if (!html) return;
    const w = window.open("", "_blank");
    if (!w) { alert("Please allow pop-ups for this site to generate the timecard."); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 900);
  };
  const openInvoiceGenerator = () => {
    const today = new Date().toISOString().split("T")[0];
    const dueD = new Date(); dueD.setDate(dueD.getDate() + 30);
    const y = new Date().getFullYear(), mo = String(new Date().getMonth() + 1).padStart(2, "0"), dy = String(new Date().getDate()).padStart(2, "0");
    const num = `INV-${y}${mo}${dy}-001`;
    let profile = {};
    try { profile = JSON.parse(localStorage.getItem("hibp_sender_profile") || "{}"); } catch {}
    setInvoiceForm({
      senderName: profile.senderName || "",
      senderAddress: profile.senderAddress || "",
      senderCity: profile.senderCity || "",
      senderState: profile.senderState || "",
      senderZip: profile.senderZip || "",
      senderPhone: profile.senderPhone || "",
      senderEmail: profile.senderEmail || "",
      clientName: "",
      clientAddress: "",
      clientCity: "",
      clientState: "",
      clientZip: "",
      invoiceNumber: num,
      invoiceDate: today,
      paymentTerms: "Net 30",
      dueDate: dueD.toISOString().split("T")[0],
      lateFeeType: "none",
      lateFeeRate: "",
      jobName: "",
      jobId: "",
      lineItems: [{ id: crypto.randomUUID(), description: "", qty: "1", rate: "", amount: 0 }],
      paymentMethods: profile.paymentMethods || (profile.paymentMethod ? [profile.paymentMethod] : ["ACH"]),
      bankName: profile.bankName || "",
      routingNumber: profile.routingNumber || "",
      accountNumber: profile.accountNumber || "",
      paypalHandle: profile.paypalHandle || "",
      zelleHandle: profile.zelleHandle || "",
      venmoHandle: profile.venmoHandle || "",
      checkPayableTo: profile.checkPayableTo || "",
      notes: "",
      taxRate: "",
      logoDataUrl: profile.logoDataUrl || "",
    });
    setEditingInvoiceId(null);
    setShowInvoiceGenerator(true);
  };

  const duplicateInvoice = (source) => {
    const today = new Date().toISOString().split("T")[0];
    const dueD = new Date(); dueD.setDate(dueD.getDate() + 30);
    const y = new Date().getFullYear(), mo = String(new Date().getMonth() + 1).padStart(2, "0"), dy = String(new Date().getDate()).padStart(2, "0");
    const num = `INV-${y}${mo}${dy}-001`;
    setInvoiceForm({
      ...source,
      invoiceNumber: num,
      invoiceDate: today,
      dueDate: dueD.toISOString().split("T")[0],
      lineItems: (source.lineItems || []).map(li => ({ ...li, id: crypto.randomUUID() })),
      paymentMethods: source.paymentMethods || (source.paymentMethod ? [source.paymentMethod] : ["ACH"]),
    });
    setEditingInvoiceId(null);
    setShowInvoiceGenerator(true);
  };

  const openEditInvoice = (item) => {
    const data = item.generatedData || {};
    setInvoiceForm({
      ...data,
      paymentMethods: data.paymentMethods || (data.paymentMethod ? [data.paymentMethod] : ["ACH"]),
      lineItems: (data.lineItems || []).map(li => ({ ...li, id: crypto.randomUUID() })),
    });
    setEditingInvoiceId(item.id);
    setShowInvoiceGenerator(true);
  };

  const updateLineItem = (id, field, val) => {
    setInvoiceForm(prev => {
      const items = prev.lineItems.map(li => {
        if (li.id !== id) return li;
        const updated = { ...li, [field]: val };
        if (field === "qty" || field === "rate") {
          updated.amount = parseFloat(updated.qty || 0) * parseFloat(updated.rate || 0);
        }
        return updated;
      });
      return { ...prev, lineItems: items };
    });
  };

  const downloadInvoicePDF = async (form, saveEntry = false) => {
    const fmt = n => (parseFloat(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
    const fmtDate = s => { if (!s) return ""; const d = new Date(s + "T12:00"); return isNaN(d) ? s : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); };
    const subtotal = form.lineItems.reduce((a, li) => a + (parseFloat(li.amount) || 0), 0);
    const taxAmt = subtotal * ((parseFloat(form.taxRate) || 0) / 100);
    const total = subtotal + taxAmt;
    const rows = form.lineItems.map(li => `
      <tr>
        <td style="padding:9px 12px;border-bottom:1px solid #daf2f7;">${li.description || ""}</td>
        <td style="padding:9px 12px;text-align:center;border-bottom:1px solid #daf2f7;">${li.qty || ""}</td>
        <td style="padding:9px 12px;text-align:right;border-bottom:1px solid #daf2f7;">${li.rate ? "$" + fmt(li.rate) : ""}</td>
        <td style="padding:9px 12px;text-align:right;border-bottom:1px solid #daf2f7;font-weight:600;">${(parseFloat(li.amount) || 0) > 0 ? "$" + fmt(li.amount) : ""}</td>
      </tr>`).join("");
    const blankRows = Array.from({ length: Math.max(0, 7 - form.lineItems.length) }, () => `
      <tr>
        <td style="padding:9px 12px;border-bottom:1px solid #daf2f7;">&nbsp;</td>
        <td style="padding:9px 12px;border-bottom:1px solid #daf2f7;"></td>
        <td style="padding:9px 12px;border-bottom:1px solid #daf2f7;"></td>
        <td style="padding:9px 12px;border-bottom:1px solid #daf2f7;"></td>
      </tr>`).join("");

    const html = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"/>
  <title>Invoice ${form.invoiceNumber || ""}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Century Gothic', 'Trebuchet MS', 'Gill Sans', Arial, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 36px 40px; }
    .top-bar { background: #111; height: 8px; border-radius: 2px 2px 0 0; }
    .header { display: grid; grid-template-columns: 1fr auto; border: 1px solid #9ee7f5; border-top: none; }
    .sender-block { background: #cff4fc; padding: 16px 18px; }
    .invoice-block { padding: 16px 18px; text-align: right; display: flex; flex-direction: column; justify-content: center; align-items: flex-end; border-left: 1px solid #9ee7f5; min-width: 160px; background: #fff; }
    .invoice-title { font-size: 24px; font-weight: bold; letter-spacing: 3px; }
    .invoice-num { font-size: 10px; color: #444; margin-top: 3px; font-family: monospace; }
    .lbl { font-size: 8.5px; color: #555; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 1px; }
    .val { font-size: 11px; color: #111; line-height: 1.4; }
    .sec-hdr { background: #cff4fc; border: 1px solid #9ee7f5; border-top: none; display: grid; grid-template-columns: 1fr 1fr; }
    .sec-hdr-cell { padding: 4px 12px; font-size: 8.5px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
    .sec-hdr-cell:first-child { border-right: 1px solid #9ee7f5; }
    .cj-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #9ee7f5; border-top: none; }
    .cj-col { padding: 10px 12px; }
    .cj-col:first-child { border-right: 1px solid #9ee7f5; }
    table.items { width: 100%; border-collapse: collapse; border: 1px solid #9ee7f5; border-top: none; }
    table.items thead th { background: #cff4fc; padding: 6px 12px; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #9ee7f5; font-weight: bold; }
    table.items thead th:not(:first-child) { text-align: right; }
    table.items thead th:nth-child(2) { text-align: center; width: 80px; }
    table.items thead th:nth-child(3) { width: 110px; }
    table.items thead th:nth-child(4) { width: 110px; }
    .totals-grid { display: grid; grid-template-columns: 1fr 220px; border: 1px solid #9ee7f5; border-top: none; }
    .notes-cell { padding: 10px 12px; font-size: 10px; color: #555; border-right: 1px solid #9ee7f5; }
    .tr-row { display: flex; justify-content: space-between; padding: 5px 12px; border-bottom: 1px solid #e8f9fc; font-size: 11px; }
    .tr-row.grand { background: #cff4fc; font-weight: bold; font-size: 13px; border-bottom: none; }
    .payment-block { border: 1px solid #9ee7f5; border-top: none; }
    .payment-hdr { background: #cff4fc; padding: 4px 12px; font-size: 8.5px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #9ee7f5; }
    .payment-grid { display: grid; gap: 0; padding: 0; }
    .pm-row { display: flex; gap: 4px; margin-bottom: 2px; }
    .pm-row .lbl { width: 52px; shrink: 0; }
    .footer-bar { border: 1px solid #9ee7f5; border-top: none; text-align: center; padding: 7px; font-size: 10px; color: #666; background: #f8fefe; }
    @media print { body { padding: 10px; } }
  </style>
</head><body>
<div class="top-bar"></div>
<div class="header">
  <div class="sender-block">
    ${form.logoDataUrl ? `<img src="${form.logoDataUrl}" style="max-height:60px;max-width:180px;object-fit:contain;margin-bottom:10px;display:block;" alt="" />` : ""}
    <div class="lbl">Name</div><div class="val" style="font-weight:600;">${form.senderName || "&nbsp;"}</div>
    ${(form.senderAddress || form.senderCity) ? `<div class="lbl" style="margin-top:6px;">Address</div>${form.senderAddress ? `<div class="val">${form.senderAddress}</div>` : ""}${(form.senderCity || form.senderState || form.senderZip) ? `<div class="val">${[form.senderCity, form.senderState, form.senderZip].filter(Boolean).join(", ")}</div>` : ""}` : ""}
    <div style="display:flex;gap:24px;margin-top:6px;">
      ${form.senderPhone ? `<div><div class="lbl">Phone</div><div class="val">${form.senderPhone}</div></div>` : ""}
      ${form.senderEmail ? `<div><div class="lbl">Email</div><div class="val">${form.senderEmail}</div></div>` : ""}
    </div>
  </div>
  <div class="invoice-block">
    <div class="invoice-title">INVOICE</div>
    ${form.invoiceNumber ? `<div class="invoice-num">#${form.invoiceNumber}</div>` : ""}
  </div>
</div>
<div class="sec-hdr">
  <div class="sec-hdr-cell">Customer</div>
  <div class="sec-hdr-cell">Job</div>
</div>
<div class="cj-grid">
  <div class="cj-col">
    <div class="lbl">Name</div><div class="val" style="font-weight:600;">${form.clientName || "&nbsp;"}</div>
    ${(form.clientAddress || form.clientCity) ? `<div class="lbl" style="margin-top:5px;">Address</div>${form.clientAddress ? `<div class="val">${form.clientAddress}</div>` : ""}${(form.clientCity || form.clientState || form.clientZip) ? `<div class="val">${[form.clientCity, form.clientState, form.clientZip].filter(Boolean).join(", ")}</div>` : ""}` : ""}
  </div>
  <div class="cj-col">
    <div class="lbl">Date Submitted</div><div class="val">${fmtDate(form.invoiceDate)}</div>
    <div class="lbl" style="margin-top:5px;">Due Date</div><div class="val" style="font-weight:600;">${fmtDate(form.dueDate)}</div>
    ${form.paymentTerms && form.paymentTerms !== "Custom" ? `<div class="lbl" style="margin-top:5px;">Payment Terms</div><div class="val">${form.paymentTerms}</div>` : ""}
    ${form.jobName ? `<div class="lbl" style="margin-top:5px;">Job / Show</div><div class="val">${form.jobName}</div>` : ""}
  </div>
</div>
<table class="items">
  <thead>
    <tr>
      <th style="text-align:left;">Description</th>
      <th>Qty / Hrs</th>
      <th>Rate</th>
      <th>Amount</th>
    </tr>
  </thead>
  <tbody>${rows}${blankRows}</tbody>
</table>
<div class="totals-grid">
  <div class="notes-cell">${form.notes ? `<strong>Notes:</strong><br/>${form.notes}` : `<span style="color:#ccc;">Notes / Comments</span>`}</div>
  <div>
    <div class="tr-row"><span>Subtotal</span><span>$${fmt(subtotal)}</span></div>
    ${taxAmt > 0 ? `<div class="tr-row"><span>Tax (${form.taxRate}%)</span><span>$${fmt(taxAmt)}</span></div>` : ""}
    ${(form.lateFeeType && form.lateFeeType !== "none" && parseFloat(form.lateFeeRate) > 0) ? `<div class="tr-row" style="color:#b45309;"><span>${form.lateFeeType === "flat" ? `Late Fee (flat $${fmt(form.lateFeeRate)})` : `Late Fee (${form.lateFeeRate}%/day)`}</span><span style="font-style:italic;">applied if overdue</span></div>` : ""}
    <div class="tr-row grand"><span>TOTAL</span><span>$${fmt(total)}</span></div>
  </div>
</div>
<div class="payment-block">
  <div class="payment-hdr">How to Pay</div>
  <div class="payment-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));">
    ${(() => {
      const methods = Array.isArray(form.paymentMethods) ? form.paymentMethods : (form.paymentMethod ? [form.paymentMethod] : ["ACH"]);
      return methods.map(m => {
        if (m === "ACH") return `<div style="padding:8px 12px;"><div class="lbl" style="margin-bottom:4px;font-size:8px;font-weight:bold;color:#0e7490;">ACH / Wire Transfer</div><div class="pm-row"><div class="lbl">Bank</div><div class="val">${form.bankName || "\u2014"}</div></div><div class="pm-row"><div class="lbl">Routing</div><div class="val" style="font-family:monospace;">${form.routingNumber || "\u2014"}</div></div><div class="pm-row"><div class="lbl">Account</div><div class="val" style="font-family:monospace;">${form.accountNumber || "\u2014"}</div></div></div>`;
        if (m === "Check") return `<div style="padding:8px 12px;"><div class="lbl" style="margin-bottom:4px;font-size:8px;font-weight:bold;color:#0e7490;">Check</div><div class="pm-row"><div class="lbl">Payable To</div><div class="val" style="font-weight:600;">${form.checkPayableTo || "\u2014"}</div></div></div>`;
        if (m === "PayPal") return `<div style="padding:8px 12px;"><div class="lbl" style="margin-bottom:4px;font-size:8px;font-weight:bold;color:#0e7490;">PayPal</div><div class="pm-row"><div class="lbl">Email / Username</div><div class="val">${form.paypalHandle || "\u2014"}</div></div></div>`;
        if (m === "Zelle") return `<div style="padding:8px 12px;"><div class="lbl" style="margin-bottom:4px;font-size:8px;font-weight:bold;color:#0e7490;">Zelle</div><div class="pm-row"><div class="lbl">Phone / Email</div><div class="val">${form.zelleHandle || "\u2014"}</div></div></div>`;
        if (m === "Venmo") return `<div style="padding:8px 12px;"><div class="lbl" style="margin-bottom:4px;font-size:8px;font-weight:bold;color:#0e7490;">Venmo</div><div class="pm-row"><div class="lbl">Username</div><div class="val">${form.venmoHandle || "\u2014"}</div></div></div>`;
        return "";
      }).join('<div style="border-left:1px solid #9ee7f5;"></div>');
    })()}
  </div>
</div>
<div class="footer-bar">Thank you for your business!</div>
</body></html>`;

    // Persist sender profile for next time
    try { localStorage.setItem("hibp_sender_profile", JSON.stringify({ senderName: form.senderName, senderAddress: form.senderAddress, senderCity: form.senderCity, senderState: form.senderState, senderZip: form.senderZip, senderPhone: form.senderPhone, senderEmail: form.senderEmail, paymentMethods: form.paymentMethods, paymentMethod: (form.paymentMethods || [])[0] || "ACH", bankName: form.bankName, routingNumber: form.routingNumber, accountNumber: form.accountNumber, paypalHandle: form.paypalHandle, zelleHandle: form.zelleHandle, venmoHandle: form.venmoHandle, checkPayableTo: form.checkPayableTo, logoDataUrl: form.logoDataUrl || "" })); } catch {}

    if (saveEntry) {
      const invId = editingInvoiceId || crypto.randomUUID();
      const safeNum = (form.invoiceNumber || invId.slice(0, 8)).replace(/[^a-zA-Z0-9_\-]/g, "_");
      const htmlFileName = `invoice_${safeNum}.html`;
      let savedFileName = null;
      try {
        const blob = new Blob([html], { type: "text/html" });
        const htmlFile = new File([blob], htmlFileName, { type: "text/html" });
        const fd = new FormData();
        fd.append("file", htmlFile);
        fd.append("subfolder", "invoices");
        const res = await fetch("/api/files", { method: "POST", body: fd });
        if (res.ok) savedFileName = htmlFileName;
      } catch (err) { console.warn("Invoice file save error:", err.message); }

      if (editingInvoiceId) {
        // Update existing invoice record, preserve payments/status
        setInvoices(prev => prev.map(inv => inv.id === editingInvoiceId ? {
          ...inv,
          company: form.clientName || "",
          amount: total,
          date: form.invoiceDate,
          invoiceNumber: form.invoiceNumber || "",
          dueDate: form.dueDate,
          paymentTerms: form.paymentTerms || "Net 30",
          lateFeeType: form.lateFeeType || "none",
          lateFeeRate: parseFloat(form.lateFeeRate) || 0,
          jobId: form.jobId || inv.jobId || "",
          fileName: savedFileName || inv.fileName,
          fileType: savedFileName ? "text/html" : inv.fileType,
          generatedData: form,
          timestamp: Date.now(),
        } : inv));
        setEditingInvoiceId(null);
      } else {
        setInvoices(prev => [{
          id: invId, fileId: null, fileName: savedFileName, fileType: savedFileName ? "text/html" : null,
          company: form.clientName || "", amount: total, date: form.invoiceDate,
          invoiceNumber: form.invoiceNumber || "", status: "Unpaid",
          jobId: form.jobId || "", dueDate: form.dueDate,
          paymentTerms: form.paymentTerms || "Net 30",
          lateFeeType: form.lateFeeType || "none",
          lateFeeRate: parseFloat(form.lateFeeRate) || 0,
          amountReceived: 0,
          generated: true, generatedData: form, timestamp: Date.now(),
        }, ...prev]);
        if (form.jobId) setExpandedJobs(prev => { const n = new Set(prev); n.add(form.jobId); return n; });
      }
    }

    const w = window.open("", "_blank");
    if (!w) { alert("Please allow pop-ups for this site to print the invoice."); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };
  // ── MILEAGE TAX REPORT ───────────────────────────────────────────────────────
  const generateMileageReport = () => {
    const entries = allMileageEntries.slice().sort((a, b) => a.date.localeCompare(b.date));
    if (entries.length === 0) { alert("No mileage entries for " + selectedYear + "."); return; }
    let profile = {};
    try { profile = JSON.parse(localStorage.getItem("hibp_sender_profile") || "{}"); } catch {}
    const ownerName = profile.senderName || "";
    const rate = IRS_MILEAGE_RATE;
    const totalMi = entries.reduce((a, b) => a + (parseFloat(b.miles) || 0), 0);
    const totalVal = totalMi * rate;

    // Group totals by company
    const byCompany = {};
    entries.forEach(m => {
      const co = m.company || "(unspecified)";
      if (!byCompany[co]) byCompany[co] = { miles: 0 };
      byCompany[co].miles += parseFloat(m.miles) || 0;
    });

    const fmtDate = (d) => { if (!d) return ""; try { return new Date(d + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch { return d; } };

    const rows = entries.map(m => `
      <tr>
        <td>${fmtDate(m.date)}</td>
        <td>${m.source === "timecard" ? "<span class=\"badge tc\">Timecard</span>" : "<span class=\"badge mn\">Manual</span>"}</td>
        <td>${m.company || "\u2014"}</td>
        <td>${m.jobName || (m.jobId && jobs ? (jobs.find ? "" : "") : "") || "\u2014"}</td>
        <td>${m.purpose || "\u2014"}</td>
        <td>${m.vehicle || "\u2014"}</td>
        <td class="num">${(parseFloat(m.miles) || 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}</td>
        <td class="num">$${((parseFloat(m.miles) || 0) * rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
      </tr>`).join("");

    const summaryRows = Object.entries(byCompany).sort((a, b) => b[1].miles - a[1].miles).map(([co, data]) => `
      <tr>
        <td>${co}</td>
        <td class="num">${data.miles.toLocaleString(undefined, { minimumFractionDigits: 1 })} mi</td>
        <td class="num">$${(data.miles * rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>Mileage Log ${selectedYear}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Century Gothic', 'Gill Sans', Arial, sans-serif; font-size: 11px; color: #222; padding: 28px 32px; }
  h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 2px; }
  .sub { font-size: 11px; color: #666; margin-bottom: 18px; }
  .section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #fff; background: #0e7490; padding: 4px 10px; margin-bottom: 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #cff4fc; font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; padding: 5px 8px; border: 1px solid #9ee7f5; text-align: left; }
  td { padding: 4px 8px; border: 1px solid #e2e8f0; font-size: 10.5px; vertical-align: middle; }
  tr:nth-child(even) td { background: #f8fefe; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .badge { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; padding: 1px 5px; border-radius: 3px; }
  .tc { background: #dbeafe; color: #1d4ed8; }
  .mn { background: #d1fae5; color: #065f46; }
  .total-row td { font-weight: 700; background: #cff4fc !important; border-top: 2px solid #9ee7f5; }
  .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #888; }
  @media print { body { padding: 10px; } }
</style></head><body>
<h1>Mileage Log &mdash; ${selectedYear} Tax Year</h1>
<p class="sub">${ownerName ? ownerName + " &nbsp;&bull;&nbsp; " : ""}IRS Standard Mileage Rate: $${rate}/mi &nbsp;&bull;&nbsp; Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

<div class="section-title">All Entries (${entries.length})</div>
<table>
  <thead><tr>
    <th>Date</th><th>Type</th><th>Client / Company</th><th>Job / Show</th><th>Purpose</th><th>Vehicle</th><th class="num">Miles</th><th class="num">Deduction</th>
  </tr></thead>
  <tbody>
    ${rows}
    <tr class="total-row">
      <td colspan="6">TOTAL</td>
      <td class="num">${totalMi.toLocaleString(undefined, { minimumFractionDigits: 1 })} mi</td>
      <td class="num">$${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
    </tr>
  </tbody>
</table>

<div class="section-title">Summary by Client / Company</div>
<table>
  <thead><tr><th>Client / Company</th><th class="num">Total Miles</th><th class="num">Deduction Value</th></tr></thead>
  <tbody>
    ${summaryRows}
    <tr class="total-row"><td>GRAND TOTAL</td><td class="num">${totalMi.toLocaleString(undefined, { minimumFractionDigits: 1 })} mi</td><td class="num">$${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
  </tbody>
</table>

<div class="footer">* Based on IRS standard mileage rate of $${rate}/mi for ${selectedYear}. Consult a tax professional for filing. This report was generated by Have I Been Paid?</div>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) { alert("Please allow pop-ups to print the report."); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  // ── EXPENSE TAX REPORT ───────────────────────────────────────────────────────
  const generateExpenseReport = async (category) => {
    // category: "expendables" | "equipment" | "gas" | "vehicle"
    const fmtDate = (d) => { if (!d) return ""; try { return new Date(d + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch { return d; } };
    const fmtMoney = (n) => (parseFloat(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
    let profile = {};
    try { profile = JSON.parse(localStorage.getItem("hibp_sender_profile") || "{}"); } catch {}
    const ownerName = profile.senderName || "";
    const genDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    setReportGenerating(true);

    // Helper: base64 from Drive → data URL (for gas/vehicle receipts stored only on Drive)
    const base64ToBytes = (b64) => { const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return bytes; };

    // Rasterize a PDF (Uint8Array) to an array of PNG data URLs using PDF.js
    const pdfToImages = async (pdfBytes) => {
      if (!window.pdfjsLib) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }
      const pdf = await window.pdfjsLib.getDocument({ data: pdfBytes }).promise;
      const pages = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        pages.push(canvas.toDataURL("image/png"));
      }
      return pages;
    };

    // Helper: fetch receipt for one item — returns { imgSrcs: string[], mimeType, fileName } or null
    // Convert a base64 HEIC/HEIF image to JPEG via the server-side sips converter.
    // Returns a data URL (JPEG if successful, original mimeType as fallback).
    const convertHeicBase64 = async (base64, mimeType, fileName) => {
      try {
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: mimeType });
        const file = new File([blob], fileName || "receipt.heic", { type: mimeType });
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/heic-convert", { method: "POST", body: fd });
        if (!res.ok) return `data:${mimeType};base64,${base64}`;
        const { base64: jpegB64 } = await res.json();
        return `data:image/jpeg;base64,${jpegB64}`;
      } catch {
        return `data:${mimeType};base64,${base64}`;
      }
    };
    const isHeicMime = (m) => m === "image/heic" || m === "image/heif";

    // imgSrcs is always an array: 1 entry for images, N entries (one per page) for PDFs.
    const fetchReceipt = async (item, itemType) => {
      try {
        if (itemType === "purchase") {
          const cached = blobCache.current.get("receipt_" + item.id);
          if (cached?.url) {
            const mimeType = cached.type || item.receipt?.fileType || "image/jpeg";
            if (mimeType === "application/pdf") {
              const ab = await fetch(cached.url).then(r => r.arrayBuffer());
              const imgSrcs = await pdfToImages(new Uint8Array(ab));
              return { imgSrcs, mimeType, fileName: item.receipt?.fileName || "receipt" };
            }
            if (isHeicMime(mimeType)) {
              const ab = await fetch(cached.url).then(r => r.arrayBuffer());
              const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
              const dataUrl = await convertHeicBase64(b64, mimeType, item.receipt?.fileName);
              return { imgSrcs: [dataUrl], mimeType: "image/jpeg", fileName: item.receipt?.fileName || "receipt" };
            }
            return { imgSrcs: [cached.url], mimeType, fileName: item.receipt?.fileName || "receipt" };
          }
          if (item.receipt?.fileId) {
            const res = await drivePost({ action: "downloadBinary", fileId: item.receipt.fileId });
            if (res.base64) {
              if (res.mimeType === "application/pdf") {
                const imgSrcs = await pdfToImages(base64ToBytes(res.base64));
                return { imgSrcs, mimeType: res.mimeType, fileName: res.name || item.receipt.fileName || "receipt" };
              }
              if (isHeicMime(res.mimeType)) {
                const dataUrl = await convertHeicBase64(res.base64, res.mimeType, res.name || item.receipt.fileName);
                return { imgSrcs: [dataUrl], mimeType: "image/jpeg", fileName: res.name || item.receipt.fileName || "receipt" };
              }
              return { imgSrcs: [`data:${res.mimeType};base64,${res.base64}`], mimeType: res.mimeType, fileName: res.name || item.receipt.fileName || "receipt" };
            }
          }
        } else {
          const fileId = item.receiptFileId;
          if (fileId) {
            const res = await drivePost({ action: "downloadBinary", fileId });
            if (res.base64) {
              if (res.mimeType === "application/pdf") {
                const imgSrcs = await pdfToImages(base64ToBytes(res.base64));
                return { imgSrcs, mimeType: res.mimeType, fileName: res.name || "receipt" };
              }
              if (isHeicMime(res.mimeType)) {
                const dataUrl = await convertHeicBase64(res.base64, res.mimeType, res.name);
                return { imgSrcs: [dataUrl], mimeType: "image/jpeg", fileName: res.name || "receipt" };
              }
              return { imgSrcs: [`data:${res.mimeType};base64,${res.base64}`], mimeType: res.mimeType, fileName: res.name || "receipt" };
            }
          }
        }
      } catch (e) { console.warn("Receipt fetch failed for", item.id, e); }
      return null;
    };

    const sharedStyles = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Century Gothic', 'Gill Sans', Arial, sans-serif; font-size: 11px; color: #222; padding: 28px 32px; }
      h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 2px; }
      .sub { font-size: 11px; color: #666; margin-bottom: 18px; }
      .section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #fff; padding: 4px 10px; margin-bottom: 0; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; padding: 5px 8px; border: 1px solid #e2e8f0; text-align: left; }
      td { padding: 5px 8px; border: 1px solid #e2e8f0; font-size: 10.5px; vertical-align: middle; }
      tr:nth-child(even) td { background: #f8fafc; }
      .num { text-align: right; font-variant-numeric: tabular-nums; }
      .total-row td { font-weight: 700; border-top: 2px solid #cbd5e1; }
      .has-receipt { font-size: 8.5px; font-weight: 700; text-transform: uppercase; padding: 1px 6px; border-radius: 3px; background: #d1fae5; color: #065f46; }
      .no-receipt { font-size: 9px; color: #94a3b8; font-style: italic; }
      .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #888; }
      .summary-table th { background: #f1f5f9; }
      .receipt-page { page-break-before: always; padding: 20px 28px; }
      .receipt-header { font-size: 10px; font-weight: 700; color: #475569; padding-bottom: 8px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; }
      .receipt-header .idx { font-size: 9px; color: #94a3b8; }
      .receipt-img { max-width: 100%; max-height: calc(100vh - 80px); display: block; margin: 0 auto; object-fit: contain; }
      @media print { body { padding: 10px; } }
    `;

    // Build receipt pages — every page in the output is a flat <img> (no iframes/embeds)
    // PDFs have already been rasterized to per-page PNGs by fetchReceipt.
    const buildReceiptPages = (pairs) => {
      const valid = pairs.filter(p => p.receipt?.imgSrcs?.length > 0);
      if (valid.length === 0) return "";
      const totalPages = valid.reduce((acc, p) => acc + p.receipt.imgSrcs.length, 0);
      let pageCounter = 0;
      return valid.map(({ item, receipt, itemLabel }) => {
        const desc = itemLabel || item.name || item.vendor || item.station || item.vehicle || "Receipt";
        const mt = receipt.mimeType || "";
        return receipt.imgSrcs.map(src => {
          pageCounter++;
          const content = `<img class="receipt-img" src="${src}" />`;
          return `
            <div class="receipt-page">
              <div class="receipt-header">
                <span>📎 ${desc} &nbsp;&bull;&nbsp; ${fmtDate(item.date)} &nbsp;&bull;&nbsp; ${fmtMoney(item.amount)} &nbsp;&bull;&nbsp; ${receipt.fileName}</span>
                <span class="idx">${pageCounter} of ${totalPages}</span>
              </div>
              ${content}
            </div>`;
        }).join("");
      }).join("");
    };

    if (category === "expendables" || category === "equipment") {
      const items = filteredPurchases.filter(p => p.category === category).slice().sort((a, b) => a.date.localeCompare(b.date));
      if (items.length === 0) { setReportGenerating(false); alert(`No ${category} logged for ${selectedYear}.`); return; }
      const total = items.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
      const label = category === "expendables" ? "Expendables" : "Equipment";
      const accent = category === "expendables" ? "#e11d48" : "#7c3aed";
      const accentLight = category === "expendables" ? "#fff1f2" : "#f5f3ff";
      const accentBorder = category === "expendables" ? "#fda4af" : "#c4b5fd";

      // Fetch all receipts in parallel
      const receipts = await Promise.all(items.map(p => fetchReceipt(p, "purchase")));
      const pairs = items.map((item, i) => ({ item, receipt: receipts[i], itemLabel: item.name }));
      const receiptCount = pairs.filter(p => p.receipt).length;

      const byVendor = {};
      items.forEach(p => { const v = p.vendor?.trim() || "(no vendor)"; if (!byVendor[v]) byVendor[v] = 0; byVendor[v] += parseFloat(p.amount) || 0; });

      const DEPR_METHOD_LABELS = { "section179": "Section 179", "bonus": "Bonus Depreciation", "straight-line": "Straight-Line", "macrs": "MACRS" };
      const rows = items.map((p, i) => {
        const method = p.depreciationMethod || "section179";
        const methodLabel = DEPR_METHOD_LABELS[method] || method;
        const lifeClass = method === "straight-line" ? (p.usefulLife ? p.usefulLife + " yr" : "—") : method === "macrs" ? (p.macrsClass || "—") : "—";
        const deduction = category === "equipment" ? calcEquipDeduction(p, selectedYear) : 0;
        return `
        <tr>
          <td>${fmtDate(p.date)}</td>
          <td>${p.name || "—"}</td>
          <td>${p.vendor || "—"}</td>
          <td>${p.notes || "—"}</td>
          ${category === "equipment" ? `<td>${p.serial || "—"}</td><td>${methodLabel}</td><td>${lifeClass}</td><td class="num">${deduction > 0 ? fmtMoney(deduction) : "—"}</td>` : ""}
          <td class="num">${fmtMoney(p.amount)}</td>
          <td>${receipts[i] ? `<span class="has-receipt">✓ p.${pairs.slice(0, i + 1).filter((_, j) => receipts[j]).length}</span>` : `<span class="no-receipt">none</span>`}</td>
        </tr>`;
      }).join("");

      const summaryRows = Object.entries(byVendor).sort((a, b) => b[1] - a[1]).map(([v, amt]) => `
        <tr><td>${v}</td><td class="num">${fmtMoney(amt)}</td></tr>`).join("");

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${label} Report ${selectedYear}</title>
      <style>${sharedStyles}
        .section-title { background: ${accent}; }
        th { background: ${accentLight}; border-color: ${accentBorder}; }
        .total-row td { background: ${accentLight} !important; }
        .summary-table th { background: #f1f5f9; border-color: #e2e8f0; }
      </style></head><body>
      <h1>${label} Expenses &mdash; ${selectedYear} Tax Year</h1>
      <p class="sub">${ownerName ? ownerName + " &nbsp;&bull;&nbsp; " : ""}${items.length} item${items.length !== 1 ? "s" : ""} &nbsp;&bull;&nbsp; ${receiptCount} receipt${receiptCount !== 1 ? "s" : ""} attached &nbsp;&bull;&nbsp; Generated ${genDate}</p>

      <div class="section-title">All ${label} (${items.length})</div>
      <table>
        <thead><tr>
          <th>Date</th><th>Item</th><th>Vendor</th><th>Notes</th>
          ${category === "equipment" ? "<th>Serial #</th><th>Depreciation Method</th><th>Life / Class</th><th class=\"num\">" + selectedYear + " Deduction</th>" : ""}
          <th class="num">Amount</th><th>Receipt</th>
        </tr></thead>
        <tbody>
          ${rows}
          <tr class="total-row">
            <td colspan="${category === "equipment" ? 8 : 4}">TOTAL</td>
            <td class="num">${fmtMoney(total)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <div class="section-title" style="background:#475569">Summary by Vendor</div>
      <table class="summary-table">
        <thead><tr><th>Vendor</th><th class="num">Total Spent</th></tr></thead>
        <tbody>
          ${summaryRows}
          <tr class="total-row"><td>GRAND TOTAL</td><td class="num">${fmtMoney(total)}</td></tr>
        </tbody>
      </table>

      <div class="footer">Consult a tax professional for filing. ${category === "equipment" ? "Depreciation deductions shown are estimates &mdash; verify method eligibility with your accountant (Section 179 subject to annual limits; MACRS/SL spread over asset life). &nbsp;&bull;&nbsp; " : ""}This report was generated by Have I Been Paid? on ${genDate}.${receiptCount > 0 ? ` &nbsp;&bull;&nbsp; ${receiptCount} receipt${receiptCount !== 1 ? "s" : ""} follow on subsequent pages.` : ""}</div>
      ${buildReceiptPages(pairs)}
      </body></html>`;

      reportHtmlRef.current = html;
      setReportGenerating(false);
      setShowReportOverlay(true);
      return;
    }

    if (category === "meals") {
      const items = filteredPurchases.filter(p => p.category === "meals").slice().sort((a, b) => a.date.localeCompare(b.date));
      if (items.length === 0) { setReportGenerating(false); alert(`No meals logged for ${selectedYear}.`); return; }
      const total = items.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);

      const receipts = await Promise.all(items.map(p => fetchReceipt(p, "purchase")));
      const pairs = items.map((item, i) => ({ item, receipt: receipts[i], itemLabel: item.name }));
      const receiptCount = pairs.filter(p => p.receipt).length;

      const byType = { "Business Meeting": 0, "Travel Dining": 0 };
      items.forEach(p => {
        const key = p.mealType === "travel_dining" ? "Travel Dining" : "Business Meeting";
        byType[key] += parseFloat(p.amount) || 0;
      });

      const rows = items.map((p, i) => `
        <tr>
          <td>${fmtDate(p.date)}</td>
          <td>${p.mealType === "travel_dining" ? "Travel Dining" : "Business Meeting"}</td>
          <td>${p.name || "—"}</td>
          <td>${p.vendor || "—"}</td>
          <td>${p.notes || "—"}</td>
          <td class="num">${fmtMoney(p.amount)}</td>
          <td>${receipts[i] ? `<span class="has-receipt">✓ p.${pairs.slice(0, i + 1).filter((_, j) => receipts[j]).length}</span>` : `<span class="no-receipt">none</span>`}</td>
        </tr>`).join("");

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Meals Report ${selectedYear}</title>
      <style>${sharedStyles}
        .section-title { background: #d97706; }
        th { background: #fffbeb; border-color: #fde68a; }
        .total-row td { background: #fffbeb !important; }
        .summary-table th { background: #f1f5f9; border-color: #e2e8f0; }
      </style></head><body>
      <h1>Meal Expenses &mdash; ${selectedYear} Tax Year</h1>
      <p class="sub">${ownerName ? ownerName + " &nbsp;&bull;&nbsp; " : ""}${items.length} entry${items.length !== 1 ? "s" : ""} &nbsp;&bull;&nbsp; ${receiptCount} receipt${receiptCount !== 1 ? "s" : ""} attached &nbsp;&bull;&nbsp; Generated ${genDate}</p>

      <div class="section-title">All Meal Expenses (${items.length})</div>
      <table>
        <thead><tr>
          <th>Date</th><th>Type</th><th>Description</th><th>Vendor / Restaurant</th><th>Notes</th>
          <th class="num">Amount</th><th>Receipt</th>
        </tr></thead>
        <tbody>
          ${rows}
          <tr class="total-row">
            <td colspan="5">TOTAL</td>
            <td class="num">${fmtMoney(total)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <div class="section-title" style="background:#475569">Summary by Type</div>
      <table class="summary-table">
        <thead><tr><th>Meal Type</th><th class="num">Total Spent</th></tr></thead>
        <tbody>
          ${Object.entries(byType).map(([k, v]) => `<tr><td>${k}</td><td class="num">${fmtMoney(v)}</td></tr>`).join("")}
          <tr class="total-row"><td>GRAND TOTAL</td><td class="num">${fmtMoney(total)}</td></tr>
        </tbody>
      </table>

      <div class="footer">Consult a tax professional for filing. Meal deductibility rules apply (typically 50% for business meals). This report was generated by Have I Been Paid? on ${genDate}.${receiptCount > 0 ? ` &nbsp;&bull;&nbsp; ${receiptCount} receipt${receiptCount !== 1 ? "s" : ""} follow on subsequent pages.` : ""}</div>
      ${buildReceiptPages(pairs)}
      </body></html>`;

      reportHtmlRef.current = html;
      setReportGenerating(false);
      setShowReportOverlay(true);
      return;
    }

    if (category === "gas") {
      const items = filteredGasLogs.slice().sort((a, b) => a.date.localeCompare(b.date));
      if (items.length === 0) { setReportGenerating(false); alert(`No gas logs for ${selectedYear}.`); return; }
      const total = items.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);

      const receipts = await Promise.all(items.map(g => fetchReceipt(g, "gas")));
      const pairs = items.map((item, i) => ({ item, receipt: receipts[i], itemLabel: item.station || item.vehicle }));
      const receiptCount = pairs.filter(p => p.receipt).length;

      const byVehicle = {};
      items.forEach(g => { const v = g.vehicle?.trim() || "(unspecified)"; if (!byVehicle[v]) byVehicle[v] = 0; byVehicle[v] += parseFloat(g.amount) || 0; });

      const rows = items.map((g, i) => `
        <tr>
          <td>${fmtDate(g.date)}</td>
          <td>${g.vehicle || "—"}</td>
          <td>${g.station || "—"}</td>
          <td>${g.pricePerGallon ? "$" + parseFloat(g.pricePerGallon).toFixed(3) + "/gal" : "—"}</td>
          <td>${g.notes || "—"}</td>
          <td class="num">${fmtMoney(g.amount)}</td>
          <td>${receipts[i] ? `<span class="has-receipt">✓ p.${pairs.slice(0, i + 1).filter((_, j) => receipts[j]).length}</span>` : `<span class="no-receipt">none</span>`}</td>
        </tr>`).join("");

      const summaryRows = Object.entries(byVehicle).sort((a, b) => b[1] - a[1]).map(([v, amt]) => `
        <tr><td>${v}</td><td class="num">${fmtMoney(amt)}</td></tr>`).join("");

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Gas Log ${selectedYear}</title>
      <style>${sharedStyles}
        .section-title { background: #d97706; }
        th { background: #fffbeb; border-color: #fcd34d; }
        .total-row td { background: #fffbeb !important; }
      </style></head><body>
      <h1>Gas Log &mdash; ${selectedYear} Tax Year</h1>
      <p class="sub">${ownerName ? ownerName + " &nbsp;&bull;&nbsp; " : ""}${items.length} fill-up${items.length !== 1 ? "s" : ""} &nbsp;&bull;&nbsp; ${receiptCount} receipt${receiptCount !== 1 ? "s" : ""} attached &nbsp;&bull;&nbsp; Generated ${genDate}</p>

      <div class="section-title">All Gas Purchases (${items.length})</div>
      <table>
        <thead><tr><th>Date</th><th>Vehicle</th><th>Station</th><th>Price/Gal</th><th>Notes</th><th class="num">Amount</th><th>Receipt</th></tr></thead>
        <tbody>
          ${rows}
          <tr class="total-row"><td colspan="5">TOTAL</td><td class="num">${fmtMoney(total)}</td><td></td></tr>
        </tbody>
      </table>

      <div class="section-title" style="background:#475569">Summary by Vehicle</div>
      <table class="summary-table">
        <thead><tr><th>Vehicle</th><th class="num">Total Gas Cost</th></tr></thead>
        <tbody>
          ${summaryRows}
          <tr class="total-row"><td>GRAND TOTAL</td><td class="num">${fmtMoney(total)}</td></tr>
        </tbody>
      </table>

      <div class="footer">Consult a tax professional for filing. This report was generated by Have I Been Paid? on ${genDate}.${receiptCount > 0 ? ` &nbsp;&bull;&nbsp; ${receiptCount} receipt${receiptCount !== 1 ? "s" : ""} follow on subsequent pages.` : ""}</div>
      ${buildReceiptPages(pairs)}
      </body></html>`;

      reportHtmlRef.current = html;
      setReportGenerating(false);
      setShowReportOverlay(true);
      return;
    }

    if (category === "vehicle") {
      const items = filteredVehicleExpenses.slice().sort((a, b) => a.date.localeCompare(b.date));
      if (items.length === 0) { setReportGenerating(false); alert(`No vehicle expenses for ${selectedYear}.`); return; }
      const total = items.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);

      const receipts = await Promise.all(items.map(v => fetchReceipt(v, "vehicle")));
      const pairs = items.map((item, i) => ({ item, receipt: receipts[i], itemLabel: item.vehicle || item.category }));
      const receiptCount = pairs.filter(p => p.receipt).length;

      const byCategory = {};
      items.forEach(v => { const c = v.category?.trim() || "other"; if (!byCategory[c]) byCategory[c] = 0; byCategory[c] += parseFloat(v.amount) || 0; });

      const rows = items.map((v, i) => `
        <tr>
          <td>${fmtDate(v.date)}</td>
          <td>${v.vehicle || "—"}</td>
          <td style="text-transform:capitalize">${v.category || "other"}</td>
          <td>${v.odometer ? v.odometer + " mi" : "—"}</td>
          <td>${v.notes || "—"}</td>
          <td class="num">${fmtMoney(v.amount)}</td>
          <td>${receipts[i] ? `<span class="has-receipt">✓ p.${pairs.slice(0, i + 1).filter((_, j) => receipts[j]).length}</span>` : `<span class="no-receipt">none</span>`}</td>
        </tr>`).join("");

      const summaryRows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([c, amt]) => `
        <tr><td style="text-transform:capitalize">${c}</td><td class="num">${fmtMoney(amt)}</td></tr>`).join("");

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Vehicle Expenses ${selectedYear}</title>
      <style>${sharedStyles}
        .section-title { background: #0891b2; }
        th { background: #ecfeff; border-color: #a5f3fc; }
        .total-row td { background: #ecfeff !important; }
      </style></head><body>
      <h1>Vehicle Expenses &mdash; ${selectedYear} Tax Year</h1>
      <p class="sub">${ownerName ? ownerName + " &nbsp;&bull;&nbsp; " : ""}${items.length} expense${items.length !== 1 ? "s" : ""} &nbsp;&bull;&nbsp; ${receiptCount} receipt${receiptCount !== 1 ? "s" : ""} attached &nbsp;&bull;&nbsp; Generated ${genDate}</p>

      <div class="section-title">All Vehicle Expenses (${items.length})</div>
      <table>
        <thead><tr><th>Date</th><th>Vehicle</th><th>Category</th><th>Odometer</th><th>Notes</th><th class="num">Amount</th><th>Receipt</th></tr></thead>
        <tbody>
          ${rows}
          <tr class="total-row"><td colspan="5">TOTAL</td><td class="num">${fmtMoney(total)}</td><td></td></tr>
        </tbody>
      </table>

      <div class="section-title" style="background:#475569">Summary by Category</div>
      <table class="summary-table">
        <thead><tr><th>Category</th><th class="num">Total Spent</th></tr></thead>
        <tbody>
          ${summaryRows}
          <tr class="total-row"><td>GRAND TOTAL</td><td class="num">${fmtMoney(total)}</td></tr>
        </tbody>
      </table>

      <div class="footer">Consult a tax professional for filing. This report was generated by Have I Been Paid? on ${genDate}.${receiptCount > 0 ? ` &nbsp;&bull;&nbsp; ${receiptCount} receipt${receiptCount !== 1 ? "s" : ""} follow on subsequent pages.` : ""}</div>
      ${buildReceiptPages(pairs)}
      </body></html>`;

      reportHtmlRef.current = html;
      setReportGenerating(false);
      setShowReportOverlay(true);
    }
  };

  const handleTimecardPaystubUpload = async (timecardId, file) => {
    if (!file) return;
    setPaystubUploading(timecardId);

    const blobUrl = URL.createObjectURL(file);
    blobCache.current.set("tc_paystub_" + timecardId, { url: blobUrl, type: file.type });

    let driveFileId = null;
    if (folderId) {
      try {
        const fileBase64 = await fileToBase64(file);
        const res = await drivePost({ action: "uploadBinary", fileName: "tc_paystub_" + file.name, fileBase64, mimeType: file.type, parents: [folderId] });
        if (res.id) driveFileId = res.id;
      } catch (err) { console.warn("Timecard paystub Drive upload error:", err); }
    }

    let extracted = { grossPay: 0, netPay: 0, payDate: new Date().toISOString().split("T")[0], checkNumber: "", employer: "" };
    if (driveConnected) {
      try {
        const text = await performOCR(file);
        extracted = parsePaystubText(text);
      } catch (err) { console.warn("Timecard paystub OCR error:", err); }
    }

    setTimecards(prev => prev.map(tc => tc.id === timecardId ? {
      ...tc,
      paystub: {
        fileId: driveFileId,
        fileName: file.name,
        fileType: file.type,
        grossPay: extracted.grossPay,
        netPay: extracted.netPay,
        payDate: extracted.payDate,
        checkNumber: extracted.checkNumber,
        employer: extracted.employer,
      },
      ...(extracted.grossPay > 0 ? { total: extracted.grossPay } : {}),
    } : tc));

    setPaystubUploading(null);
  };

  // ── STATS ────────────────────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const getYear = (dateStr) => { const d = new Date(dateStr); return isNaN(d) ? null : d.getFullYear(); };
  const allYears = [...new Set([
    ...invoices.map(i => getYear(i.date)),
    ...timecards.map(t => getYear(t.date)),
    ...purchases.map(p => getYear(p.date)),
    currentYear,
  ].filter(Boolean))].sort((a, b) => b - a);

  const sq = searchQuery.toLowerCase().trim();
  const filteredInvoices = invoices.filter(i => getYear(i.date) === selectedYear &&
    (!sq || (i.company||'').toLowerCase().includes(sq) || (i.invoiceNumber||'').toLowerCase().includes(sq) || String(i.amount||'').includes(sq)));
  const filteredTimecards = timecards.filter(t => getYear(t.date) === selectedYear &&
    (!sq || (t.company||'').toLowerCase().includes(sq) || (t.description||'').toLowerCase().includes(sq) || String(t.hours||'').includes(sq)));

  const totalBilled = filteredInvoices.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
  const totalPaid = filteredInvoices.reduce((a, b) => {
    const status = computeInvoiceStatus(b);
    if (status === "Paid") return a + (parseFloat(b.amount) || 0);
    if (status === "Partially Paid") return a + (parseFloat(b.amountReceived) || 0);
    return a;
  }, 0);
  const totalOutstanding = totalBilled - totalPaid;
  const totalTimecardHours = filteredTimecards.reduce((a, b) => a + (b.hours || 0), 0);
  const totalTimecardEarnings = filteredTimecards.reduce((a, b) => a + (b.total || 0), 0);
  const totalTimecardInvoiced = filteredTimecards.filter(t => t.status === "Paid").reduce((a, b) => a + (b.total || 0), 0);

  const filteredPurchases = purchases.filter(p => getYear(p.date) === selectedYear &&
    (!sq || (p.name||'').toLowerCase().includes(sq) || (p.vendor||'').toLowerCase().includes(sq) || (p.notes||'').toLowerCase().includes(sq) || (p.serial||'').toLowerCase().includes(sq)));
  const filteredExpendables = filteredPurchases.filter(p => p.category === "expendables");
  const filteredEquipment = filteredPurchases.filter(p => p.category === "equipment");
  const filteredMeals = filteredPurchases.filter(p => p.category === "meals");
  const totalExpendables = filteredExpendables.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
  const totalEquipment = filteredEquipment.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
  const totalMeals = filteredMeals.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
  const totalPurchases = totalExpendables + totalEquipment + totalMeals;

  const allMileageEntries = [
    ...timecards
      .filter(t => (t.mileage || 0) > 0 && getYear(t.date) === selectedYear)
      .map(t => ({ id: "tc_" + t.id, source: "timecard", timecardId: t.id, date: t.date, miles: t.mileage, company: t.company, jobName: t.jobName, purpose: t.description || "", jobId: t.jobId })),
    ...mileageLogs
      .filter(m => getYear(m.date) === selectedYear)
      .map(m => ({ ...m, source: "manual" })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const totalMiles = allMileageEntries.reduce((a, b) => a + (parseFloat(b.miles) || 0), 0);
  const totalMileageValue = totalMiles * IRS_MILEAGE_RATE;
  const filteredVehicleExpenses = vehicleExpenses.filter(v => getYear(v.date) === selectedYear);
  const totalVehicleExpenses = filteredVehicleExpenses.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
  const filteredGasLogs = gasLogs.filter(g => getYear(g.date) === selectedYear);
  const totalGasCost = filteredGasLogs.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
  const VEHICLE_EXPENSE_CATEGORIES = ["maintenance", "repairs", "tires", "insurance", "oil change", "registration", "other"];

  // ── Global search suggestions (all years, all tabs) ──────────────────────
  const searchSuggestions = (() => {
    if (!sq || sq.length < 1) return [];
    const results = [];
    invoices.forEach(i => {
      if ((i.company||'').toLowerCase().includes(sq) || (i.invoiceNumber||'').toLowerCase().includes(sq) || String(i.amount||'').includes(sq))
        results.push({ id: i.id, tab: "invoices", year: getYear(i.date), title: i.company || "Unnamed Client", sub: `${i.invoiceNumber ? "#" + i.invoiceNumber + " · " : ""}$${(parseFloat(i.amount)||0).toLocaleString(undefined,{minimumFractionDigits:2})} · ${i.date}`, badge: "Invoice", badgeColor: "bg-blue-100 text-blue-700", jobId: i.jobId });
    });
    timecards.forEach(t => {
      if ((t.company||'').toLowerCase().includes(sq) || (t.jobName||'').toLowerCase().includes(sq) || (t.description||'').toLowerCase().includes(sq) || (t.workerName||'').toLowerCase().includes(sq))
        results.push({ id: t.id, tab: "timecards", year: getYear(t.date), title: t.company || "Unnamed", sub: `${t.jobName ? t.jobName + " · " : ""}${t.hours}h · $${(t.total||0).toLocaleString(undefined,{minimumFractionDigits:2})} · ${t.date}`, badge: "Timecard", badgeColor: "bg-violet-100 text-violet-700", jobId: t.jobId });
    });
    purchases.forEach(p => {
      if ((p.name||'').toLowerCase().includes(sq) || (p.vendor||'').toLowerCase().includes(sq) || (p.serial||'').toLowerCase().includes(sq) || (p.notes||'').toLowerCase().includes(sq))
        results.push({ id: p.id, tab: "purchases", year: getYear(p.date), title: p.name || "Unnamed Item", sub: `${p.vendor ? p.vendor + " · " : ""}$${(parseFloat(p.amount)||0).toLocaleString(undefined,{minimumFractionDigits:2})}${p.serial ? " · SN:" + p.serial : ""} · ${p.date}`, badge: p.category === "equipment" ? "Equipment" : p.category === "meals" ? "Meal" : "Expendable", badgeColor: p.category === "equipment" ? "bg-violet-100 text-violet-700" : p.category === "meals" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700", jobId: p.jobId, purchaseCategory: p.category });
    });
    return results.slice(0, 12);
  })();

  const navigateToResult = (result) => {
    setSearchQuery("");
    setSearchFocused(false);
    setActiveTab(result.tab);
    if (result.year) setSelectedYear(result.year);
    // Expand the job group containing this item
    if (result.jobId) {
      const key = result.tab === "purchases" ? "pur_" + result.jobId : result.jobId;
      setExpandedJobs(prev => { const n = new Set(prev); n.add(key); return n; });
    }
    if (result.tab === "purchases") {
      setPurchaseSubTab(result.purchaseCategory || "expendables");
    }
    setHighlightedId(result.id);
    setTimeout(() => {
      document.getElementById(result.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    setTimeout(() => setHighlightedId(null), 3000);
  };

  const addPurchase = () => {
    const amount = parseFloat(newPurchase.amount);
    if (!newPurchase.name || isNaN(amount) || amount <= 0) return;
    setPurchases(prev => [{ id: crypto.randomUUID(), ...newPurchase, amount, locked: true, timestamp: Date.now() }, ...prev]);
    if (newPurchase.jobId) setExpandedJobs(prev => { const n = new Set(prev); n.add("pur_" + newPurchase.jobId); return n; });
    setNewPurchase(p => ({ name: "", vendor: "", amount: "", date: new Date().toISOString().split("T")[0], notes: "", serial: "", category: p.category, mealType: p.mealType || "business_meeting", jobId: p.jobId, isKit: false, kitDailyRate: "", kitWeeklyRate: "" }));
  };

  const deletePurchase = (id) => {
    const pur = purchases.find(p => p.id === id);
    if (pur?.locked) { alert("Unlock this entry before deleting it."); return; }
    if (!window.confirm("Delete this purchase entry? This cannot be undone.")) return;
    URL.revokeObjectURL(blobCache.current.get("receipt_" + id)?.url);
    blobCache.current.delete("receipt_" + id);
    setPurchases(prev => prev.filter(p => p.id !== id));
  };

  const handleReceiptUpload = async (purchaseId, file) => {
    if (!file) return;
    file = await normalizeReceiptFile(file);
    const blobUrl = URL.createObjectURL(file);
    blobCache.current.set("receipt_" + purchaseId, { url: blobUrl, type: file.type });

    let driveFileId = null;
    if (folderId) {
      try {
        const fileBase64 = await fileToBase64(file);
        const res = await drivePost({ action: "uploadBinary", fileName: "receipt_" + file.name, fileBase64, mimeType: file.type, parents: [folderId] });
        if (res.id) driveFileId = res.id;
      } catch (err) { console.warn("Receipt Drive upload error:", err); }
    }

    setPurchases(prev => prev.map(p => p.id === purchaseId ? {
      ...p,
      receipt: { fileId: driveFileId, fileName: file.name, fileType: file.type },
    } : p));
  };

  // Preview blob or Drive
  const previewBlob = previewItem ? blobCache.current.get(previewItem.id) : null;

  return (
    <>
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20 dark:bg-slate-900 dark:text-slate-100">

      {/* Hidden relink file input */}
      <input ref={relinkInputRef} type="file" accept=".json,application/json" onChange={handleRelinkFile} className="hidden" />

      {/* ── Relink Confirm Modal ── */}
      {relinkPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setRelinkPreview(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="font-bold text-slate-800 text-base">Restore Backup?</h2>
              <button onClick={() => setRelinkPreview(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-3 text-sm text-slate-600">
              <p>This will <strong>replace</strong> your current data with the contents of the backup file. A copy is kept in localStorage.</p>
              <ul className="text-xs text-slate-500 space-y-0.5 bg-slate-50 rounded-lg p-3">
                <li>{(relinkPreview.invoices?.length ?? 0)} invoices</li>
                <li>{(relinkPreview.timecards?.length ?? 0)} timecards</li>
                <li>{(relinkPreview.purchases?.length ?? 0)} purchases</li>
                <li>{(relinkPreview.vehicles?.length ?? 0)} vehicles &middot; {(relinkPreview.gasLogs?.length ?? 0)} gas logs</li>
                <li>{(relinkPreview.mileageLogs?.length ?? 0)} mileage entries</li>
              </ul>
            </div>
            <div className="px-6 pb-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRelinkPreview(null)}>Cancel</Button>
              <Button onClick={confirmRelink}>Restore</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Drive Setup Modal ── */}
      {showDriveSetup && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowDriveSetup(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <UploadCloud size={18} className="text-blue-600" />
                <h2 className="font-bold text-slate-800 text-base">Google Drive Backup</h2>
              </div>
              <button onClick={() => setShowDriveSetup(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            {/* Connection status bar */}
            <div className={`px-6 py-3 flex items-center gap-2.5 text-sm border-b ${
              driveCheckStatus === "ok" || driveConnected
                ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                : driveCheckStatus === "error"
                ? "bg-red-50 border-red-100 text-red-700"
                : "bg-slate-50 border-slate-100 text-slate-500"
            }`}>
              {driveCheckStatus === "checking" ? (
                <><Loader2 size={15} className="animate-spin" /> Checking connection...</>
              ) : driveCheckStatus === "ok" || driveConnected ? (
                <><CheckCircle size={15} /> <span>Connected as <strong>{driveEmail}</strong> — Drive is online</span></>
              ) : driveCheckStatus === "error" ? (
                <><AlertCircle size={15} /> <span>{driveCheckError}</span></>
              ) : (
                <><CloudOff size={15} /> Not connected — configure below then click Verify</>  
              )}
            </div>

            <div className="px-6 py-5 space-y-4 text-sm text-slate-600">
              {/* Collapse instructions when already connected */}
              {!driveConnected && (
                <>
                  <p>Drive backup uses a <strong>Service Account</strong> — no login popup. Add credentials to <code className="bg-slate-100 px-1 rounded text-xs">.env.local</code> then click <strong>Verify Connection</strong>.</p>
                  <ol className="list-decimal list-inside space-y-2 text-slate-500">
                    <li>Go to <button onClick={() => window.open("https://console.cloud.google.com")} className="text-blue-600 underline font-medium">Google Cloud Console</button> → create or select a project</li>
                    <li>Enable the <button onClick={() => window.open("https://console.cloud.google.com/apis/library/drive.googleapis.com")} className="text-blue-600 underline font-medium">Google Drive API</button></li>
                    <li>Go to <strong>APIs &amp; Services → Credentials</strong>, click <strong>+ Create Credentials → Service Account</strong>, fill in a name and click through</li>
                    <li>Back on the Credentials page, click your new service account email under <em>Service Accounts</em></li>
                    <li>Click the <strong>Keys</strong> tab → <strong>Add Key → Create new key → JSON → Create</strong> — a <code className="bg-slate-100 px-1 rounded text-xs">.json</code> file will download</li>
                    <li>Open <code className="bg-slate-100 px-1 rounded text-xs">.env.local</code> in the app folder, paste the <em>entire contents</em> of that file between the single quotes:<br />
                      <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs block mt-1 break-all">GOOGLE_SERVICE_ACCOUNT_JSON=&apos;&#123;paste entire JSON here&#125;&apos;</code>
                    </li>
                    <li>Save and restart the app (<code className="bg-slate-100 px-1 rounded text-xs">Ctrl+C</code> then <code className="bg-slate-100 px-1 rounded text-xs">npm run dev</code>), then click <strong>Verify Connection</strong> below</li>
                  </ol>
                </>
              )}

              {/* Drive folder section */}
              <div className="border-t border-slate-200 pt-4 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Your Drive Folder</p>
                <p className="text-xs text-slate-400">
                  {driveConnected
                    ? <>Share a folder with <strong className="text-slate-600">{driveEmail}</strong> (Editor access) then paste the URL below. Files will sync there instead of the service account&apos;s private storage.</>
                    : <>Once connected, share a folder with the service account email and paste its URL here.</>}
                </p>
                <div className="flex gap-2">
                  <input
                    value={customFolderInput}
                    onChange={e => setCustomFolderInput(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button
                    variant="outline"
                    className="text-xs shrink-0"
                    disabled={!customFolderInput.trim()}
                    onClick={() => {
                      const match = customFolderInput.match(/folders\/([a-zA-Z0-9_-]+)/);
                      const id = match ? match[1] : customFolderInput.trim();
                      if (!id) return;
                      localStorage.setItem("hibp_custom_folder_id", id);
                      setSavedCustomFolderId(id);
                      setCustomFolderInput(id);
                      checkDriveConnection();
                    }}
                  >
                    Use Folder
                  </Button>
                  {savedCustomFolderId && (
                    <Button
                      variant="ghost"
                      className="text-xs text-red-500 shrink-0 hover:text-red-700"
                      onClick={() => {
                        localStorage.removeItem("hibp_custom_folder_id");
                        setSavedCustomFolderId("");
                        setCustomFolderInput("");
                        checkDriveConnection();
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {savedCustomFolderId && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle size={13} /> Folder saved — ID: <code className="font-mono">{savedCustomFolderId}</code>
                  </p>
                )}
              </div>
            </div>

            <div className="px-6 pb-5 flex justify-between items-center gap-2">
              <Button
                variant="outline"
                className="gap-1.5"
                disabled={driveCheckStatus === "checking"}
                onClick={checkDriveConnection}
              >
                {driveCheckStatus === "checking" ? <><Loader2 size={14} className="animate-spin" /> Checking...</> : <><RefreshCw size={14} /> Verify Connection</>}
              </Button>
              {driveConnected ? (
                <Button onClick={() => { setShowDriveSetup(false); syncToDrive(); }} className="gap-1.5">
                  <RefreshCw size={14} /> Sync Now
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => setShowDriveSetup(false)}>Close</Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Preview Modal ── */}
      {previewItem && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPreviewItem(null)}>
          <div className="bg-white rounded-2xl w-full max-w-4xl flex flex-col shadow-2xl overflow-hidden" style={{ maxHeight: "92vh" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
              <div>
                <p className="font-bold text-slate-800 text-sm">{previewItem.fileName || "Invoice"}</p>
                {previewItem.invoiceNumber && <p className="text-xs text-slate-400 font-mono">#{previewItem.invoiceNumber}</p>}
              </div>
              <div className="flex items-center gap-2">
                {(previewItem.fileName || previewItem.fileId) && (
                  <a
                    href={previewItem.fileName ? `/api/files?name=${encodeURIComponent(previewItem.fileName)}` : `/api/drive?action=proxy&id=${previewItem.fileId}`}
                    download={previewItem.fileName}
                    className="inline-flex items-center gap-1.5 text-xs border border-slate-300 rounded-md px-3 py-1.5 text-slate-700 hover:bg-slate-50">
                    <ExternalLink size={13} /> Download
                  </a>
                )}
                <Button variant="ghost" onClick={() => setPreviewItem(null)} className="!px-2"><X size={18} /></Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100" style={{ minHeight: "70vh" }}>
              {previewBlob ? (
                // Local blob preview — works for any freshly uploaded file
                previewBlob.type.startsWith("image/") ? (
                  <img src={previewBlob.url} alt="Invoice" className="max-w-full h-auto mx-auto block p-4" />
                ) : (
                  <object data={previewBlob.url} type="application/pdf" className="w-full h-full border-0" style={{ minHeight: "70vh" }}>
                    <p className="p-8 text-center text-slate-500">PDF preview not supported in this browser. <a href={previewBlob.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">Download instead</a></p>
                  </object>
                )
              ) : previewItem.fileName ? (
                // Local file — served from offline_files/ folder
                previewItem.fileType === "text/html" ? (
                  <iframe src={`/api/files?name=${encodeURIComponent(previewItem.fileName)}`} className="w-full border-0" style={{ minHeight: "70vh" }} title="Invoice Preview" />
                ) : previewItem.fileType?.startsWith("image/") ? (
                  <img src={`/api/files?name=${encodeURIComponent(previewItem.fileName)}`} alt="Document" className="max-w-full h-auto mx-auto block p-4" />
                ) : (
                  <object data={`/api/files?name=${encodeURIComponent(previewItem.fileName)}`} type="application/pdf" className="w-full h-full border-0" style={{ minHeight: "70vh" }}>
                    <a href={`/api/files?name=${encodeURIComponent(previewItem.fileName)}`} download={previewItem.fileName} className="block p-8 text-center text-blue-600 underline">Download file</a>
                  </object>
                )
              ) : previewItem.fileId ? (
                // Drive proxy fallback for files without a local copy
                previewItem.fileType?.startsWith("image/") ? (
                  <img src={`/api/drive?action=proxy&id=${previewItem.fileId}`} alt="Document" className="max-w-full h-auto mx-auto block p-4" />
                ) : (
                  <object data={`/api/drive?action=proxy&id=${previewItem.fileId}`} type="application/pdf" className="w-full h-full border-0" style={{ minHeight: "70vh" }}>
                    <a href={`/api/drive?action=proxy&id=${previewItem.fileId}`} download={previewItem.fileName} className="block p-8 text-center text-blue-600 underline">Download file</a>
                  </object>
                )
              ) : (previewItem.generated && previewItem.generatedData) ? (
                // Regenerate HTML on the fly from saved data (fallback for older entries)
                (() => {
                  const f = previewItem.generatedData;
                  const fmt = n => (parseFloat(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
                  const fmtDate = s => { if (!s) return ""; const d = new Date(s + "T12:00"); return isNaN(d) ? s : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); };
                  const subtotal = f.lineItems.reduce((a, li) => a + (parseFloat(li.amount) || 0), 0);
                  const taxAmt = subtotal * ((parseFloat(f.taxRate) || 0) / 100);
                  const total = subtotal + taxAmt;
                  const rows = f.lineItems.map(li => `<tr><td style="padding:9px 12px;border-bottom:1px solid #daf2f7;">${li.description || ""}</td><td style="padding:9px 12px;text-align:center;border-bottom:1px solid #daf2f7;">${li.qty || ""}</td><td style="padding:9px 12px;text-align:right;border-bottom:1px solid #daf2f7;">${li.rate ? "$" + fmt(li.rate) : ""}</td><td style="padding:9px 12px;text-align:right;border-bottom:1px solid #daf2f7;font-weight:600;">${(parseFloat(li.amount) || 0) > 0 ? "$" + fmt(li.amount) : ""}</td></tr>`).join("");
                  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Century Gothic','Trebuchet MS',Arial,sans-serif;font-size:11px;color:#111;background:#fff;padding:36px 40px;}.top-bar{background:#111;height:8px;border-radius:2px 2px 0 0;}.header{display:grid;grid-template-columns:1fr auto;border:1px solid #9ee7f5;border-top:none;}.sender-block{background:#cff4fc;padding:16px 18px;}.invoice-block{padding:16px 18px;text-align:right;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;border-left:1px solid #9ee7f5;min-width:160px;background:#fff;}.invoice-title{font-size:24px;font-weight:bold;letter-spacing:3px;}.lbl{font-size:8.5px;color:#555;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:1px;}.val{font-size:11px;color:#111;line-height:1.4;}.sec-hdr{background:#cff4fc;border:1px solid #9ee7f5;border-top:none;display:grid;grid-template-columns:1fr 1fr;}.sec-hdr-cell{padding:4px 12px;font-size:8.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;}.sec-hdr-cell:first-child{border-right:1px solid #9ee7f5;}.cj-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #9ee7f5;border-top:none;}.cj-col{padding:10px 12px;}.cj-col:first-child{border-right:1px solid #9ee7f5;}table.items{width:100%;border-collapse:collapse;border:1px solid #9ee7f5;border-top:none;}table.items thead th{background:#cff4fc;padding:6px 12px;font-size:8.5px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #9ee7f5;font-weight:bold;}table.items thead th:not(:first-child){text-align:right;}table.items thead th:nth-child(2){text-align:center;width:80px;}table.items thead th:nth-child(3){width:110px;}table.items thead th:nth-child(4){width:110px;}.totals-grid{display:grid;grid-template-columns:1fr 220px;border:1px solid #9ee7f5;border-top:none;}.notes-cell{padding:10px 12px;font-size:10px;color:#555;border-right:1px solid #9ee7f5;}.tr-row{display:flex;justify-content:space-between;padding:5px 12px;border-bottom:1px solid #e8f9fc;font-size:11px;}.tr-row.grand{background:#cff4fc;font-weight:bold;font-size:13px;border-bottom:none;}.payment-block{border:1px solid #9ee7f5;border-top:none;}.payment-hdr{background:#cff4fc;padding:4px 12px;font-size:8.5px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #9ee7f5;}.payment-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:10px 12px;}.footer-bar{border:1px solid #9ee7f5;border-top:none;text-align:center;padding:7px;font-size:10px;color:#666;background:#f8fefe;}</style></head><body><div class="top-bar"></div><div class="header"><div class="sender-block">${f.logoDataUrl?`<img src="${f.logoDataUrl}" style="max-height:60px;max-width:180px;object-fit:contain;margin-bottom:10px;display:block;" alt=""/>`:""}<div class="lbl">Name</div><div class="val" style="font-weight:600;">${f.senderName||""}</div>${f.senderAddress?`<div class="lbl" style="margin-top:6px;">Address</div><div class="val">${f.senderAddress}</div>`:""}<div class="val">${[f.senderCity,f.senderState,f.senderZip].filter(Boolean).join(", ")}</div></div><div class="invoice-block"><div class="invoice-title">INVOICE</div><div class="lbl" style="margin-top:6px;">Invoice #</div><div class="val" style="font-family:monospace;">${f.invoiceNumber||""}</div><div class="lbl" style="margin-top:4px;">Date</div><div class="val">${fmtDate(f.invoiceDate)}</div>${f.dueDate?`<div class="lbl" style="margin-top:4px;">Due</div><div class="val">${fmtDate(f.dueDate)}</div>`:""}</div></div><div class="sec-hdr"><div class="sec-hdr-cell">Bill To</div><div class="sec-hdr-cell">Job / Project</div></div><div class="cj-grid"><div class="cj-col"><div class="val" style="font-weight:600;">${f.clientName||""}</div>${f.clientAddress?`<div class="val">${f.clientAddress}</div>`:""}<div class="val">${[f.clientCity,f.clientState,f.clientZip].filter(Boolean).join(", ")}</div>${f.clientEmail?`<div class="val">${f.clientEmail}</div>`:""}</div><div class="cj-col"><div class="val" style="font-weight:600;">${f.jobName||""}</div>${f.jobDescription?`<div class="val" style="color:#555;margin-top:3px;">${f.jobDescription}</div>`:""}</div></div><table class="items"><thead><tr><th style="text-align:left;">Description</th><th>Qty / Hrs</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><div class="totals-grid"><div class="notes-cell">${f.notes?`<strong>Notes:</strong><br/>${f.notes}`:`<span style="color:#ccc;">Notes / Comments</span>`}</div><div><div class="tr-row"><span>Subtotal</span><span>$${fmt(subtotal)}</span></div>${taxAmt>0?`<div class="tr-row"><span>Tax (${f.taxRate}%)</span><span>$${fmt(taxAmt)}</span></div>`:""}<div class="tr-row grand"><span>TOTAL</span><span>$${fmt(total)}</span></div></div></div><div class="payment-block"><div class="payment-hdr">How to Pay</div><div class="payment-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0;">${(()=>{const ms=Array.isArray(f.paymentMethods)?f.paymentMethods:(f.paymentMethod?[f.paymentMethod]:["ACH"]);return ms.map((m,i)=>`<div style="padding:8px 12px;${i>0?"border-left:1px solid #9ee7f5;":""}">${m==="ACH"?`<div class="lbl" style="margin-bottom:4px;font-size:8px;font-weight:bold;color:#0e7490;">ACH / Wire</div><div class="pm-row"><div class="lbl">Bank</div><div class="val">${f.bankName||"—"}</div></div><div class="pm-row"><div class="lbl">Routing</div><div class="val" style="font-family:monospace;">${f.routingNumber||"—"}</div></div><div class="pm-row"><div class="lbl">Account</div><div class="val" style="font-family:monospace;">${f.accountNumber||"—"}</div></div>`:m==="Check"?`<div class="lbl" style="margin-bottom:4px;font-size:8px;font-weight:bold;color:#0e7490;">Check</div><div class="pm-row"><div class="lbl">Payable To</div><div class="val" style="font-weight:600;">${f.checkPayableTo||"—"}</div></div>`:m==="PayPal"?`<div class="lbl" style="margin-bottom:4px;font-size:8px;font-weight:bold;color:#0e7490;">PayPal</div><div class="pm-row"><div class="lbl">Email/Username</div><div class="val">${f.paypalHandle||"—"}</div></div>`:m==="Zelle"?`<div class="lbl" style="margin-bottom:4px;font-size:8px;font-weight:bold;color:#0e7490;">Zelle</div><div class="pm-row"><div class="lbl">Phone/Email</div><div class="val">${f.zelleHandle||"—"}</div></div>`:m==="Venmo"?`<div class="lbl" style="margin-bottom:4px;font-size:8px;font-weight:bold;color:#0e7490;">Venmo</div><div class="pm-row"><div class="lbl">Username</div><div class="val">${f.venmoHandle||"—"}</div></div>`:""}</div>`).join("")})()}</div></div><div class="footer-bar">Thank you for your business!</div></body></html>`;
                  return <iframe srcDoc={srcDoc} className="w-full border-0" style={{ minHeight: "70vh" }} title="Invoice Preview" />;
                })()
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 p-10 text-slate-400">
                  <FileText size={40} />
                  <p>No preview available — file was not saved to Drive.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Hold Day Release Modal ── */}
      {holdReleaseModal && (() => {
        const hd = holdDays.find(h => h.id === holdReleaseModal.holdId);
        if (!hd) { setHoldReleaseModal(null); return null; }
        const dateLabel = new Date(holdReleaseModal.date + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
        const isDatesArray = Array.isArray(hd.dates);
        const released = new Set(hd.releasedDates || []);
        const total = isDatesArray ? hd.dates.length : (() => { const s = new Date(hd.startDate + "T12:00"); const e = new Date(hd.endDate + "T12:00"); return Math.round((e - s) / 86400000) + 1; })();
        const remaining = total - released.size;
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setHoldReleaseModal(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><span className="text-xl">⏸</span> Release Hold</h2>
                <button onClick={() => setHoldReleaseModal(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
              </div>
              {(() => {
                const htStyles = { soft: "bg-pink-50 border-pink-200", hold: "bg-blue-50 border-blue-200", locked: "bg-orange-50 border-orange-200", travel: "bg-purple-50 border-purple-200" };
                const htText = { soft: "text-pink-800", hold: "text-blue-800", locked: "text-orange-900", travel: "text-purple-800" };
                const htSub = { soft: "text-pink-600", hold: "text-blue-600", locked: "text-orange-700", travel: "text-purple-600" };
                const htDots = { soft: "✏️", hold: "⏸", locked: "🔒", travel: "✈️" };
                const htLabels = { soft: "Soft Hold", hold: "Hold", locked: "Locked", travel: "Travel" };
                const t = hd.type || "hold";
                return (
                  <div className={`border rounded-xl p-3 space-y-1 ${htStyles[t] || htStyles.hold}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base leading-none">{htDots[t]}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${htText[t] || htText.hold}`}>{htLabels[t] || "Hold"}</span>
                    </div>
                    <p className={`text-sm font-bold ${htText[t] || htText.hold}`}>{hd.company}</p>
                    <p className={`text-xs ${htSub[t] || htSub.hold}`}>{remaining} of {total} day{total !== 1 ? "s" : ""} active</p>
                  </div>
                );
              })()}
              <p className="text-xs text-slate-500">What would you like to release?</p>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    if (isDatesArray) {
                      // Remove from the dates array directly
                      const newDates = hd.dates.filter(d => d !== holdReleaseModal.date);
                      if (newDates.length === 0) {
                        setHoldDays(prev => prev.filter(h => h.id !== hd.id));
                      } else {
                        setHoldDays(prev => prev.map(h => h.id === hd.id ? { ...h, dates: newDates } : h));
                      }
                    } else {
                      setHoldDays(prev => prev.map(h => h.id === hd.id
                        ? { ...h, releasedDates: [...new Set([...(h.releasedDates || []), holdReleaseModal.date])] }
                        : h
                      ));
                    }
                    setHoldReleaseModal(null);
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl border border-amber-200 hover:bg-amber-50 transition-colors"
                >
                  <p className="text-sm font-bold text-amber-800">Release this day only</p>
                  <p className="text-xs text-amber-600 mt-0.5">{dateLabel}</p>
                </button>
                <button
                  onClick={() => {
                    setHoldDays(prev => prev.filter(h => h.id !== hd.id));
                    setHoldReleaseModal(null);
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl border border-red-200 hover:bg-red-50 transition-colors"
                >
                  <p className="text-sm font-bold text-red-700">Release entire hold</p>
                  <p className="text-xs text-red-500 mt-0.5">Remove all {remaining} remaining day{remaining !== 1 ? "s" : ""} for this job</p>
                </button>
              </div>
              <button onClick={() => setHoldReleaseModal(null)} className="w-full px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors">Cancel</button>
            </div>
          </div>
        );
      })()}

      {/* ── Hold Name Prompt Modal ── */}
      {holdNamePrompt && (() => {
        const typeConfig = {
          soft:   { label: "Soft Hold", dot: "✏️",  desc: "Tentative, can be moved",   style: "border-pink-400 bg-pink-50 text-pink-800",    ring: "ring-pink-400" },
          hold:   { label: "Hold",      dot: "⏸",   desc: "Standard hold",             style: "border-blue-400 bg-blue-50 text-blue-800",    ring: "ring-blue-400" },
          locked: { label: "Locked",    dot: "🔒",  desc: "Confirmed, do not move",   style: "border-orange-400 bg-orange-50 text-orange-900", ring: "ring-orange-400" },
          travel: { label: "Travel",    dot: "✈️",  desc: "Travel day",               style: "border-purple-400 bg-purple-50 text-purple-800", ring: "ring-purple-400" },
          prep:   { label: "Prep",      dot: "🔧",  desc: "Prep day",                 style: "border-teal-400 bg-teal-50 text-teal-800",    ring: "ring-teal-400" },
          scout:  { label: "Scout",     dot: "🚧",  desc: "Location scout",           style: "border-cyan-400 bg-cyan-50 text-cyan-800",    ring: "ring-cyan-400" },
          wrap:   { label: "Wrap",      dot: "📦",  desc: "Wrap day",                 style: "border-slate-400 bg-slate-100 text-slate-800", ring: "ring-slate-400" },
        };
        const tc = typeConfig[holdTypeInput] || typeConfig.hold;
        const applyHold = () => {
          const newHd = { id: Date.now().toString(), type: holdTypeInput, company: holdNameInput.trim() || tc.label, dates: [...calSelectedDates].sort(), releasedDates: [] };
          setHoldDays(prev => [...prev, newHd]);
          setCalSelectedDates([]);
          setCalSelectMode(false);
          setHoldNamePrompt(false);
          setHoldTypeInput("hold");
        };
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setHoldNamePrompt(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><span className="text-xl">{tc.dot}</span> Mark Days</h2>
                <button onClick={() => setHoldNamePrompt(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
              </div>
              <p className="text-sm text-slate-500">Applying to <span className="font-bold text-amber-600">{calSelectedDates.length} day{calSelectedDates.length !== 1 ? "s" : ""}</span></p>

              {/* Hold type selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Hold Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(typeConfig).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setHoldTypeInput(key)}
                      className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border-2 text-center transition-all ${holdTypeInput === key ? `${cfg.style} ring-2 ${cfg.ring} shadow-sm` : "border-slate-200 text-slate-500 hover:border-slate-300"}`}
                    >
                      <span className="text-lg leading-none">{cfg.dot}</span>
                      <span className="text-[11px] font-bold leading-tight">{cfg.label}</span>
                      <span className="text-[9px] leading-tight opacity-70">{cfg.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Production / Company <span className="font-normal text-slate-400">(optional)</span></label>
                <input
                  autoFocus
                  type="text"
                  value={holdNameInput}
                  onChange={e => setHoldNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") applyHold(); }}
                  placeholder="e.g. Netflix — Untitled Project"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setHoldNamePrompt(false)} className="flex-1 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors">Back</button>
                <button
                  onClick={applyHold}
                  className={`flex-1 px-4 py-2 text-sm font-bold rounded-xl transition-colors text-white ${
                    holdTypeInput === "soft"   ? "bg-pink-500 hover:bg-pink-600" :
                    holdTypeInput === "locked" ? "bg-orange-500 hover:bg-orange-600" :
                    holdTypeInput === "travel" ? "bg-purple-600 hover:bg-purple-700" :
                    holdTypeInput === "prep"   ? "bg-teal-600 hover:bg-teal-700" :
                    holdTypeInput === "scout"  ? "bg-cyan-600 hover:bg-cyan-700" :
                    holdTypeInput === "wrap"   ? "bg-slate-600 hover:bg-slate-700" :
                    "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {tc.dot} Apply {tc.label}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Payroll Portal Export Modal ── */}
      {showExportModal && exportEntry && (() => {
        const formats = [
          {
            id: "ep",
            name: "Entertainment Partners (EP)",
            desc: "Generates the standard EP Non-Union Crew Time Card — the exact form used by EP, Cast & Crew, and Media Services payroll portals.",
            badge: "EP · C&C",
            color: "border-blue-300 bg-blue-50",
            badgeColor: "bg-blue-600 text-white",
          },
          {
            id: "greenslate",
            name: "GreenSlate Crew Time Card",
            desc: "Generates the GreenSlate Crew Time Card form, including the Gross Hours summary, Other Earnings, Housing/Per Diem, and Deductions sections.",
            badge: "GreenSlate",
            color: "border-emerald-300 bg-emerald-50",
            badgeColor: "bg-emerald-600 text-white",
          },
          {
            id: "caps",
            name: "CAPS Crew Time Card",
            desc: "Generates the official CAPS (A Cast & Crew Company) Crew Time Card, with all AICP fields, dual-meal rows, and the CA MPN notice.",
            badge: "CAPS",
            color: "border-violet-300 bg-violet-50",
            badgeColor: "bg-violet-600 text-white",
          },
        ];
        return (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowExportModal(false)}>
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileDown size={16} className="text-violet-600" />Generate Payroll Timecard</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{exportEntry.company} — Week ending {exportEntry.date}</p>
                </div>
                <Button variant="ghost" onClick={() => setShowExportModal(false)} className="!px-2"><X size={18} /></Button>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-sm text-slate-600">Choose a portal format. Your timecard data will be filled into the official form layout — ready to print or save as PDF.</p>
                {formats.map(f => (
                  <button key={f.id}
                    onClick={() => { generatePayrollTimecard(exportEntry, f.id); setShowExportModal(false); }}
                    className={`w-full text-left rounded-xl border-2 p-4 transition-all hover:shadow-md active:scale-[0.99] ${f.color}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.badgeColor}`}>{f.badge}</span>
                      <span className="text-sm font-bold text-slate-800">{f.name}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                  </button>
                ))}
                <p className="text-[10px] text-slate-400 pt-1">A print preview will open in a new tab. Use <strong>File → Print</strong> (or ⌘P) and choose <strong>Save as PDF</strong> to download.</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Edit Timecard Modal ── */}
      {editingTimecard && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setEditingTimecard(null)}>
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Edit Timecard</h3>
              <Button variant="ghost" onClick={() => setEditingTimecard(null)} className="!px-2"><X size={18} /></Button>
            </div>
            <div className="p-6 space-y-5">
              {/* Header fields */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="space-y-1 col-span-2 sm:col-span-3 lg:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Production Company *</label>
                  {clients.length > 0 && (
                    <select value="" onChange={e => { if (e.target.value) setEditingTimecard(p => ({ ...p, company: e.target.value })); }}
                      className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mb-1">
                      <option value="">— Saved client —</option>
                      {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  )}
                  <Input value={editingTimecard.company} onChange={e => setEditingTimecard(p => ({ ...p, company: e.target.value }))} placeholder="e.g. KISSD Honda" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Job</label>
                  <select value={editingTimecard.jobId || ""} onChange={e => setEditingTimecard(p => ({ ...p, jobId: e.target.value }))}
                    className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                    <option value="">— Unassigned —</option>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1 col-span-2 sm:col-span-3 lg:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Job Name / Show</label>
                  <Input value={editingTimecard.jobName || ""} onChange={e => setEditingTimecard(p => ({ ...p, jobName: e.target.value }))} placeholder="e.g. Honda Civic Campaign" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Classification</label>
                  <div className="flex gap-1">
                    <select
                      value={classifications.includes(editingTimecard.jobClassification) ? editingTimecard.jobClassification : ""}
                      onChange={e => { if (e.target.value) setEditingTimecard(p => ({ ...p, jobClassification: e.target.value })); }}
                      className="flex-1 min-w-0 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                      <option value="">— Quick select —</option>
                      {classifications.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <Input value={editingTimecard.jobClassification || ""} onChange={e => setEditingTimecard(p => ({ ...p, jobClassification: e.target.value }))} placeholder="or type here" className="mt-1" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Week Ending (Sat)</label>
                  <Input type="date" value={editingTimecard.weekEnding}
                    onChange={e => {
                      const raw = e.target.value; if (!raw) return;
                      const entered = new Date(raw + "T12:00");
                      const daysToSat = (6 - entered.getDay() + 7) % 7;
                      entered.setDate(entered.getDate() + daysToSat);
                      const we = entered.toISOString().split("T")[0];
                      setEditingTimecard(p => ({ ...p, weekEnding: we, days: initWeekDays(we).map((nd, i) => ({ ...nd, ...(p.days?.[i] ? { call: p.days[i].call, meal1Out: p.days[i].meal1Out, meal1In: p.days[i].meal1In, meal2Out: p.days[i].meal2Out, meal2In: p.days[i].meal2In, wrap: p.days[i].wrap } : {}) })) }));
                    }} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Rate ($/hr) *</label>
                  <Input type="number" value={editingTimecard.rate} onChange={e => setEditingTimecard(p => ({ ...p, rate: e.target.value, dayRate: "" }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">— or — Day Rate ($)</label>
                  <div className="flex gap-1">
                    <Input type="number" value={editingTimecard.dayRate || ""} onChange={e => {
                      const dr = e.target.value;
                      const hr = dayRateToHourly(dr, editingTimecard.dayRateType || "10");
                      setEditingTimecard(p => ({ ...p, dayRate: dr, rate: hr, guarHours: (p.dayRateType || "10") === "12" ? "12" : "10" }));
                    }} placeholder="e.g. 1650" className="flex-1" />
                    <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs font-bold shrink-0">
                      {["10", "12"].map(t => (
                        <button key={t} type="button"
                          onClick={() => {
                            const hr = dayRateToHourly(editingTimecard.dayRate, t);
                            setEditingTimecard(p => ({ ...p, dayRateType: t, rate: hr || p.rate, guarHours: t }));
                          }}
                          className={`px-2.5 py-1 transition-colors ${(editingTimecard.dayRateType || "10") === t ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                          {t}hr
                        </button>
                      ))}
                    </div>
                  </div>
                  {editingTimecard.dayRate && editingTimecard.rate && (
                    <p className="text-[10px] text-blue-500">≈ ${parseFloat(editingTimecard.rate).toFixed(4)}/hr (auto-calculated)</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Guar. Hours</label>
                  <Input type="number" value={editingTimecard.guarHours} onChange={e => setEditingTimecard(p => ({ ...p, guarHours: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Mileage (mi)</label>
                  <Input type="number" value={editingTimecard.mileage || ""} onChange={e => setEditingTimecard(p => ({ ...p, mileage: e.target.value }))} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Work Day Per Diem ($)</label>
                  <Input type="number" value={editingTimecard.workPerDiem || ""} onChange={e => setEditingTimecard(p => ({ ...p, workPerDiem: e.target.value }))} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Day Off Per Diem ($)</label>
                  <Input type="number" value={editingTimecard.daysOffPerDiem || ""} onChange={e => setEditingTimecard(p => ({ ...p, daysOffPerDiem: e.target.value }))} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Kit/Box Rental ($/day)</label>
                  <Input type="number" value={editingTimecard.kitRentalRate || ""} onChange={e => setEditingTimecard(p => ({ ...p, kitRentalRate: e.target.value }))} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Notes</label>
                  <Input value={editingTimecard.description || ""} onChange={e => setEditingTimecard(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Your Name</label>
                  <Input value={editingTimecard.workerName || ""} onChange={e => setEditingTimecard(p => ({ ...p, workerName: e.target.value }))} />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Your Email</label>
                  <Input type="email" value={editingTimecard.workerEmail || ""} onChange={e => setEditingTimecard(p => ({ ...p, workerEmail: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">SS Last 4</label>
                  <Input value={editingTimecard.last4SS || ""} onChange={e => setEditingTimecard(p => ({ ...p, last4SS: e.target.value.replace(/\D/g, "").slice(0, 4) }))} className="font-mono tracking-widest" />
                </div>
              </div>

              {/* Signature section */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee Signature</div>
                <div className="flex gap-3 flex-wrap">
                  <div className="space-y-1 flex-1 min-w-[160px]">
                    <label className="text-[10px] text-slate-400">Font Style</label>
                    <select value={editingTimecard.signatureFont || "Dancing Script"} onChange={e => setEditingTimecard(p => ({ ...p, signatureFont: e.target.value }))}
                      className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                      {SIGNATURE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Signature Date</label>
                    <Input type="date" value={editingTimecard.signatureDate || ""} onChange={e => setEditingTimecard(p => ({ ...p, signatureDate: e.target.value }))} className="w-40" />
                  </div>
                </div>
                {editingTimecard.workerName ? (
                  <div className="rounded-lg border border-slate-200 bg-white px-5 py-3">
                    <div style={{ fontFamily: `'${editingTimecard.signatureFont || "Dancing Script"}', cursive`, fontSize: "32px", color: "#1e293b", lineHeight: 1.3 }}>
                      {editingTimecard.workerName}
                    </div>
                    {editingTimecard.signatureDate && (
                      <div className="text-sm text-slate-700 mt-1">
                        {new Date(editingTimecard.signatureDate + "T12:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400 mt-1">{editingTimecard.signatureFont || "Dancing Script"}</div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic">Enter your name above to preview signature</div>
                )}
              </div>

              {/* 7-day grid */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[700px] text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-24 border-r border-slate-200">Field</th>
                      {editingTimecard.days.map((d, i) => {
                        const isWeekend = i === 0 || i === 6;
                        const hours = calcDayHours(d);
                        return (
                          <th key={i} className={`text-center px-1 py-1.5 border-r border-slate-100 last:border-r-0 min-w-[92px] ${isWeekend ? "bg-amber-50" : hours > 0 ? "bg-blue-50" : ""}`}>
                            <div className={`font-bold text-xs ${isWeekend ? "text-amber-600" : "text-slate-700"}`}>{d.day}</div>
                            <div className={`text-[10px] mt-0.5 font-normal ${isWeekend ? "text-amber-500" : "text-slate-400"}`}>
                              {new Date(d.date + "T12:00").toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}
                            </div>
                            {hours > 0 && <div className="text-[10px] font-bold text-blue-600 mt-0.5">{hours}h</div>}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Call", key: "call", type: "time" },
                      { label: "Meal 1 Out", key: "meal1Out", type: "time" },
                      { label: "Meal 1 In", key: "meal1In", type: "time" },
                      { label: "Meal 2 Out", key: "meal2Out", type: "time" },
                      { label: "Meal 2 In", key: "meal2In", type: "time" },
                      { label: "Wrap", key: "wrap", type: "text" },
                    ].map(({ label, key, type }, rowIdx) => (
                      <tr key={key} className={rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                        <td className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase border-r border-slate-200 whitespace-nowrap">
                          {label}
                          {key === "wrap" && <span className="ml-1 text-slate-300 font-normal normal-case">(27:18=3:18am)</span>}
                        </td>
                        {editingTimecard.days.map((d, i) => {
                          const isWeekend = i === 0 || i === 6;
                          const isNextDay = key === "wrap" && d[key] && parseInt(d[key].split(":")[0], 10) >= 24;
                          return (
                            <td key={i} className={`px-1 py-1 border-r border-slate-100 last:border-r-0 ${isWeekend ? "bg-amber-50/60" : ""}`}>
                              <input type={type} value={d[key] || ""}
                                placeholder={key === "wrap" ? "--:--" : undefined}
                                title={key === "wrap" ? "For next-day wraps use hours > 23, e.g. 27:18 = 3:18am" : undefined}
                                onChange={e => setEditingTimecard(p => ({ ...p, days: p.days.map((day, idx) => idx !== i ? day : { ...day, [key]: e.target.value }) }))}
                                className={`w-full text-xs border rounded px-1 py-0.5 text-center focus:outline-none focus:border-blue-400 ${isNextDay ? "border-violet-300 bg-violet-50 text-violet-700 font-medium" : isWeekend ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`} />
                              {isNextDay && <div className="text-[9px] text-violet-500 text-center leading-none mt-0.5">+next day</div>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="bg-sky-50 border-t border-sky-200">
                      <td className="px-3 py-1.5 text-[10px] font-bold text-sky-700 uppercase border-r border-slate-200 whitespace-nowrap">Day Type</td>
                      {editingTimecard.days.map((d, i) => {
                        const isWeekend = i === 0 || i === 6;
                        return (
                          <td key={i} className={`px-1 py-1.5 border-r border-slate-100 last:border-r-0 text-center ${isWeekend ? "bg-amber-50/60" : ""}`}>
                            <select value={d.type || "work"}
                              onChange={e => setEditingTimecard(p => ({ ...p, days: p.days.map((day, idx) => idx !== i ? day : { ...day, type: e.target.value }) }))}
                              className="w-full text-[10px] border border-sky-200 rounded px-0.5 py-0.5 bg-white focus:outline-none focus:border-blue-400 text-slate-700">
                              <option value="work">Work</option>
                              <option value="hold">Hold</option>
                              <option value="travel">Travel</option>
                              <option value="off">Off</option>
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="bg-orange-50 border-t border-orange-200">
                      <td className="px-3 py-1.5 text-[10px] font-bold text-orange-700 uppercase border-r border-slate-200 whitespace-nowrap">Meal Penalty</td>
                      {editingTimecard.days.map((d, i) => {
                        const isWeekend = i === 0 || i === 6;
                        return (
                          <td key={i} className={`px-1 py-1.5 border-r border-slate-100 last:border-r-0 text-center ${isWeekend ? "bg-amber-50/60" : ""}`}>
                            <input
                              type="checkbox"
                              checked={!!d.mealPenalty}
                              onChange={e => setEditingTimecard(p => ({ ...p, days: p.days.map((day, idx) => idx !== i ? day : { ...day, mealPenalty: e.target.checked }) }))}
                              className="w-4 h-4 rounded accent-orange-500 cursor-pointer"
                              title={d.mealPenalty ? "Meal penalty flagged" : "Check to flag meal penalty"}
                            />
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="bg-violet-50 border-t border-violet-200">
                      <td className="px-3 py-1.5 text-[10px] font-bold text-violet-700 uppercase border-r border-slate-200 whitespace-nowrap">
                        Work Per Diem
                        {parseFloat(editingTimecard.workPerDiem) > 0 && (() => {
                          const wRate = parseFloat(editingTimecard.workPerDiem);
                          const wCount = editingTimecard.days.filter(d => d.perDiemWork).length;
                          return (<>
                            <div className="text-[9px] font-normal normal-case text-violet-400">{"$" + wRate.toLocaleString(undefined, { minimumFractionDigits: 2 }) + "/day"}</div>
                            {wCount > 0 && <div className="text-[9px] font-normal normal-case text-violet-500">{wCount + " day" + (wCount !== 1 ? "s" : "") + " = $" + (wRate * wCount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>}
                          </>);
                        })()}
                      </td>
                      {editingTimecard.days.map((d, i) => {
                        const isWeekend = i === 0 || i === 6;
                        return (
                          <td key={i} className={`px-1 py-1.5 border-r border-slate-100 last:border-r-0 text-center ${isWeekend ? "bg-amber-50/60" : ""}`}>
                            <input
                              type="checkbox"
                              checked={!!d.perDiemWork}
                              onChange={e => setEditingTimecard(p => ({ ...p, days: p.days.map((day, idx) => idx !== i ? day : { ...day, perDiemWork: e.target.checked, perDiemOff: e.target.checked ? false : day.perDiemOff }) }))}
                              className="w-4 h-4 rounded accent-violet-500 cursor-pointer"
                              title="Apply work day per diem to this day"
                            />
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="bg-teal-50 border-t border-teal-200">
                      <td className="px-3 py-1.5 text-[10px] font-bold text-teal-700 uppercase border-r border-slate-200 whitespace-nowrap">
                        Day Off Per Diem
                        {parseFloat(editingTimecard.daysOffPerDiem) > 0 && (() => {
                          const oRate = parseFloat(editingTimecard.daysOffPerDiem);
                          const oCount = editingTimecard.days.filter(d => d.perDiemOff).length;
                          return (<>
                            <div className="text-[9px] font-normal normal-case text-teal-400">{"$" + oRate.toLocaleString(undefined, { minimumFractionDigits: 2 }) + "/day"}</div>
                            {oCount > 0 && <div className="text-[9px] font-normal normal-case text-teal-600">{oCount + " day" + (oCount !== 1 ? "s" : "") + " = $" + (oRate * oCount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>}
                          </>);
                        })()}
                      </td>
                      {editingTimecard.days.map((d, i) => {
                        const isWeekend = i === 0 || i === 6;
                        return (
                          <td key={i} className={`px-1 py-1.5 border-r border-slate-100 last:border-r-0 text-center ${isWeekend ? "bg-amber-50/60" : ""}`}>
                            <input
                              type="checkbox"
                              checked={!!d.perDiemOff}
                              onChange={e => setEditingTimecard(p => ({ ...p, days: p.days.map((day, idx) => idx !== i ? day : { ...day, perDiemOff: e.target.checked, perDiemWork: e.target.checked ? false : day.perDiemWork }) }))}
                              className="w-4 h-4 rounded accent-teal-500 cursor-pointer"
                              title="Apply day off per diem to this day"
                            />
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="bg-emerald-50 border-t border-emerald-200">
                      <td className="px-3 py-1.5 text-[10px] font-bold text-emerald-700 uppercase border-r border-slate-200 whitespace-nowrap">Daily Total</td>
                      {(() => {
                        const sixthIdx = get6thDayIndex(editingTimecard.days);
                        const seventhIdx = get7thDayIndex(editingTimecard.days);
                        const rate = parseFloat(editingTimecard.rate) || 0;
                        const guarH = parseFloat(editingTimecard.guarHours) || 0;
                        const wPD = parseFloat(editingTimecard.workPerDiem) || 0;
                        const oPD = parseFloat(editingTimecard.daysOffPerDiem) || 0;
                        return editingTimecard.days.map((d, i) => {
                          const h = calcDayHours(d);
                          const paidH = h > 0 ? Math.max(h, guarH) : 0;
                          const ot = i === seventhIdx ? calcOTBreakdown7thDay(paidH) : i === sixthIdx ? calcOTBreakdown6thDay(paidH) : calcOTBreakdown(paidH);
                          const perDiem = (d.perDiemWork ? wPD : 0) + (d.perDiemOff ? oPD : 0);
                          const dayTotal = ot.hours1x * rate + ot.hours15x * rate * 1.5 + ot.hours2x * rate * 2 + (d.mealPenalty ? rate : 0) + perDiem;
                          const isWeekend = i === 0 || i === 6;
                          return (
                            <td key={i} className={`px-1 py-1.5 text-center border-r border-slate-100 last:border-r-0 ${isWeekend ? "bg-amber-50/60" : ""}`}>
                              {(paidH > 0 || perDiem > 0)
                                ? <span className="text-xs font-bold text-emerald-700">${dayTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                : <span className="text-slate-300 text-xs">—</span>}
                            </td>
                          );
                        });
                      })()}
                    </tr>
                    <tr className="bg-blue-600 border-t-2 border-blue-700">
                      <td className="px-3 py-2 text-[10px] font-bold text-blue-100 uppercase border-r border-blue-500">Total Hrs</td>
                      {(() => {
                        const sixthIdx = get6thDayIndex(editingTimecard.days);
                        const seventhIdx = get7thDayIndex(editingTimecard.days);
                        const guarH = parseFloat(editingTimecard.guarHours) || 0;
                        return editingTimecard.days.map((d, i) => {
                          const h = calcDayHours(d);
                          const paidH = h > 0 ? Math.max(h, guarH) : 0;
                          const is6th = i === sixthIdx;
                          const is7th = i === seventhIdx;
                          const ot = is7th ? calcOTBreakdown7thDay(paidH) : is6th ? calcOTBreakdown6thDay(paidH) : calcOTBreakdown(paidH);
                          const isWeekend = i === 0 || i === 6;
                          return (
                            <td key={i} className={`px-1 py-2 text-center border-r border-blue-500 last:border-r-0 ${isWeekend ? "bg-blue-700" : ""}`}>
                              <div className={`font-bold text-sm ${paidH > 0 ? "text-white" : "text-blue-400"}`}>{paidH > 0 ? paidH : "—"}</div>
                              {is7th && paidH > 0 && <div className="text-[9px] text-rose-300 font-bold">7th day</div>}
                              {is6th && paidH > 0 && <div className="text-[9px] text-cyan-300 font-bold">6th day</div>}
                              {ot.hours15x > 0 && <div className="text-[9px] text-amber-300 font-medium">{ot.hours15x}h @1.5×</div>}
                              {ot.hours2x > 0 && <div className="text-[9px] text-red-300 font-medium">{ot.hours2x}h @2×</div>}
                            </td>
                          );
                        });
                      })()}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <Button variant="outline" onClick={() => setEditingTimecard(null)}>Cancel</Button>
              <Button onClick={saveTimecardEdit} disabled={!editingTimecard.company || !editingTimecard.rate}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Client Manager Modal ── */}
      {showClientManager && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setShowClientManager(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <Briefcase size={17} className="text-blue-600" />
                <h2 className="font-bold text-slate-800 text-base">Manage Clients</h2>
              </div>
              <button onClick={() => setShowClientManager(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="px-5 py-4 space-y-2 max-h-72 overflow-y-auto">
              {clients.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">No saved clients yet. Add one below.</p>
              )}
              {clients.map(c => (
                <div key={c.id} className="flex items-start justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{c.name}</p>
                    {c.address && <p className="text-xs text-slate-500 truncate mt-0.5">{c.address}</p>}
                    {(c.city || c.state || c.zip) && <p className="text-xs text-slate-500 truncate">{[c.city, c.state, c.zip].filter(Boolean).join(", ")}</p>}
                    <div className="flex gap-3 mt-0.5">
                      {c.email && <p className="text-xs text-slate-400 truncate">{c.email}</p>}
                      {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                    </div>
                  </div>
                  <Button variant="danger" onClick={() => { if (window.confirm("Remove this client?")) setClients(prev => prev.filter(x => x.id !== c.id)); }} className="!p-1.5 shrink-0" title="Delete client">
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))}
            </div>

            <div className="px-5 pb-5 pt-3 border-t border-slate-200 space-y-3 bg-slate-50">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Add Client</p>
              <div className="grid grid-cols-2 gap-2">
                <Input value={newClient.name} onChange={e => setNewClient(p => ({ ...p, name: e.target.value }))} placeholder="Client / Company name *" />
                <Input value={newClient.address} onChange={e => setNewClient(p => ({ ...p, address: e.target.value }))} placeholder="Street address" />
                <Input value={newClient.city} onChange={e => setNewClient(p => ({ ...p, city: e.target.value }))} placeholder="City" />
                <Input value={newClient.state} onChange={e => setNewClient(p => ({ ...p, state: e.target.value }))} placeholder="State" />
                <Input value={newClient.zip} onChange={e => setNewClient(p => ({ ...p, zip: e.target.value }))} placeholder="Zip" />
                <Input value={newClient.email} onChange={e => setNewClient(p => ({ ...p, email: e.target.value }))} placeholder="Email" />
                <Input value={newClient.phone} onChange={e => setNewClient(p => ({ ...p, phone: e.target.value }))} placeholder="Phone" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowClientManager(false)}>Done</Button>
                <Button
                  disabled={!newClient.name.trim()}
                  onClick={() => {
                    if (!newClient.name.trim()) return;
                    setClients(prev => [...prev, { id: crypto.randomUUID(), ...newClient }]);
                    setNewClient({ name: "", address: "", city: "", state: "", zip: "", email: "", phone: "" });
                  }}
                >
                  <Plus size={14} className="mr-1" />Save Client
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoice Generator Modal ── */}
      {showInvoiceGenerator && invoiceForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => { setShowInvoiceGenerator(false); setEditingInvoiceId(null); }}>
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl my-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <FileText size={18} className="text-blue-600" />
                <h2 className="font-bold text-slate-800 text-base">{editingInvoiceId ? "Edit Invoice" : "Create Invoice"}</h2>
                {editingInvoiceId && <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">Editing</span>}
              </div>
              <button onClick={() => { setShowInvoiceGenerator(false); setEditingInvoiceId(null); }} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* YOUR INFO */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Your Info</p>
                <div className="grid grid-cols-2 gap-3">
                  {/* LOGO UPLOAD */}
                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Logo (optional)</label>
                    <div className="flex items-center gap-3">
                      {invoiceForm.logoDataUrl ? (
                        <>
                          <img src={invoiceForm.logoDataUrl} alt="Logo preview" className="h-12 max-w-[160px] object-contain border border-slate-200 rounded-lg p-1 bg-white" />
                          <Button variant="ghost" className="text-xs text-red-500 hover:text-red-700 h-8"
                            onClick={() => setInvoiceForm(p => ({ ...p, logoDataUrl: "" }))}>
                            Remove
                          </Button>
                        </>
                      ) : (
                        <label className="flex items-center gap-2 cursor-pointer border border-dashed border-slate-300 rounded-lg px-4 py-2.5 text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                          <UploadCloud size={14} />
                          Upload logo (PNG, JPG, SVG…)
                          <input type="file" accept="image/*" className="hidden" onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = ev => setInvoiceForm(p => ({ ...p, logoDataUrl: ev.target.result }));
                            reader.readAsDataURL(file);
                            e.target.value = "";
                          }} />
                        </label>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Name</label>
                    <Input value={invoiceForm.senderName} onChange={e => setInvoiceForm(p => ({ ...p, senderName: e.target.value }))} placeholder="Your full name" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Email</label>
                    <Input value={invoiceForm.senderEmail} onChange={e => setInvoiceForm(p => ({ ...p, senderEmail: e.target.value }))} placeholder="your@email.com" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Phone</label>
                    <Input value={invoiceForm.senderPhone} onChange={e => setInvoiceForm(p => ({ ...p, senderPhone: e.target.value }))} placeholder="(555) 000-0000" />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Street Address</label>
                    <Input value={invoiceForm.senderAddress} onChange={e => setInvoiceForm(p => ({ ...p, senderAddress: e.target.value }))} placeholder="123 Main St" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">City</label>
                    <Input value={invoiceForm.senderCity} onChange={e => setInvoiceForm(p => ({ ...p, senderCity: e.target.value }))} placeholder="Los Angeles" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">State</label>
                    <Input value={invoiceForm.senderState} onChange={e => setInvoiceForm(p => ({ ...p, senderState: e.target.value }))} placeholder="CA" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Zip</label>
                    <Input value={invoiceForm.senderZip} onChange={e => setInvoiceForm(p => ({ ...p, senderZip: e.target.value }))} placeholder="90001" />
                  </div>
                </div>
              </div>

              {/* INVOICE META */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Invoice Details</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Invoice #</label>
                    <Input value={invoiceForm.invoiceNumber} onChange={e => setInvoiceForm(p => ({ ...p, invoiceNumber: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
                    <Input type="date" value={invoiceForm.invoiceDate} onChange={e => {
                      const newDate = e.target.value;
                      const newDue = dueDateFromTerms(newDate, invoiceForm.paymentTerms);
                      setInvoiceForm(p => ({ ...p, invoiceDate: newDate, ...(newDue ? { dueDate: newDue } : {}) }));
                    }} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Payment Terms</label>
                    <select
                      value={invoiceForm.paymentTerms || "Net 30"}
                      onChange={e => {
                        const terms = e.target.value;
                        const newDue = dueDateFromTerms(invoiceForm.invoiceDate, terms);
                        setInvoiceForm(p => ({ ...p, paymentTerms: terms, ...(newDue ? { dueDate: newDue } : {}) }));
                      }}
                      className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                      {PAYMENT_TERMS.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Due Date</label>
                    <Input type="date" value={invoiceForm.dueDate} onChange={e => setInvoiceForm(p => ({ ...p, dueDate: e.target.value, paymentTerms: "Custom" }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Late Fee Type</label>
                    <select
                      value={invoiceForm.lateFeeType || "none"}
                      onChange={e => setInvoiceForm(p => ({ ...p, lateFeeType: e.target.value }))}
                      className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                      <option value="none">None</option>
                      <option value="flat">Flat fee ($)</option>
                      <option value="daily">Daily interest (%/day)</option>
                    </select>
                  </div>
                  {invoiceForm.lateFeeType && invoiceForm.lateFeeType !== "none" && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        {invoiceForm.lateFeeType === "flat" ? "Flat Fee Amount ($)" : "Daily Rate (%)"}
                      </label>
                      <Input type="number" value={invoiceForm.lateFeeRate} onChange={e => setInvoiceForm(p => ({ ...p, lateFeeRate: e.target.value }))}
                        placeholder={invoiceForm.lateFeeType === "flat" ? "e.g. 50" : "e.g. 0.1"} />
                    </div>
                  )}
                </div>
              </div>

              {/* CLIENT */}
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Client / Customer</p>
                  <Button variant="ghost" className="h-7 text-xs gap-1 text-blue-600" onClick={() => setShowClientManager(true)}>
                    <Briefcase size={12} />Manage Clients
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Select Saved Client</label>
                    <select
                      value=""
                      onChange={e => {
                        const c = clients.find(c => c.id === e.target.value);
                        if (c) setInvoiceForm(p => ({ ...p, clientName: c.name, clientAddress: c.address || "", clientCity: c.city || "", clientState: c.state || "", clientZip: c.zip || "" }));
                      }}
                      className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                      <option value="">— Pick a saved client —</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Job / Show</label>
                    <select value={invoiceForm.jobId} onChange={e => { const j = jobs.find(j => j.id === e.target.value); setInvoiceForm(p => ({ ...p, jobId: e.target.value, jobName: j ? j.name : "" })); }}
                      className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                      <option value="">— None —</option>
                      {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Client Name</label>
                    <Input value={invoiceForm.clientName} onChange={e => setInvoiceForm(p => ({ ...p, clientName: e.target.value }))} placeholder="Production Company" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Street Address</label>
                    <Input value={invoiceForm.clientAddress} onChange={e => setInvoiceForm(p => ({ ...p, clientAddress: e.target.value }))} placeholder="123 Main St" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">City</label>
                    <Input value={invoiceForm.clientCity} onChange={e => setInvoiceForm(p => ({ ...p, clientCity: e.target.value }))} placeholder="Los Angeles" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">State</label>
                    <Input value={invoiceForm.clientState} onChange={e => setInvoiceForm(p => ({ ...p, clientState: e.target.value }))} placeholder="CA" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Zip</label>
                    <Input value={invoiceForm.clientZip} onChange={e => setInvoiceForm(p => ({ ...p, clientZip: e.target.value }))} placeholder="90001" />
                  </div>
                </div>
              </div>

              {/* LINE ITEMS */}
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Line Items</p>
                  <Button variant="ghost" className="h-7 text-xs gap-1" onClick={() => setInvoiceForm(p => ({ ...p, lineItems: [...p.lineItems, { id: crypto.randomUUID(), description: "", qty: "1", rate: "", amount: 0 }] }))}>
                    <Plus size={12} />Add Row
                  </Button>
                </div>

                {/* Quick-add from package */}
                {kitPackages.length > 0 && (() => {
                  const selectedPkg = kitPackages.find(p => p.id === pkgQaId);
                  const pkgRate = selectedPkg
                    ? (pkgQaRateType === "daily" ? parseFloat(selectedPkg.dailyRate) || 0 : parseFloat(selectedPkg.weeklyRate) || 0)
                    : 0;
                  const pkgAmount = pkgRate * (parseFloat(pkgQaQty) || 0);
                  return (
                    <div className="mb-3 bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex flex-wrap items-end gap-2">
                      <div className="space-y-1 flex-1 min-w-36">
                        <label className="text-[10px] font-bold text-indigo-500 uppercase">Package</label>
                        <select
                          value={pkgQaId}
                          onChange={e => setPkgQaId(e.target.value)}
                          className="flex w-full rounded-lg border border-indigo-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400">
                          <option value="">— Select package —</option>
                          {kitPackages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-indigo-500 uppercase">Rate Type</label>
                        <div className="flex rounded-lg border border-indigo-200 overflow-hidden text-sm bg-white">
                          {["daily", "weekly"].map(rt => (
                            <button key={rt} onClick={() => setPkgQaRateType(rt)}
                              className={`px-3 py-1.5 font-semibold capitalize transition-colors ${pkgQaRateType === rt ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-indigo-50"}`}>
                              {rt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1 w-24">
                        <label className="text-[10px] font-bold text-indigo-500 uppercase">
                          {pkgQaRateType === "daily" ? "Days" : "Weeks"}
                        </label>
                        <Input type="number" min="1" value={pkgQaQty} onChange={e => setPkgQaQty(e.target.value)} className="text-center" />
                      </div>
                      {selectedPkg && (
                        <div className="w-full">
                          {(() => {
                            const pkgItems = purchases.filter(p => p.isKit && (selectedPkg.itemIds || []).includes(p.id));
                            const pkgItemNames = pkgItems.map(p => p.name).filter(Boolean);
                            return pkgItemNames.length > 0 ? (
                              <div className="mb-2 px-3 py-2 bg-white border border-indigo-200 rounded-lg">
                                <p className="text-[10px] font-bold text-indigo-500 uppercase mb-1">Includes</p>
                                <ul className="space-y-0.5">
                                  {pkgItemNames.map((n, i) => <li key={i} className="text-xs text-slate-600 flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-indigo-400 shrink-0"></span>{n}</li>)}
                                </ul>
                              </div>
                            ) : null;
                          })()}
                          <div className="flex items-center gap-3 mb-2">
                            <p className="text-xs text-indigo-600 font-semibold">
                              ${pkgRate.toLocaleString(undefined, { minimumFractionDigits: 2 })} × {pkgQaQty} = ${pkgAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                            <label className="flex items-center gap-1.5 text-xs text-indigo-700 font-semibold cursor-pointer select-none ml-auto">
                              <input type="checkbox" checked={pkgQaExpand} onChange={e => setPkgQaExpand(e.target.checked)}
                                className="rounded border-indigo-300 accent-indigo-600" />
                              List each item as separate line
                            </label>
                          </div>
                        </div>
                      )}
                      <Button
                        disabled={!selectedPkg || !pkgQaQty || pkgRate === 0}
                        onClick={() => {
                          const qty = pkgQaQty;
                          const rate = pkgRate;
                          const rateLabel = pkgQaRateType.charAt(0).toUpperCase() + pkgQaRateType.slice(1);
                          let newRows;
                          if (pkgQaExpand) {
                            // package as one priced line, then each item at $0
                            const pkgItems = purchases.filter(p => p.isKit && (selectedPkg.itemIds || []).includes(p.id));
                            newRows = [
                              { id: crypto.randomUUID(), description: `${selectedPkg.name} — ${rateLabel} Rental`, qty, rate: String(rate), amount: rate * (parseFloat(qty) || 0) },
                              ...pkgItems.map(item => ({
                                id: crypto.randomUUID(),
                                description: `  • ${item.name}`,
                                qty: "",
                                rate: "",
                                amount: 0,
                              })),
                            ];
                          } else {
                            newRows = [{ id: crypto.randomUUID(), description: `${selectedPkg.name} — ${rateLabel} Rental`, qty, rate: String(rate), amount: rate * (parseFloat(qty) || 0) }];
                          }
                          setInvoiceForm(p => ({ ...p, lineItems: [...p.lineItems, ...newRows] }));
                          setPkgQaId("");
                          setPkgQaQty("1");
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white h-9"
                      >
                        <Plus size={13} className="mr-1" />Add to Invoice
                      </Button>
                    </div>
                  );
                })()} 

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Description</th>
                        <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase text-center w-24">Qty / Hrs</th>
                        <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase text-right w-28">Rate ($)</th>
                        <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase text-right w-32">Amount</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceForm.lineItems.map(li => (
                        <tr key={li.id} className="border-b border-slate-100 last:border-b-0">
                          <td className="px-2 py-1">
                            <Input value={li.description} onChange={e => updateLineItem(li.id, "description", e.target.value)} placeholder="Services rendered…" className="border-0 shadow-none focus:ring-0 bg-transparent px-1 py-1" />
                          </td>
                          <td className="px-2 py-1">
                            <Input type="number" value={li.qty} onChange={e => updateLineItem(li.id, "qty", e.target.value)} className="border-0 shadow-none focus:ring-0 bg-transparent text-center px-1 py-1" />
                          </td>
                          <td className="px-2 py-1">
                            <Input type="number" value={li.rate} onChange={e => updateLineItem(li.id, "rate", e.target.value)} placeholder="0.00" className="border-0 shadow-none focus:ring-0 bg-transparent text-right px-1 py-1" />
                          </td>
                          <td className="px-3 py-1 text-right font-semibold text-slate-700 text-sm">
                            {(li.amount || 0) > 0 ? `$${li.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : <span className="text-slate-300">&mdash;</span>}
                          </td>
                          <td className="px-1 py-1 text-center">
                            {invoiceForm.lineItems.length > 1 && (
                              <button onClick={() => setInvoiceForm(p => ({ ...p, lineItems: p.lineItems.filter(x => x.id !== li.id) }))} className="text-slate-300 hover:text-red-400 transition-colors">
                                <X size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Subtotal / Tax / Total */}
                <div className="mt-3 flex justify-end">
                  <div className="w-60 space-y-1.5 text-sm">
                    <div className="flex justify-between text-slate-500">
                      <span>Subtotal</span>
                      <span>${invoiceForm.lineItems.reduce((a, li) => a + (li.amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 gap-2">
                      <span>Tax</span>
                      <div className="flex items-center gap-1">
                        <Input type="number" value={invoiceForm.taxRate} onChange={e => setInvoiceForm(p => ({ ...p, taxRate: e.target.value }))} placeholder="0" className="w-16 h-7 text-right text-xs py-1" />
                        <span className="text-xs text-slate-400">%</span>
                      </div>
                    </div>
                    <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-1.5">
                      <span>Total</span>
                      <span>${(invoiceForm.lineItems.reduce((a, li) => a + (li.amount || 0), 0) * (1 + (parseFloat(invoiceForm.taxRate) || 0) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* NOTES */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Notes / Comments</p>
                <textarea value={invoiceForm.notes} onChange={e => setInvoiceForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Optional notes, project details, etc."
                  rows={2}
                  className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" />
              </div>

              {/* PAYMENT INFO */}
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center flex-wrap gap-2 mb-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Payment Methods</p>
                  <p className="text-[10px] text-slate-400 italic">Select all that apply — each will appear on the invoice</p>
                  {["ACH", "Check", "PayPal", "Zelle", "Venmo"].map(m => {
                    const active = (invoiceForm.paymentMethods || []).includes(m);
                    return (
                      <button key={m} onClick={() => setInvoiceForm(p => {
                        const methods = p.paymentMethods || [];
                        return { ...p, paymentMethods: active ? methods.filter(x => x !== m) : [...methods, m] };
                      })}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                          active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-300 hover:border-blue-400 hover:text-blue-600"
                        }`}>{active ? "✓ " : ""}{m}</button>
                    );
                  })}
                </div>
                {(invoiceForm.paymentMethods || []).length === 0 && (
                  <p className="text-xs text-amber-600 mb-3">⚠ Select at least one payment method to display on the invoice.</p>
                )}
                <div className="space-y-3">
                  {(invoiceForm.paymentMethods || []).map(m => (
                    <div key={m} className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">{m === "ACH" ? "ACH / Wire Transfer" : m}</p>
                      {m === "ACH" && (
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Bank Name</label>
                            <Input value={invoiceForm.bankName} onChange={e => setInvoiceForm(p => ({ ...p, bankName: e.target.value }))} placeholder="Chase, Wells Fargo…" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Routing #</label>
                            <Input value={invoiceForm.routingNumber} onChange={e => setInvoiceForm(p => ({ ...p, routingNumber: e.target.value.replace(/\D/g, "").slice(0, 9) }))} placeholder="123456789" className="font-mono" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Account #</label>
                            <Input value={invoiceForm.accountNumber} onChange={e => setInvoiceForm(p => ({ ...p, accountNumber: e.target.value.replace(/\D/g, "") }))} placeholder="Account number" className="font-mono" />
                          </div>
                        </div>
                      )}
                      {m === "PayPal" && (
                        <div className="space-y-1 max-w-sm">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">PayPal Email / Username</label>
                          <Input value={invoiceForm.paypalHandle} onChange={e => setInvoiceForm(p => ({ ...p, paypalHandle: e.target.value }))} placeholder="you@paypal.com or @username" />
                        </div>
                      )}
                      {m === "Zelle" && (
                        <div className="space-y-1 max-w-sm">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Zelle Phone / Email</label>
                          <Input value={invoiceForm.zelleHandle} onChange={e => setInvoiceForm(p => ({ ...p, zelleHandle: e.target.value }))} placeholder="(555) 000-0000 or you@email.com" />
                        </div>
                      )}
                      {m === "Venmo" && (
                        <div className="space-y-1 max-w-sm">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Venmo Username</label>
                          <Input value={invoiceForm.venmoHandle} onChange={e => setInvoiceForm(p => ({ ...p, venmoHandle: e.target.value }))} placeholder="@your-venmo" />
                        </div>
                      )}
                      {m === "Check" && (
                        <div className="space-y-1 max-w-sm">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Make Check Payable To</label>
                          <Input value={invoiceForm.checkPayableTo} onChange={e => setInvoiceForm(p => ({ ...p, checkPayableTo: e.target.value }))} placeholder="Your name or business name" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="px-6 pb-5 pt-4 flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <Button variant="outline" onClick={() => { setShowInvoiceGenerator(false); setEditingInvoiceId(null); }}>Cancel</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => downloadInvoicePDF(invoiceForm, false)} className="gap-1.5">
                  <Download size={15} />Preview PDF
                </Button>
                <Button onClick={() => { downloadInvoicePDF(invoiceForm, true); setShowInvoiceGenerator(false); setActiveTab("invoices"); }} className="gap-1.5">
                  <Download size={15} />{editingInvoiceId ? "Save & Update" : "Save & Download"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10 dark:bg-slate-800 dark:border-slate-700">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Have I Been Paid?" className="w-32 h-32 object-contain rounded-lg" />
            <span className="font-bold text-lg hidden sm:inline-block">Have I Been Paid?</span>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === "invoices" && (
              <div className="relative">
                <input type="file" multiple accept="image/*,.pdf" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isUploading || !driveConnected} />
                <Button disabled={isUploading || !driveConnected} title={!driveConnected ? "Connect Drive to enable OCR upload" : undefined} className="shadow-md">
                  {isUploading ? <Loader2 className="animate-spin mr-2" size={18} /> : <UploadCloud className="mr-2" size={18} />}
                  {isUploading ? (uploadStatus || "Processing...") : "Upload Invoice"}
                </Button>
              </div>
            )}
            {activeTab === "timecards" && (
              <div className="relative">
                <input type="file" multiple accept="image/*,.pdf" onChange={handleTimecardUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isUploadingTimecard || !driveConnected} />
                <Button disabled={isUploadingTimecard || !driveConnected} title={!driveConnected ? "Connect Drive to enable OCR upload" : undefined} className="shadow-md">
                  {isUploadingTimecard ? <Loader2 className="animate-spin mr-2" size={18} /> : <UploadCloud className="mr-2" size={18} />}
                  {isUploadingTimecard ? (uploadTimecardStatus || "Processing...") : "Upload Timecard"}
                </Button>
              </div>
            )}
            {/* Drive sync area */}
            {driveConnected ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Online
                  </span>
                  {lastSynced ? <span className="text-[10px] text-slate-400">Synced {lastSynced}</span> : <span className="text-[10px] text-slate-400">Not yet synced</span>}
                </div>
                <Button onClick={syncToDrive} disabled={isSyncing} variant="outline" className="text-xs h-8 gap-1.5">
                  {isSyncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  {isSyncing ? "Syncing..." : "Sync"}
                </Button>
                <Button onClick={exportData} variant="ghost" className="text-xs h-8 gap-1.5" title="Download backup JSON">
                  <Download size={13} /> Backup
                </Button>
                <Button onClick={() => relinkInputRef.current?.click()} variant="ghost" className="text-xs h-8 gap-1.5" title="Restore from backup file">
                  <RefreshCw size={13} /> Relink
                </Button>
                <Button variant="ghost" onClick={() => setShowDriveSetup(true)} className="!px-2" title={`Drive settings (${driveEmail})`}><LogOut size={15} /></Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Button onClick={exportData} variant="ghost" className="text-xs h-8 gap-1.5" title="Download backup JSON">
                  <Download size={13} /> Backup
                </Button>
                <Button onClick={() => relinkInputRef.current?.click()} variant="ghost" className="text-xs h-8 gap-1.5" title="Restore from backup file">
                  <RefreshCw size={13} /> Relink
                </Button>
                <Button onClick={() => setShowDriveSetup(true)} variant="outline" className="text-xs h-8 gap-1.5">
                  <UploadCloud size={13} /> Setup Drive
                </Button>
              </div>
            )}
            {/* Dark / Light mode toggle */}
            <button
              onClick={toggleDarkMode}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              className="ml-1 p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Drive not connected hint */}
        {!driveConnected && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 flex items-center justify-between gap-3 text-blue-700 text-sm">
            <div className="flex items-center gap-2.5">
              <CloudOff size={16} className="shrink-0" />
              <span><strong>Working offline.</strong> Your data saves automatically to this browser. Download a backup or restore from a previous one.</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button onClick={exportData} variant="outline" className="text-xs h-8 border-blue-300 text-blue-700 hover:bg-blue-100 gap-1.5">
                <Download size={13} /> Backup
              </Button>
              <Button onClick={() => relinkInputRef.current?.click()} variant="outline" className="text-xs h-8 border-blue-300 text-blue-700 hover:bg-blue-100 gap-1.5">
                <RefreshCw size={13} /> Relink
              </Button>
              <Button onClick={() => setShowDriveSetup(true)} variant="outline" className="text-xs h-8 border-blue-300 text-blue-700 hover:bg-blue-100">
                Setup Drive
              </Button>
            </div>
          </div>
        )}

        {/* Drive upload error banner */}
        {uploadError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-start gap-3 text-red-700 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Drive upload failed</p>
              <p className="text-red-600 mt-0.5">{uploadError}</p>
              <button onClick={() => setShowDriveSetup(true)} className="mt-2 underline font-medium">Check service account setup →</button>
            </div>
            <button onClick={() => setUploadError("")} className="ml-auto shrink-0"><X size={16} /></button>
          </div>
        )}

        {/* Year selector — hidden on Kit tab */}
        <div className={`flex items-center gap-2 flex-wrap ${activeTab === "kit" || activeTab === "calendar" || activeTab === "tax" ? "hidden" : ""}`}>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Year</span>
          {allYears.map(yr => (
            <button key={yr} onClick={() => setSelectedYear(yr)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${
                selectedYear === yr
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
              }`}>
              {yr}{yr === currentYear ? " ✦" : ""}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            <button onClick={() => { setActiveTab("invoices"); setSearchQuery(""); }} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "invoices" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              <FileText size={14} className="inline mr-1.5 -mt-0.5" />Invoices
            </button>
            <button onClick={() => { setActiveTab("timecards"); setSearchQuery(""); }} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "timecards" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              <Clock size={14} className="inline mr-1.5 -mt-0.5" />Timecards
            </button>
            <button onClick={() => { setActiveTab("purchases"); setSearchQuery(""); }} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "purchases" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              <ShoppingCart size={14} className="inline mr-1.5 -mt-0.5" />Purchases
            </button>
            <button onClick={() => { setActiveTab("kit"); setSearchQuery(""); }} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "kit" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              <Layers size={14} className="inline mr-1.5 -mt-0.5" />Kit / Packages
            </button>
            <button onClick={() => { setActiveTab("mileage"); setSearchQuery(""); }} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "mileage" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              <MapPin size={14} className="inline mr-1.5 -mt-0.5" />Mileage
            </button>
            <button onClick={() => { setActiveTab("calendar"); setSearchQuery(""); }} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "calendar" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              <Calendar size={14} className="inline mr-1.5 -mt-0.5" />Calendar
            </button>
            <button onClick={() => { setActiveTab("tax"); setSearchQuery(""); }} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "tax" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              <Calculator size={14} className="inline mr-1.5 -mt-0.5" />Tax Est.
            </button>
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearchFocused(true); }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              placeholder={`Search ${activeTab}…`}
              className="w-full pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setSearchFocused(false); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10">
                <X size={13} />
              </button>
            )}
            {/* Suggestions dropdown */}
            {searchFocused && searchSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto">
                {searchSuggestions.map((result, i) => (
                  <button
                    key={result.id}
                    onMouseDown={() => navigateToResult(result)}
                    className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-slate-50 transition-colors ${i > 0 ? "border-t border-slate-100" : ""}`}
                  >
                    <span className={`mt-0.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${result.badgeColor}`}>{result.badge}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{result.title}</div>
                      <div className="text-[11px] text-slate-400 truncate">{result.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searchFocused && sq.length > 0 && searchSuggestions.length === 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 px-4 py-3 text-sm text-slate-400">
                No results for &ldquo;{searchQuery}&rdquo;
              </div>
            )}
          </div>
        </div>

        {/* ── INVOICES ── */}
        {activeTab === "invoices" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="p-6 bg-blue-50 border-blue-200">
                <p className="text-blue-700 text-sm font-medium">Total Billed</p>
                <h2 className="text-3xl font-bold mt-1 text-blue-700">${totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
              </Card>
              <Card className="p-6">
                <p className="text-slate-500 text-sm font-medium">Received</p>
                <h2 className="text-3xl font-bold mt-1 text-emerald-600">${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
              </Card>
              <Card className="p-6">
                <p className="text-slate-500 text-sm font-medium">Outstanding</p>
                <h2 className={`text-3xl font-bold mt-1 ${totalOutstanding > 0 ? "text-red-500" : "text-slate-400"}`}>${totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
              </Card>
              <Card className="p-6">
                <p className="text-slate-500 text-sm font-medium">Est. Taxes (25%)</p>
                <h2 className="text-3xl font-bold mt-1 text-amber-600">${(totalBilled * TAX_RATE).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
              </Card>
            </div>

            {/* YTD Summary card */}
            {(() => {
              const ytdYear = new Date().getFullYear();
              const ytdInvoices = invoices.filter(i => { try { return new Date(i.date + "T12:00").getFullYear() === ytdYear; } catch { return false; } });
              const ytdTimecards = timecards.filter(t => { try { return new Date(t.date + "T12:00").getFullYear() === ytdYear; } catch { return false; } });
              const ytdBilled = ytdInvoices.reduce((a, i) => a + (parseFloat(i.amount) || 0), 0);
              const ytdReceived = ytdInvoices.reduce((a, i) => {
                const s = computeInvoiceStatus(i);
                if (s === "Paid") return a + (parseFloat(i.amount) || 0);
                if (s === "Partially Paid") return a + (parseFloat(i.amountReceived) || 0);
                return a;
              }, 0);
              const ytdOutstanding = ytdBilled - ytdReceived;
              const ytdEarned = ytdTimecards.reduce((a, t) => a + (parseFloat(t.total) || 0), 0);
              const ytdEstTax = ytdReceived * TAX_RATE;
              return (
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-4 text-white">
                  <p className="text-xs font-bold text-blue-200 uppercase tracking-wider mb-3">{ytdYear} Year-to-Date</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-blue-200 text-xs">TC Earnings</p>
                      <p className="text-xl font-bold">${ytdEarned.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                    </div>
                    <div>
                      <p className="text-blue-200 text-xs">Inv. Received</p>
                      <p className="text-xl font-bold">${ytdReceived.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                    </div>
                    <div>
                      <p className="text-blue-200 text-xs">Outstanding</p>
                      <p className="text-xl font-bold">${ytdOutstanding.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                    </div>
                    <div>
                      <p className="text-blue-200 text-xs">Est. Tax (25%)</p>
                      <p className="text-xl font-bold text-amber-300">${ytdEstTax.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Overdue / due-soon notification banners */}
            {(() => {
              const today = new Date(); today.setHours(0,0,0,0);
              const unpaid = invoices.filter(i => { const s = computeInvoiceStatus(i); return s !== "Paid"; });
              const getDue = i => { const d = new Date(i.dueDate || (() => { const x = new Date(i.date); x.setDate(x.getDate() + 30); return x.toISOString().split("T")[0]; })()); d.setHours(0,0,0,0); return d; };
              const overdue = unpaid.filter(i => getDue(i) < today);
              const dueSoon = unpaid.filter(i => { const diff = Math.round((getDue(i) - today) / 86400000); return diff >= 0 && diff <= 7; });
              if (overdue.length === 0 && dueSoon.length === 0) return null;
              return (
                <div className="space-y-2">
                  {overdue.length > 0 && (
                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                      <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-red-700">{overdue.length} overdue invoice{overdue.length !== 1 ? "s" : ""}</p>
                        <p className="text-xs text-red-500 mt-0.5 truncate">{overdue.map(i => i.company || "Unnamed").join(", ")}</p>
                      </div>
                      <span className="text-sm font-bold text-red-600 shrink-0">${overdue.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {dueSoon.length > 0 && (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <CalendarClock size={16} className="text-amber-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-amber-700">{dueSoon.length} invoice{dueSoon.length !== 1 ? "s" : ""} due within 7 days</p>
                        <p className="text-xs text-amber-500 mt-0.5 truncate">{dueSoon.map(i => i.company || "Unnamed").join(", ")}</p>
                      </div>
                      <span className="text-sm font-bold text-amber-600 shrink-0">${dueSoon.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Invoice aging report */}
            {(() => {
              const today = new Date(); today.setHours(0,0,0,0);
              const unpaid = invoices.filter(i => { const s = computeInvoiceStatus(i); return s !== "Paid"; });
              const getDue = i => { const d = new Date(i.dueDate || (() => { const x = new Date(i.date); x.setDate(x.getDate() + 30); return x.toISOString().split("T")[0]; })()); d.setHours(0,0,0,0); return d; };
              const buckets = [
                { label: "Current", range: [null, 0], color: "text-emerald-600 bg-emerald-50", border: "border-emerald-200" },
                { label: "1–30 days", range: [1, 30], color: "text-amber-600 bg-amber-50", border: "border-amber-200" },
                { label: "31–60 days", range: [31, 60], color: "text-orange-600 bg-orange-50", border: "border-orange-200" },
                { label: "61–90 days", range: [61, 90], color: "text-red-500 bg-red-50", border: "border-red-200" },
                { label: "90+ days", range: [91, null], color: "text-red-700 bg-red-100", border: "border-red-300" },
              ];
              const bucketData = buckets.map(b => {
                const items = unpaid.filter(i => {
                  const diff = Math.round((today - getDue(i)) / 86400000);
                  if (b.range[0] === null) return diff <= 0;
                  if (b.range[1] === null) return diff >= b.range[0];
                  return diff >= b.range[0] && diff <= b.range[1];
                });
                const total = items.reduce((a, i) => a + Math.max(0, (parseFloat(i.amount) || 0) - (parseFloat(i.amountReceived) || 0)), 0);
                return { ...b, count: items.length, total };
              });
              if (unpaid.length === 0) return null;
              return (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Accounts Receivable Aging</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {bucketData.map(b => (
                      <div key={b.label} className={`rounded-lg border p-3 ${b.border} ${b.color}`}>
                        <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{b.label}</p>
                        <p className="text-lg font-bold mt-0.5">${b.total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                        <p className="text-[10px] opacity-60">{b.count} invoice{b.count !== 1 ? "s" : ""}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Job selector for upcoming upload */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upload to job</span>
              <select value={uploadJobId} onChange={e => setUploadJobId(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                <option value="">— Unassigned —</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>

            {/* Jobs list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Invoices — {selectedYear}</h3>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => relinkInputRef.current?.click()} className="h-8 text-xs gap-1.5 text-slate-500" title="Restore data from backup file">
                    <RefreshCw size={13} /> Restore
                  </Button>
                  <Button variant="outline" onClick={openInvoiceGenerator} className="h-8 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50">
                    <FileText size={13} />Create Invoice
                  </Button>
                  {showNewJobForm ? (
                    <form onSubmit={e => { e.preventDefault(); if (newJobName.trim()) { addJob(newJobName); setNewJobName(""); setShowNewJobForm(false); } }} className="flex gap-2">
                      <Input value={newJobName} onChange={e => setNewJobName(e.target.value)} placeholder="Job name" className="w-48 h-8 text-sm" autoFocus />
                      <Button type="submit" className="h-8 text-xs px-3">Save</Button>
                      <Button type="button" variant="ghost" onClick={() => { setShowNewJobForm(false); setNewJobName(""); }} className="h-8 text-xs px-2">Cancel</Button>
                    </form>
                  ) : (
                    <Button variant="outline" onClick={() => setShowNewJobForm(true)} className="h-8 text-xs"><Plus size={13} className="mr-1" />New Job</Button>
                  )}
                  <Button variant="outline" onClick={() => {
                    const header = ["Invoice #", "Date", "Due Date", "Company", "Job", "Amount", "Received", "Payment Date", "Payment Method", "Status"];
                    const rows = filteredInvoices.map(i => [i.invoiceNumber || "", i.date || "", i.dueDate || "", i.company || "", i.jobId ? (jobs.find(j => j.id === i.jobId)?.name || i.jobId) : "", i.amount || 0, i.amountReceived || 0, i.paymentDate || "", i.paymentMethod || "", computeInvoiceStatus(i)]);
                    downloadCSV([header, ...rows], `invoices_${selectedYear}.csv`);
                  }} className="h-8 text-xs gap-1.5"><FileDown size={13} />CSV</Button>
                </div>
              </div>

              {/* Group invoices by job */}
              {(() => {
                const jobGroups = [
                  ...jobs.map(j => ({ ...j, items: filteredInvoices.filter(i => i.jobId === j.id) })),
                  { id: "", name: "Unassigned", items: filteredInvoices.filter(i => !i.jobId || !jobs.find(j => j.id === i.jobId)) },
                ].filter(g => sq ? g.items.length > 0 : (g.items.length > 0 || g.id !== ""));

                if (jobGroups.every(g => g.items.length === 0)) {
                  return (
                    <div className="py-20 text-center bg-white border-2 border-dashed border-slate-200 rounded-2xl">
                      <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300"><UploadCloud size={32} /></div>
                      <h4 className="text-slate-900 font-semibold">{sq ? `No invoices match "${sq}"` : `No invoices for ${selectedYear}`}</h4>
                      <p className="text-slate-500 text-sm">{sq ? "Try a different search term." : (selectedYear === currentYear ? "Upload a PDF or image — data will be read automatically." : "No invoices were recorded for this year.")}</p>
                    </div>
                  );
                }

                return jobGroups.map(group => {
                  if (group.items.length === 0) return null;
                  const isExpanded = sq || group.id === "" ? true : expandedJobs.has(group.id);
                  const groupBilled = group.items.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
                  const groupPaid = group.items.reduce((a, b) => {
                    const s = computeInvoiceStatus(b);
                    if (s === "Paid") return a + (parseFloat(b.amount) || 0);
                    if (s === "Partially Paid") return a + (parseFloat(b.amountReceived) || 0);
                    return a;
                  }, 0);
                  return (
                    <div key={group.id || "unassigned"} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 cursor-pointer select-none"
                        onClick={() => group.id && toggleJobExpanded(group.id)}>
                        <div className="flex items-center gap-2">
                          {group.id ? (
                            isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />
                          ) : <span className="w-4" />}
                          <Briefcase size={15} className="text-slate-400" />
                          <span className="font-semibold text-slate-800 text-sm">{group.name}</span>
                          <span className="text-xs text-slate-400">({group.items.length} invoice{group.items.length !== 1 ? "s" : ""})</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-medium">
                          <span className="text-slate-500">Billed <span className="text-slate-800 font-bold">${groupBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
                          <span className="text-emerald-600">Paid <span className="font-bold">${groupPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
                          {group.id && <Button variant="danger" onClick={e => { e.stopPropagation(); deleteJob(group.id); }} className="!p-1 ml-1" title="Delete job"><Trash2 size={13} /></Button>}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="p-4">
                          {group.items.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-6">No invoices in this job yet. Select it in "Upload to job" then upload.</p>
                          ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                              {group.items.map((item) => {
                                const idx = invoices.findIndex(i => i.id === item.id);
                                const effectiveStatus = computeInvoiceStatus(item);
                                const lateFee = calcLateFee(item);
                                const amountReceived = parseFloat(item.amountReceived) || 0;
                                const amountOwed = Math.max(0, (parseFloat(item.amount) || 0) - amountReceived);
                                const statusBadgeClass = effectiveStatus === "Paid"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : effectiveStatus === "Partially Paid"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-amber-100 text-amber-700";
                                return (<Card key={item.id} id={item.id} className={`transition-all flex flex-col ${item.locked ? "border-amber-200 bg-amber-50/20" : "hover:border-blue-200"} ${highlightedId === item.id ? "ring-2 ring-blue-500 border-blue-400" : ""}`}>
                                  <div className="p-5 flex-1 space-y-4">
                                    <div className="flex justify-between items-start">
                                      <div className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${statusBadgeClass}`}>{effectiveStatus}</div>
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => { const n = [...invoices]; n[idx] = { ...n[idx], locked: !n[idx].locked }; setInvoices(n); }}
                                          className={`p-1.5 rounded-lg transition-colors ${item.locked ? "text-amber-600 bg-amber-100 hover:bg-amber-200" : "text-slate-300 hover:text-slate-500 hover:bg-slate-100"}`}
                                          title={item.locked ? "Unlock entry to edit" : "Lock entry to prevent edits"}>
                                          {item.locked ? <Lock size={13} /> : <LockOpen size={13} />}
                                        </button>
                                        <select value={item.jobId || ""} onChange={e => { const n = [...invoices]; n[idx] = { ...n[idx], jobId: e.target.value }; setInvoices(n); }}
                                          disabled={!!item.locked}
                                          className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-500 focus:outline-none max-w-[100px] disabled:opacity-50 disabled:cursor-not-allowed" title="Move to job">
                                          <option value="">Unassigned</option>
                                          {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                                        </select>
                                        <Button variant="danger" onClick={() => deleteInvoice(item.id)} className="!p-1.5"><Trash2 size={14} /></Button>
                                        <button
                                          onClick={() => duplicateInvoice(item)}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                          title="Duplicate invoice with today's date &amp; new number">
                                          <Copy size={13} />
                                        </button>
                                      </div>
                                    </div>
                                    {item.invoiceNumber && <p className="text-[11px] text-slate-400 font-mono tracking-wide -mt-2">#{item.invoiceNumber}</p>}
                                    {effectiveStatus !== "Paid" && (() => {
                                      const today = new Date(); today.setHours(0,0,0,0);
                                      const defaultDue = item.dueDate || (() => { const d = new Date(item.date); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; })();
                                      const due = new Date(defaultDue); due.setHours(0,0,0,0);
                                      const diff = Math.round((due - today) / 86400000);
                                      if (diff < 0) return <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-100 text-red-700 text-[11px] font-bold w-fit"><AlertCircle size={12} />{Math.abs(diff)}d overdue{lateFee > 0 ? ` · +$${lateFee.toLocaleString(undefined,{minimumFractionDigits:2})} late fee` : ""}</div>;
                                      if (diff <= 7) return <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 text-[11px] font-bold w-fit"><CalendarClock size={12} />Due in {diff}d</div>;
                                      return <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-500 text-[11px] w-fit"><CalendarClock size={12} />Due in {diff}d</div>;
                                    })()}
                                    <div className="space-y-3">
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Client / Company</label>
                                        {clients.length > 0 && !item.locked && (
                                          <select value="" onChange={e => { if (e.target.value) { const n = [...invoices]; n[idx] = { ...n[idx], company: e.target.value }; setInvoices(n); } }}
                                            className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mb-1">
                                            <option value="">— Saved client —</option>
                                            {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                          </select>
                                        )}
                                        <Input value={item.company} placeholder="Click to add company name" disabled={!!item.locked} onChange={e => { const n = [...invoices]; n[idx] = { ...n[idx], company: e.target.value }; setInvoices(n); }} />
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-400 uppercase">Amount ($)</label>
                                          <Input type="number" value={item.amount} disabled={!!item.locked} onChange={e => { const n = [...invoices]; n[idx] = { ...n[idx], amount: e.target.value }; setInvoices(n); }} />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
                                          <Input type="date" value={item.date} disabled={!!item.locked} onChange={e => { const n = [...invoices]; n[idx] = { ...n[idx], date: e.target.value }; setInvoices(n); }} />
                                        </div>
                                      </div>
                                      {/* Payment Terms + Due Date */}
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-400 uppercase">Payment Terms</label>
                                          <select
                                            value={item.paymentTerms || "Net 30"}
                                            disabled={!!item.locked}
                                            onChange={e => {
                                              const terms = e.target.value;
                                              const newDue = dueDateFromTerms(item.date, terms);
                                              const n = [...invoices];
                                              n[idx] = { ...n[idx], paymentTerms: terms, ...(newDue ? { dueDate: newDue } : {}) };
                                              setInvoices(n);
                                            }}
                                            className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50">
                                            {PAYMENT_TERMS.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
                                          </select>
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><CalendarClock size={10} />Due Date</label>
                                          <Input type="date" value={item.dueDate || (() => { const d = new Date(item.date); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; })()} disabled={!!item.locked} onChange={e => { const n = [...invoices]; n[idx] = { ...n[idx], dueDate: e.target.value, paymentTerms: "Custom" }; setInvoices(n); }} />
                                        </div>
                                      </div>
                                      {/* Late Fee */}
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Late Fee</label>
                                        <div className="flex gap-2">
                                          <select
                                            value={item.lateFeeType || "none"}
                                            disabled={!!item.locked}
                                            onChange={e => { const n = [...invoices]; n[idx] = { ...n[idx], lateFeeType: e.target.value }; setInvoices(n); }}
                                            className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50">
                                            <option value="none">None</option>
                                            <option value="flat">Flat fee ($)</option>
                                            <option value="daily">Daily interest (%/day)</option>
                                          </select>
                                          {item.lateFeeType && item.lateFeeType !== "none" && (
                                            <Input
                                              type="number"
                                              value={item.lateFeeRate || ""}
                                              disabled={!!item.locked}
                                              placeholder={item.lateFeeType === "flat" ? "e.g. 50" : "e.g. 0.1"}
                                              onChange={e => { const n = [...invoices]; n[idx] = { ...n[idx], lateFeeRate: e.target.value }; setInvoices(n); }}
                                              className="flex-1"
                                            />
                                          )}
                                        </div>
                                        {lateFee > 0 && (
                                          <p className="text-[11px] text-red-600 font-semibold">
                                            Current late fee: ${lateFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                          </p>
                                        )}
                                      </div>
                                      {/* Payment History */}
                                      {(() => {
                                        const pmts = item.payments || [];
                                        const ML = { ach: "ACH/Wire", check: "Check", cash: "Cash", paypal: "PayPal", zelle: "Zelle", venmo: "Venmo", other: "Other" };
                                        return (
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><CreditCard size={10} />Payment History</label>
                                              {amountReceived > 0 && <span className="text-[10px] text-slate-400">${amountReceived.toLocaleString(undefined,{minimumFractionDigits:2})} of ${(parseFloat(item.amount)||0).toLocaleString(undefined,{minimumFractionDigits:2})}</span>}
                                            </div>
                                            {pmts.length > 0 ? (
                                              <div className="space-y-1">
                                                {pmts.map(pmt => (
                                                  <div key={pmt.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs">
                                                    <span className="font-mono text-slate-500 shrink-0">{pmt.date}</span>
                                                    <span className="font-bold text-emerald-700 flex-1">${(parseFloat(pmt.amount)||0).toLocaleString(undefined,{minimumFractionDigits:2})}</span>
                                                    {pmt.method && <span className="text-[9px] bg-emerald-100 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">{ML[pmt.method]||pmt.method}</span>}
                                                    {!item.locked && (
                                                      <button onClick={() => {
                                                        const newPmts = pmts.filter(p => p.id !== pmt.id);
                                                        const newTotal = newPmts.reduce((a,p) => a+(parseFloat(p.amount)||0), 0);
                                                        const n = [...invoices]; n[idx] = { ...n[idx], payments: newPmts, amountReceived: newTotal, status: newTotal <= 0 ? "Unpaid" : newTotal >= (parseFloat(item.amount)||0) ? "Paid" : "Partially Paid" }; setInvoices(n);
                                                      }} className="text-slate-300 hover:text-red-400 transition-colors shrink-0" title="Remove payment"><Trash2 size={11} /></button>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            ) : parseFloat(item.amountReceived) > 0 ? (
                                              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs">
                                                {item.paymentDate && <span className="font-mono text-slate-500 shrink-0">{item.paymentDate}</span>}
                                                <span className="font-bold text-emerald-700 flex-1">${(parseFloat(item.amountReceived)||0).toLocaleString(undefined,{minimumFractionDigits:2})}</span>
                                                {item.paymentMethod && <span className="text-[9px] bg-emerald-100 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">{ML[item.paymentMethod]||item.paymentMethod}</span>}
                                              </div>
                                            ) : (
                                              <p className="text-[11px] text-slate-400 italic">No payments recorded yet.</p>
                                            )}
                                            {effectiveStatus === "Partially Paid" && (
                                              <p className="text-[11px] text-orange-600 font-semibold">
                                                Balance owed: ${amountOwed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                {lateFee > 0 ? ` + $${lateFee.toLocaleString(undefined, { minimumFractionDigits: 2 })} late fee` : ""}
                                              </p>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
                                    <Button variant="outline" className="flex-none" onClick={() => setPreviewItem(item)} title="Preview invoice">
                                      <Eye size={15} className="mr-1.5" /> View
                                    </Button>
                                    {item.generated && item.generatedData && (
                                      <Button variant="outline" className="flex-none text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => openEditInvoice(item)} title="Edit invoice">
                                        <Pencil size={15} className="mr-1.5" />Edit
                                      </Button>
                                    )}
                                    {effectiveStatus !== "Paid" ? (
                                      <Button variant="success" className="flex-1" onClick={() => {
                                        setMarkPaidModal({ id: item.id, idx, amount: parseFloat(item.amount) || 0, existingPayments: item.payments || [] });
                                        setMarkPaidMode(null);
                                        setMarkPaidPartialAmt("");
                                        setMarkPaidDate(new Date().toISOString().split("T")[0]);
                                        setMarkPaidMethod("");
                                      }}>Mark as Paid</Button>
                                    ) : (
                                      <Button variant="outline" className="flex-1 text-emerald-600 border-emerald-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors group" onClick={() => { const n = [...invoices]; n[idx] = { ...n[idx], status: "Unpaid", amountReceived: 0, payments: [] }; setInvoices(n); }} title="Click to mark as unpaid">
                                        <CheckCircle size={15} className="mr-1.5 group-hover:hidden" />
                                        <X size={15} className="mr-1.5 hidden group-hover:inline" />
                                        <span className="group-hover:hidden">Paid</span>
                                        <span className="hidden group-hover:inline">Mark Unpaid</span>
                                      </Button>
                                    )}
                                    {!item.paystub ? (
                                      <div className="relative flex-none">
                                        <input type="file" accept="image/*,.pdf"
                                          onChange={e => { if (e.target.files[0]) handlePaystubUpload(item.id, e.target.files[0]); e.target.value = ""; }}
                                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                          disabled={paystubUploading === item.id} />
                                        <Button variant="outline" disabled={paystubUploading === item.id} className="text-blue-600 border-blue-200 hover:bg-blue-50 whitespace-nowrap">
                                          {paystubUploading === item.id ? <><Loader2 size={13} className="animate-spin mr-1.5" />Reading...</> : <><UploadCloud size={13} className="mr-1.5" />Paystub</>}
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button variant="outline" className="flex-none text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                        onClick={() => setPreviewItem({ ...item, id: "paystub_" + item.id, fileName: item.paystub.fileName, fileId: item.paystub.fileId, fileType: item.paystub.fileType })}>
                                        <CheckCircle size={13} className="mr-1.5" />Paystub
                                      </Button>
                                    )}
                                  </div>
                                  {item.paystub && (
                                    <div className="px-5 pb-4 pt-0 bg-white space-y-2">
                                      <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 space-y-1.5">
                                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5"><CheckCircle size={11} />Paystub Verified</p>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                          {item.paystub.grossPay > 0 && <div><span className="text-slate-400">Gross Pay </span><span className="font-semibold text-slate-700">${item.paystub.grossPay.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
                                          {item.paystub.netPay > 0 && <div><span className="text-slate-400">Net Pay </span><span className="font-semibold text-slate-700">${item.paystub.netPay.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
                                          {item.paystub.payDate && <div><span className="text-slate-400">Pay Date </span><span className="font-semibold text-slate-700">{item.paystub.payDate}</span></div>}
                                          {item.paystub.checkNumber && <div><span className="text-slate-400">Check # </span><span className="font-semibold text-slate-700 font-mono">{item.paystub.checkNumber}</span></div>}
                                        </div>
                                        <button onClick={() => { setInvoices(prev => prev.map(inv => inv.id === item.id ? { ...inv, paystub: undefined } : inv)); URL.revokeObjectURL(blobCache.current.get("paystub_" + item.id)?.url); blobCache.current.delete("paystub_" + item.id); }}
                                          className="text-[10px] text-red-400 hover:text-red-600 mt-1">Remove paystub</button>
                                      </div>
                                    </div>
                                  )}
                                </Card>);
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </>
        )}

        {/* ── TIMECARDS ── */}
        {activeTab === "timecards" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="p-6 bg-blue-50 border-blue-200">
                <p className="text-blue-700 text-sm font-medium">Total Hours Logged</p>
                <h2 className="text-3xl font-bold mt-1 text-blue-700">{totalTimecardHours.toFixed(1)} hrs</h2>
              </Card>
              <Card className="p-6">
                <p className="text-slate-500 text-sm font-medium">Total Earnings</p>
                <h2 className="text-3xl font-bold mt-1 text-blue-600">${totalTimecardEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
              </Card>
              <Card className="p-6">
                <p className="text-slate-500 text-sm font-medium">Paid</p>
                <h2 className="text-3xl font-bold mt-1 text-emerald-600">${totalTimecardInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
              </Card>
              <Card className="p-6">
                <p className="text-slate-500 text-sm font-medium">Est. Taxes (25%)</p>
                <h2 className="text-3xl font-bold mt-1 text-amber-600">${(totalTimecardEarnings * TAX_RATE).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
              </Card>
            </div>
            {/* ── Classification Manager ── */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Manage your saved classifications for quick-select in timecards.</span>
              <Button variant="outline" onClick={() => setShowClassificationManager(p => !p)} className="text-xs h-8">
                <Wrench size={13} className="mr-1.5" />{showClassificationManager ? "Hide" : "Manage Classifications"}
              </Button>
            </div>
            {showClassificationManager && (
              <Card className="p-4">
                <h4 className="text-sm font-bold mb-3">Saved Classifications</h4>
                <div className="flex flex-wrap gap-2 mb-3">
                  {classifications.length === 0 && <span className="text-xs text-slate-400 italic">No classifications saved yet.</span>}
                  {classifications.map(c => (
                    <span key={c} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 text-xs font-medium">
                      {c}
                      <button onClick={() => setClassifications(prev => prev.filter(x => x !== c))} className="text-blue-400 hover:text-red-500 transition-colors" title="Remove"><X size={11} /></button>
                    </span>
                  ))}
                </div>
                <form onSubmit={e => { e.preventDefault(); const v = newClassificationName.trim(); if (v && !classifications.includes(v)) { setClassifications(prev => [...prev, v].sort()); } setNewClassificationName(""); }} className="flex gap-2">
                  <Input value={newClassificationName} onChange={e => setNewClassificationName(e.target.value)} placeholder="e.g. Director of Photography" className="flex-1" autoFocus />
                  <Button type="submit" disabled={!newClassificationName.trim()}><Plus size={14} className="mr-1" />Add</Button>
                </form>
              </Card>
            )}

            {/* ── Weekly Timecard Entry Form ── */}
            <Card className="p-5">
              <h3 className="text-base font-bold mb-4">
                New Timecard — {newTimecard.days?.[0]?.date ? new Date(newTimecard.days[0].date + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""} – {newTimecard.weekEnding ? new Date(newTimecard.weekEnding + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
              </h3>

              {/* Header fields */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
                <div className="space-y-1 col-span-2 sm:col-span-3 lg:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Production Company *</label>
                  {clients.length > 0 && (
                    <select value="" onChange={e => { if (e.target.value) setNewTimecard(p => ({ ...p, company: e.target.value })); }}
                      className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mb-1">
                      <option value="">— Saved client —</option>
                      {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  )}
                  <Input value={newTimecard.company} onChange={e => setNewTimecard(p => ({ ...p, company: e.target.value }))} placeholder="e.g. KISSD Honda" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Job</label>
                  <select value={newTimecard.jobId} onChange={e => setNewTimecard(p => ({ ...p, jobId: e.target.value }))}
                    className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                    <option value="">— Unassigned —</option>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1 col-span-2 sm:col-span-3 lg:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Job Name / Show</label>
                  <Input value={newTimecard.jobName} onChange={e => setNewTimecard(p => ({ ...p, jobName: e.target.value }))} placeholder="e.g. Honda Civic Campaign" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Classification</label>
                  <div className="flex gap-1">
                    <select
                      value={classifications.includes(newTimecard.jobClassification) ? newTimecard.jobClassification : ""}
                      onChange={e => { if (e.target.value) setNewTimecard(p => ({ ...p, jobClassification: e.target.value })); }}
                      className="flex-1 min-w-0 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                      <option value="">— Quick select —</option>
                      {classifications.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <Input value={newTimecard.jobClassification} onChange={e => setNewTimecard(p => ({ ...p, jobClassification: e.target.value }))} placeholder="or type here" className="mt-1" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Week Ending (Sat)</label>
                  <Input type="date" value={newTimecard.weekEnding}
                    onChange={e => {
                      const raw = e.target.value;
                      if (!raw) return;
                      // Snap entered date to nearest Saturday
                      const entered = new Date(raw + "T12:00");
                      const dow = entered.getDay(); // 0=Sun … 6=Sat
                      const daysToSat = (6 - dow + 7) % 7; // 0 if already Sat
                      entered.setDate(entered.getDate() + daysToSat);
                      const we = entered.toISOString().split("T")[0];
                      setNewTimecard(p => ({ ...p, weekEnding: we, days: initWeekDays(we) }));
                    }} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Rate ($/hr) *</label>
                  <Input type="number" value={newTimecard.rate} onChange={e => setNewTimecard(p => ({ ...p, rate: e.target.value, dayRate: "" }))} placeholder="e.g. 750" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">— or — Day Rate ($)</label>
                  <div className="flex gap-1">
                    <Input type="number" value={newTimecard.dayRate} onChange={e => {
                      const dr = e.target.value;
                      const hr = dayRateToHourly(dr, newTimecard.dayRateType);
                      setNewTimecard(p => ({ ...p, dayRate: dr, rate: hr, guarHours: p.dayRateType === "12" ? "12" : "10" }));
                    }} placeholder="e.g. 1650" className="flex-1" />
                    <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs font-bold shrink-0">
                      {["10", "12"].map(t => (
                        <button key={t} type="button"
                          onClick={() => {
                            const hr = dayRateToHourly(newTimecard.dayRate, t);
                            setNewTimecard(p => ({ ...p, dayRateType: t, rate: hr || p.rate, guarHours: t }));
                          }}
                          className={`px-2.5 py-1 transition-colors ${newTimecard.dayRateType === t ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                          {t}hr
                        </button>
                      ))}
                    </div>
                  </div>
                  {newTimecard.dayRate && newTimecard.rate && (
                    <p className="text-[10px] text-blue-500">≈ ${parseFloat(newTimecard.rate).toFixed(4)}/hr (auto-calculated)</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Guar. Hours</label>
                  <Input type="number" value={newTimecard.guarHours} onChange={e => setNewTimecard(p => ({ ...p, guarHours: e.target.value }))} placeholder="10" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Mileage (mi)</label>
                  <Input type="number" value={newTimecard.mileage} onChange={e => setNewTimecard(p => ({ ...p, mileage: e.target.value }))} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Work Day Per Diem ($)</label>
                  <Input type="number" value={newTimecard.workPerDiem} onChange={e => setNewTimecard(p => ({ ...p, workPerDiem: e.target.value }))} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Day Off Per Diem ($)</label>
                  <Input type="number" value={newTimecard.daysOffPerDiem} onChange={e => setNewTimecard(p => ({ ...p, daysOffPerDiem: e.target.value }))} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Kit/Box Rental ($/day)</label>
                  <Input type="number" value={newTimecard.kitRentalRate} onChange={e => setNewTimecard(p => ({ ...p, kitRentalRate: e.target.value }))} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Notes</label>
                  <Input value={newTimecard.description} onChange={e => setNewTimecard(p => ({ ...p, description: e.target.value }))} placeholder="Meal penalty, etc." />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Your Name</label>
                  <Input value={newTimecard.workerName} onChange={e => setNewTimecard(p => ({ ...p, workerName: e.target.value }))} placeholder="Full name" />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Your Email</label>
                  <Input type="email" value={newTimecard.workerEmail} onChange={e => setNewTimecard(p => ({ ...p, workerEmail: e.target.value }))} placeholder="email@example.com" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">SS Last 4</label>
                  <Input value={newTimecard.last4SS} onChange={e => setNewTimecard(p => ({ ...p, last4SS: e.target.value.replace(/\D/g, "").slice(0, 4) }))} placeholder="1234" className="font-mono tracking-widest" />
                </div>
              </div>

              {/* Signature section */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee Signature</div>
                <div className="flex gap-3 flex-wrap">
                  <div className="space-y-1 flex-1 min-w-[160px]">
                    <label className="text-[10px] text-slate-400">Font Style</label>
                    <select value={newTimecard.signatureFont} onChange={e => setNewTimecard(p => ({ ...p, signatureFont: e.target.value }))}
                      className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                      {SIGNATURE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Signature Date</label>
                    <Input type="date" value={newTimecard.signatureDate} onChange={e => setNewTimecard(p => ({ ...p, signatureDate: e.target.value }))} className="w-40" />
                  </div>
                </div>
                {newTimecard.workerName ? (
                  <div className="rounded-lg border border-slate-200 bg-white px-5 py-3">
                    <div style={{ fontFamily: `'${newTimecard.signatureFont}', cursive`, fontSize: "32px", color: "#1e293b", lineHeight: 1.3 }}>
                      {newTimecard.workerName}
                    </div>
                    {newTimecard.signatureDate && (
                      <div className="text-sm text-slate-700 mt-1">
                        {new Date(newTimecard.signatureDate + "T12:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400 mt-1">{newTimecard.signatureFont}</div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic">Enter your name above to preview signature</div>
                )}
              </div>

              {/* 7-day time grid */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[700px] text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase w-24 border-r border-slate-200">Field</th>
                      {newTimecard.days.map((d, i) => {
                        const hasData = !!(d.call || d.wrap);
                        const hours = calcDayHours(d);
                        const isWeekend = (i === 0 || i === 6);
                        return (
                          <th key={i} className={`text-center px-1 py-1.5 border-r border-slate-100 last:border-r-0 min-w-[92px] ${hasData ? "bg-blue-50" : isWeekend ? "bg-amber-50" : ""}`}>
                            <div className={`font-bold text-xs ${isWeekend ? "text-amber-600" : "text-slate-700"}`}>{d.day}</div>
                            <div className={`text-[10px] mt-0.5 font-normal ${isWeekend ? "text-amber-500" : "text-slate-400"}`}>
                              {new Date(d.date + "T12:00").toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}
                            </div>
                            {hours > 0 && <div className="text-[10px] font-bold text-blue-600 mt-0.5">{hours}h</div>}
                            {i > 0 && (
                              <button
                                type="button"
                                title="Copy times from previous day"
                                onClick={() => setNewTimecard(p => {
                                  const prev = p.days[i - 1];
                                  const updated = p.days.map((day, idx) => idx !== i ? day : {
                                    ...day,
                                    call: prev.call, meal1Out: prev.meal1Out, meal1In: prev.meal1In,
                                    meal2Out: prev.meal2Out, meal2In: prev.meal2In, wrap: prev.wrap,
                                  });
                                  return { ...p, days: updated };
                                })}
                                className="mt-1 text-[9px] text-slate-400 hover:text-blue-500 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded px-1 py-0.5 leading-none transition-colors"
                              >⬅ copy</button>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Call", key: "call", type: "time" },
                      { label: "Meal 1 Out", key: "meal1Out", type: "time" },
                      { label: "Meal 1 In", key: "meal1In", type: "time" },
                      { label: "Meal 2 Out", key: "meal2Out", type: "time" },
                      { label: "Meal 2 In", key: "meal2In", type: "time" },
                      { label: "Wrap", key: "wrap", type: "text" },
                    ].map(({ label, key, type }, rowIdx) => (
                      <tr key={key} className={rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                        <td className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase border-r border-slate-200 whitespace-nowrap">
                          {label}
                          {key === "wrap" && <span className="ml-1 text-slate-300 font-normal normal-case">(27:18=3:18am)</span>}
                        </td>
                        {newTimecard.days.map((d, i) => {
                          const isWeekend = (i === 0 || i === 6);
                          const isNextDay = key === "wrap" && d[key] && parseInt(d[key].split(":")[0], 10) >= 24;
                          return (
                            <td key={i} className={`px-1 py-1 border-r border-slate-100 last:border-r-0 ${isWeekend ? "bg-amber-50/60" : ""}`}>
                              <input type={type} value={d[key]}
                                placeholder={key === "wrap" ? "--:--" : undefined}
                                title={key === "wrap" ? "For next-day wraps use hours > 23, e.g. 27:18 = 3:18am" : undefined}
                                onChange={e => setNewTimecard(p => ({ ...p, days: p.days.map((day, idx) => idx !== i ? day : { ...day, [key]: e.target.value }) }))}
                                className={`w-full text-xs border rounded px-1 py-0.5 text-center focus:outline-none focus:border-blue-400 ${isNextDay ? "border-violet-300 bg-violet-50 text-violet-700 font-medium" : isWeekend ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`} />
                              {isNextDay && <div className="text-[9px] text-violet-500 text-center leading-none mt-0.5">+next day</div>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="bg-sky-50 border-t border-sky-200">
                      <td className="px-3 py-1.5 text-[10px] font-bold text-sky-700 uppercase border-r border-slate-200 whitespace-nowrap">Day Type</td>
                      {newTimecard.days.map((d, i) => {
                        const isWeekend = i === 0 || i === 6;
                        return (
                          <td key={i} className={`px-1 py-1.5 border-r border-slate-100 last:border-r-0 text-center ${isWeekend ? "bg-amber-50/60" : ""}`}>
                            <select value={d.type || "work"}
                              onChange={e => setNewTimecard(p => ({ ...p, days: p.days.map((day, idx) => idx !== i ? day : { ...day, type: e.target.value }) }))}
                              className="w-full text-[10px] border border-sky-200 rounded px-0.5 py-0.5 bg-white focus:outline-none focus:border-blue-400 text-slate-700">
                              <option value="work">Work</option>
                              <option value="hold">Hold</option>
                              <option value="travel">Travel</option>
                              <option value="off">Off</option>
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="bg-orange-50 border-t border-orange-200">
                      <td className="px-3 py-1.5 text-[10px] font-bold text-orange-700 uppercase border-r border-slate-200 whitespace-nowrap">Meal Penalty</td>
                      {newTimecard.days.map((d, i) => {
                        const isWeekend = i === 0 || i === 6;
                        return (
                          <td key={i} className={`px-1 py-1.5 border-r border-slate-100 last:border-r-0 text-center ${isWeekend ? "bg-amber-50/60" : ""}`}>
                            <input
                              type="checkbox"
                              checked={!!d.mealPenalty}
                              onChange={e => setNewTimecard(p => ({ ...p, days: p.days.map((day, idx) => idx !== i ? day : { ...day, mealPenalty: e.target.checked }) }))}
                              className="w-4 h-4 rounded accent-orange-500 cursor-pointer"
                              title={d.mealPenalty ? "Meal penalty flagged" : "Check to flag meal penalty"}
                            />
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="bg-violet-50 border-t border-violet-200">
                      <td className="px-3 py-1.5 text-[10px] font-bold text-violet-700 uppercase border-r border-slate-200 whitespace-nowrap">
                        Work Per Diem
                        {parseFloat(newTimecard.workPerDiem) > 0 && (() => {
                          const wRate = parseFloat(newTimecard.workPerDiem);
                          const wCount = newTimecard.days.filter(d => d.perDiemWork).length;
                          return (<>
                            <div className="text-[9px] font-normal normal-case text-violet-400">{"$" + wRate.toLocaleString(undefined, { minimumFractionDigits: 2 }) + "/day"}</div>
                            {wCount > 0 && <div className="text-[9px] font-normal normal-case text-violet-500">{wCount + " day" + (wCount !== 1 ? "s" : "") + " = $" + (wRate * wCount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>}
                          </>);
                        })()}
                      </td>
                      {newTimecard.days.map((d, i) => {
                        const isWeekend = i === 0 || i === 6;
                        return (
                          <td key={i} className={`px-1 py-1.5 border-r border-slate-100 last:border-r-0 text-center ${isWeekend ? "bg-amber-50/60" : ""}`}>
                            <input
                              type="checkbox"
                              checked={!!d.perDiemWork}
                              onChange={e => setNewTimecard(p => ({ ...p, days: p.days.map((day, idx) => idx !== i ? day : { ...day, perDiemWork: e.target.checked, perDiemOff: e.target.checked ? false : day.perDiemOff }) }))}
                              className="w-4 h-4 rounded accent-violet-500 cursor-pointer"
                              title="Apply work day per diem to this day"
                            />
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="bg-teal-50 border-t border-teal-200">
                      <td className="px-3 py-1.5 text-[10px] font-bold text-teal-700 uppercase border-r border-slate-200 whitespace-nowrap">
                        Day Off Per Diem
                        {parseFloat(newTimecard.daysOffPerDiem) > 0 && (() => {
                          const oRate = parseFloat(newTimecard.daysOffPerDiem);
                          const oCount = newTimecard.days.filter(d => d.perDiemOff).length;
                          return (<>
                            <div className="text-[9px] font-normal normal-case text-teal-400">{"$" + oRate.toLocaleString(undefined, { minimumFractionDigits: 2 }) + "/day"}</div>
                            {oCount > 0 && <div className="text-[9px] font-normal normal-case text-teal-600">{oCount + " day" + (oCount !== 1 ? "s" : "") + " = $" + (oRate * oCount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>}
                          </>);
                        })()}
                      </td>
                      {newTimecard.days.map((d, i) => {
                        const isWeekend = i === 0 || i === 6;
                        return (
                          <td key={i} className={`px-1 py-1.5 border-r border-slate-100 last:border-r-0 text-center ${isWeekend ? "bg-amber-50/60" : ""}`}>
                            <input
                              type="checkbox"
                              checked={!!d.perDiemOff}
                              onChange={e => setNewTimecard(p => ({ ...p, days: p.days.map((day, idx) => idx !== i ? day : { ...day, perDiemOff: e.target.checked, perDiemWork: e.target.checked ? false : day.perDiemWork }) }))}
                              className="w-4 h-4 rounded accent-teal-500 cursor-pointer"
                              title="Apply day off per diem to this day"
                            />
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="bg-emerald-50 border-t border-emerald-200">
                      <td className="px-3 py-1.5 text-[10px] font-bold text-emerald-700 uppercase border-r border-slate-200 whitespace-nowrap">Daily Total</td>
                      {(() => {
                        const sixthIdx = get6thDayIndex(newTimecard.days);
                        const seventhIdx = get7thDayIndex(newTimecard.days);
                        const rate = parseFloat(newTimecard.rate) || 0;
                        const guarH = parseFloat(newTimecard.guarHours) || 0;
                        const wPD = parseFloat(newTimecard.workPerDiem) || 0;
                        const oPD = parseFloat(newTimecard.daysOffPerDiem) || 0;
                        return newTimecard.days.map((d, i) => {
                          const h = calcDayHours(d);
                          const paidH = h > 0 ? Math.max(h, guarH) : 0;
                          const ot = i === seventhIdx ? calcOTBreakdown7thDay(paidH) : i === sixthIdx ? calcOTBreakdown6thDay(paidH) : calcOTBreakdown(paidH);
                          const perDiem = (d.perDiemWork ? wPD : 0) + (d.perDiemOff ? oPD : 0);
                          const dayTotal = ot.hours1x * rate + ot.hours15x * rate * 1.5 + ot.hours2x * rate * 2 + (d.mealPenalty ? rate : 0) + perDiem;
                          const isWeekend = i === 0 || i === 6;
                          return (
                            <td key={i} className={`px-1 py-1.5 text-center border-r border-slate-100 last:border-r-0 ${isWeekend ? "bg-amber-50/60" : ""}`}>
                              {(paidH > 0 || perDiem > 0)
                                ? <span className="text-xs font-bold text-emerald-700">${dayTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                : <span className="text-slate-300 text-xs">—</span>}
                            </td>
                          );
                        });
                      })()}
                    </tr>
                    <tr className="bg-blue-600 border-t-2 border-blue-700">
                      <td className="px-3 py-2 text-[10px] font-bold text-blue-100 uppercase border-r border-blue-500">Total Hrs</td>
                      {(() => {
                        const sixthIdx = get6thDayIndex(newTimecard.days);
                        const seventhIdx = get7thDayIndex(newTimecard.days);
                        const guarH = parseFloat(newTimecard.guarHours) || 0;
                        return newTimecard.days.map((d, i) => {
                          const h = calcDayHours(d);
                          const paidH = h > 0 ? Math.max(h, guarH) : 0;
                          const is6th = i === sixthIdx;
                          const is7th = i === seventhIdx;
                          const ot = is7th ? calcOTBreakdown7thDay(paidH) : is6th ? calcOTBreakdown6thDay(paidH) : calcOTBreakdown(paidH);
                          const isWeekend = i === 0 || i === 6;
                          return (
                            <td key={i} className={`px-1 py-2 text-center border-r border-blue-500 last:border-r-0 ${isWeekend ? "bg-blue-700" : ""}`}>
                              <div className={`font-bold text-sm ${paidH > 0 ? "text-white" : "text-blue-400"}`}>{paidH > 0 ? paidH : "—"}</div>
                              {is7th && paidH > 0 && <div className="text-[9px] text-rose-300 font-bold">7th day</div>}
                              {is6th && paidH > 0 && <div className="text-[9px] text-cyan-300 font-bold">6th day</div>}
                              {ot.hours15x > 0 && <div className="text-[9px] text-amber-300 font-medium">{ot.hours15x}h @1.5×</div>}
                              {ot.hours2x > 0 && <div className="text-[9px] text-red-300 font-medium">{ot.hours2x}h @2×</div>}
                            </td>
                          );
                        });
                      })()}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Summary + submit */}
              <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
                <div className="flex items-center gap-6 text-sm">
                  {(() => {
                    const guarHours = parseFloat(newTimecard.guarHours) || 0;
                    const totalHrs = parseFloat(newTimecard.days.reduce((a, d) => a + calcDayHours(d), 0).toFixed(2));
                    const rate = parseFloat(newTimecard.rate) || 0;
                    const total = parseFloat((totalHrs * rate).toFixed(2));
                    const workDays = newTimecard.days.filter(d => calcDayHours(d) > 0).length;
                    return (
                      <>
                        <div><span className="text-slate-400">Days worked: </span><span className="font-bold text-slate-800">{workDays}</span></div>
                        <div><span className="text-slate-400">Week total: </span><span className="font-bold text-slate-800">{totalHrs} hrs</span></div>
                        {rate > 0 && <div><span className="text-slate-400">Gross est.: </span><span className="font-bold text-blue-700">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>}
                      </>
                    );
                  })()}
                </div>
                <Button onClick={addTimecard} disabled={!newTimecard.company || !newTimecard.rate}>
                  <Plus size={16} className="mr-1.5" /> Add Timecard
                </Button>
              </div>
            </Card>

            {/* Job selector for upcoming upload */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upload to job</span>
              <select value={uploadJobId} onChange={e => setUploadJobId(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                <option value="">— Unassigned —</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>

            {/* Jobs list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Time Entries — {selectedYear}</h3>
                <div className="flex items-center gap-2">
                  {showNewJobForm ? (
                    <form onSubmit={e => { e.preventDefault(); if (newJobName.trim()) { addJob(newJobName); setNewJobName(""); setShowNewJobForm(false); } }} className="flex gap-2">
                      <Input value={newJobName} onChange={e => setNewJobName(e.target.value)} placeholder="Job name" className="w-48 h-8 text-sm" autoFocus />
                      <Button type="submit" className="h-8 text-xs px-3">Save</Button>
                      <Button type="button" variant="ghost" onClick={() => { setShowNewJobForm(false); setNewJobName(""); }} className="h-8 text-xs px-2">Cancel</Button>
                    </form>
                  ) : (
                    <Button variant="outline" onClick={() => setShowNewJobForm(true)} className="h-8 text-xs"><Plus size={13} className="mr-1" />New Job</Button>
                  )}
                  <Button variant="outline" onClick={() => {
                    const header = ["Week Ending", "Company", "Job Name", "Classification", "Rate/hr", "Day Rate", "Hours", "Total", "Meal Penalty Pay", "Per Diem Total", "Kit Rental Pay", "Mileage", "Status"];
                    const rows = filteredTimecards.map(tc => [tc.date || "", tc.company || "", tc.jobName || "", tc.jobClassification || "", tc.rate || 0, tc.dayRate || 0, tc.hours || 0, tc.total || 0, tc.mealPenaltyPay || 0, tc.perDiemTotal || 0, tc.kitRentalPay || 0, tc.mileage || 0, tc.status || ""]);
                    downloadCSV([header, ...rows], `timecards_${selectedYear}.csv`);
                  }} className="h-8 text-xs gap-1.5"><FileDown size={13} />CSV</Button>
                </div>
              </div>

              {(() => {
                const jobGroups = [
                  ...jobs.map(j => ({ ...j, items: filteredTimecards.filter(t => t.jobId === j.id) })),
                  { id: "", name: "Unassigned", items: filteredTimecards.filter(t => !t.jobId || !jobs.find(j => j.id === t.jobId)) },
                ].filter(g => sq ? g.items.length > 0 : (g.items.length > 0 || g.id !== ""));

                if (jobGroups.every(g => g.items.length === 0)) {
                  return (
                    <div className="py-20 text-center bg-white border-2 border-dashed border-slate-200 rounded-2xl">
                      <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300"><Clock size={32} /></div>
                      <h4 className="text-slate-900 font-semibold">{sq ? `No time entries match "${sq}"` : `No time entries for ${selectedYear}`}</h4>
                      <p className="text-slate-500 text-sm">{sq ? "Try a different search term." : (selectedYear === currentYear ? "Log hours using the form above, or upload a timecard PDF/image." : "No time was logged for this year.")}</p>
                    </div>
                  );
                }

                return jobGroups.map(group => {
                  if (group.items.length === 0) return null;
                  const isExpanded = sq || group.id === "" ? true : expandedJobs.has(group.id);
                  const groupHours = group.items.reduce((a, b) => a + (b.hours || 0), 0);
                  const groupEarnings = group.items.reduce((a, b) => a + (b.total || 0), 0);
                  return (
                    <div key={group.id || "unassigned"} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 cursor-pointer select-none"
                        onClick={() => group.id && toggleJobExpanded(group.id)}>
                        <div className="flex items-center gap-2">
                          {group.id ? (
                            isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />
                          ) : <span className="w-4" />}
                          <Briefcase size={15} className="text-slate-400" />
                          <span className="font-semibold text-slate-800 text-sm">{group.name}</span>
                          <span className="text-xs text-slate-400">({group.items.length} entr{group.items.length !== 1 ? "ies" : "y"})</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-medium">
                          <span className="text-slate-500">{groupHours.toFixed(1)} hrs</span>
                          <span className="text-blue-600 font-bold">${groupEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          {group.id && <Button variant="danger" onClick={e => { e.stopPropagation(); deleteJob(group.id); }} className="!p-1 ml-1" title="Delete job"><Trash2 size={13} /></Button>}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="p-4">
                          {group.items.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-6">No time entries in this job yet. Select it in "Upload to job" or pick it in the form above.</p>
                          ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                              {group.items.map((entry) => {
                                const idx = timecards.findIndex(t => t.id === entry.id);
                                return (<Card key={entry.id} id={entry.id} className={`transition-all flex flex-col ${entry.locked ? "border-amber-200 bg-amber-50/20" : "hover:border-blue-200"} ${highlightedId === entry.id ? "ring-2 ring-violet-500 border-violet-400" : ""}`}>
                                  <div className="flex-1 flex flex-col">
                                    {/* Card header */}
                                    <div className="p-4 space-y-2">
                                      <div className="flex justify-between items-start">
                                        <div className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${entry.status === "Paid" ? "bg-emerald-100 text-emerald-700" : entry.status === "Partially Paid" ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700"}`}>{entry.status}</div>
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => { const n = [...timecards]; n[idx] = { ...n[idx], locked: !n[idx].locked }; setTimecards(n); }}
                                            className={`p-1.5 rounded-lg transition-colors ${entry.locked ? "text-amber-600 bg-amber-100 hover:bg-amber-200" : "text-slate-300 hover:text-slate-500 hover:bg-slate-100"}`}
                                            title={entry.locked ? "Unlock entry to edit" : "Lock entry to prevent edits"}>
                                            {entry.locked ? <Lock size={13} /> : <LockOpen size={13} />}
                                          </button>
                                          <select value={entry.jobId || ""} onChange={e => { const n = [...timecards]; n[idx] = { ...n[idx], jobId: e.target.value }; setTimecards(n); }}
                                            disabled={!!entry.locked}
                                            className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-500 focus:outline-none max-w-[100px] disabled:opacity-50 disabled:cursor-not-allowed" title="Move to job">
                                            <option value="">Unassigned</option>
                                            {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                                          </select>
                                          <Button variant="danger" onClick={() => deleteTimecard(entry.id)} className="!p-1.5"><Trash2 size={14} /></Button>
                                        </div>
                                      </div>
                                      <div>
                                        <p className="font-semibold text-slate-800">{entry.company}</p>
                                        {entry.jobName && <p className="text-xs text-blue-600 font-medium mt-0.5">{entry.jobName}</p>}
                                        {entry.jobClassification && <p className="text-xs text-slate-400">{entry.jobClassification}</p>}
                                        {entry.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{entry.description}</p>}
                                      </div>
                                      <div className="flex items-center gap-3 text-xs text-slate-400">
                                        <span>Week ending: <span className="font-semibold text-slate-600">{entry.date}</span></span>
                                        {entry.guarHours > 0 && <span>Guar. <span className="font-semibold text-slate-600">{entry.guarHours}h</span></span>}
                                        {entry.rate > 0 && <span>${entry.rate}/hr</span>}
                                      </div>
                                      {/* Turnaround / meal penalty warnings */}
                                      {(() => {
                                        const turnaroundViolations = entry.days ? calcTurnaroundViolations(entry.days) : new Set();
                                        const autoMealDays = entry.days ? entry.days.filter(d => !d.mealPenalty && shouldAutoMealPenalty(d)) : [];
                                        if (turnaroundViolations.size === 0 && autoMealDays.length === 0) return null;
                                        return (
                                          <div className="flex flex-wrap gap-1.5 mt-1">
                                            {turnaroundViolations.size > 0 && (
                                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold" title="< 10h between wrap and next call">⏰ {turnaroundViolations.size} turnaround violation{turnaroundViolations.size !== 1 ? "s" : ""}</span>
                                            )}
                                            {autoMealDays.length > 0 && (
                                              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold" title="No meal break logged within 6h of call">🍽 {autoMealDays.length} possible meal penalty</span>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                    {/* 7-day calendar */}
                                    {entry.days?.length > 0 ? (
                                      <div className="overflow-x-auto border-t border-slate-100">
                                        <table className="w-full min-w-[360px] text-[11px] border-collapse">
                                          <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                              <th className="px-2 py-1.5 text-left text-[10px] font-bold text-slate-400 uppercase border-r border-slate-200 w-[70px]">Day</th>
                                              <th className="px-1.5 py-1.5 text-center text-[10px] font-bold text-slate-400 border-r border-slate-100">Call</th>
                                              <th className="px-1.5 py-1.5 text-center text-[10px] font-bold text-slate-400 border-r border-slate-100">Wrap</th>
                                              <th className="px-1.5 py-1.5 text-center text-[10px] font-bold text-slate-400 border-r border-slate-100">Hrs</th>
                                              <th className="px-1.5 py-1.5 text-center text-[10px] font-bold text-slate-400 border-r border-slate-100">OT</th>
                                              <th className="px-1.5 py-1.5 text-center text-[10px] font-bold text-orange-400">MP</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {entry.days.map(d => {
                                              const hasWork = d.totalHours > 0 || d.call;
                                              return (
                                                <tr key={d.date} className={`border-t border-slate-100 ${hasWork ? "bg-blue-50/50" : ""}`}>
                                                  <td className="px-2 py-1.5 border-r border-slate-200 whitespace-nowrap">
                                                    <span className="font-bold text-slate-700">{d.day}</span>
                                                    <span className="text-slate-400 ml-1 text-[10px]">{new Date(d.date + "T12:00").toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}</span>
                                                  </td>
                                                  <td className="px-1.5 py-1.5 text-center text-slate-500 border-r border-slate-100">{d.call || <span className="text-slate-300">—</span>}</td>
                                                  <td className="px-1.5 py-1.5 text-center text-slate-500 border-r border-slate-100">{d.wrap || <span className="text-slate-300">—</span>}</td>
                                                  <td className="px-1.5 py-1.5 text-center border-r border-slate-100 font-bold">
                                                    {d.totalHours > 0 ? <span className="text-blue-700">{d.totalHours}h</span> : <span className="text-slate-300">—</span>}
                                                  </td>
                                                  <td className="px-1.5 py-1.5 text-center text-[10px]">
                                                    {d.hours2x > 0 && <span className="text-red-500 font-medium">{d.hours2x}×2 </span>}
                                                    {d.hours15x > 0 && <span className="text-amber-500 font-medium">{d.hours15x}×1.5</span>}
                                                    {!d.hours15x && !d.hours2x && d.totalHours > 0 && <span className="text-slate-400">st</span>}
                                                    {!d.totalHours && <span className="text-slate-300">—</span>}
                                                  </td>
                                                  <td className="px-1.5 py-1.5 text-center">
                                                    {d.mealPenalty
                                                      ? <span className="text-orange-500 font-bold text-[10px]" title="Meal penalty">⚠ MP</span>
                                                      : <span className="text-slate-200 text-[10px]">—</span>}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                          <tfoot>
                                            <tr className="bg-blue-600 text-white text-[11px] font-bold">
                                              <td colSpan={3} className="px-2 py-1.5 border-r border-blue-500">Week Total (Hours)</td>
                                              <td className="px-1.5 py-1.5 text-center border-r border-blue-500">{entry.hours}h</td>
                                              <td className="px-1.5 py-1.5 text-center border-r border-blue-500">${(entry.total - (entry.mealPenaltyPay || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                              <td className="px-1.5 py-1.5 text-center text-blue-200 text-[10px]">{entry.days?.filter(d => d.mealPenalty).length > 0 ? `${entry.days.filter(d => d.mealPenalty).length} day${entry.days.filter(d => d.mealPenalty).length !== 1 ? "s" : ""}` : "—"}</td>
                                            </tr>
                                            {(entry.mealPenaltyPay || 0) > 0 && (
                                              <tr className="bg-orange-500 text-white text-[11px] font-bold">
                                                <td colSpan={3} className="px-2 py-1.5 border-r border-orange-400">Meal Penalty ({entry.days.filter(d => d.mealPenalty).length} day{entry.days.filter(d => d.mealPenalty).length !== 1 ? "s" : ""} × 1hr base)</td>
                                                <td className="px-1.5 py-1.5 text-center border-r border-orange-400">—</td>
                                                <td className="px-1.5 py-1.5 text-center border-r border-orange-400">${(entry.mealPenaltyPay).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                <td className="px-1.5 py-1.5 text-center">—</td>
                                              </tr>
                                            )}
                                            {(entry.kitRentalPay || 0) > 0 && (
                                              <tr className="bg-purple-600 text-white text-[11px] font-bold">
                                                <td colSpan={3} className="px-2 py-1.5 border-r border-purple-500">Kit/Box Rental ({entry.days.filter(d => d.totalHours > 0 || d.call).length}d × ${(entry.kitRentalRate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}/day)</td>
                                                <td className="px-1.5 py-1.5 text-center border-r border-purple-500">—</td>
                                                <td className="px-1.5 py-1.5 text-center border-r border-purple-500">${(entry.kitRentalPay).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                <td className="px-1.5 py-1.5 text-center">—</td>
                                              </tr>
                                            )}
                                            {((entry.mealPenaltyPay || 0) > 0 || (entry.kitRentalPay || 0) > 0) && (
                                              <tr className="bg-blue-800 text-white text-[11px] font-bold">
                                                <td colSpan={3} className="px-2 py-1.5 border-r border-blue-700">Total Due</td>
                                                <td className="px-1.5 py-1.5 text-center border-r border-blue-700">—</td>
                                                <td className="px-1.5 py-1.5 text-center border-r border-blue-700">${(entry.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                <td className="px-1.5 py-1.5 text-center">—</td>
                                              </tr>
                                            )}
                                          </tfoot>
                                        </table>
                                      </div>
                                    ) : (
                                      /* Fallback for old entries without days */
                                      <div className="px-4 py-3 border-t border-slate-100 flex gap-4 text-sm flex-wrap">
                                        <div><p className="text-[10px] font-bold text-slate-400 uppercase">Hours</p><p className="font-semibold">{entry.hours}</p></div>
                                        <div><p className="text-[10px] font-bold text-slate-400 uppercase">Rate</p><p className="font-semibold">${entry.rate}/hr</p></div>
                                        <div><p className="text-[10px] font-bold text-slate-400 uppercase">Total</p><p className="font-bold text-blue-600">${(entry.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></div>
                                      </div>
                                    )}
                                  </div>
                                  {/* Payment History */}
                                  {(() => {
                                    const pmts = entry.payments || [];
                                    const tcAmtRcvd = pmts.length > 0 ? pmts.reduce((a, p) => a + (parseFloat(p.amount) || 0), 0) : (parseFloat(entry.amountReceived) || 0);
                                    const tcTotal = parseFloat(entry.total) || 0;
                                    const ML = { ach: "ACH/Wire", check: "Check", cash: "Cash", paypal: "PayPal", zelle: "Zelle", venmo: "Venmo", other: "Other" };
                                    if (pmts.length === 0 && tcAmtRcvd === 0 && entry.status !== "Partially Paid") return null;
                                    return (
                                      <div className="px-4 pb-3 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                          <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><CreditCard size={10} />Payment History</label>
                                          {tcAmtRcvd > 0 && <span className="text-[10px] text-slate-400">${tcAmtRcvd.toLocaleString(undefined,{minimumFractionDigits:2})} of ${tcTotal.toLocaleString(undefined,{minimumFractionDigits:2})}</span>}
                                        </div>
                                        {pmts.length > 0 ? (
                                          <div className="space-y-1">
                                            {pmts.map(pmt => (
                                              <div key={pmt.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs">
                                                <span className="font-mono text-slate-500 shrink-0">{pmt.date}</span>
                                                <span className="font-bold text-emerald-700 flex-1">${(parseFloat(pmt.amount)||0).toLocaleString(undefined,{minimumFractionDigits:2})}</span>
                                                {pmt.method && <span className="text-[9px] bg-emerald-100 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">{ML[pmt.method]||pmt.method}</span>}
                                                {!entry.locked && (
                                                  <button onClick={() => {
                                                    const newPmts = pmts.filter(p => p.id !== pmt.id);
                                                    const newTotal2 = newPmts.reduce((a,p) => a+(parseFloat(p.amount)||0), 0);
                                                    const n = [...timecards]; n[idx] = { ...n[idx], payments: newPmts, amountReceived: newTotal2, status: newTotal2 <= 0 ? "Unpaid" : newTotal2 >= tcTotal ? "Paid" : "Partially Paid" }; setTimecards(n);
                                                  }} className="text-slate-300 hover:text-red-400 transition-colors shrink-0" title="Remove payment"><Trash2 size={11} /></button>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        ) : null}
                                        {entry.status === "Partially Paid" && (
                                          <p className="text-[11px] text-orange-600 font-semibold">Balance owed: ${Math.max(0, tcTotal - tcAmtRcvd).toLocaleString(undefined,{minimumFractionDigits:2})}</p>
                                        )}
                                      </div>
                                    );
                                  })()}
                                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2 flex-wrap">
                                    <Button variant="outline" className="flex-none" title={entry.locked ? "Unlock entry to edit" : "Edit timecard"} disabled={!!entry.locked}
                                      onClick={() => setEditingTimecard({ ...entry, rate: String(entry.rate), guarHours: String(entry.guarHours || ""), dayRate: String(entry.dayRate || ""), dayRateType: entry.dayRateType || "10", weekEnding: entry.date, days: entry.days?.length ? entry.days.map(d => ({ ...d })) : initWeekDays(entry.date) })}>
                                      <Pencil size={14} className="mr-1.5" />Edit
                                    </Button>
                                    <Button variant="outline" className="flex-none" title="Download PDF" onClick={() => downloadTimecardPDF(entry)}>
                                      <Download size={14} className="mr-1.5" />PDF
                                    </Button>
                                    <Button variant="outline" className="flex-none text-violet-600 border-violet-200 hover:bg-violet-50" title="Export to payroll portal (EP, GreenSlate, CAPS)" onClick={() => { setExportEntry(entry); setShowExportModal(true); }}>
                                      <FileDown size={14} className="mr-1.5" />Export
                                    </Button>
                                    {blobCache.current.has(entry.id) && (
                                      <Button variant="outline" className="flex-none" onClick={() => setPreviewItem(entry)} title="Preview timecard">
                                        <Eye size={15} className="mr-1.5" /> View
                                      </Button>
                                    )}
                                    {entry.status !== "Paid" ? (
                                      <Button variant="success" className="flex-1" onClick={() => {
                                        setMarkPaidModal({ type: "timecard", id: entry.id, idx, amount: parseFloat(entry.total) || 0, existingPayments: entry.payments || [] });
                                        setMarkPaidMode(null);
                                        setMarkPaidPartialAmt("");
                                        setMarkPaidDate(new Date().toISOString().split("T")[0]);
                                        setMarkPaidMethod("");
                                      }}>Mark as Paid</Button>
                                    ) : (
                                      <Button variant="outline" className="flex-1 text-emerald-600 border-emerald-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors group" onClick={() => { const n = [...timecards]; n[idx] = { ...n[idx], status: "Unpaid", amountReceived: 0, payments: [] }; setTimecards(n); }} title="Click to mark as unpaid">
                                        <CheckCircle size={16} className="mr-1.5 group-hover:hidden" />
                                        <X size={16} className="mr-1.5 hidden group-hover:inline" />
                                        <span className="group-hover:hidden">Paid</span>
                                        <span className="hidden group-hover:inline">Mark Unpaid</span>
                                      </Button>
                                    )}
                                    {!entry.paystub ? (
                                      <div className="relative flex-none">
                                        <input type="file" accept="image/*,application/pdf" className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                          onChange={e => { if (e.target.files[0]) handleTimecardPaystubUpload(entry.id, e.target.files[0]); e.target.value = ""; }}
                                          disabled={paystubUploading === entry.id} />
                                        <Button variant="outline" disabled={paystubUploading === entry.id} className="text-blue-600 border-blue-200 hover:bg-blue-50 whitespace-nowrap">
                                          {paystubUploading === entry.id ? <><Loader2 size={13} className="animate-spin mr-1.5" />Reading...</> : <><UploadCloud size={13} className="mr-1.5" />Paystub</>}
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button variant="outline" className="flex-none text-emerald-600 border-emerald-200 hover:bg-emerald-50 whitespace-nowrap"
                                        onClick={() => setPreviewItem({ ...entry, id: "tc_paystub_" + entry.id, fileName: entry.paystub.fileName, fileId: entry.paystub.fileId, fileType: entry.paystub.fileType })}>
                                        <CheckCircle size={13} className="mr-1.5" />Paystub
                                      </Button>
                                    )}
                                  </div>
                                  {entry.paystub && (
                                    <div className="px-5 pb-4">
                                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1.5">
                                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5"><CheckCircle size={11} />Paystub Verified</p>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                          {entry.paystub.grossPay > 0 && <div><span className="text-slate-400">Gross Pay </span><span className="font-semibold text-slate-700">${entry.paystub.grossPay.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
                                          {entry.paystub.netPay > 0 && <div><span className="text-slate-400">Net Pay </span><span className="font-semibold text-slate-700">${entry.paystub.netPay.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
                                          {entry.paystub.payDate && <div><span className="text-slate-400">Pay Date </span><span className="font-semibold text-slate-700">{entry.paystub.payDate}</span></div>}
                                          {entry.paystub.checkNumber && <div><span className="text-slate-400">Check # </span><span className="font-semibold text-slate-700 font-mono">{entry.paystub.checkNumber}</span></div>}
                                        </div>
                                        <button onClick={() => { setTimecards(prev => prev.map(tc => tc.id === entry.id ? { ...tc, paystub: undefined } : tc)); URL.revokeObjectURL(blobCache.current.get("tc_paystub_" + entry.id)?.url); blobCache.current.delete("tc_paystub_" + entry.id); }}
                                          className="text-[10px] text-red-400 hover:text-red-600 mt-1">Remove paystub</button>
                                      </div>
                                    </div>
                                  )}
                                </Card>);
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </>
        )}

        {/* ── PURCHASES ── */}
        {activeTab === "purchases" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="p-6 bg-rose-50 border-rose-200">
                <p className="text-rose-700 text-sm font-medium">Total Spent</p>
                <h2 className="text-3xl font-bold mt-1 text-rose-700">${totalPurchases.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
              </Card>
              <Card className="p-6">
                <p className="text-slate-500 text-sm font-medium">Expendables</p>
                <h2 className="text-3xl font-bold mt-1 text-rose-500">${totalExpendables.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
              </Card>
              <Card className="p-6">
                <p className="text-slate-500 text-sm font-medium">Equipment</p>
                <h2 className="text-3xl font-bold mt-1 text-violet-600">${totalEquipment.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
              </Card>
              <Card className="p-6">
                <p className="text-slate-500 text-sm font-medium">Items Logged</p>
                <h2 className="text-3xl font-bold mt-1 text-slate-700">{filteredPurchases.length}</h2>
              </Card>
            </div>

            {/* Sub-tabs + Tax Report */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                <button onClick={() => { setPurchaseSubTab("expendables"); setNewPurchase(p => ({ ...p, category: "expendables" })); }}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${purchaseSubTab === "expendables" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                  <Package size={14} className="inline mr-1.5 -mt-0.5" />Expendables
                </button>
                <button onClick={() => { setPurchaseSubTab("equipment"); setNewPurchase(p => ({ ...p, category: "equipment" })); }}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${purchaseSubTab === "equipment" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                  <Wrench size={14} className="inline mr-1.5 -mt-0.5" />Equipment
                </button>
                <button onClick={() => { setPurchaseSubTab("meals"); setNewPurchase(p => ({ ...p, category: "meals" })); }}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${purchaseSubTab === "meals" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                  <Utensils size={14} className="inline mr-1.5 -mt-0.5" />Meals
                </button>
              </div>
              {filteredPurchases.filter(p => p.category === purchaseSubTab).length > 0 && (
                <div className="flex items-center gap-2">
                  <Button onClick={() => {
                    const items = filteredPurchases.filter(p => p.category === purchaseSubTab);
                    const header = purchaseSubTab === "meals"
                      ? ["Date", "Description", "Vendor", "Meal Type", "Amount ($)", "Job", "Notes"]
                      : purchaseSubTab === "equipment"
                      ? ["Date", "Description", "Vendor", "Serial #", "Depreciation Method", "Life / Asset Class", `${selectedYear} Deduction ($)`, "Amount ($)", "Job", "Notes"]
                      : ["Date", "Description", "Vendor", "Amount ($)", "Job", "Notes"];
                    const rows = items.map(p => {
                      const base = [p.date || "", p.name || "", p.vendor || ""];
                      if (purchaseSubTab === "meals") return [...base, p.mealType === "travel_dining" ? "Travel Dining" : "Business Meeting", p.amount || 0, p.jobId ? (jobs.find(j => j.id === p.jobId)?.name || p.jobId) : "", p.notes || ""];
                      if (purchaseSubTab === "equipment") {
                        const method = p.depreciationMethod || "section179";
                        const methodLabel = { "section179": "Section 179", "bonus": "Bonus Depreciation", "straight-line": "Straight-Line", "macrs": "MACRS" }[method] || method;
                        const lifeClass = method === "straight-line" ? (p.usefulLife ? p.usefulLife + " yr" : "—") : method === "macrs" ? (p.macrsClass || "—") : "—";
                        const deduction = calcEquipDeduction(p, selectedYear);
                        return [...base, p.serial || "", methodLabel, lifeClass, deduction > 0 ? deduction.toFixed(2) : "0.00", p.amount || 0, p.jobId ? (jobs.find(j => j.id === p.jobId)?.name || p.jobId) : "", p.notes || ""];
                      }
                      return [...base, p.amount || 0, p.jobId ? (jobs.find(j => j.id === p.jobId)?.name || p.jobId) : "", p.notes || ""];
                    });
                    downloadCSV([header, ...rows], `${purchaseSubTab}_${selectedYear}.csv`);
                  }} variant="outline" className="gap-1.5 border-slate-300 text-slate-600 hover:bg-slate-50">
                    <FileDown size={14} />CSV
                  </Button>
                  <Button onClick={() => generateExpenseReport(purchaseSubTab)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Receipt size={14} />Receipts PDF
                  </Button>
                </div>
              )}
            </div>

            {/* Add purchase form */}
            <Card className="p-6">
              <h3 className="text-base font-bold mb-4">Log {purchaseSubTab === "expendables" ? "Expendable" : purchaseSubTab === "meals" ? "Meal" : "Equipment"} Purchase</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                <div className="space-y-1 lg:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Item Name</label>
                  <Input value={newPurchase.name} onChange={e => setNewPurchase(p => ({ ...p, name: e.target.value }))} placeholder={purchaseSubTab === "expendables" ? "e.g. Gels, tape, batteries" : purchaseSubTab === "meals" ? "e.g. Client lunch, team dinner" : "e.g. Camera, lens, tripod"} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Vendor</label>
                  <Input value={newPurchase.vendor} onChange={e => setNewPurchase(p => ({ ...p, vendor: e.target.value }))} placeholder="B&H, Amazon…" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Amount ($)</label>
                  <Input type="number" value={newPurchase.amount} onChange={e => setNewPurchase(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
                  <Input type="date" value={newPurchase.date} onChange={e => setNewPurchase(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div className="space-y-1 sm:col-span-2 lg:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Notes (optional)</label>
                  <Input value={newPurchase.notes} onChange={e => setNewPurchase(p => ({ ...p, notes: e.target.value }))} placeholder="Any extra details" />
                </div>
                {purchaseSubTab === "meals" && (
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Meal Type</label>
                    <select value={newPurchase.mealType} onChange={e => setNewPurchase(p => ({ ...p, mealType: e.target.value }))}
                      className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                      <option value="business_meeting">Business Meeting</option>
                      <option value="travel_dining">Travel Dining</option>
                    </select>
                  </div>
                )}
                {purchaseSubTab !== "meals" && (
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Serial Number (optional)</label>
                    <Input value={newPurchase.serial} onChange={e => setNewPurchase(p => ({ ...p, serial: e.target.value }))} placeholder="e.g. SN123456789" className="font-mono" />
                  </div>
                )}
                <div className="space-y-1 lg:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Job</label>
                  <select value={newPurchase.jobId} onChange={e => setNewPurchase(p => ({ ...p, jobId: e.target.value }))}
                    className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                    <option value="">— Unassigned —</option>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer text-sm font-semibold transition-colors ${
                    newPurchase.isKit ? "bg-indigo-100 text-indigo-700 border-indigo-300" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  }`}>
                    <input type="checkbox" checked={!!newPurchase.isKit} onChange={e => setNewPurchase(p => ({ ...p, isKit: e.target.checked }))} className="w-4 h-4 rounded accent-indigo-600" />
                    <Layers size={14} />Kit
                  </label>
                </div>
                <Button onClick={addPurchase} className="h-10"><Plus size={16} className="mr-1.5" /> Add</Button>
              </div>
            </Card>

            {/* Purchase list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xl font-bold">
                  {purchaseSubTab === "expendables" ? <><Package size={18} className="inline mr-2 -mt-0.5 text-rose-500" />Expendables</> : purchaseSubTab === "meals" ? <><Utensils size={18} className="inline mr-2 -mt-0.5 text-amber-500" />Meals</> : <><Wrench size={18} className="inline mr-2 -mt-0.5 text-violet-600" />Equipment</>}
                  <span className="ml-2 text-slate-400 font-normal text-base">— {selectedYear}</span>
                </h3>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Group by</span>
                  <button onClick={() => setPurchaseGroupBy("job")}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${purchaseGroupBy === "job" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                    <Briefcase size={12} className="inline mr-1 -mt-0.5" />Job
                  </button>
                  <button onClick={() => setPurchaseGroupBy("vendor")}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${purchaseGroupBy === "vendor" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                    <ShoppingCart size={12} className="inline mr-1 -mt-0.5" />Vendor
                  </button>
                </div>
              </div>
              {(() => {
                const activeItems = purchaseSubTab === "expendables" ? filteredExpendables : purchaseSubTab === "meals" ? filteredMeals : filteredEquipment;
                const accentColor = purchaseSubTab === "expendables" ? "text-rose-600" : purchaseSubTab === "meals" ? "text-amber-600" : "text-violet-600";

                const groups = purchaseGroupBy === "vendor"
                  ? (() => {
                      const vendorMap = new Map();
                      activeItems.forEach(p => {
                        const key = p.vendor?.trim() || "No Vendor";
                        if (!vendorMap.has(key)) vendorMap.set(key, []);
                        vendorMap.get(key).push(p);
                      });
                      return [...vendorMap.entries()]
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([name, items]) => ({ id: "v_" + name, name, items, isVendor: true }));
                    })()
                  : [
                      ...jobs.map(j => ({ ...j, items: activeItems.filter(p => p.jobId === j.id) })),
                      { id: "", name: "Unassigned", items: activeItems.filter(p => !p.jobId || !jobs.find(j => j.id === p.jobId)) },
                    ].filter(g => sq ? g.items.length > 0 : (g.items.length > 0 || g.id !== ""));

                if (groups.every(g => g.items.length === 0)) {
                  return (
                    <div className="py-20 text-center bg-white border-2 border-dashed border-slate-200 rounded-2xl">
                      <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                        {purchaseSubTab === "expendables" ? <Package size={32} /> : purchaseSubTab === "meals" ? <Utensils size={32} /> : <Wrench size={32} />}
                      </div>
                      <h4 className="text-slate-900 font-semibold">{sq ? `No ${purchaseSubTab} match "${sq}"` : `No ${purchaseSubTab} logged for ${selectedYear}`}</h4>
                      <p className="text-slate-500 text-sm">{sq ? "Try a different search term." : "Use the form above to add your first entry."}</p>
                    </div>
                  );
                }

                const PurchaseCard = ({ p }) => {
                  const idx = purchases.findIndex(x => x.id === p.id);
                  const upd = (field, val) => { const n = [...purchases]; n[idx] = { ...n[idx], [field]: val }; setPurchases(n); };
                  const isLocked = !!p.locked;
                  return (
                    <Card key={p.id} id={p.id} className={`transition-all flex flex-col ${isLocked ? "border-amber-200 bg-amber-50/20" : "hover:border-rose-200"} ${highlightedId === p.id ? "ring-2 ring-rose-500 border-rose-400" : ""}`}>
                      <div className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-1.5">
                            <select value={p.category} onChange={e => upd("category", e.target.value)} disabled={isLocked}
                              className={`text-[10px] font-bold uppercase tracking-wider border rounded px-2 py-0.5 focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                p.category === "expendables" ? "bg-rose-100 text-rose-700 border-rose-200" : p.category === "meals" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-violet-100 text-violet-700 border-violet-200"
                              }`}>
                              <option value="expendables">Expendables</option>
                              <option value="equipment">Equipment</option>
                              <option value="meals">Meals</option>
                            </select>
                            {/* Kit checkbox */}
                            <label className={`flex items-center gap-1 px-2 py-0.5 rounded border cursor-pointer text-[10px] font-bold uppercase tracking-wider transition-colors ${
                              p.isKit ? "bg-indigo-100 text-indigo-700 border-indigo-200" : "bg-slate-100 text-slate-500 border-slate-200 hover:border-slate-300"
                            } ${isLocked ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}>
                              <input type="checkbox" checked={!!p.isKit} disabled={isLocked}
                                onChange={e => upd("isKit", e.target.checked)}
                                className="w-3 h-3 rounded accent-indigo-600 cursor-pointer" />
                              Kit
                            </label>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => upd("locked", !p.locked)}
                              className={`p-1.5 rounded-lg transition-colors ${isLocked ? "text-amber-600 bg-amber-100 hover:bg-amber-200" : "text-slate-300 hover:text-slate-500 hover:bg-slate-100"}`}
                              title={isLocked ? "Unlock entry to edit" : "Lock entry to prevent edits"}>
                              {isLocked ? <Lock size={13} /> : <LockOpen size={13} />}
                            </button>
                            <select value={p.jobId || ""} onChange={e => upd("jobId", e.target.value)} disabled={isLocked}
                              className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-500 focus:outline-none max-w-[90px] disabled:opacity-50 disabled:cursor-not-allowed" title="Move to job">
                              <option value="">Unassigned</option>
                              {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                            </select>
                            <Button variant="danger" onClick={() => deletePurchase(p.id)} className="!p-1.5"><Trash2 size={13} /></Button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Item Name</label>
                          <Input value={p.name} placeholder="Item name" disabled={isLocked} onChange={e => upd("name", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Vendor</label>
                          <Input value={p.vendor || ""} placeholder="Vendor / store" disabled={isLocked} onChange={e => upd("vendor", e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Amount ($)</label>
                            <Input type="number" value={p.amount} disabled={isLocked} onChange={e => upd("amount", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
                            <Input type="date" value={p.date} disabled={isLocked} onChange={e => upd("date", e.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Notes</label>
                          <Input value={p.notes || ""} placeholder="Optional notes" disabled={isLocked} onChange={e => upd("notes", e.target.value)} />
                        </div>
                        {p.category === "meals" ? (
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Meal Type</label>
                            <select value={p.mealType || "business_meeting"} disabled={isLocked} onChange={e => upd("mealType", e.target.value)}
                              className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
                              <option value="business_meeting">Business Meeting</option>
                              <option value="travel_dining">Travel Dining</option>
                            </select>
                          </div>
                        ) : (
                          <>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Serial Number</label>
                            <Input value={p.serial || ""} placeholder="e.g. SN123456789" disabled={isLocked} onChange={e => upd("serial", e.target.value)} className="font-mono" />
                          </div>
                          {p.category === "equipment" && (
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Calculator size={10} />Depreciation Method</label>
                                <select value={p.depreciationMethod || "section179"} disabled={isLocked} onChange={e => upd("depreciationMethod", e.target.value)}
                                  className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
                                  <option value="section179">Section 179 — Full deduction year 1</option>
                                  <option value="bonus">Bonus Depreciation — 100% year 1</option>
                                  <option value="straight-line">Straight-Line — Spread over useful life</option>
                                  <option value="macrs">MACRS — IRS half-year tables</option>
                                </select>
                              </div>
                              {(p.depreciationMethod === "straight-line") && (
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Useful Life (years)</label>
                                  <select value={p.usefulLife || "5"} disabled={isLocked} onChange={e => upd("usefulLife", e.target.value)}
                                    className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <option value="3">3 years</option>
                                    <option value="5">5 years</option>
                                    <option value="7">7 years</option>
                                    <option value="10">10 years</option>
                                    <option value="15">15 years</option>
                                  </select>
                                </div>
                              )}
                              {(p.depreciationMethod === "macrs") && (
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase">MACRS Asset Class</label>
                                  <select value={p.macrsClass || "5yr"} disabled={isLocked} onChange={e => upd("macrsClass", e.target.value)}
                                    className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <option value="3yr">3-year (small tools, tractors)</option>
                                    <option value="5yr">5-year (cameras, computers, cars)</option>
                                    <option value="7yr">7-year (office furniture, equipment)</option>
                                    <option value="10yr">10-year (certain manufacturing equip)</option>
                                    <option value="15yr">15-year (land improvements)</option>
                                  </select>
                                </div>
                              )}
                              {(p.depreciationMethod === "straight-line" || p.depreciationMethod === "macrs") && p.date && parseFloat(p.amount) > 0 && (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Depreciation Schedule</p>
                                  {(() => {
                                    const cost = parseFloat(p.amount) || 0;
                                    const purchaseYear = parseInt(p.date.slice(0, 4), 10);
                                    const thisYear = new Date().getFullYear();
                                    const rows = p.depreciationMethod === "macrs"
                                      ? (MACRS_TABLES[p.macrsClass || "5yr"] || MACRS_TABLES["5yr"]).map((pct, i) => ({ year: purchaseYear + i, amount: cost * pct / 100 }))
                                      : Array.from({ length: parseInt(p.usefulLife || 5) }, (_, i) => ({ year: purchaseYear + i, amount: cost / parseInt(p.usefulLife || 5) }));
                                    return rows.map(({ year, amount }) => (
                                      <div key={year} className={`flex justify-between text-xs py-0.5 ${year === thisYear ? "font-bold" : ""}`}>
                                        <span className={year === thisYear ? "text-blue-600" : "text-slate-400"}>{year}{year === thisYear ? " ← current" : ""}</span>
                                        <span className={year === thisYear ? "text-emerald-600 font-mono" : "text-slate-500 font-mono"}>${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                      </div>
                                    ));
                                  })()}
                                </div>
                              )}
                            </div>
                          )}
                          </>
                        )}
                        {/* Kit rental rates — shown only when isKit is checked */}
                        {p.isKit && (
                          <div className="pt-2 border-t border-indigo-100 space-y-2">
                            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                              <Layers size={10} />Kit Rental Rates
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Daily Rate ($)</label>
                                <Input type="number" value={p.kitDailyRate || ""} placeholder="0.00" disabled={isLocked} onChange={e => upd("kitDailyRate", e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Weekly Rate ($)</label>
                                <Input type="number" value={p.kitWeeklyRate || ""} placeholder="0.00" disabled={isLocked} onChange={e => upd("kitWeeklyRate", e.target.value)} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
                        {!p.receipt ? (
                          <div className="relative flex-1">
                            <input type="file" accept="image/*,.pdf" className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                              onChange={e => { if (e.target.files[0]) handleReceiptUpload(p.id, e.target.files[0]); e.target.value = ""; }} />
                            <Button variant="outline" className="w-full text-slate-500 border-slate-200">
                              <UploadCloud size={14} className="mr-1.5" />Attach Receipt
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Button variant="outline" className="flex-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => setPreviewItem({ id: "receipt_" + p.id, fileName: p.receipt.fileName, fileId: p.receipt.fileId, fileType: p.receipt.fileType })}>
                              <Eye size={14} className="mr-1.5" />View Receipt
                            </Button>
                            <Button variant="danger" onClick={() => { setPurchases(prev => prev.map(x => x.id === p.id ? { ...x, receipt: undefined } : x)); URL.revokeObjectURL(blobCache.current.get("receipt_" + p.id)?.url); blobCache.current.delete("receipt_" + p.id); }} className="!px-2" title="Remove receipt">
                              <X size={14} />
                            </Button>
                          </>
                        )}
                      </div>
                    </Card>
                  );
                };

                return groups.map(group => {
                  if (group.items.length === 0) return null;
                  const isVendorGroup = !!group.isVendor;
                  const isExpanded = sq || isVendorGroup || group.id === "" ? true : expandedJobs.has("pur_" + group.id);
                  const groupTotal = group.items.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
                  const GroupIcon = isVendorGroup ? ShoppingCart : Briefcase;
                  return (
                    <div key={group.id || "unassigned"} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 cursor-pointer select-none"
                        onClick={() => !isVendorGroup && group.id && toggleJobExpanded("pur_" + group.id)}>
                        <div className="flex items-center gap-2">
                          {!isVendorGroup && group.id ? (
                            isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />
                          ) : <span className="w-4" />}
                          <GroupIcon size={15} className="text-slate-400" />
                          <span className="font-semibold text-slate-800 text-sm">{group.name}</span>
                          <span className="text-xs text-slate-400">({group.items.length} item{group.items.length !== 1 ? "s" : ""})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold ${accentColor}`}>${groupTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          {!isVendorGroup && group.id && <Button variant="danger" onClick={e => { e.stopPropagation(); deleteJob(group.id); }} className="!p-1 ml-1" title="Delete job"><Trash2 size={13} /></Button>}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="p-4">
                          {group.items.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-6">No {purchaseSubTab === "meals" ? "meal entries" : purchaseSubTab} in this job yet. Select it in the form above.</p>
                          ) : (
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                              {group.items.map(p => <PurchaseCard key={p.id} p={p} />)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </>
        )}

        {activeTab === "kit" && (() => {
          const kitItems = purchases.filter(p => p.isKit);
          const updKitItem = (id, field, val) => {
            setPurchases(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
          };
          const deletePackage = (pkgId) => setKitPackages(prev => prev.filter(x => x.id !== pkgId));
          const updPackage = (pkgId, field, val) => setKitPackages(prev => prev.map(p => p.id === pkgId ? { ...p, [field]: val } : p));
          const removeItemFromPackage = (pkgId, itemId) => {
            setKitPackages(prev => prev.map(pkg =>
              pkg.id !== pkgId ? pkg : { ...pkg, itemIds: (pkg.itemIds || []).filter(x => x !== itemId) }
            ));
          };
          const addItemToPackage = (pkgId, itemId) => {
            if (!itemId) return;
            setKitPackages(prev => prev.map(pkg =>
              pkg.id !== pkgId ? pkg : { ...pkg, itemIds: [...new Set([...(pkg.itemIds || []), itemId])] }
            ));
          };
          const addPackage = () => {
            if (!newPackage.name.trim()) return;
            setKitPackages(prev => [...prev, {
              id: crypto.randomUUID(),
              name: newPackage.name.trim(),
              dailyRate: newPackage.dailyRate,
              weeklyRate: newPackage.weeklyRate,
              notes: newPackage.notes,
              barcode: newPackage.barcode,
              itemIds: [],
              locked: true,
              timestamp: Date.now(),
            }]);
            setNewPackage({ name: "", dailyRate: "", weeklyRate: "", notes: "", barcode: "", itemIds: [] });
          };
          const totalKitDailyRate = kitItems.reduce((a, p) => a + (parseFloat(p.kitDailyRate) || 0), 0);
          const totalKitWeeklyRate = kitItems.reduce((a, p) => a + (parseFloat(p.kitWeeklyRate) || 0), 0);

          return (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card className="p-6 bg-indigo-50 border-indigo-200">
                  <p className="text-indigo-700 text-sm font-medium">Kit Items</p>
                  <h2 className="text-3xl font-bold mt-1 text-indigo-700">{kitItems.length}</h2>
                </Card>
                <Card className="p-6 bg-indigo-50 border-indigo-200">
                  <p className="text-indigo-700 text-sm font-medium">Total Daily Rate</p>
                  <h2 className="text-3xl font-bold mt-1 text-indigo-700">${totalKitDailyRate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                </Card>
                <Card className="p-6 bg-indigo-50 border-indigo-200">
                  <p className="text-indigo-700 text-sm font-medium">Total Weekly Rate</p>
                  <h2 className="text-3xl font-bold mt-1 text-indigo-700">${totalKitWeeklyRate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                </Card>
              </div>

              {/* Sub-tabs */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                <button onClick={() => setKitSubTab("items")} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${kitSubTab === "items" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                  <Layers size={13} className="inline mr-1.5 -mt-0.5" />Kit Items
                </button>
                <button onClick={() => setKitSubTab("packages")} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${kitSubTab === "packages" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                  <Package size={13} className="inline mr-1.5 -mt-0.5" />Packages ({kitPackages.length})
                </button>
              </div>

              {/* Kit Items sub-tab */}
              {kitSubTab === "items" && (
                <>
                  {kitItems.length === 0 ? (
                    <div className="py-20 text-center bg-white border-2 border-dashed border-slate-200 rounded-2xl">
                      <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300"><Layers size={32} /></div>
                      <h4 className="text-slate-900 font-semibold">No kit items yet</h4>
                      <p className="text-slate-500 text-sm mt-1">Check the "Kit" box on a purchase entry to add it here.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {kitItems.map(p => {
                        const kitLocked = !!p.locked;
                        return (
                        <Card key={p.id} className={`space-y-3 transition-all ${kitLocked ? "border-amber-200 bg-amber-50/20" : ""}`}>
                          <div className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate">{p.name || <span className="text-slate-400 italic">Unnamed item</span>}</p>
                              {p.vendor && <p className="text-xs text-slate-500 truncate">{p.vendor}</p>}
                              {p.serial && <p className="text-[10px] text-slate-400 font-mono truncate">SN: {p.serial}</p>}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[10px] font-bold uppercase tracking-wider border rounded px-2 py-0.5 ${
                                p.category === "expendables" ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-violet-100 text-violet-700 border-violet-200"
                              }`}>{p.category}</span>
                              <button
                                onClick={() => updKitItem(p.id, "locked", !p.locked)}
                                className={`p-1.5 rounded-lg transition-colors ${kitLocked ? "text-amber-600 bg-amber-100 hover:bg-amber-200" : "text-slate-300 hover:text-slate-500 hover:bg-slate-100"}`}
                                title={kitLocked ? "Unlock to edit" : "Lock entry"}>
                                {kitLocked ? <Lock size={13} /> : <LockOpen size={13} />}
                              </button>
                            </div>
                          </div>
                          <div className="pt-2 border-t border-indigo-100 space-y-2">
                            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5"><Layers size={10} />Kit Rental Rates</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Daily ($)</label>
                                <Input type="number" value={p.kitDailyRate || ""} placeholder="0.00" disabled={kitLocked} onChange={e => updKitItem(p.id, "kitDailyRate", e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Weekly ($)</label>
                                <Input type="number" value={p.kitWeeklyRate || ""} placeholder="0.00" disabled={kitLocked} onChange={e => updKitItem(p.id, "kitWeeklyRate", e.target.value)} />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Barcode</label>
                              <Input value={p.barcode || ""} placeholder="Scan or enter barcode" disabled={kitLocked} onChange={e => updKitItem(p.id, "barcode", e.target.value)} className="font-mono" />
                            </div>
                          </div>
                          </div>
                        </Card>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* Packages sub-tab */}
              {kitSubTab === "packages" && (
                <>
                  {/* New package form */}
                  <Card className="p-5 space-y-4 border-indigo-200 bg-indigo-50/30">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Package size={16} className="text-indigo-500" />New Package</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Package Name</label>
                        <Input value={newPackage.name} placeholder="e.g. Camera Package A" onChange={e => setNewPackage(p => ({ ...p, name: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Daily Rate ($)</label>
                        <Input type="number" value={newPackage.dailyRate} placeholder="0.00" onChange={e => setNewPackage(p => ({ ...p, dailyRate: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Weekly Rate ($)</label>
                        <Input type="number" value={newPackage.weeklyRate} placeholder="0.00" onChange={e => setNewPackage(p => ({ ...p, weeklyRate: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Barcode</label>
                        <Input value={newPackage.barcode} placeholder="Scan or enter barcode" onChange={e => setNewPackage(p => ({ ...p, barcode: e.target.value }))} className="font-mono" />
                      </div>
                    </div>
                    <Button onClick={addPackage} disabled={!newPackage.name.trim()}><Plus size={15} className="mr-1.5" />Create Package</Button>
                  </Card>

                  {/* Existing packages as windows */}
                  {kitPackages.length === 0 ? (
                    <div className="py-16 text-center bg-white border-2 border-dashed border-slate-200 rounded-2xl">
                      <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300"><Package size={32} /></div>
                      <h4 className="text-slate-900 font-semibold">No packages yet</h4>
                      <p className="text-slate-500 text-sm mt-1">Use the form above to create your first package.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {kitPackages.map(pkg => {
                        const pkgItems = kitItems.filter(p => (pkg.itemIds || []).includes(p.id));
                        const availableToAdd = kitItems.filter(p => !(pkg.itemIds || []).includes(p.id));
                        const pkgLocked = !!pkg.locked;
                        return (
                          <Card key={pkg.id} className={`flex flex-col overflow-hidden transition-all ${pkgLocked ? "border-amber-200" : "border-indigo-200"}`}>
                            {/* Window title bar */}
                            <div className={`flex items-center justify-between px-4 py-3 text-white ${pkgLocked ? "bg-amber-500" : "bg-indigo-600"}`}>
                              <div className="flex items-center gap-2 min-w-0">
                                <Package size={14} className="shrink-0" />
                                <input
                                  value={pkg.name}
                                  disabled={pkgLocked}
                                  onChange={e => updPackage(pkg.id, "name", e.target.value)}
                                  className="bg-transparent font-semibold text-sm truncate border-b border-transparent hover:border-white/50 focus:border-white focus:outline-none w-full disabled:cursor-not-allowed"
                                />
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <button
                                  onClick={() => updPackage(pkg.id, "locked", !pkg.locked)}
                                  className="text-white/70 hover:text-white transition-colors"
                                  title={pkgLocked ? "Unlock to edit" : "Lock package"}>
                                  {pkgLocked ? <Lock size={14} /> : <LockOpen size={14} />}
                                </button>
                                <button onClick={() => deletePackage(pkg.id)} className="text-white/70 hover:text-white transition-colors" title="Delete package">
                                  <X size={15} />
                                </button>
                              </div>
                            </div>

                            {/* Window body */}
                            <div className={`p-4 space-y-4 flex-1 ${pkgLocked ? "bg-amber-50/20" : ""}`}>
                              {/* Rates */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Daily Rate ($)</label>
                                  <Input type="number" value={pkg.dailyRate} placeholder="0.00" disabled={pkgLocked} onChange={e => updPackage(pkg.id, "dailyRate", e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Weekly Rate ($)</label>
                                  <Input type="number" value={pkg.weeklyRate} placeholder="0.00" disabled={pkgLocked} onChange={e => updPackage(pkg.id, "weeklyRate", e.target.value)} />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Barcode</label>
                                <Input value={pkg.barcode || ""} placeholder="Scan or enter barcode" disabled={pkgLocked} onChange={e => updPackage(pkg.id, "barcode", e.target.value)} className="font-mono" />
                              </div>

                              {/* Items in this package */}
                              {pkgItems.length > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Items ({pkgItems.length})</p>
                                  {pkgItems.map(item => (
                                    <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg">
                                      <span className="text-sm text-slate-700 truncate">{item.name || "Unnamed"}</span>
                                      {!pkgLocked && <button onClick={() => removeItemFromPackage(pkg.id, item.id)} className="shrink-0 text-slate-300 hover:text-rose-500 transition-colors" title="Remove from package">
                                        <X size={13} />
                                      </button>}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Add item dropdown */}
                              {!pkgLocked && availableToAdd.length > 0 && (
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Add Item from Kit</label>
                                  <select
                                    defaultValue=""
                                    onChange={e => { addItemToPackage(pkg.id, e.target.value); e.target.value = ""; }}
                                    className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400">
                                    <option value="" disabled>— select a kit item —</option>
                                    {availableToAdd.map(item => (
                                      <option key={item.id} value={item.id}>{item.name || "Unnamed"}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              {availableToAdd.length === 0 && kitItems.length > 0 && (
                                <p className="text-[10px] text-slate-400 italic">All kit items are in this package.</p>
                              )}
                              {kitItems.length === 0 && (
                                <p className="text-[10px] text-slate-400 italic">No kit items yet. Mark a purchase as Kit to add items here.</p>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          );
        })()}

        {/* ── PRODUCTION CALENDAR ── */}
        {activeTab === "calendar" && (() => {
          const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
          const today = new Date().toISOString().split("T")[0];

          // Build event map from timecards + invoices
          const eventMap = {};
          const addEv = (date, ev) => { if (!date) return; if (!eventMap[date]) eventMap[date] = []; eventMap[date].push(ev); };

          timecards.forEach(tc => {
            (tc.days || []).forEach(d => {
              const type = d.type || "work";
              const hasWork = !!(d.call || d.totalHours > 0);
              if (type === "hold") {
                addEv(d.date, { kind: "hold", label: tc.company || "Hold Day", tc });
              } else if (type === "travel") {
                addEv(d.date, { kind: "travel", label: (tc.company || "Travel") + " · Travel", tc });
              } else if (type === "work" && hasWork) {
                addEv(d.date, { kind: "shoot", label: tc.company || "Shoot Day", hours: d.totalHours, tc });
              }
            });
          });

          // Standalone hold days
          holdDays.forEach(hd => {
            const released = new Set(hd.releasedDates || []);
            const dates = hd.dates || [];
            if (hd.startDate && !hd.dates) {
              const start = new Date(hd.startDate + "T12:00");
              const end = hd.endDate ? new Date(hd.endDate + "T12:00") : start;
              for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
                const iso = dt.toISOString().split("T")[0];
                if (!released.has(iso)) addEv(iso, { kind: "hold", holdType: hd.type || "hold", label: hd.company || "Hold Day", holdId: hd.id, holdDate: iso });
              }
            } else {
              dates.forEach(iso => {
                if (!released.has(iso)) addEv(iso, { kind: "hold", holdType: hd.type || "hold", label: hd.company || "Hold Day", holdId: hd.id, holdDate: iso });
              });
            }
          });

          invoices.forEach(inv => {
            if (inv.dueDate) {
              const s = computeInvoiceStatus(inv);
              const isPaid = s === "Paid";
              const isOverdue = !isPaid && inv.dueDate < today;
              addEv(inv.dueDate, { kind: isPaid ? "inv-paid" : isOverdue ? "inv-overdue" : "inv-due", label: `${inv.company || "Invoice"} — Due`, amount: inv.amount, inv });
            }
          });

          // Build grid for calYear / calMonth
          const firstDow = new Date(calYear, calMonth, 1).getDay();
          const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
          const cells = [];
          for (let i = 0; i < firstDow; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) {
            const iso = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            cells.push({ d, iso, evs: eventMap[iso] || [] });
          }
          while (cells.length % 7 !== 0) cells.push(null);

          const prevMonth = () => { const dt = new Date(calYear, calMonth - 1, 1); setCalMonth(dt.getMonth()); setCalYear(dt.getFullYear()); };
          const nextMonth = () => { const dt = new Date(calYear, calMonth + 1, 1); setCalMonth(dt.getMonth()); setCalYear(dt.getFullYear()); };
          const selSet = new Set(calSelectedDates);
          const toggleDate = iso => setCalSelectedDates(prev => prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso]);

          const kindStyle = { shoot: "bg-blue-100 text-blue-800", hold: "bg-amber-100 text-amber-800", travel: "bg-purple-100 text-purple-800", "inv-due": "bg-orange-100 text-orange-800", "inv-overdue": "bg-red-100 text-red-800", "inv-paid": "bg-emerald-100 text-emerald-700" };
          const kindDot = { shoot: "🎬", hold: "⏸", travel: "✈", "inv-due": "💰", "inv-overdue": "⚠", "inv-paid": "✓" };
          const holdTypeStyle = { soft: "bg-pink-100 text-pink-700", hold: "bg-blue-100 text-blue-800", locked: "bg-orange-100 text-orange-800", travel: "bg-purple-100 text-purple-800", prep: "bg-teal-100 text-teal-800", scout: "bg-cyan-100 text-cyan-800", wrap: "bg-slate-100 text-slate-700" };
          const holdTypeDot = { soft: "✏️", hold: "⏸", locked: "🔒", travel: "✈️", prep: "🔧", scout: "🚧", wrap: "📦" };
          const holdTypeLabel = { soft: "Soft Hold", hold: "Hold", locked: "Locked", travel: "Travel", prep: "Prep", scout: "Scout", wrap: "Wrap" };
          const getChipStyle = ev => ev.holdType ? (holdTypeStyle[ev.holdType] || kindStyle.hold) : kindStyle[ev.kind];
          const getChipDot = ev => ev.holdType ? (holdTypeDot[ev.holdType] || kindDot.hold) : kindDot[ev.kind];

          return (
            <div className="space-y-4">
              {/* Navigation */}
              <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-3 shadow-sm">
                <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"><ChevronLeft size={18} /></button>
                <div className="text-center">
                  <h2 className="text-xl font-bold text-slate-800">{MONTH_NAMES[calMonth]} {calYear}</h2>
                  <button onClick={() => { setCalMonth(new Date().getMonth()); setCalYear(new Date().getFullYear()); }} className="text-[10px] text-blue-500 hover:underline mt-0.5">Today</button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setCalSelectMode(m => !m); setCalSelectedDates([]); }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-colors shadow-sm ${calSelectMode ? "bg-amber-500 text-white ring-2 ring-amber-300" : "bg-amber-400 text-white hover:bg-amber-500"}`}
                  >
                    <span className="text-base leading-none">⏸</span> {calSelectMode ? "Selecting…" : "Add hold and travel days"}
                  </button>
                  <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"><ChevronRight size={18} /></button>
                </div>
              </div>

              {/* Select-mode action bar */}
              {calSelectMode && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 shadow-sm">
                  <p className="text-sm text-amber-800">
                    {calSelectedDates.length === 0
                      ? <span className="font-medium">Tap days on the calendar to select them for a hold</span>
                      : <span className="font-bold">{calSelectedDates.length} day{calSelectedDates.length !== 1 ? "s" : ""} selected</span>}
                  </p>
                  <div className="flex items-center gap-2">
                    {calSelectedDates.length > 0 && (
                      <button
                        onClick={() => { setHoldNameInput(""); setHoldTypeInput("hold"); setHoldNamePrompt(true); }}
                        className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
                      >Apply Hold</button>
                    )}
                    <button
                      onClick={() => { setCalSelectMode(false); setCalSelectedDates([]); }}
                      className="px-3 py-1.5 text-xs font-semibold border border-amber-300 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
                    >Cancel</button>
                  </div>
                </div>
              )}

              {/* Two-column layout: calendar left, journal right */}
              <div className="flex gap-4 items-start">
                {/* Left: DOW headers + grid */}
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Day-of-week headers */}
                  <div className="grid grid-cols-7 gap-1 px-0.5">
                    {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(dn => (
                      <div key={dn} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider py-1">{dn}</div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((cell, ci) => {
                      const isSelected = cell && selSet.has(cell.iso);
                      const notePreview = cell && calendarNotes[cell.iso]
                        ? calendarNotes[cell.iso].split("\n").filter(l => l.trim()).slice(0, 2)
                        : null;
                      return (
                        <div
                          key={ci}
                          onClick={() => {
                            if (!cell) return;
                            if (calSelectMode) { toggleDate(cell.iso); return; }
                            if (calNoteDate === cell.iso) { setCalNoteDate(null); setCalNoteEditing(false); return; }
                            const existing = calendarNotes[cell.iso] || "";
                            setCalNoteDate(cell.iso);
                            setCalNoteEditing(!existing);
                            setCalNoteDraft(existing);
                          }}
                          className={`min-h-[88px] rounded-xl border p-1.5 flex flex-col transition-colors ${
                            cell === null ? "bg-transparent border-transparent" :
                            isSelected ? "border-amber-500 bg-amber-50 ring-2 ring-amber-400 cursor-pointer" :
                            calSelectMode ? "border-slate-200 bg-white hover:bg-amber-50 hover:border-amber-300 cursor-pointer" :
                            calNoteDate === cell.iso ? "border-blue-500 bg-blue-50 ring-2 ring-blue-300 cursor-pointer" :
                            cell.iso === today ? "border-blue-400 bg-blue-50 shadow-sm cursor-pointer" :
                            "border-slate-200 bg-white hover:border-blue-200 cursor-pointer"
                          }`}
                        >
                          {cell && (
                            <>
                              <div className="flex items-start justify-between mb-1">
                                <div className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shrink-0 ${
                                  isSelected ? "bg-amber-500 text-white" :
                                  cell.iso === today ? "bg-blue-600 text-white" : "text-slate-600"
                                }`}>{cell.d}</div>
                                {calendarNotes[cell.iso] && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1 shrink-0" title="Has note" />}
                              </div>
                              <div className="space-y-0.5 flex-1">
                                {cell.evs.slice(0, 3).map((ev, ei) => (
                                  <div key={ei} className={`text-[9px] px-1 py-0.5 rounded truncate font-medium leading-tight flex items-center gap-0.5 ${getChipStyle(ev)}`} title={ev.label + (ev.hours ? ` (${ev.hours}h)` : "") + (ev.amount ? ` · $${(parseFloat(ev.amount)||0).toLocaleString()}` : "")}>
                                    <span className="truncate flex-1">{getChipDot(ev)} {ev.label}</span>
                                    {ev.holdId && !calSelectMode && <button onClick={e => { e.stopPropagation(); setHoldReleaseModal({ holdId: ev.holdId, date: cell.iso }); }} className="shrink-0 opacity-60 hover:opacity-100 ml-0.5 leading-none" title="Release options">&times;</button>}
                                  </div>
                                ))}
                                {cell.evs.length > 3 && <div className="text-[9px] text-slate-400 font-medium pl-1">+{cell.evs.length - 3} more</div>}
                              </div>
                              {notePreview && (
                                <div className="mt-1 pt-1 border-t border-blue-100 space-y-0.5">
                                  {notePreview.map((line, i) => (
                                    <p key={i} className="text-[8px] text-blue-500 truncate leading-snug">📝 {line}</p>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Journal panel */}
                {calNoteDate && !calSelectMode && (() => {
                  const savedNote = calendarNotes[calNoteDate] || "";
                  const dateLabel = new Date(calNoteDate + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
                  const dayEvs = eventMap[calNoteDate] || [];
                  return (
                    <div className="w-72 shrink-0 sticky top-4">
                      <Card className="p-4 border-blue-200 !bg-blue-50 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-xs font-bold text-blue-800 flex items-center gap-1.5 leading-tight">
                            <PenLine size={13} />{dateLabel}
                          </h3>
                          <button onClick={() => { setCalNoteDate(null); setCalNoteEditing(false); }} className="text-slate-400 hover:text-slate-600 text-lg leading-none shrink-0">&times;</button>
                        </div>
                        {dayEvs.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {dayEvs.map((ev, i) => (
                              <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${getChipStyle(ev)}`}>
                                {getChipDot(ev)} {ev.label}
                              </span>
                            ))}
                          </div>
                        )}
                        {calNoteEditing ? (
                          <>
                            <textarea
                              value={calNoteDraft}
                              onChange={e => setCalNoteDraft(e.target.value)}
                              placeholder="Write your journal entry…"
                              rows={8}
                              autoFocus
                              className="w-full text-sm border border-blue-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  if (calNoteDraft.trim()) { setCalendarNotes(prev => ({ ...prev, [calNoteDate]: calNoteDraft })); }
                                  else { setCalendarNotes(prev => { const n = { ...prev }; delete n[calNoteDate]; return n; }); }
                                  setCalNoteEditing(false);
                                }}
                                className="flex-1 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                              >Save</button>
                              <button
                                onClick={() => { if (!savedNote) setCalNoteDate(null); setCalNoteEditing(false); setCalNoteDraft(savedNote); }}
                                className="px-3 py-1.5 text-xs font-semibold border border-blue-300 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
                              >Cancel</button>
                            </div>
                          </>
                        ) : savedNote ? (
                          <>
                            <div className="bg-white border border-blue-100 rounded-lg px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed min-h-[80px]">{savedNote}</div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setCalNoteEditing(true); setCalNoteDraft(savedNote); }}
                                className="flex-1 px-3 py-1.5 text-xs font-bold bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors flex items-center justify-center gap-1"
                              ><Pencil size={11} />Edit</button>
                              <button
                                onClick={() => { if (window.confirm("Delete this journal entry?")) { setCalendarNotes(prev => { const n = { ...prev }; delete n[calNoteDate]; return n; }); setCalNoteDate(null); setCalNoteEditing(false); } }}
                                className="px-3 py-1.5 text-xs font-semibold border border-red-200 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >Delete</button>
                            </div>
                          </>
                        ) : null}
                      </Card>
                    </div>
                  );
                })()}
              </div>
              {(() => {
                const weekRows = [];
                for (let i = 0; i < cells.length; i += 7) {
                  const weekCells = cells.slice(i, i + 7).filter(Boolean);
                  if (weekCells.length === 0) continue;
                  const shootDays = weekCells.filter(c => c.evs.some(e => e.kind === "shoot")).length;
                  const holdDayCount = weekCells.filter(c => c.evs.some(e => e.kind === "hold")).length;
                  const travelDays = weekCells.filter(c => c.evs.some(e => e.kind === "travel")).length;
                  const invDue = weekCells.filter(c => c.evs.some(e => e.kind === "inv-due" || e.kind === "inv-overdue")).length;
                  if (shootDays + holdDayCount + travelDays + invDue === 0) continue;
                  const weekLabel = new Date(weekCells[0].iso + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  weekRows.push(
                    <div key={weekCells[0].iso} className="flex items-center gap-2 text-[11px]">
                      <span className="text-slate-400 font-mono w-16 shrink-0">{weekLabel}</span>
                      {shootDays > 0 && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">🎬 {shootDays} shoot</span>}
                      {holdDayCount > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">⏸ {holdDayCount} hold</span>}
                      {travelDays > 0 && <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-medium">✈️ {travelDays} travel</span>}
                      {invDue > 0 && <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">💰 {invDue} inv</span>}
                    </div>
                  );
                }
                if (weekRows.length === 0) return null;
                return (
                  <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Week Summary</p>
                    {weekRows}
                  </div>
                );
              })()}

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {[{ kind: "shoot", label: "Shoot Day" }, { kind: "inv-due", label: "Payment Due" }, { kind: "inv-overdue", label: "Overdue" }, { kind: "inv-paid", label: "Inv. Paid" }].map(({ kind, label }) => (
                  <span key={kind} className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${kindStyle[kind]}`}>{kindDot[kind]} {label}</span>
                ))}
                {["soft", "hold", "locked", "travel", "prep", "scout", "wrap"].map(t => (
                  <span key={t} className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${holdTypeStyle[t]}`}>{holdTypeDot[t]} {holdTypeLabel[t]}</span>
                ))}
                <span className="text-[10px] px-2.5 py-1 rounded-full font-medium bg-blue-100 text-blue-700">📝 Note</span>
              </div>

              {/* Upcoming events */}
              {(() => {
                const upcoming = Object.entries(eventMap)
                  .filter(([d]) => d >= today)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .slice(0, 8)
                  .flatMap(([d, evs]) => evs.map(ev => ({ ...ev, date: d })));
                if (upcoming.length === 0) return null;
                return (
                  <Card className="p-5">
                    <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><CalendarClock size={15} className="text-blue-500" />Upcoming Events</h3>
                    <div className="space-y-2">
                      {upcoming.map((ev, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs font-mono text-slate-500 w-24 shrink-0">{new Date(ev.date + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${getChipStyle(ev)}`}>{getChipDot(ev)} {ev.kind === "shoot" ? "Shoot" : ev.holdType ? holdTypeLabel[ev.holdType] : ev.kind === "travel" ? "Travel" : "Invoice"}</span>
                          <span className="text-sm text-slate-700 truncate">{ev.label}</span>
                          {ev.amount && <span className="text-xs font-semibold text-slate-500 ml-auto shrink-0">${(parseFloat(ev.amount)||0).toLocaleString(undefined,{minimumFractionDigits:2})}</span>}
                          {ev.holdId && <button onClick={() => setHoldReleaseModal({ holdId: ev.holdId, date: ev.date })} className="ml-auto text-slate-300 hover:text-amber-500 text-sm leading-none shrink-0" title="Release options">&times;</button>}
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })()}
            </div>
          );
        })()}

        {activeTab === "mileage" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card className="p-6 bg-emerald-50 border-emerald-200 col-span-2 md:col-span-1">
                <p className="text-emerald-700 text-sm font-medium">Total Miles</p>
                <h2 className="text-3xl font-bold mt-1 text-emerald-700">{totalMiles.toLocaleString(undefined, { maximumFractionDigits: 1 })} mi</h2>
              </Card>
              <Card className="p-6">
                <p className="text-slate-500 text-sm font-medium">IRS Write-Off Value</p>
                <h2 className="text-3xl font-bold mt-1 text-emerald-600">${totalMileageValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                <p className="text-[10px] text-slate-400 mt-1">@ ${IRS_MILEAGE_RATE}/mi (2025 IRS rate)</p>
              </Card>
              <Card className="p-6">
                <p className="text-slate-500 text-sm font-medium">From Timecards</p>
                <h2 className="text-3xl font-bold mt-1 text-blue-600">{allMileageEntries.filter(m => m.source === "timecard").length}</h2>
              </Card>
              <Card className="p-6">
                <p className="text-slate-500 text-sm font-medium">Standalone Entries</p>
                <h2 className="text-3xl font-bold mt-1 text-slate-700">{allMileageEntries.filter(m => m.source === "manual").length}</h2>
              </Card>
              <Card className="p-6">
                <p className="text-slate-500 text-sm font-medium">Vehicle Expenses</p>
                <h2 className="text-3xl font-bold mt-1 text-amber-600">${totalVehicleExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
              </Card>
              <Card className="p-6">
                <p className="text-slate-500 text-sm font-medium">Gas Spent</p>
                <h2 className="text-3xl font-bold mt-1 text-orange-500">${totalGasCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
              </Card>
            </div>

            {/* Sub-tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setMileageSubTab("mileage")}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${mileageSubTab === "mileage" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                  <MapPin size={14} className="inline mr-1.5 -mt-0.5" />Mileage
                </button>
                <button onClick={() => setMileageSubTab("vehicle")}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${mileageSubTab === "vehicle" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                  <Wrench size={14} className="inline mr-1.5 -mt-0.5" />Vehicle Expenses
                </button>
                <button onClick={() => setMileageSubTab("gas")}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${mileageSubTab === "gas" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                  <Fuel size={14} className="inline mr-1.5 -mt-0.5" />Gas
                </button>
              </div>
              {mileageSubTab === "mileage" && allMileageEntries.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button onClick={() => {
                    const IRS_RATE = selectedYear >= 2025 ? 0.70 : 0.67;
                    const header = ["Date", "Miles", "Purpose", "Company", "Job", "Vehicle", "Type", `Deduction @ $${IRS_RATE}/mi`];
                    const rows = allMileageEntries.map(m => [
                      m.date || "", parseFloat(m.miles) || 0, m.purpose || "", m.company || "",
                      m.jobId ? (jobs.find(j => j.id === m.jobId)?.name || m.jobId) : "",
                      m.vehicle || "", m.source || "manual",
                      ((parseFloat(m.miles) || 0) * IRS_RATE).toFixed(2),
                    ]);
                    downloadCSV([header, ...rows], `mileage_${selectedYear}.csv`);
                  }} variant="outline" className="gap-1.5 border-slate-300 text-slate-600 hover:bg-slate-50">
                    <FileDown size={14} />CSV
                  </Button>
                  <Button onClick={generateMileageReport} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                    <FileText size={14} />Tax Report
                  </Button>
                </div>
              )}
              {mileageSubTab === "vehicle" && filteredVehicleExpenses.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button onClick={() => {
                    const header = ["Date", "Category", "Vehicle", "Odometer (mi)", "Amount ($)", "Notes"];
                    const rows = filteredVehicleExpenses.map(v => [v.date || "", v.category || "", v.vehicle || "", v.odometer || "", v.amount || 0, v.notes || ""]);
                    downloadCSV([header, ...rows], `vehicle_expenses_${selectedYear}.csv`);
                  }} variant="outline" className="gap-1.5 border-slate-300 text-slate-600 hover:bg-slate-50">
                    <FileDown size={14} />CSV
                  </Button>
                  <Button onClick={() => generateExpenseReport("vehicle")} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Receipt size={14} />Receipts PDF
                  </Button>
                </div>
              )}
              {mileageSubTab === "gas" && filteredGasLogs.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button onClick={() => {
                    const header = ["Date", "Vehicle", "Station", "Price/Gallon ($)", "Total Amount ($)", "Notes"];
                    const rows = filteredGasLogs.map(g => [g.date || "", g.vehicle || "", g.station || "", g.pricePerGallon || "", g.amount || 0, g.notes || ""]);
                    downloadCSV([header, ...rows], `gas_logs_${selectedYear}.csv`);
                  }} variant="outline" className="gap-1.5 border-slate-300 text-slate-600 hover:bg-slate-50">
                    <FileDown size={14} />CSV
                  </Button>
                  <Button onClick={() => generateExpenseReport("gas")} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Receipt size={14} />Receipts PDF
                  </Button>
                </div>
              )}
            </div>

            {/* Vehicle manager */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Add your vehicles for quick-select in mileage and expense entries.</span>
              <Button variant="outline" onClick={() => setShowVehicleManager(p => !p)} className="text-xs h-8">
                <Car size={13} className="mr-1.5" />{showVehicleManager ? "Hide" : "Manage Vehicles"}
              </Button>
            </div>
            {showVehicleManager && (
              <Card className="p-4">
                <h4 className="text-sm font-bold mb-3">Saved Vehicles</h4>
                <div className="flex flex-wrap gap-2 mb-3">
                  {vehicles.length === 0 && <span className="text-xs text-slate-400 italic">No vehicles saved yet.</span>}
                  {vehicles.map(v => (
                    <span key={v} className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1 text-xs font-medium">
                      <Car size={11} className="shrink-0" />{v}
                      <button onClick={() => setVehicles(prev => prev.filter(x => x !== v))} className="text-emerald-400 hover:text-red-500 transition-colors" title="Remove"><X size={11} /></button>
                    </span>
                  ))}
                </div>
                <form onSubmit={e => { e.preventDefault(); const val = newVehicleName.trim(); if (val && !vehicles.includes(val)) { setVehicles(prev => [...prev, val].sort()); } setNewVehicleName(""); }} className="flex gap-2">
                  <Input value={newVehicleName} onChange={e => setNewVehicleName(e.target.value)} placeholder='e.g. "2019 Honda Fit", "Ford Transit"' className="flex-1" />
                  <Button type="submit" disabled={!newVehicleName.trim()}><Plus size={14} className="mr-1" />Add</Button>
                </form>
              </Card>
            )}

            {/* ── Mileage sub-tab ── */}
            {mileageSubTab === "mileage" && (
              <>
                <Card className="p-6">
                  <h3 className="text-base font-bold mb-4">Log Mileage Entry</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
                      <Input type="date" value={newMileage.date} onChange={e => setNewMileage(p => ({ ...p, date: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Vehicle</label>
                      <select value={newMileage.vehicle} onChange={e => setNewMileage(p => ({ ...p, vehicle: e.target.value }))}
                        className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                        <option value="">— Select vehicle —</option>
                        {vehicles.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Miles</label>
                      <Input type="number" value={newMileage.miles} onChange={e => setNewMileage(p => ({ ...p, miles: e.target.value }))} placeholder="e.g. 42" />
                    </div>
                    <div className="space-y-1 lg:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Purpose / Notes</label>
                      <Input value={newMileage.purpose} onChange={e => setNewMileage(p => ({ ...p, purpose: e.target.value }))} placeholder="e.g. Location scout, equipment pickup" />
                    </div>
                    <div className="space-y-1 lg:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Production Company</label>
                      {clients.length > 0 && (
                        <select value="" onChange={e => { if (e.target.value) setNewMileage(p => ({ ...p, company: e.target.value })); }}
                          className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mb-1">
                          <option value="">— Saved client —</option>
                          {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      )}
                      <Input value={newMileage.company} onChange={e => setNewMileage(p => ({ ...p, company: e.target.value }))} placeholder="e.g. Self, KISSD Honda" />
                    </div>
                    <div className="space-y-1 lg:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Job (optional)</label>
                      <select value={newMileage.jobId} onChange={e => setNewMileage(p => ({ ...p, jobId: e.target.value }))}
                        className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                        <option value="">— Unassigned —</option>
                        {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                      </select>
                    </div>
                    <Button onClick={addMileageLog} className="h-10"><Plus size={16} className="mr-1.5" /> Add</Button>
                  </div>
                </Card>

                {(() => {
                  const tcEntries = allMileageEntries.filter(m => m.source === "timecard");
                  const manualEntries = allMileageEntries.filter(m => m.source === "manual");
                  return (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
                          <Clock size={16} className="text-blue-500" />From Timecards
                          <span className="text-slate-400 font-normal text-sm">— {selectedYear}</span>
                        </h3>
                        {tcEntries.length === 0 ? (
                          <div className="py-12 text-center bg-white border-2 border-dashed border-slate-200 rounded-2xl">
                            <MapPin size={28} className="mx-auto mb-2 text-slate-300" />
                            <p className="text-slate-500 text-sm">No timecard mileage for {selectedYear}. Add miles to a timecard to see it here.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {tcEntries.map(m => (
                              <Card key={m.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Timecard</span>
                                  <span className="text-sm font-bold text-slate-800">{m.miles} mi</span>
                                  <span className="text-xs text-slate-500">{m.date}</span>
                                  {m.company && <span className="text-xs text-slate-600 font-medium">{m.company}</span>}
                                  {m.jobName && <span className="text-xs text-slate-400">{m.jobName}</span>}
                                  {m.purpose && <span className="text-xs text-slate-400 italic">{m.purpose}</span>}
                                </div>
                                <span className="text-sm font-bold text-emerald-600">${((parseFloat(m.miles) || 0) * IRS_MILEAGE_RATE).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
                          <MapPin size={16} className="text-emerald-600" />Standalone Entries
                          <span className="text-slate-400 font-normal text-sm">— write-offs &amp; unreimbursed</span>
                        </h3>
                        {manualEntries.length === 0 ? (
                          <div className="py-12 text-center bg-white border-2 border-dashed border-slate-200 rounded-2xl">
                            <MapPin size={28} className="mx-auto mb-2 text-slate-300" />
                            <p className="text-slate-500 text-sm">No standalone entries for {selectedYear}. Use the form above to log mileage not tied to a timecard.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {manualEntries.map(m => (
                              <Card key={m.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Manual</span>
                                  <span className="text-sm font-bold text-slate-800">{m.miles} mi</span>
                                  <span className="text-xs text-slate-500">{m.date}</span>
                                  {m.vehicle && <span className="text-xs font-medium text-slate-700 flex items-center gap-1"><Car size={11} />{m.vehicle}</span>}
                                  {m.company && <span className="text-xs text-slate-600 font-medium">{m.company}</span>}
                                  {m.purpose && <span className="text-xs text-slate-400 italic">{m.purpose}</span>}
                                  {m.jobId && jobs.find(j => j.id === m.jobId) && <span className="text-xs text-slate-400">{jobs.find(j => j.id === m.jobId).name}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-emerald-600">${((parseFloat(m.miles) || 0) * IRS_MILEAGE_RATE).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                  <Button variant="danger" onClick={() => { if (window.confirm("Delete this mileage entry?")) setMileageLogs(prev => prev.filter(x => x.id !== m.id)); }} className="!p-1.5"><Trash2 size={13} /></Button>
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

            {/* ── Vehicle Expenses sub-tab ── */}
            {mileageSubTab === "vehicle" && (
              <>
                <Card className="p-5">
                  <h3 className="text-base font-bold mb-3">Log Vehicle Expense</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
                      <Input type="date" value={newVehicleExpense.date} onChange={e => setNewVehicleExpense(p => ({ ...p, date: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Vehicle</label>
                      <select value={newVehicleExpense.vehicle} onChange={e => setNewVehicleExpense(p => ({ ...p, vehicle: e.target.value }))}
                        className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                        <option value="">— Select vehicle —</option>
                        {vehicles.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Category</label>
                      <select value={newVehicleExpense.category} onChange={e => setNewVehicleExpense(p => ({ ...p, category: e.target.value }))}
                        className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                        {VEHICLE_EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Odometer (mi)</label>
                      <Input type="number" value={newVehicleExpense.odometer} onChange={e => setNewVehicleExpense(p => ({ ...p, odometer: e.target.value }))} placeholder="e.g. 48250" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Amount ($)</label>
                      <Input type="number" value={newVehicleExpense.amount} onChange={e => setNewVehicleExpense(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
                    </div>
                    <div className="space-y-1 lg:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Notes (optional)</label>
                      <Input value={newVehicleExpense.notes} onChange={e => setNewVehicleExpense(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. Jiffy Lube, Goodyear 4x tires" />
                    </div>
                    <Button onClick={addVehicleExpense} disabled={!newVehicleExpense.amount || parseFloat(newVehicleExpense.amount) <= 0} className="h-10">
                      <Plus size={16} className="mr-1.5" /> Add
                    </Button>
                  </div>
                </Card>

                {filteredVehicleExpenses.length === 0 ? (
                  <div className="py-12 text-center bg-white border-2 border-dashed border-slate-200 rounded-2xl">
                    <Wrench size={28} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-slate-500 text-sm">No vehicle expenses for {selectedYear}. Use the form above to log maintenance, insurance, and more.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredVehicleExpenses.sort((a, b) => b.date.localeCompare(a.date)).map(v => {
                      const catColors = {
                        maintenance: "bg-amber-100 text-amber-700",
                        repairs: "bg-red-100 text-red-700",
                        tires: "bg-slate-100 text-slate-700",
                        insurance: "bg-blue-100 text-blue-700",
                        "oil change": "bg-orange-100 text-orange-700",
                        registration: "bg-violet-100 text-violet-700",
                        other: "bg-gray-100 text-gray-600",
                      };
                      const colorClass = catColors[v.category] || catColors.other;
                      const idx = vehicleExpenses.findIndex(x => x.id === v.id);
                      const upd = (field, val) => { const n = [...vehicleExpenses]; n[idx] = { ...n[idx], [field]: val }; setVehicleExpenses(n); };
                      return (
                        <Card key={v.id} className="p-4 space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <select value={v.category} onChange={e => upd("category", e.target.value)}
                                className={`text-[10px] font-bold uppercase tracking-wider border rounded px-2 py-0.5 focus:outline-none cursor-pointer ${colorClass} border-transparent`}>
                                {VEHICLE_EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                              </select>
                              {v.vehicle && <span className="text-xs font-medium text-slate-700 flex items-center gap-1"><Car size={11} />{v.vehicle}</span>}
                              <Input type="date" value={v.date} onChange={e => upd("date", e.target.value)} className="w-36 !py-1 !text-xs" />
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-bold text-amber-600">${(parseFloat(v.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              <Button variant="danger" onClick={() => { if (window.confirm("Delete this vehicle expense?")) setVehicleExpenses(prev => prev.filter(x => x.id !== v.id)); }} className="!p-1.5"><Trash2 size={13} /></Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Vehicle</label>
                              <select value={v.vehicle || ""} onChange={e => upd("vehicle", e.target.value)}
                                className="flex w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500">
                                <option value="">— None —</option>
                                {vehicles.map(ve => <option key={ve} value={ve}>{ve}</option>)}
                              </select>
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Odometer (mi)</label>
                              <Input type="number" value={v.odometer || ""} onChange={e => upd("odometer", e.target.value)} placeholder="e.g. 48250" className="!py-1.5 !text-xs font-mono" />
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Amount ($)</label>
                              <Input type="number" value={v.amount} onChange={e => upd("amount", parseFloat(e.target.value) || 0)} className="!py-1.5 !text-xs font-mono" />
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Notes</label>
                              <Input value={v.notes || ""} onChange={e => upd("notes", e.target.value)} placeholder="Notes" className="!py-1.5 !text-xs" />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors">
                              <UploadCloud size={12} />{v.receiptFileId ? "Replace Receipt" : "Upload Receipt"}
                              <input type="file" className="hidden" accept="image/*,application/pdf" onChange={async e => { const file = e.target.files?.[0]; if (file) await uploadReceiptForExpense(v.id, file); e.target.value = ""; }} />
                            </label>
                            {v.receiptFileId && (
                              <a href={`https://drive.google.com/file/d/${v.receiptFileId}/view`} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 text-xs text-emerald-600 hover:bg-emerald-50 transition-colors">
                                <ExternalLink size={12} />View Receipt
                              </a>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                    <div className="flex justify-end pt-1">
                      <span className="text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                        Total: ${totalVehicleExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Gas sub-tab ── */}
            {mileageSubTab === "gas" && (
              <>
                <Card className="p-5">
                  <h3 className="text-base font-bold mb-3">Log Gas Fill-Up</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
                      <Input type="date" value={newGasLog.date} onChange={e => setNewGasLog(p => ({ ...p, date: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Vehicle</label>
                      <select value={newGasLog.vehicle} onChange={e => setNewGasLog(p => ({ ...p, vehicle: e.target.value }))}
                        className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                        <option value="">— Select vehicle —</option>
                        {vehicles.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Gas Station</label>
                      <Input value={newGasLog.station} onChange={e => setNewGasLog(p => ({ ...p, station: e.target.value }))} placeholder="e.g. Shell, Chevron" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Price / Gallon (opt.)</label>
                      <Input type="number" value={newGasLog.pricePerGallon} onChange={e => setNewGasLog(p => ({ ...p, pricePerGallon: e.target.value }))} placeholder="e.g. 4.59" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Total Amount ($)</label>
                      <Input type="number" value={newGasLog.amount} onChange={e => setNewGasLog(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
                    </div>
                    <div className="space-y-1 lg:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Notes (optional)</label>
                      <Input value={newGasLog.notes} onChange={e => setNewGasLog(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. Full tank, topped off" />
                    </div>
                    <Button onClick={addGasLog} disabled={!newGasLog.amount || parseFloat(newGasLog.amount) <= 0} className="h-10">
                      <Plus size={16} className="mr-1.5" /> Add
                    </Button>
                  </div>
                </Card>

                {filteredGasLogs.length === 0 ? (
                  <div className="py-12 text-center bg-white border-2 border-dashed border-slate-200 rounded-2xl">
                    <Fuel size={28} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-slate-500 text-sm">No gas logs for {selectedYear}. Use the form above to track fill-ups.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredGasLogs.sort((a, b) => b.date.localeCompare(a.date)).map(g => {
                      const idx = gasLogs.findIndex(x => x.id === g.id);
                      const upd = (field, val) => { const n = [...gasLogs]; n[idx] = { ...n[idx], [field]: val }; setGasLogs(n); };
                      return (
                        <Card key={g.id} className="p-4 space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700 rounded px-2 py-0.5 flex items-center gap-1">
                                <Fuel size={10} />Gas
                              </span>
                              {g.vehicle && <span className="text-xs font-medium text-slate-700 flex items-center gap-1"><Car size={11} />{g.vehicle}</span>}
                              <Input type="date" value={g.date} onChange={e => upd("date", e.target.value)} className="w-36 !py-1 !text-xs" />
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-bold text-orange-500">${(parseFloat(g.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              <Button variant="danger" onClick={() => { if (window.confirm("Delete this gas log entry?")) setGasLogs(prev => prev.filter(x => x.id !== g.id)); }} className="!p-1.5"><Trash2 size={13} /></Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Vehicle</label>
                              <select value={g.vehicle || ""} onChange={e => upd("vehicle", e.target.value)}
                                className="flex w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500">
                                <option value="">— None —</option>
                                {vehicles.map(ve => <option key={ve} value={ve}>{ve}</option>)}
                              </select>
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Gas Station</label>
                              <Input value={g.station || ""} onChange={e => upd("station", e.target.value)} placeholder="Station name" className="!py-1.5 !text-xs" />
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Price / Gallon</label>
                              <Input type="number" value={g.pricePerGallon || ""} onChange={e => upd("pricePerGallon", e.target.value)} placeholder="e.g. 4.59" className="!py-1.5 !text-xs font-mono" />
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Total Amount ($)</label>
                              <Input type="number" value={g.amount} onChange={e => upd("amount", parseFloat(e.target.value) || 0)} className="!py-1.5 !text-xs font-mono" />
                            </div>
                            <div className="space-y-0.5 sm:col-span-4">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Notes</label>
                              <Input value={g.notes || ""} onChange={e => upd("notes", e.target.value)} placeholder="Notes" className="!py-1.5 !text-xs" />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors">
                              <UploadCloud size={12} />{g.receiptFileId ? "Replace Receipt" : "Upload Receipt"}
                              <input type="file" className="hidden" accept="image/*,application/pdf" onChange={async e => { const file = e.target.files?.[0]; if (file) await uploadReceiptForGas(g.id, file); e.target.value = ""; }} />
                            </label>
                            {g.receiptFileId && (
                              <a href={`https://drive.google.com/file/d/${g.receiptFileId}/view`} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 text-xs text-emerald-600 hover:bg-emerald-50 transition-colors">
                                <ExternalLink size={12} />View Receipt
                              </a>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                    <div className="flex justify-end pt-1">
                      <span className="text-sm font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
                        Total: ${totalGasCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Quarterly Tax Estimator Tab ── */}
        {activeTab === "tax" && (() => {
          const taxYear = selectedYear;
          const taxInvoices = invoices.filter(inv => (inv.date || "").startsWith(String(taxYear)));

          const taxGrossInvoiced = taxInvoices.reduce((a, inv) => a + (parseFloat(inv.amount) || 0), 0);
          const taxIncomeReceived = taxInvoices.reduce((a, inv) => {
            const s = computeInvoiceStatus(inv);
            if (s === "Paid") return a + (parseFloat(inv.amount) || 0);
            return a + (parseFloat(inv.amountReceived) || 0);
          }, 0);
          const taxIncomeOutstanding = taxGrossInvoiced - taxIncomeReceived;

          const taxPurchaseItems = purchases.filter(p => (p.date || "").startsWith(String(taxYear)));
          const taxExpendables = taxPurchaseItems.filter(p => p.category === "expendables").reduce((a, p) => a + (parseFloat(p.amount) || 0), 0);
          const taxEquipmentItems = taxPurchaseItems.filter(p => p.category === "equipment");
          const taxEquipment = taxEquipmentItems.reduce((a, p) => a + calcEquipDeduction(p, taxYear), 0);
          const taxMealsTotal = taxPurchaseItems.filter(p => p.category === "meals").reduce((a, p) => a + (parseFloat(p.amount) || 0), 0);
          const taxMealsDeductible = taxMealsTotal * 0.5;

          const IRS_RATE = taxYear >= 2025 ? 0.70 : 0.67;
          const taxManualMiles = mileageLogs.filter(m => (m.date || "").startsWith(String(taxYear))).reduce((a, m) => a + (parseFloat(m.miles) || 0), 0);
          const taxTimecardMiles = timecards.filter(tc => (tc.date || "").startsWith(String(taxYear))).reduce((a, tc) => a + (parseFloat(tc.mileage) || 0), 0);
          const taxTotalMiles = taxManualMiles + taxTimecardMiles;
          const taxMileageDeduction = taxTotalMiles * IRS_RATE;

          const taxGasTotal = gasLogs.filter(g => (g.date || "").startsWith(String(taxYear))).reduce((a, g) => a + (parseFloat(g.amount) || 0), 0);
          const taxVehicleTotal = vehicleExpenses.filter(v => (v.date || "").startsWith(String(taxYear))).reduce((a, v) => a + (parseFloat(v.amount) || 0), 0);

          const taxTotalDeductions = taxExpendables + taxEquipment + taxMealsDeductible + taxMileageDeduction;
          const taxNetSEIncome = Math.max(0, taxIncomeReceived - taxTotalDeductions);

          const SS_WAGE_BASE = 176100;
          const seBase = taxNetSEIncome * 0.9235;
          const seTaxSS = Math.min(seBase, SS_WAGE_BASE) * 0.124;
          const seTaxMedicare = seBase * 0.029;
          const seTax = seTaxSS + seTaxMedicare;
          const deductibleSE = seTax / 2;

          const agi = taxNetSEIncome - deductibleSE;
          const STANDARD_DEDUCTION = 14600;
          const taxableIncome = Math.max(0, agi - STANDARD_DEDUCTION);
          const TAX_BRACKETS = [
            { min: 0, max: 11925, rate: 0.10 },
            { min: 11925, max: 48475, rate: 0.12 },
            { min: 48475, max: 103350, rate: 0.22 },
            { min: 103350, max: 197300, rate: 0.24 },
            { min: 197300, max: 250525, rate: 0.32 },
            { min: 250525, max: 626350, rate: 0.35 },
            { min: 626350, max: Infinity, rate: 0.37 },
          ];
          let fedTax = 0; let rem = taxableIncome;
          for (const b of TAX_BRACKETS) { if (rem <= 0) break; const taxable = Math.min(rem, b.max - b.min); fedTax += taxable * b.rate; rem -= taxable; }

          const totalEstTax = seTax + fedTax;
          const qPayment = totalEstTax / 4;
          const QUARTERLY = [
            { label: "Q1 (Jan – Mar)", period: `Jan 1 – Mar 31, ${taxYear}`, due: `April 15, ${taxYear}` },
            { label: "Q2 (Apr – May)", period: `Apr 1 – May 31, ${taxYear}`, due: `June 15, ${taxYear}` },
            { label: "Q3 (Jun – Aug)", period: `Jun 1 – Aug 31, ${taxYear}`, due: `September 15, ${taxYear}` },
            { label: "Q4 (Sep – Dec)", period: `Sep 1 – Dec 31, ${taxYear}`, due: `January 15, ${taxYear + 1}` },
          ];
          const fmt = n => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

          return (
            <div className="space-y-6 pb-8">
              {/* Year selector */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tax Year</span>
                {allYears.map(yr => (
                  <button key={yr} onClick={() => setSelectedYear(yr)}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${
                      selectedYear === yr
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                    }`}>
                    {yr}{yr === new Date().getFullYear() ? " ✦" : ""}
                  </button>
                ))}
              </div>
              <div>
                <h2 className="text-2xl font-bold">Quarterly Tax Estimator</h2>
                <p className="text-sm text-slate-500 mt-0.5">Estimated taxes for <strong>{taxYear}</strong> based on your tracked income &amp; deductions. Uses 2025 IRS rates — consult a tax professional for filing.</p>
              </div>

              {/* Income + Deductions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-5 space-y-3">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><FileText size={14} className="text-blue-500" />Income ({taxYear})</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Total Invoiced</span><span className="font-semibold">${fmt(taxGrossInvoiced)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Total Received (cash basis)</span><span className="font-bold text-emerald-600">${fmt(taxIncomeReceived)}</span></div>
                    {taxIncomeOutstanding > 0 && <div className="flex justify-between text-sm"><span className="text-slate-400 italic">Still outstanding</span><span className="text-amber-600">${fmt(taxIncomeOutstanding)}</span></div>}
                  </div>
                  <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">Cash-basis: only counts payments received. Partial payments included.</p>
                </Card>
                <Card className="p-5 space-y-3">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><ShoppingCart size={14} className="text-emerald-500" />Deductions ({taxYear})</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Expendables</span><span className="font-semibold text-emerald-700">${fmt(taxExpendables)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Equipment</span><span className="font-semibold text-emerald-700">${fmt(taxEquipment)}</span></div>
                    {taxEquipmentItems.some(p => (p.depreciationMethod || "section179") !== "section179" && (p.depreciationMethod || "section179") !== "bonus") && (
                      <div className="ml-3 space-y-0.5 border-l-2 border-slate-100 pl-2">
                        {taxEquipmentItems.map(p => { const d = calcEquipDeduction(p, taxYear); return d > 0 ? (
                          <div key={p.id} className="flex justify-between text-xs text-slate-400">
                            <span className="truncate max-w-[160px]">{p.name || "Item"} <span className="text-[9px] bg-slate-100 px-1 rounded">{DEPR_LABELS[p.depreciationMethod||"section179"]}</span></span>
                            <span className="font-mono shrink-0">${fmt(d)}</span>
                          </div>
                        ) : null; })}
                      </div>
                    )}
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Meals (50% of ${fmt(taxMealsTotal)})</span><span className="font-semibold text-emerald-700">${fmt(taxMealsDeductible)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Mileage ({taxTotalMiles.toLocaleString()} mi × ${IRS_RATE}/mi)</span><span className="font-semibold text-emerald-700">${fmt(taxMileageDeduction)}</span></div>
                    {(taxGasTotal > 0 || taxVehicleTotal > 0) && (
                      <div className="pt-1 border-t border-slate-100 space-y-1">
                        <p className="text-[10px] text-slate-400 italic">Not included (covered by standard mileage rate):</p>
                        {taxGasTotal > 0 && <div className="flex justify-between text-xs text-slate-400"><span>Gas logged</span><span>${fmt(taxGasTotal)}</span></div>}
                        {taxVehicleTotal > 0 && <div className="flex justify-between text-xs text-slate-400"><span>Vehicle expenses</span><span>${fmt(taxVehicleTotal)}</span></div>}
                      </div>
                    )}
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-sm">
                    <span>Total Deductions</span><span className="text-emerald-700">${fmt(taxTotalDeductions)}</span>
                  </div>
                </Card>
              </div>

              {/* Tax calculation */}
              <Card className="p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Calculator size={14} className="text-violet-500" />Tax Calculation (Single Filer Estimate)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Self-Employment Tax</p>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Net SE income</span><span>${fmt(taxNetSEIncome)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">SE base (× 92.35%)</span><span>${fmt(seBase)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Social Security (12.4%)</span><span>${fmt(seTaxSS)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Medicare (2.9%)</span><span>${fmt(seTaxMedicare)}</span></div>
                    <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-100"><span>SE Tax Total</span><span className="text-red-600">${fmt(seTax)}</span></div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Federal Income Tax</p>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Net SE income</span><span>${fmt(taxNetSEIncome)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Less ½ SE deduction</span><span>– ${fmt(deductibleSE)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">AGI</span><span>${fmt(agi)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Standard deduction</span><span>– ${fmt(STANDARD_DEDUCTION)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Taxable income</span><span>${fmt(taxableIncome)}</span></div>
                    <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-100"><span>Federal Tax Total</span><span className="text-red-600">${fmt(fedTax)}</span></div>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-5 py-4">
                  <div>
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Total Estimated Tax ({taxYear})</p>
                    <p className="text-3xl font-bold text-red-700 mt-0.5">${fmt(totalEstTax)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Per Quarter</p>
                    <p className="text-2xl font-bold text-red-600">${fmt(qPayment)}</p>
                  </div>
                </div>
              </Card>

              {/* Quarterly schedule */}
              <Card className="p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><CalendarClock size={14} className="text-orange-500" />Quarterly Payment Schedule</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {QUARTERLY.map((q, i) => {
                    const isPast = new Date(q.due) < new Date();
                    return (
                      <div key={i} className={`rounded-xl border p-4 space-y-1.5 ${isPast ? "border-slate-200 bg-slate-50" : "border-orange-200 bg-orange-50"}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold uppercase tracking-wide ${isPast ? "text-slate-400" : "text-orange-600"}`}>{q.label}</span>
                          {isPast && <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-medium">Past</span>}
                        </div>
                        <p className="text-[11px] text-slate-500">{q.period}</p>
                        <div className="flex items-center justify-between pt-1">
                          <div>
                            <p className="text-[10px] text-slate-400">IRS Due</p>
                            <p className={`text-sm font-bold ${isPast ? "text-slate-500" : "text-orange-700"}`}>{q.due}</p>
                          </div>
                          <p className={`text-xl font-bold ${isPast ? "text-slate-400" : "text-orange-600"}`}>${fmt(qPayment)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">Pay via <strong>EFTPS</strong> (eftps.gov) or mail Form 1040-ES. Dates are standard IRS deadlines — verify at irs.gov if a date falls on a weekend or holiday. State estimated taxes are separate. This is not tax advice.</p>
              </Card>
            </div>
          );
        })()}
      </main>
    </div>

    {/* ── Mark as Paid Modal ── */}
    {markPaidModal && (() => {
      const existingPmts = markPaidModal.existingPayments || [];
      const alreadyPaid = existingPmts.reduce((a, p) => a + (parseFloat(p.amount) || 0), 0);
      const remaining = Math.max(0, markPaidModal.amount - alreadyPaid);
      const ML = { ach: "ACH/Wire", check: "Check", cash: "Cash", paypal: "PayPal", zelle: "Zelle", venmo: "Venmo", other: "Other" };
      const doSave = (rawAmt) => {
        const amt = parseFloat(rawAmt);
        if (!amt || amt <= 0) return;
        const newPmt = { id: Date.now().toString(36) + Math.random().toString(36).slice(2), amount: amt, date: markPaidDate, ...(markPaidMethod ? { method: markPaidMethod } : {}) };
        const newPmts = [...existingPmts, newPmt];
        const newTotal = newPmts.reduce((a, p) => a + (parseFloat(p.amount) || 0), 0);
        const newStatus = newTotal >= markPaidModal.amount ? "Paid" : "Partially Paid";
        if (markPaidModal.type === "timecard") {
          const n = [...timecards];
          n[markPaidModal.idx] = { ...n[markPaidModal.idx], payments: newPmts, amountReceived: newTotal, status: newStatus };
          setTimecards(n);
        } else {
          const n = [...invoices];
          n[markPaidModal.idx] = { ...n[markPaidModal.idx], payments: newPmts, amountReceived: newTotal, status: newStatus };
          setInvoices(n);
        }
        setMarkPaidModal(null);
      };
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => { if (e.target === e.currentTarget) setMarkPaidModal(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 shrink-0">
              <h2 className="text-base font-bold text-slate-800">Record Payment</h2>
              <p className="text-xs text-slate-400 mt-0.5">Invoice total: <span className="font-semibold text-slate-600">${markPaidModal.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></p>
            </div>
            <div className="px-6 py-5 space-y-3 overflow-y-auto flex-1">

              {/* Prior payments ledger */}
              {existingPmts.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prior Payments</p>
                  {existingPmts.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400 w-4 shrink-0 text-right font-mono">{i + 1}.</span>
                      <span className="font-mono text-slate-500 shrink-0">{p.date}</span>
                      <span className="font-bold text-emerald-700 flex-1">${(parseFloat(p.amount)||0).toLocaleString(undefined,{minimumFractionDigits:2})}</span>
                      {p.method && <span className="text-[9px] text-slate-400">{ML[p.method]||p.method}</span>}
                    </div>
                  ))}
                  <div className="pt-1.5 border-t border-slate-200 space-y-0.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-500">Paid so far</span><span className="text-emerald-700">${alreadyPaid.toLocaleString(undefined,{minimumFractionDigits:2})}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-500">Remaining</span><span className="text-orange-600">${remaining.toLocaleString(undefined,{minimumFractionDigits:2})}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1 — choose type */}
              {markPaidMode === null && (
                <div className="space-y-2">
                  {!existingPmts.length && <p className="text-sm text-slate-600 font-medium">Was this payment in full or partial?</p>}
                  <button onClick={() => setMarkPaidMode("full")}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100 transition-colors text-left">
                    <CheckCircle size={18} className="text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-emerald-700">{existingPmts.length > 0 ? "Pay Remaining Balance" : "Paid in Full"}</p>
                      <p className="text-xs text-emerald-600">${remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })} received</p>
                    </div>
                  </button>
                  <button onClick={() => setMarkPaidMode("partial")}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-orange-200 bg-orange-50 hover:border-orange-400 hover:bg-orange-100 transition-colors text-left">
                    <CreditCard size={18} className="text-orange-500 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-orange-700">Partial Payment</p>
                      <p className="text-xs text-orange-600">Enter the amount received</p>
                    </div>
                  </button>
                </div>
              )}

              {/* Step 2 — entry form (shared for both modes) */}
              {markPaidMode !== null && (
                <div className="space-y-3">
                  <button onClick={() => setMarkPaidMode(null)} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"><ChevronLeft size={12} />Back</button>

                  {markPaidMode === "partial" && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Amount Received ($)</label>
                      <input type="number" value={markPaidPartialAmt} onChange={e => setMarkPaidPartialAmt(e.target.value)}
                        placeholder="0.00" min="0.01" step="0.01" autoFocus
                        className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                      {parseFloat(markPaidPartialAmt) > 0 && (
                        <p className="text-[11px] text-orange-600">Balance after this payment: ${Math.max(0, remaining - parseFloat(markPaidPartialAmt)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      )}
                    </div>
                  )}
                  {markPaidMode === "full" && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                      <p className="text-sm font-semibold text-emerald-700">{existingPmts.length > 0 ? "Pay Remaining Balance" : "Mark as Paid in Full"}</p>
                      <p className="text-xs mt-0.5 text-emerald-600">${remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })} will be recorded as received.</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Date Received</label>
                      <input type="date" value={markPaidDate} onChange={e => setMarkPaidDate(e.target.value)}
                        className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Method</label>
                      <select value={markPaidMethod} onChange={e => setMarkPaidMethod(e.target.value)}
                        className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                        <option value="">— Method —</option>
                        <option value="ach">ACH / Wire</option>
                        <option value="check">Check</option>
                        <option value="cash">Cash</option>
                        <option value="paypal">PayPal</option>
                        <option value="zelle">Zelle</option>
                        <option value="venmo">Venmo</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <button
                    disabled={markPaidMode === "partial" && (!markPaidPartialAmt || parseFloat(markPaidPartialAmt) <= 0)}
                    onClick={() => doSave(markPaidMode === "full" ? remaining : markPaidPartialAmt)}
                    className={`w-full px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      markPaidMode === "full" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-orange-500 hover:bg-orange-600"
                    }`}>
                    {markPaidMode === "full" ? (existingPmts.length > 0 ? "Confirm — Pay Remaining" : "Confirm — Paid in Full") : "Save Partial Payment"}
                  </button>
                </div>
              )}
            </div>
            <div className="px-6 pb-5 shrink-0 border-t border-slate-100 pt-3">
              <button onClick={() => setMarkPaidModal(null)} className="w-full text-xs text-slate-400 hover:text-slate-600 py-1">Cancel</button>
            </div>
          </div>
        </div>
      );
    })()}

    {/* ── Expense Report Overlay ── */}
    {showReportOverlay && (
      <div className="fixed inset-0 z-50 flex flex-col bg-white">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <span className="font-semibold text-slate-700 text-sm">Tax Report Preview</span>
          <div className="flex-1" />
          <button
            onClick={() => reportIframeRef.current?.contentWindow?.print()}
            className="px-4 py-1.5 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700"
          >Print / Save PDF</button>
          <button
            onClick={() => { setShowReportOverlay(false); reportHtmlRef.current = null; }}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-100"
          >✕ Close</button>
        </div>
        <iframe ref={reportIframeRef} className="flex-1 w-full border-0" title="Tax Report" />
      </div>
    )}
    </>
  );
}
