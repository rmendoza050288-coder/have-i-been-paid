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
} from "lucide-react";

const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, disabled, variant = "primary", className = "" }) => {
  const base = "inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";
  const v = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    outline: "border border-gray-300 text-gray-700 bg-white hover:bg-gray-50",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    danger: "text-red-600 hover:bg-red-50",
    ghost: "text-slate-500 hover:bg-slate-100",
  };
  return <button onClick={onClick} disabled={disabled} className={`${base} ${v[variant]} ${className}`}>{children}</button>;
};

const Input = ({ type = "text", value, onChange, placeholder, className = "" }) => (
  <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    className={`flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${className}`} />
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
    return { date: d.toISOString().split("T")[0], day: DAY_NAMES[d.getDay()], call: "", meal1Out: "", meal1In: "", meal2Out: "", meal2In: "", wrap: "", mealPenalty: false, totalHours: 0, hours1x: 0, hours15x: 0, hours2x: 0 };
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

const TAX_RATE = 0.25;
const IRS_MILEAGE_RATE = 0.70; // 2025 IRS standard mileage rate ($/mi)
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
  const [newTimecard, setNewTimecard] = useState(() => { const we = getNextSaturday(); return { company: "", jobName: "", jobClassification: "", guarHours: "10", rate: "", weekEnding: we, days: initWeekDays(we), description: "", jobId: "", workerName: "", workerEmail: "", last4SS: "", mileage: "", signatureFont: "Dancing Script", signatureDate: new Date().toISOString().split("T")[0] }; });
  const [editingTimecard, setEditingTimecard] = useState(null);
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
  const [newPurchase, setNewPurchase] = useState({ name: "", vendor: "", amount: "", date: new Date().toISOString().split("T")[0], notes: "", serial: "", category: "expendables", jobId: "" });
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

  // Local blob URL cache: itemId → { url, type }
  const blobCache = useRef(new Map());
  const hasLoadedRef = useRef(false);
  useEffect(() => () => blobCache.current.forEach(v => URL.revokeObjectURL(v.url)), []);

  // Drive connection state (optional — app works offline without it)
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveName, setDriveName] = useState("");
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
      }
      const ls = localStorage.getItem("hibp_last_synced");
      if (ls) setLastSynced(ls);
    } catch {}
    hasLoadedRef.current = true;
    // Silently restore Drive session if a token exists
    const existingToken = localStorage.getItem("google_token");
    if (existingToken) {
      fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${existingToken}`)
        .then(r => r.json())
        .then(info => {
          if (!info.error) {
            setDriveConnected(true);
            setDriveName(info.email || "");
            initDrive().catch(() => {});
          } else {
            localStorage.removeItem("google_token");
          }
        }).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track when Google Identity Services script has loaded
  const [googleReady, setGoogleReady] = useState(false);
  useEffect(() => {
    if (window.google?.accounts?.oauth2) { setGoogleReady(true); return; }
    const iv = setInterval(() => {
      if (window.google?.accounts?.oauth2) { setGoogleReady(true); clearInterval(iv); }
    }, 150);
    return () => clearInterval(iv);
  }, []);

  // ── AUTH / DRIVE CONNECTION ──────────────────────────────────────────────────
  const connectDrive = () => new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      alert("Google sign-in is still loading — please wait a moment and try again.");
      return reject(new Error("GIS not loaded"));
    }
    try {
      window.google.accounts.oauth2.initTokenClient({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: async (res) => {
          if (res.error) { alert("Sign-in failed: " + res.error); return reject(new Error(res.error)); }
          if (res.access_token) {
            localStorage.setItem("google_token", res.access_token);
            let name = "", email = "";
            try {
              const uRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${res.access_token}` } });
              const uData = await uRes.json();
              name = uData.name || ""; email = uData.email || "";
            } catch {}
            setDriveConnected(true);
            setDriveName(name || email);
            setNewTimecard(p => ({ ...p, workerName: p.workerName || name, workerEmail: p.workerEmail || email }));
            await initDrive();
            resolve();
          }
        },
      }).requestAccessToken();
    } catch (err) {
      alert("Could not open sign-in window — " + err.message + "\n\nIf a popup was blocked, allow popups for this site and try again.");
      reject(err);
    }
  });

  // keep handleLogin as alias so existing OCR call-sites still work
  const handleLogin = connectDrive;

  const disconnectDrive = () => {
    localStorage.removeItem("google_token");
    setDriveConnected(false);
    setDriveName("");
    setFolderId(null);
    setDataFileId(null);
    setYearFolderIds({});
    setSyncStatus("Not synced");
  };

  // ── DRIVE HELPERS ───────────────────────────────────────────────────────────
  const tok = () => localStorage.getItem("google_token");
  const authHeader = () => ({ Authorization: `Bearer ${tok()}` });
  const jsonHeaders = () => ({ ...authHeader(), "Content-Type": "application/json" });

  // ── DRIVE INIT / SYNC ───────────────────────────────────────────────────────
  const initDrive = async () => {
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        { headers: jsonHeaders() }
      );
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error?.message || "Drive API error");
      }
      const data = await res.json();
      let fId = data.files?.[0]?.id;
      if (!fId) {
        const cr = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST", headers: jsonHeaders(),
          body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
        });
        const cd = await cr.json();
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
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${year}' and mimeType='application/vnd.google-apps.folder' and '${rootId}' in parents and trashed=false`,
      { headers: jsonHeaders() }
    );
    const data = await res.json();
    let yId = data.files?.[0]?.id;
    if (!yId) {
      const cr = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST", headers: jsonHeaders(),
        body: JSON.stringify({ name: String(year), mimeType: "application/vnd.google-apps.folder", parents: [rootId] }),
      });
      const cd = await cr.json();
      yId = cd.id;
    }
    setYearFolderIds(prev => ({ ...prev, [year]: yId }));
    return yId;
  };

  const loadManifest = async (fId) => {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='data.json' and '${fId}' in parents and trashed=false`,
      { headers: jsonHeaders() }
    );
    const data = await res.json();
    if (data.files?.length > 0) {
      const fileId = data.files[0].id;
      setDataFileId(fileId);
      const fr = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: authHeader() });
      const content = await fr.json();
      if (Array.isArray(content)) { setInvoices(content); }
      else { setInvoices(Array.isArray(content.invoices) ? content.invoices : []); setTimecards(Array.isArray(content.timecards) ? content.timecards : []); setJobs(Array.isArray(content.jobs) ? content.jobs : []); setPurchases(Array.isArray(content.purchases) ? content.purchases : []); setClassifications(Array.isArray(content.classifications) ? content.classifications : []); setMileageLogs(Array.isArray(content.mileageLogs) ? content.mileageLogs : []); setVehicleExpenses(Array.isArray(content.vehicleExpenses) ? content.vehicleExpenses : []); setVehicles(Array.isArray(content.vehicles) ? content.vehicles : []); setGasLogs(Array.isArray(content.gasLogs) ? content.gasLogs : []); }
    }
    hasLoadedRef.current = true;
  };

  const saveManifest = async (inv, tc, j, pur) => {
    // saveManifest is kept as a no-op alias; actual Drive push is done via syncToDrive
    void inv; void tc; void j; void pur;
  };

  // Auto-save all data to localStorage whenever anything changes
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    const data = { invoices, timecards, jobs, purchases, classifications, mileageLogs, vehicleExpenses, vehicles, gasLogs };
    try { localStorage.setItem("hibp_data", JSON.stringify(data)); } catch {}
  }, [invoices, timecards, jobs, purchases, classifications, mileageLogs, vehicleExpenses, vehicles, gasLogs]);

  // ── SYNC TO DRIVE (manual) ───────────────────────────────────────────────────
  const syncToDrive = async () => {
    if (!driveConnected) {
      try { await connectDrive(); } catch { return; }
    }
    setIsSyncing(true);
    setSyncStatus("Syncing...");
    try {
      let rFolderId = folderId;
      if (!rFolderId) { await initDrive(); rFolderId = folderId; }
      const data = { invoices, timecards, jobs, purchases, classifications, mileageLogs, vehicleExpenses, vehicles, gasLogs };
      const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      // Root data.json
      if (dataFileId) {
        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${dataFileId}?uploadType=media`, {
          method: "PATCH", headers: { ...authHeader(), "Content-Type": "application/json" }, body: blob,
        });
      } else {
        const m = await (await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST", headers: jsonHeaders(),
          body: JSON.stringify({ name: "data.json", parents: [rFolderId] }),
        })).json();
        setDataFileId(m.id);
        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${m.id}?uploadType=media`, {
          method: "PATCH", headers: { ...authHeader(), "Content-Type": "application/json" }, body: blob,
        });
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
        const yBlob = new Blob([JSON.stringify(yearData)], { type: "application/json" });
        const yFileKey = `hibp_yfid_${year}`;
        const existingYFId = localStorage.getItem(yFileKey);
        if (existingYFId) {
          await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingYFId}?uploadType=media`, {
            method: "PATCH", headers: { ...authHeader(), "Content-Type": "application/json" }, body: yBlob,
          });
        } else {
          const ym = await (await fetch("https://www.googleapis.com/drive/v3/files", {
            method: "POST", headers: jsonHeaders(),
            body: JSON.stringify({ name: `data_${year}.json`, parents: [yFId] }),
          })).json();
          localStorage.setItem(yFileKey, ym.id);
          await fetch(`https://www.googleapis.com/upload/drive/v3/files/${ym.id}?uploadType=media`, {
            method: "PATCH", headers: { ...authHeader(), "Content-Type": "application/json" }, body: yBlob,
          });
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
    if (!folderId) { alert("Not connected to Drive."); return; }
    try {
      const metaRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST", headers: jsonHeaders(),
        body: JSON.stringify({ name: `receipt_${file.name}`, parents: [folderId] }),
      });
      const meta = await metaRes.json();
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${meta.id}?uploadType=media`, {
        method: "PATCH", headers: { ...authHeader(), "Content-Type": file.type }, body: file,
      });
      setVehicleExpenses(prev => prev.map(v => v.id === expenseId ? { ...v, receiptFileId: meta.id } : v));
    } catch (err) { alert("Receipt upload failed: " + err.message); }
  };

  const addGasLog = () => {
    if (!newGasLog.amount || parseFloat(newGasLog.amount) <= 0) return;
    setGasLogs(prev => [{ id: crypto.randomUUID(), date: newGasLog.date, vehicle: newGasLog.vehicle, station: newGasLog.station, pricePerGallon: newGasLog.pricePerGallon, amount: parseFloat(newGasLog.amount), notes: newGasLog.notes, receiptFileId: "", timestamp: Date.now() }, ...prev]);
    setNewGasLog(p => ({ ...p, amount: "", notes: "", pricePerGallon: "" }));
  };

  const uploadReceiptForGas = async (gasId, file) => {
    if (!folderId) { alert("Not connected to Drive."); return; }
    try {
      const metaRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST", headers: jsonHeaders(),
        body: JSON.stringify({ name: `gas_receipt_${file.name}`, parents: [folderId] }),
      });
      const meta = await metaRes.json();
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${meta.id}?uploadType=media`, {
        method: "PATCH", headers: { ...authHeader(), "Content-Type": file.type }, body: file,
      });
      setGasLogs(prev => prev.map(g => g.id === gasId ? { ...g, receiptFileId: meta.id } : g));
    } catch (err) { alert("Receipt upload failed: " + err.message); }
  };

  const deleteJob = (id) => {
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
  const extractWithDriveOCR = async (file) => {
    const base64 = await new Promise(r => {
      const reader = new FileReader();
      reader.onload = () => r(reader.result.split(",")[1]);
      reader.readAsDataURL(file);
    });
    const boundary = "ocr_" + Date.now();
    const meta = JSON.stringify({ name: `_ocr_${Date.now()}`, mimeType: "application/vnd.google-apps.document", parents: [folderId] });
    const body = [`--${boundary}`, "Content-Type: application/json; charset=UTF-8", "", meta,
      `--${boundary}`, `Content-Type: ${file.type}`, "Content-Transfer-Encoding: base64", "", base64, `--${boundary}--`].join("\r\n");

    const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": `multipart/related; boundary="${boundary}"` },
      body,
    });
    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      throw new Error("Drive OCR upload failed: " + (err.error?.message || uploadRes.status));
    }
    const ocrDoc = await uploadRes.json();
    if (!ocrDoc.id) throw new Error("No OCR doc ID returned");

    const textRes = await fetch(`https://www.googleapis.com/drive/v3/files/${ocrDoc.id}/export?mimeType=text/plain`, { headers: authHeader() });
    const text = await textRes.text();
    console.log("=== RAW OCR TEXT ===\n", text, "\n===================");

    // Delete temp doc (fire and forget)
    fetch(`https://www.googleapis.com/drive/v3/files/${ocrDoc.id}`, { method: "DELETE", headers: authHeader() }).catch(() => {});

    return parseInvoiceText(text);
  };

  // ── UPLOAD ───────────────────────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    e.target.value = "";
    if (!folderId) { alert("Not connected to Drive yet. Please log out and reconnect."); return; }

    setIsUploading(true);
    setUploadError("");

    for (const file of files) {
      const itemId = crypto.randomUUID();

      // 1. Store a local blob URL so preview works immediately
      const blobUrl = URL.createObjectURL(file);
      blobCache.current.set(itemId, { url: blobUrl, type: file.type });

      // 2. Upload original file to Drive
      setUploadStatus(`Uploading ${file.name}...`);
      let driveFileId = null;
      try {
        const metaRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST", headers: jsonHeaders(),
          body: JSON.stringify({ name: file.name, parents: [folderId] }),
        });
        if (!metaRes.ok) {
          const err = await metaRes.json().catch(() => ({}));
          throw new Error("Upload failed: " + (err.error?.message || metaRes.status));
        }
        const metaData = await metaRes.json();
        driveFileId = metaData.id;

        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`, {
          method: "PATCH",
          headers: { ...authHeader(), "Content-Type": file.type },
          body: file,
        });
      } catch (err) {
        console.error("Drive upload error:", err);
        setUploadError(err.message + " — Make sure Google Drive API is enabled at console.cloud.google.com");
      }

      // 3. OCR extraction
      setUploadStatus(`Reading ${file.name}...`);
      let extracted = { company: "", amount: 0, date: new Date().toISOString().split("T")[0], invoiceNumber: "" };
      try {
        const result = await extractWithDriveOCR(file);
        if (result) extracted = result;
      } catch (err) {
        console.warn("OCR failed:", err.message);
        // Fall back to filename as company
        extracted.company = file.name.replace(/\.[^.]+$/, "").replace(/[_\-]+/g, " ");
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
        timestamp: Date.now(),
      }, ...prev]);
      if (uploadJobId) setExpandedJobs(prev => { const n = new Set(prev); n.add(uploadJobId); return n; });
    }

    setIsUploading(false);
    setUploadStatus("");
  };

  const deleteInvoice = (id) => {
    URL.revokeObjectURL(blobCache.current.get(id)?.url);
    URL.revokeObjectURL(blobCache.current.get("paystub_" + id)?.url);
    blobCache.current.delete(id);
    blobCache.current.delete("paystub_" + id);
    setInvoices(prev => prev.filter(i => i.id !== id));
  };

  // ── PAYSTUB UPLOAD ───────────────────────────────────────────────────────────
  const handlePaystubUpload = async (invoiceId, file) => {
    if (!file || !folderId) return;
    setPaystubUploading(invoiceId);

    // Store blob for immediate local preview
    const blobUrl = URL.createObjectURL(file);
    blobCache.current.set("paystub_" + invoiceId, { url: blobUrl, type: file.type });

    // Upload to Drive
    let driveFileId = null;
    try {
      const metaRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST", headers: jsonHeaders(),
        body: JSON.stringify({ name: "paystub_" + file.name, parents: [folderId] }),
      });
      if (metaRes.ok) {
        const metaData = await metaRes.json();
        driveFileId = metaData.id;
        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`, {
          method: "PATCH", headers: { ...authHeader(), "Content-Type": file.type }, body: file,
        });
      }
    } catch (err) { console.warn("Paystub Drive upload error:", err); }

    // OCR extraction
    let extracted = { grossPay: 0, netPay: 0, payDate: new Date().toISOString().split("T")[0], checkNumber: "", employer: "" };
    try {
      const base64 = await new Promise(r => { const reader = new FileReader(); reader.onload = () => r(reader.result.split(",")[1]); reader.readAsDataURL(file); });
      const boundary = "ocr_ps_" + Date.now();
      const meta = JSON.stringify({ name: `_ocrps_${Date.now()}`, mimeType: "application/vnd.google-apps.document", parents: [folderId] });
      const body = [`--${boundary}`, "Content-Type: application/json; charset=UTF-8", "", meta,
        `--${boundary}`, `Content-Type: ${file.type}`, "Content-Transfer-Encoding: base64", "", base64, `--${boundary}--`].join("\r\n");
      const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST", headers: { ...authHeader(), "Content-Type": `multipart/related; boundary="${boundary}"` }, body,
      });
      if (uploadRes.ok) {
        const ocrDoc = await uploadRes.json();
        if (ocrDoc.id) {
          const textRes = await fetch(`https://www.googleapis.com/drive/v3/files/${ocrDoc.id}/export?mimeType=text/plain`, { headers: authHeader() });
          const text = await textRes.text();
          console.log("=== PAYSTUB OCR ===\n", text);
          fetch(`https://www.googleapis.com/drive/v3/files/${ocrDoc.id}`, { method: "DELETE", headers: authHeader() }).catch(() => {});
          extracted = parsePaystubText(text);
        }
      }
    } catch (err) { console.warn("Paystub OCR error:", err); }

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
    if (!folderId) { alert("Not connected to Drive yet. Please log out and reconnect."); return; }

    setIsUploadingTimecard(true);
    for (const file of files) {
      const itemId = crypto.randomUUID();
      const blobUrl = URL.createObjectURL(file);
      blobCache.current.set(itemId, { url: blobUrl, type: file.type });

      setUploadTimecardStatus(`Uploading ${file.name}...`);
      let driveFileId = null;
      try {
        const metaRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST", headers: jsonHeaders(),
          body: JSON.stringify({ name: file.name, parents: [folderId] }),
        });
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          driveFileId = metaData.id;
          await fetch(`https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`, {
            method: "PATCH", headers: { ...authHeader(), "Content-Type": file.type }, body: file,
          });
        }
      } catch (err) { console.warn("Drive upload error:", err); }

      setUploadTimecardStatus(`Reading ${file.name}...`);
      let extracted = { company: "", hours: 0, rate: 0, date: new Date().toISOString().split("T")[0], description: "" };
      try {
        const rawText = await extractWithDriveOCR(file);
        // extractWithDriveOCR already calls parseInvoiceText — we need raw text here
        // so we re-do just the OCR part and call parseTimecardText instead
        const result = await (async () => {
          const base64 = await new Promise(r => { const reader = new FileReader(); reader.onload = () => r(reader.result.split(",")[1]); reader.readAsDataURL(file); });
          const boundary = "ocr_tc_" + Date.now();
          const meta = JSON.stringify({ name: `_ocrtc_${Date.now()}`, mimeType: "application/vnd.google-apps.document", parents: [folderId] });
          const body = [`--${boundary}`, "Content-Type: application/json; charset=UTF-8", "", meta,
            `--${boundary}`, `Content-Type: ${file.type}`, "Content-Transfer-Encoding: base64", "", base64, `--${boundary}--`].join("\r\n");
          const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
            method: "POST", headers: { ...authHeader(), "Content-Type": `multipart/related; boundary="${boundary}"` }, body,
          });
          if (!uploadRes.ok) throw new Error("OCR upload failed");
          const ocrDoc = await uploadRes.json();
          if (!ocrDoc.id) throw new Error("No OCR doc ID");
          const textRes = await fetch(`https://www.googleapis.com/drive/v3/files/${ocrDoc.id}/export?mimeType=text/plain`, { headers: authHeader() });
          const text = await textRes.text();
          fetch(`https://www.googleapis.com/drive/v3/files/${ocrDoc.id}`, { method: "DELETE", headers: authHeader() }).catch(() => {});
          return parseTimecardText(text);
        })();
        if (result) extracted = result;
      } catch (err) {
        console.warn("Timecard OCR failed:", err.message);
        extracted.company = file.name.replace(/\.[^.]+$/, "").replace(/[_\-]+/g, " ");
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
    const days = newTimecard.days.map(d => {
      const actualHours = calcDayHours(d);
      // Apply guaranteed minimum only on days the crew member actually worked
      const paidHours = actualHours > 0 ? Math.max(actualHours, guarHours) : 0;
      return { ...d, totalHours: actualHours, paidHours, ...calcOTBreakdown(paidHours) };
    });
    const hours = parseFloat(days.reduce((a, d) => a + (d.paidHours ?? d.totalHours), 0).toFixed(2));
    const mealPenaltyPay = parseFloat(days.reduce((a, d) => a + (d.mealPenalty ? rate : 0), 0).toFixed(2));
    const total = parseFloat((days.reduce((a, d) => a + (d.hours1x * rate) + (d.hours15x * rate * 1.5) + (d.hours2x * rate * 2), 0) + mealPenaltyPay).toFixed(2));
    setTimecards(prev => [{ id: crypto.randomUUID(), company: newTimecard.company, jobName: newTimecard.jobName, jobClassification: newTimecard.jobClassification, guarHours, hours, rate, total, mealPenaltyPay, date: newTimecard.weekEnding, days, description: newTimecard.description, status: "Unpaid", jobId: newTimecard.jobId || "", workerName: newTimecard.workerName || "", workerEmail: newTimecard.workerEmail || "", last4SS: newTimecard.last4SS || "", mileage: parseFloat(newTimecard.mileage) || 0, signatureName: newTimecard.workerName || "", signatureFont: newTimecard.signatureFont || "Dancing Script", signatureDate: newTimecard.signatureDate || "", timestamp: Date.now() }, ...prev]);
    if (newTimecard.jobId) setExpandedJobs(prev => { const n = new Set(prev); n.add(newTimecard.jobId); return n; });
    setNewTimecard(p => { const we = p.weekEnding; return { company: "", jobName: "", jobClassification: "", guarHours: p.guarHours, rate: "", weekEnding: we, days: initWeekDays(we), description: "", jobId: p.jobId, workerName: p.workerName, workerEmail: p.workerEmail, last4SS: p.last4SS, mileage: "", signatureFont: p.signatureFont, signatureDate: new Date().toISOString().split("T")[0] }; });
  };

  const saveTimecardEdit = () => {
    if (!editingTimecard) return;
    const rate = parseFloat(editingTimecard.rate);
    if (!editingTimecard.company || isNaN(rate) || rate <= 0) return;
    const guarHours = parseFloat(editingTimecard.guarHours) || 0;
    const days = editingTimecard.days.map(d => {
      const actualHours = calcDayHours(d);
      const paidHours = actualHours > 0 ? Math.max(actualHours, guarHours) : 0;
      return { ...d, totalHours: actualHours, paidHours, ...calcOTBreakdown(paidHours) };
    });
    const hours = parseFloat(days.reduce((a, d) => a + (d.paidHours ?? d.totalHours), 0).toFixed(2));
    const mealPenaltyPay = parseFloat(days.reduce((a, d) => a + (d.mealPenalty ? rate : 0), 0).toFixed(2));
    const total = parseFloat((days.reduce((a, d) => a + (d.hours1x * rate) + (d.hours15x * rate * 1.5) + (d.hours2x * rate * 2), 0) + mealPenaltyPay).toFixed(2));
    setTimecards(prev => prev.map(tc => tc.id !== editingTimecard.id ? tc : {
      ...tc, company: editingTimecard.company, jobName: editingTimecard.jobName,
      jobClassification: editingTimecard.jobClassification, guarHours, rate, date: editingTimecard.weekEnding,
      days, hours, total, mealPenaltyPay, description: editingTimecard.description, jobId: editingTimecard.jobId || "",
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
      const guarApplied = d.paidHours != null && d.paidHours > d.totalHours;
      const rowBg = isWeekend ? "#fffbeb" : hasWork ? "#eff6ff" : "#ffffff";
      const otStr = d.hours2x > 0 ? `${d.hours2x}\u00d72 ` : d.hours15x > 0 ? `${d.hours15x}\u00d71.5` : d.totalHours > 0 ? "St" : "\u2014";
      const mpCell = d.mealPenalty ? `<span style='color:#c2410c;font-weight:bold;'>&#9888; Yes</span>` : `<span style='color:#cbd5e1;'>\u2014</span>`;
      return `<tr style="background:${rowBg};border-bottom:1px solid #e2e8f0;">
        <td style="padding:5px 8px;font-weight:600;">${d.day} ${new Date(d.date + "T12:00").toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}</td>
        <td style="padding:5px 8px;text-align:center;">${d.call || "\u2014"}</td>
        <td style="padding:5px 8px;text-align:center;">${d.meal1Out && d.meal1In ? d.meal1Out + "\u2013" + d.meal1In : "\u2014"}</td>
        <td style="padding:5px 8px;text-align:center;">${d.meal2Out && d.meal2In ? d.meal2Out + "\u2013" + d.meal2In : "\u2014"}</td>
        <td style="padding:5px 8px;text-align:center;">${d.wrap || "\u2014"}</td>
        <td style="padding:5px 8px;text-align:center;font-weight:bold;">${d.totalHours > 0 ? d.totalHours + "h" : "\u2014"}</td>
        <td style="padding:5px 8px;text-align:center;font-weight:bold;">${paidH > 0 ? paidH + "h" : "\u2014"}${guarApplied ? " <span style='color:#b45309;font-size:9px;'>(guar)</span>" : ""}</td>
        <td style="padding:5px 8px;text-align:center;font-size:10px;">${otStr}</td>
        <td style="padding:5px 8px;text-align:center;font-size:10px;">${mpCell}</td>
      </tr>`;
    }).join("");
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
<table><thead><tr><th>Day</th><th>Call</th><th>Meal 1</th><th>Meal 2</th><th>Wrap</th><th>Hrs Worked</th><th>Hrs Paid</th><th>OT</th><th>Meal Penalty</th></tr></thead><tbody>${rowsHtml}</tbody><tfoot><tr><td colspan="5" style="text-align:left;">WEEK TOTAL (Hours)</td><td style="text-align:center;">${entry.hours}h</td><td colspan="2" style="text-align:center;">$${(entry.total - (entry.mealPenaltyPay || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td style="text-align:center;">${(entry.days?.filter(d => d.mealPenalty).length || 0) > 0 ? entry.days.filter(d => d.mealPenalty).length + " day(s)" : "\u2014"}</td></tr>${(entry.mealPenaltyPay || 0) > 0 ? `<tr><td colspan="5" style="text-align:left;">Meal Penalty (${entry.days.filter(d => d.mealPenalty).length} day${entry.days.filter(d => d.mealPenalty).length !== 1 ? "s" : ""} \u00d7 1hr base)</td><td colspan="3" style="text-align:center;">$${(entry.mealPenaltyPay).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td></td></tr><tr><td colspan="5" style="text-align:left;font-size:13px;">TOTAL DUE</td><td colspan="3" style="text-align:center;font-size:13px;">$${(entry.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td></td></tr>` : ""}</tfoot></table>
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
    URL.revokeObjectURL(blobCache.current.get(id)?.url);
    URL.revokeObjectURL(blobCache.current.get("tc_paystub_" + id)?.url);
    blobCache.current.delete(id);
    blobCache.current.delete("tc_paystub_" + id);
    setTimecards(prev => prev.filter(t => t.id !== id));
  };

  // ── TIMECARD PAYSTUB UPLOAD ──────────────────────────────────────────────────
  const handleTimecardPaystubUpload = async (timecardId, file) => {
    if (!file || !folderId) return;
    setPaystubUploading(timecardId);

    const blobUrl = URL.createObjectURL(file);
    blobCache.current.set("tc_paystub_" + timecardId, { url: blobUrl, type: file.type });

    let driveFileId = null;
    try {
      const metaRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST", headers: jsonHeaders(),
        body: JSON.stringify({ name: "tc_paystub_" + file.name, parents: [folderId] }),
      });
      if (metaRes.ok) {
        const metaData = await metaRes.json();
        driveFileId = metaData.id;
        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`, {
          method: "PATCH", headers: { ...authHeader(), "Content-Type": file.type }, body: file,
        });
      }
    } catch (err) { console.warn("Timecard paystub Drive upload error:", err); }

    let extracted = { grossPay: 0, netPay: 0, payDate: new Date().toISOString().split("T")[0], checkNumber: "", employer: "" };
    try {
      const base64 = await new Promise(r => { const reader = new FileReader(); reader.onload = () => r(reader.result.split(",")[1]); reader.readAsDataURL(file); });
      const boundary = "ocr_tcp_" + Date.now();
      const meta = JSON.stringify({ name: `_ocrtcp_${Date.now()}`, mimeType: "application/vnd.google-apps.document", parents: [folderId] });
      const body = [`--${boundary}`, "Content-Type: application/json; charset=UTF-8", "", meta,
        `--${boundary}`, `Content-Type: ${file.type}`, "Content-Transfer-Encoding: base64", "", base64, `--${boundary}--`].join("\r\n");
      const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST", headers: { ...authHeader(), "Content-Type": `multipart/related; boundary="${boundary}"` }, body,
      });
      if (uploadRes.ok) {
        const ocrDoc = await uploadRes.json();
        if (ocrDoc.id) {
          const textRes = await fetch(`https://www.googleapis.com/drive/v3/files/${ocrDoc.id}/export?mimeType=text/plain`, { headers: authHeader() });
          const text = await textRes.text();
          fetch(`https://www.googleapis.com/drive/v3/files/${ocrDoc.id}`, { method: "DELETE", headers: authHeader() }).catch(() => {});
          extracted = parsePaystubText(text);
        }
      }
    } catch (err) { console.warn("Timecard paystub OCR error:", err); }

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
  const totalPaid = filteredInvoices.filter(i => i.status === "Paid").reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
  const totalOutstanding = totalBilled - totalPaid;
  const totalTimecardHours = filteredTimecards.reduce((a, b) => a + (b.hours || 0), 0);
  const totalTimecardEarnings = filteredTimecards.reduce((a, b) => a + (b.total || 0), 0);
  const totalTimecardInvoiced = filteredTimecards.filter(t => t.status === "Paid").reduce((a, b) => a + (b.total || 0), 0);

  const filteredPurchases = purchases.filter(p => getYear(p.date) === selectedYear &&
    (!sq || (p.name||'').toLowerCase().includes(sq) || (p.vendor||'').toLowerCase().includes(sq) || (p.notes||'').toLowerCase().includes(sq) || (p.serial||'').toLowerCase().includes(sq)));
  const filteredExpendables = filteredPurchases.filter(p => p.category === "expendables");
  const filteredEquipment = filteredPurchases.filter(p => p.category === "equipment");
  const totalExpendables = filteredExpendables.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
  const totalEquipment = filteredEquipment.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
  const totalPurchases = totalExpendables + totalEquipment;

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
        results.push({ id: p.id, tab: "purchases", year: getYear(p.date), title: p.name || "Unnamed Item", sub: `${p.vendor ? p.vendor + " · " : ""}$${(parseFloat(p.amount)||0).toLocaleString(undefined,{minimumFractionDigits:2})}${p.serial ? " · SN:" + p.serial : ""} · ${p.date}`, badge: p.category === "equipment" ? "Equipment" : "Expendable", badgeColor: p.category === "equipment" ? "bg-violet-100 text-violet-700" : "bg-rose-100 text-rose-700", jobId: p.jobId, purchaseCategory: p.category });
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
    setPurchases(prev => [{ id: crypto.randomUUID(), ...newPurchase, amount, timestamp: Date.now() }, ...prev]);
    if (newPurchase.jobId) setExpandedJobs(prev => { const n = new Set(prev); n.add("pur_" + newPurchase.jobId); return n; });
    setNewPurchase(p => ({ name: "", vendor: "", amount: "", date: new Date().toISOString().split("T")[0], notes: "", serial: "", category: p.category, jobId: p.jobId }));
  };

  const deletePurchase = (id) => {
    URL.revokeObjectURL(blobCache.current.get("receipt_" + id)?.url);
    blobCache.current.delete("receipt_" + id);
    setPurchases(prev => prev.filter(p => p.id !== id));
  };

  const handleReceiptUpload = async (purchaseId, file) => {
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    blobCache.current.set("receipt_" + purchaseId, { url: blobUrl, type: file.type });

    let driveFileId = null;
    if (folderId) {
      try {
        const metaRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST", headers: jsonHeaders(),
          body: JSON.stringify({ name: "receipt_" + file.name, parents: [folderId] }),
        });
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          driveFileId = metaData.id;
          await fetch(`https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`, {
            method: "PATCH", headers: { ...authHeader(), "Content-Type": file.type }, body: file,
          });
        }
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20">

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
                {previewItem.fileId && (
                  <Button variant="outline" onClick={() => window.open(`https://drive.google.com/file/d/${previewItem.fileId}/view`)} className="text-xs">
                    <ExternalLink size={13} className="mr-1.5" /> Open in Drive
                  </Button>
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
              ) : previewItem.fileId ? (
                // Drive embed for invoices loaded from saved data
                <iframe src={`https://drive.google.com/file/d/${previewItem.fileId}/preview`} className="w-full h-full border-0" style={{ minHeight: "70vh" }} allow="autoplay" title="Invoice preview" />
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
                  <Input value={editingTimecard.company} onChange={e => setEditingTimecard(p => ({ ...p, company: e.target.value }))} placeholder="e.g. KISSD Honda" />
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
                  <Input type="number" value={editingTimecard.rate} onChange={e => setEditingTimecard(p => ({ ...p, rate: e.target.value }))} />
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Notes</label>
                  <Input value={editingTimecard.description || ""} onChange={e => setEditingTimecard(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Job</label>
                  <select value={editingTimecard.jobId || ""} onChange={e => setEditingTimecard(p => ({ ...p, jobId: e.target.value }))}
                    className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                    <option value="">— Unassigned —</option>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                  </select>
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
                                placeholder={key === "wrap" ? "HH:MM" : undefined}
                                title={key === "wrap" ? "For next-day wraps use hours > 23, e.g. 27:18 = 3:18am" : undefined}
                                onChange={e => setEditingTimecard(p => ({ ...p, days: p.days.map((day, idx) => idx !== i ? day : { ...day, [key]: e.target.value }) }))}
                                className={`w-full text-xs border rounded px-1 py-0.5 text-center focus:outline-none focus:border-blue-400 ${isNextDay ? "border-violet-300 bg-violet-50 text-violet-700 font-medium" : isWeekend ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`} />
                              {isNextDay && <div className="text-[9px] text-violet-500 text-center leading-none mt-0.5">+next day</div>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
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
                    <tr className="bg-blue-600 border-t-2 border-blue-700">
                      <td className="px-3 py-2 text-[10px] font-bold text-blue-100 uppercase border-r border-blue-500">Total Hrs</td>
                      {editingTimecard.days.map((d, i) => {
                        const h = calcDayHours(d);
                        const guarH = parseFloat(editingTimecard.guarHours) || 0;
                        const paidH = h > 0 ? Math.max(h, guarH) : 0;
                        const ot = calcOTBreakdown(paidH);
                        const isWeekend = i === 0 || i === 6;
                        return (
                          <td key={i} className={`px-1 py-2 text-center border-r border-blue-500 last:border-r-0 ${isWeekend ? "bg-blue-700" : ""}`}>
                            <div className={`font-bold text-sm ${paidH > 0 ? "text-white" : "text-blue-400"}`}>{paidH > 0 ? paidH : "—"}</div>
                            {ot.hours15x > 0 && <div className="text-[9px] text-amber-300 font-medium">{ot.hours15x}h @1.5×</div>}
                            {ot.hours2x > 0 && <div className="text-[9px] text-red-300 font-medium">{ot.hours2x}h @2×</div>}
                          </td>
                        );
                      })}
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

      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white"><FileText size={18} /></div>
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
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Drive</span>
                  {lastSynced ? <span className="text-[10px] text-slate-400">Synced {lastSynced}</span> : <span className="text-[10px] text-slate-400">Not yet synced</span>}
                </div>
                <Button onClick={syncToDrive} disabled={isSyncing} variant="outline" className="text-xs h-8 gap-1.5">
                  {isSyncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  {isSyncing ? "Syncing..." : "Sync"}
                </Button>
                <Button variant="ghost" onClick={disconnectDrive} className="!px-2" title={`Disconnect Drive (${driveName})`}><LogOut size={15} /></Button>
              </div>
            ) : (
              <Button onClick={connectDrive} disabled={!googleReady} variant="outline" className="text-xs h-8 gap-1.5">
                <UploadCloud size={13} />{googleReady ? "Connect Drive" : "Loading..."}
              </Button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Drive not connected hint */}
        {!driveConnected && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 flex items-center justify-between gap-3 text-blue-700 text-sm">
            <div className="flex items-center gap-2.5">
              <CloudOff size={16} className="shrink-0" />
              <span><strong>Working offline.</strong> Your data saves automatically to this browser. Connect Google Drive to back up and sync across devices.</span>
            </div>
            <Button onClick={connectDrive} disabled={!googleReady} variant="outline" className="shrink-0 text-xs h-8 border-blue-300 text-blue-700 hover:bg-blue-100">
              {googleReady ? "Connect Drive" : "Loading..."}
            </Button>
          </div>
        )}

        {/* Drive upload error banner */}
        {uploadError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-start gap-3 text-red-700 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Drive upload failed</p>
              <p className="text-red-600 mt-0.5">{uploadError}</p>
              <button onClick={() => window.open(`https://console.cloud.google.com/apis/library/drive.googleapis.com`)} className="mt-2 underline font-medium">Enable Google Drive API →</button>
            </div>
            <button onClick={() => setUploadError("")} className="ml-auto shrink-0"><X size={16} /></button>
          </div>
        )}

        {/* Year selector */}
        <div className="flex items-center gap-2 flex-wrap">
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
            <button onClick={() => { setActiveTab("mileage"); setSearchQuery(""); }} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "mileage" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              <MapPin size={14} className="inline mr-1.5 -mt-0.5" />Mileage
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

            {/* Overdue / due-soon notification banners */}
            {(() => {
              const today = new Date(); today.setHours(0,0,0,0);
              const unpaid = invoices.filter(i => i.status !== "Paid");
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
                  {showNewJobForm ? (
                    <form onSubmit={e => { e.preventDefault(); if (newJobName.trim()) { addJob(newJobName); setNewJobName(""); setShowNewJobForm(false); } }} className="flex gap-2">
                      <Input value={newJobName} onChange={e => setNewJobName(e.target.value)} placeholder="Job name" className="w-48 h-8 text-sm" autoFocus />
                      <Button type="submit" className="h-8 text-xs px-3">Save</Button>
                      <Button type="button" variant="ghost" onClick={() => { setShowNewJobForm(false); setNewJobName(""); }} className="h-8 text-xs px-2">Cancel</Button>
                    </form>
                  ) : (
                    <Button variant="outline" onClick={() => setShowNewJobForm(true)} className="h-8 text-xs"><Plus size={13} className="mr-1" />New Job</Button>
                  )}
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
                  const groupPaid = group.items.filter(i => i.status === "Paid").reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
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
                                return (<Card key={item.id} id={item.id} className={`hover:border-blue-200 transition-all flex flex-col ${highlightedId === item.id ? "ring-2 ring-blue-500 border-blue-400" : ""}`}>
                                  <div className="p-5 flex-1 space-y-4">
                                    <div className="flex justify-between items-start">
                                      <div className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${item.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{item.status}</div>
                                      <div className="flex items-center gap-1">
                                        <select value={item.jobId || ""} onChange={e => { const n = [...invoices]; n[idx] = { ...n[idx], jobId: e.target.value }; setInvoices(n); }}
                                          className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-500 focus:outline-none max-w-[100px]" title="Move to job">
                                          <option value="">Unassigned</option>
                                          {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                                        </select>
                                        <Button variant="danger" onClick={() => deleteInvoice(item.id)} className="!p-1.5"><Trash2 size={14} /></Button>
                                      </div>
                                    </div>
                                    {item.invoiceNumber && <p className="text-[11px] text-slate-400 font-mono tracking-wide -mt-2">#{item.invoiceNumber}</p>}
                                    {(() => {
                                      if (item.status === "Paid") return null;
                                      const today = new Date(); today.setHours(0,0,0,0);
                                      const defaultDue = item.dueDate || (() => { const d = new Date(item.date); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; })();
                                      const due = new Date(defaultDue); due.setHours(0,0,0,0);
                                      const diff = Math.round((due - today) / 86400000);
                                      if (diff < 0) return <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-100 text-red-700 text-[11px] font-bold w-fit"><AlertCircle size={12} />{Math.abs(diff)}d overdue</div>;
                                      if (diff <= 7) return <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 text-[11px] font-bold w-fit"><CalendarClock size={12} />Due in {diff}d</div>;
                                      return <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-500 text-[11px] w-fit"><CalendarClock size={12} />Due in {diff}d</div>;
                                    })()}
                                    <div className="space-y-3">
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Client / Company</label>
                                        <Input value={item.company} placeholder="Click to add company name" onChange={e => { const n = [...invoices]; n[idx] = { ...n[idx], company: e.target.value }; setInvoices(n); }} />
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-400 uppercase">Amount ($)</label>
                                          <Input type="number" value={item.amount} onChange={e => { const n = [...invoices]; n[idx] = { ...n[idx], amount: e.target.value }; setInvoices(n); }} />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
                                          <Input type="date" value={item.date} onChange={e => { const n = [...invoices]; n[idx] = { ...n[idx], date: e.target.value }; setInvoices(n); }} />
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><CalendarClock size={10} />Due Date <span className="font-normal normal-case text-slate-300">(default 30 days)</span></label>
                                        <Input type="date" value={item.dueDate || (() => { const d = new Date(item.date); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; })()} onChange={e => { const n = [...invoices]; n[idx] = { ...n[idx], dueDate: e.target.value }; setInvoices(n); }} />
                                      </div>
                                    </div>
                                  </div>
                                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
                                    <Button variant="outline" className="flex-none" onClick={() => setPreviewItem(item)} title="Preview invoice">
                                      <Eye size={15} className="mr-1.5" /> View
                                    </Button>
                                    {item.status !== "Paid" ? (
                                      <Button variant="success" className="flex-1" onClick={() => { const n = [...invoices]; n[idx] = { ...n[idx], status: "Paid" }; setInvoices(n); }}>Mark as Paid</Button>
                                    ) : (
                                      <Button variant="outline" className="flex-1 text-emerald-600 border-emerald-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors group" onClick={() => { const n = [...invoices]; n[idx] = { ...n[idx], status: "Unpaid" }; setInvoices(n); }} title="Click to mark as unpaid">
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
                  <Input value={newTimecard.company} onChange={e => setNewTimecard(p => ({ ...p, company: e.target.value }))} placeholder="e.g. KISSD Honda" />
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
                  <Input type="number" value={newTimecard.rate} onChange={e => setNewTimecard(p => ({ ...p, rate: e.target.value }))} placeholder="e.g. 750" />
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Notes</label>
                  <Input value={newTimecard.description} onChange={e => setNewTimecard(p => ({ ...p, description: e.target.value }))} placeholder="Meal penalty, etc." />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Job</label>
                  <select value={newTimecard.jobId} onChange={e => setNewTimecard(p => ({ ...p, jobId: e.target.value }))}
                    className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                    <option value="">— Unassigned —</option>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                  </select>
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
                                placeholder={key === "wrap" ? "HH:MM" : undefined}
                                title={key === "wrap" ? "For next-day wraps use hours > 23, e.g. 27:18 = 3:18am" : undefined}
                                onChange={e => setNewTimecard(p => ({ ...p, days: p.days.map((day, idx) => idx !== i ? day : { ...day, [key]: e.target.value }) }))}
                                className={`w-full text-xs border rounded px-1 py-0.5 text-center focus:outline-none focus:border-blue-400 ${isNextDay ? "border-violet-300 bg-violet-50 text-violet-700 font-medium" : isWeekend ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`} />
                              {isNextDay && <div className="text-[9px] text-violet-500 text-center leading-none mt-0.5">+next day</div>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {/* Calculated totals row */}
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
                    {/* Calculated totals row */}
                    <tr className="bg-blue-600 border-t-2 border-blue-700">
                      <td className="px-3 py-2 text-[10px] font-bold text-blue-100 uppercase border-r border-blue-500">Total Hrs</td>
                      {newTimecard.days.map((d, i) => {
                        const h = calcDayHours(d);
                        const ot = calcOTBreakdown(h);
                        const isWeekend = (i === 0 || i === 6);
                        return (
                          <td key={i} className={`px-1 py-2 text-center border-r border-blue-500 last:border-r-0 ${isWeekend ? "bg-blue-700" : ""}`}>
                            <div className={`font-bold text-sm ${h > 0 ? "text-white" : "text-blue-400"}`}>{h > 0 ? h : "—"}</div>
                            {ot.hours15x > 0 && <div className="text-[9px] text-amber-300 font-medium">{ot.hours15x}h @1.5×</div>}
                            {ot.hours2x > 0 && <div className="text-[9px] text-red-300 font-medium">{ot.hours2x}h @2×</div>}
                          </td>
                        );
                      })}
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
                                return (<Card key={entry.id} id={entry.id} className={`hover:border-blue-200 transition-all flex flex-col ${highlightedId === entry.id ? "ring-2 ring-violet-500 border-violet-400" : ""}`}>
                                  <div className="flex-1 flex flex-col">
                                    {/* Card header */}
                                    <div className="p-4 space-y-2">
                                      <div className="flex justify-between items-start">
                                        <div className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${entry.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{entry.status}</div>
                                        <div className="flex items-center gap-1">
                                          <select value={entry.jobId || ""} onChange={e => { const n = [...timecards]; n[idx] = { ...n[idx], jobId: e.target.value }; setTimecards(n); }}
                                            className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-500 focus:outline-none max-w-[100px]" title="Move to job">
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
                                            {(entry.mealPenaltyPay || 0) > 0 && (
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
                                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2 flex-wrap">
                                    <Button variant="outline" className="flex-none" title="Edit timecard"
                                      onClick={() => setEditingTimecard({ ...entry, rate: String(entry.rate), guarHours: String(entry.guarHours || ""), weekEnding: entry.date, days: entry.days?.length ? entry.days.map(d => ({ ...d })) : initWeekDays(entry.date) })}>
                                      <Pencil size={14} className="mr-1.5" />Edit
                                    </Button>
                                    <Button variant="outline" className="flex-none" title="Download PDF" onClick={() => downloadTimecardPDF(entry)}>
                                      <Download size={14} className="mr-1.5" />PDF
                                    </Button>
                                    {blobCache.current.has(entry.id) && (
                                      <Button variant="outline" className="flex-none" onClick={() => setPreviewItem(entry)} title="Preview timecard">
                                        <Eye size={15} className="mr-1.5" /> View
                                      </Button>
                                    )}
                                    {entry.status !== "Paid" ? (
                                      <Button variant="success" className="flex-1" onClick={() => { const n = [...timecards]; n[idx] = { ...n[idx], status: "Paid" }; setTimecards(n); }}>Mark as Paid</Button>
                                    ) : (
                                      <Button variant="outline" className="flex-1 text-emerald-600 border-emerald-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors group" onClick={() => { const n = [...timecards]; n[idx] = { ...n[idx], status: "Unpaid" }; setTimecards(n); }} title="Click to mark as unpaid">
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

            {/* Sub-tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
              <button onClick={() => { setPurchaseSubTab("expendables"); setNewPurchase(p => ({ ...p, category: "expendables" })); }}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${purchaseSubTab === "expendables" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                <Package size={14} className="inline mr-1.5 -mt-0.5" />Expendables
              </button>
              <button onClick={() => { setPurchaseSubTab("equipment"); setNewPurchase(p => ({ ...p, category: "equipment" })); }}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${purchaseSubTab === "equipment" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                <Wrench size={14} className="inline mr-1.5 -mt-0.5" />Equipment
              </button>
            </div>

            {/* Add purchase form */}
            <Card className="p-6">
              <h3 className="text-base font-bold mb-4">Log {purchaseSubTab === "expendables" ? "Expendable" : "Equipment"} Purchase</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                <div className="space-y-1 lg:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Item Name</label>
                  <Input value={newPurchase.name} onChange={e => setNewPurchase(p => ({ ...p, name: e.target.value }))} placeholder={purchaseSubTab === "expendables" ? "e.g. Gels, tape, batteries" : "e.g. Camera, lens, tripod"} />
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
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Serial Number (optional)</label>
                  <Input value={newPurchase.serial} onChange={e => setNewPurchase(p => ({ ...p, serial: e.target.value }))} placeholder="e.g. SN123456789" className="font-mono" />
                </div>
                <div className="space-y-1 lg:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Job</label>
                  <select value={newPurchase.jobId} onChange={e => setNewPurchase(p => ({ ...p, jobId: e.target.value }))}
                    className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                    <option value="">— Unassigned —</option>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                  </select>
                </div>
                <Button onClick={addPurchase} className="h-10"><Plus size={16} className="mr-1.5" /> Add</Button>
              </div>
            </Card>

            {/* Purchase list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xl font-bold">
                  {purchaseSubTab === "expendables" ? <><Package size={18} className="inline mr-2 -mt-0.5 text-rose-500" />Expendables</> : <><Wrench size={18} className="inline mr-2 -mt-0.5 text-violet-600" />Equipment</>}
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
                const activeItems = purchaseSubTab === "expendables" ? filteredExpendables : filteredEquipment;
                const accentColor = purchaseSubTab === "expendables" ? "text-rose-600" : "text-violet-600";

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
                        {purchaseSubTab === "expendables" ? <Package size={32} /> : <Wrench size={32} />}
                      </div>
                      <h4 className="text-slate-900 font-semibold">{sq ? `No ${purchaseSubTab} match "${sq}"` : `No ${purchaseSubTab} logged for ${selectedYear}`}</h4>
                      <p className="text-slate-500 text-sm">{sq ? "Try a different search term." : "Use the form above to add your first entry."}</p>
                    </div>
                  );
                }

                const PurchaseCard = ({ p }) => {
                  const idx = purchases.findIndex(x => x.id === p.id);
                  const upd = (field, val) => { const n = [...purchases]; n[idx] = { ...n[idx], [field]: val }; setPurchases(n); };
                  return (
                    <Card key={p.id} id={p.id} className={`hover:border-rose-200 transition-all flex flex-col ${highlightedId === p.id ? "ring-2 ring-rose-500 border-rose-400" : ""}`}>
                      <div className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <select value={p.category} onChange={e => upd("category", e.target.value)}
                            className={`text-[10px] font-bold uppercase tracking-wider border rounded px-2 py-0.5 focus:outline-none cursor-pointer ${
                              p.category === "expendables" ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-violet-100 text-violet-700 border-violet-200"
                            }`}>
                            <option value="expendables">Expendables</option>
                            <option value="equipment">Equipment</option>
                          </select>
                          <div className="flex items-center gap-1">
                            <select value={p.jobId || ""} onChange={e => upd("jobId", e.target.value)}
                              className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-500 focus:outline-none max-w-[90px]" title="Move to job">
                              <option value="">Unassigned</option>
                              {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                            </select>
                            <Button variant="danger" onClick={() => deletePurchase(p.id)} className="!p-1.5"><Trash2 size={13} /></Button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Item Name</label>
                          <Input value={p.name} placeholder="Item name" onChange={e => upd("name", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Vendor</label>
                          <Input value={p.vendor || ""} placeholder="Vendor / store" onChange={e => upd("vendor", e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Amount ($)</label>
                            <Input type="number" value={p.amount} onChange={e => upd("amount", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
                            <Input type="date" value={p.date} onChange={e => upd("date", e.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Notes</label>
                          <Input value={p.notes || ""} placeholder="Optional notes" onChange={e => upd("notes", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Serial Number</label>
                          <Input value={p.serial || ""} placeholder="e.g. SN123456789" onChange={e => upd("serial", e.target.value)} className="font-mono" />
                        </div>
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
                            <p className="text-sm text-slate-400 text-center py-6">No {purchaseSubTab} in this job yet. Select it in the form above.</p>
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
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
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
                                  <Button variant="danger" onClick={() => setMileageLogs(prev => prev.filter(x => x.id !== m.id))} className="!p-1.5"><Trash2 size={13} /></Button>
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
                              <Button variant="danger" onClick={() => setVehicleExpenses(prev => prev.filter(x => x.id !== v.id))} className="!p-1.5"><Trash2 size={13} /></Button>
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
                              <Button variant="danger" onClick={() => setGasLogs(prev => prev.filter(x => x.id !== g.id))} className="!p-1.5"><Trash2 size={13} /></Button>
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
      </main>
    </div>
  );
}
