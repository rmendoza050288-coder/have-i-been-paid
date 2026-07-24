"use client";

import React from "react";
import {
  AlertCircle,
  CalendarClock,
  UploadCloud,
  CheckCircle,
  X,
  ChevronDown,
  ChevronRight,
  Briefcase,
  Trash2,
  Lock,
  LockOpen,
  Plus,
  FileText,
  FileDown,
  RefreshCw,
  Eye,
  Pencil,
  CreditCard,
  Loader2,
  Copy,
  BookmarkPlus,
} from "lucide-react";
import { Card, Button, Input } from "./ui";
import {
  TAX_RATE,
  computeInvoiceStatus,
  calcLateFee,
  PAYMENT_TERMS,
  dueDateFromTerms,
  downloadCSV,
} from "../lib/utils";

export default function InvoicesTab({
  totalBilled,
  totalPaid,
  totalOutstanding,
  invoices,
  setInvoices,
  timecards,
  filteredInvoices,
  uploadJobId,
  setUploadJobId,
  jobs,
  clients,
  selectedYear,
  currentYear,
  sq,
  expandedJobs,
  toggleJobExpanded,
  highlightedId,
  deleteInvoice,
  duplicateInvoice,
  relinkInputRef,
  openInvoiceGenerator,
  openEditInvoice,
  showNewJobForm,
  setShowNewJobForm,
  newJobName,
  setNewJobName,
  addJob,
  deleteJob,
  setJobStatus,
  invoiceTemplates = [],
  saveAsTemplate,
  generateFromTemplate,
  deleteTemplate,
  setPreviewItem,
  setMarkPaidModal,
  setMarkPaidMode,
  setMarkPaidPartialAmt,
  setMarkPaidDate,
  setMarkPaidMethod,
  paystubUploading,
  handlePaystubUpload,
  blobCache,
}) {
  return (
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

        {/* Templates section */}
        {invoiceTemplates.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <BookmarkPlus size={15} className="text-violet-500" />
              <h3 className="text-sm font-bold text-slate-700">Recurring Templates</h3>
              <span className="text-xs text-slate-400">({invoiceTemplates.length})</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {invoiceTemplates.map(t => (
                <div key={t.id} className="border border-violet-200 bg-violet-50 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 leading-snug">{t.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Saved {t.createdAt}</p>
                    </div>
                    <button onClick={() => deleteTemplate(t.id)} className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0" title="Delete template"><Trash2 size={13} /></button>
                  </div>
                  <Button onClick={() => generateFromTemplate(t)} className="w-full gap-1.5 text-xs bg-violet-600 hover:bg-violet-700">
                    <Plus size={13} />Use Template
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

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
                    {group.id && (() => {
                      const jobStatus = group.status || "active";
                      const statusCycle = { active: "wrapped", wrapped: "hold", hold: "active" };
                      const statusLabel = { active: "Active", wrapped: "Wrapped", hold: "On Hold" };
                      const statusColor = { active: "bg-emerald-100 text-emerald-700 border-emerald-200", wrapped: "bg-slate-100 text-slate-500 border-slate-200", hold: "bg-amber-100 text-amber-700 border-amber-200" };
                      return (
                        <button
                          onClick={e => { e.stopPropagation(); setJobStatus(group.id, statusCycle[jobStatus]); }}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${statusColor[jobStatus]}`}
                          title="Click to change status"
                        >
                          {statusLabel[jobStatus]}
                        </button>
                      );
                    })()}
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
                                  <button
                                    onClick={() => saveAsTemplate(item)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                                    title="Save as recurring template">
                                    <BookmarkPlus size={13} />
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
                            <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
                              <div className="flex flex-wrap gap-2">
                                <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setPreviewItem(item)} title="Preview invoice">
                                  <Eye size={15} className="mr-1.5" /> View
                                </Button>
                                {item.generated && item.generatedData && (
                                  <Button variant="outline" className="flex-1 sm:flex-none text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => openEditInvoice(item)} title="Edit invoice">
                                    <Pencil size={15} className="mr-1.5" />Edit
                                  </Button>
                                )}
                                {!item.paystub ? (
                                  <div className="relative flex-1 sm:flex-none">
                                    <input type="file" accept="image/*,.pdf"
                                      onChange={e => { if (e.target.files[0]) handlePaystubUpload(item.id, e.target.files[0]); e.target.value = ""; }}
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                      disabled={paystubUploading === item.id} />
                                    <Button variant="outline" disabled={paystubUploading === item.id} className="w-full text-blue-600 border-blue-200 hover:bg-blue-50 whitespace-nowrap">
                                      {paystubUploading === item.id ? <><Loader2 size={13} className="animate-spin mr-1.5" />Reading...</> : <><UploadCloud size={13} className="mr-1.5" />Paystub</>}
                                    </Button>
                                  </div>
                                ) : (
                                  <Button variant="outline" className="flex-1 sm:flex-none text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                    onClick={() => setPreviewItem({ ...item, id: "paystub_" + item.id, fileName: item.paystub.fileName, fileId: item.paystub.fileId, fileType: item.paystub.fileType })}>
                                    <CheckCircle size={13} className="mr-1.5" />Paystub
                                  </Button>
                                )}
                              </div>
                              {effectiveStatus !== "Paid" ? (
                                <Button variant="success" className="w-full" onClick={() => {
                                  setMarkPaidModal({ id: item.id, idx, amount: parseFloat(item.amount) || 0, existingPayments: item.payments || [] });
                                  setMarkPaidMode(null);
                                  setMarkPaidPartialAmt("");
                                  setMarkPaidDate(new Date().toISOString().split("T")[0]);
                                  setMarkPaidMethod("");
                                }}>Mark as Paid</Button>
                              ) : (
                                <Button variant="outline" className="w-full text-emerald-600 border-emerald-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors group" onClick={() => { const n = [...invoices]; n[idx] = { ...n[idx], status: "Unpaid", amountReceived: 0, payments: [] }; setInvoices(n); }} title="Click to mark as unpaid">
                                  <CheckCircle size={15} className="mr-1.5 group-hover:hidden" />
                                  <X size={15} className="mr-1.5 hidden group-hover:inline" />
                                  <span className="group-hover:hidden">Paid</span>
                                  <span className="hidden group-hover:inline">Mark Unpaid</span>
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
  );
}
