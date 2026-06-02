"use client";

import React from "react";
import { ChevronLeft, ChevronRight, FileDown, PenLine, Pencil } from "lucide-react";
import { Card } from "./ui";
import { computeInvoiceStatus } from "../lib/utils";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const kindStyle = { shoot: "bg-blue-100 text-blue-800", hold: "bg-amber-100 text-amber-800", travel: "bg-purple-100 text-purple-800", "inv-due": "bg-orange-100 text-orange-800", "inv-overdue": "bg-red-100 text-red-800", "inv-paid": "bg-emerald-100 text-emerald-700" };
const kindDot = { shoot: "🎬", hold: "⏸", travel: "✈", "inv-due": "💰", "inv-overdue": "⚠", "inv-paid": "✓" };
const holdTypeStyle = { soft: "bg-pink-100 text-pink-700", hold: "bg-blue-100 text-blue-800", locked: "bg-orange-100 text-orange-800", travel: "bg-purple-100 text-purple-800", prep: "bg-teal-100 text-teal-800", scout: "bg-cyan-100 text-cyan-800", wrap: "bg-slate-100 text-slate-700" };
const holdTypeDot = { soft: "✏️", hold: "⏸", locked: "🔒", travel: "✈️", prep: "🔧", scout: "🚧", wrap: "📦" };
const getChipStyle = ev => ev.holdType ? (holdTypeStyle[ev.holdType] || kindStyle.hold) : kindStyle[ev.kind];
const getChipDot = ev => ev.holdType ? (holdTypeDot[ev.holdType] || kindDot.hold) : kindDot[ev.kind];

export default function CalendarTab({
  // Data
  timecards,
  invoices,
  holdDays,
  calendarNotes,
  setCalendarNotes,
  // Navigation state
  calMonth,
  setCalMonth,
  calYear,
  setCalYear,
  // Selection state
  calSelectMode,
  setCalSelectMode,
  calSelectedDates,
  setCalSelectedDates,
  // Hold prompt
  setHoldNameInput,
  setHoldTypeInput,
  setHoldNamePrompt,
  // Release modal
  setHoldReleaseModal,
  // Journal state
  calNoteDate,
  setCalNoteDate,
  calNoteEditing,
  setCalNoteEditing,
  calNoteDraft,
  setCalNoteDraft,
}) {
  const today = new Date().toISOString().split("T")[0];

  // Build event map from timecards + invoices + holdDays
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

  // ── iCalendar export ──
  const exportCalendarICS = () => {
    const fmt = iso => iso.replace(/-/g, "");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const escape = str => (str || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Have I Been Paid//Production Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];
    Object.entries(eventMap).forEach(([date, evs]) => {
      evs.forEach((ev, i) => {
        const note = calendarNotes[date] || "";
        const kindLabel = ev.holdType ? (ev.holdType.charAt(0).toUpperCase() + ev.holdType.slice(1)) : ev.kind;
        const summary = escape(ev.label);
        const desc = escape(
          (ev.hours ? `Hours: ${ev.hours}` : "") +
          (ev.amount ? `${ev.hours ? " | " : ""}Amount: $${parseFloat(ev.amount).toLocaleString()}` : "") +
          (note ? `${ev.hours || ev.amount ? "\n" : ""}${note}` : "")
        );
        lines.push(
          ...([
            "BEGIN:VEVENT",
            `UID:hibp-${date}-${kindLabel}-${i}@haveIBeenPaid`,
            `DTSTAMP:${stamp}`,
            `DTSTART;VALUE=DATE:${fmt(date)}`,
            `DTEND;VALUE=DATE:${fmt(date)}`,
            `SUMMARY:${summary}`,
            desc ? `DESCRIPTION:${desc}` : null,
            "END:VEVENT",
          ].filter(Boolean))
        );
      });
      if (evs.length === 0 && calendarNotes[date]) {
        lines.push(
          "BEGIN:VEVENT",
          `UID:hibp-note-${date}@haveIBeenPaid`,
          `DTSTAMP:${stamp}`,
          `DTSTART;VALUE=DATE:${fmt(date)}`,
          `DTEND;VALUE=DATE:${fmt(date)}`,
          `SUMMARY:📝 Note`,
          `DESCRIPTION:${escape(calendarNotes[date])}`,
          "END:VEVENT"
        );
      }
    });
    Object.entries(calendarNotes).forEach(([date, note]) => {
      if (!eventMap[date] && note) {
        lines.push(
          "BEGIN:VEVENT",
          `UID:hibp-note-${date}@haveIBeenPaid`,
          `DTSTAMP:${stamp}`,
          `DTSTART;VALUE=DATE:${fmt(date)}`,
          `DTEND;VALUE=DATE:${fmt(date)}`,
          `SUMMARY:📝 Note`,
          `DESCRIPTION:${escape(note)}`,
          "END:VEVENT"
        );
      }
    });
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `have-i-been-paid-${calYear}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Week summary rows ──
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
    weekRows.push({ weekLabel, shootDays, holdDayCount, travelDays, invDue });
  }

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
            onClick={exportCalendarICS}
            title="Export all events to Apple Calendar or Google Calendar"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
          >
            <FileDown size={14} /> Export .ics
          </button>
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

      {/* Week summary rows */}
      {weekRows.length > 0 && (
        <div className="space-y-1">
          {weekRows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-white border border-slate-100 rounded-lg px-4 py-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-400 w-16 shrink-0">Wk {row.weekLabel}</span>
              {row.shootDays > 0 && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">🎬 {row.shootDays}d</span>}
              {row.holdDayCount > 0 && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">⏸ {row.holdDayCount}d</span>}
              {row.travelDays > 0 && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">✈ {row.travelDays}d</span>}
              {row.invDue > 0 && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">💰 {row.invDue} due</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
