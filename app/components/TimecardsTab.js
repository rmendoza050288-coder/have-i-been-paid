"use client";

import React from "react";
import {
  Clock,
  Wrench,
  X,
  Plus,
  ChevronDown,
  ChevronRight,
  Briefcase,
  Trash2,
  Lock,
  LockOpen,
  Pencil,
  Download,
  FileDown,
  Eye,
  UploadCloud,
  CheckCircle,
  CreditCard,
  Loader2,
} from "lucide-react";
import { Card, Button, Input } from "./ui";
import {
  calcDayHours,
  get6thDayIndex,
  get7thDayIndex,
  calcOTBreakdown,
  calcOTBreakdown6thDay,
  calcOTBreakdown7thDay,
  calcTurnaroundViolations,
  shouldAutoMealPenalty,
  initWeekDays,
  SIGNATURE_FONTS,
  dayRateToHourly,
  downloadCSV,
  TAX_RATE,
} from "../lib/utils";

export default function TimecardsTab({
  totalTimecardHours,
  totalTimecardEarnings,
  totalTimecardInvoiced,
  showClassificationManager,
  setShowClassificationManager,
  classifications,
  setClassifications,
  newClassificationName,
  setNewClassificationName,
  newTimecard,
  setNewTimecard,
  clients,
  jobs,
  addTimecard,
  uploadJobId,
  setUploadJobId,
  showNewJobForm,
  setShowNewJobForm,
  newJobName,
  setNewJobName,
  addJob,
  filteredTimecards,
  selectedYear,
  currentYear,
  sq,
  expandedJobs,
  toggleJobExpanded,
  timecards,
  setTimecards,
  highlightedId,
  deleteTimecard,
  downloadTimecardPDF,
  setEditingTimecard,
  setExportEntry,
  setShowExportModal,
  blobCache,
  setPreviewItem,
  setMarkPaidModal,
  setMarkPaidMode,
  setMarkPaidPartialAmt,
  setMarkPaidDate,
  setMarkPaidMethod,
  paystubUploading,
  handleTimecardPaystubUpload,
  deleteJob,
}) {
  return (
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
                const entered = new Date(raw + "T12:00");
                const dow = entered.getDay();
                const daysToSat = (6 - dow + 7) % 7;
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
  );
}
