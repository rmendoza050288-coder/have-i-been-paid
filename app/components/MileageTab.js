"use client";

import React from "react";
import {
  MapPin, Wrench, Fuel, Car, Plus, Trash2, X,
  Clock, FileDown, FileText, Receipt, UploadCloud, ExternalLink,
} from "lucide-react";
import { Card, Button, Input } from "./ui";
import { IRS_MILEAGE_RATE, downloadCSV } from "../lib/utils";

const VEHICLE_EXPENSE_CATEGORIES = [
  "maintenance", "repairs", "tires", "insurance", "oil change", "registration", "other",
];

export default function MileageTab({
  selectedYear,
  allMileageEntries,
  totalMiles,
  totalMileageValue,
  totalVehicleExpenses,
  totalGasCost,
  mileageSubTab,
  setMileageSubTab,
  newMileage,
  setNewMileage,
  addMileageLog,
  mileageLogs,
  setMileageLogs,
  vehicles,
  setVehicles,
  showVehicleManager,
  setShowVehicleManager,
  newVehicleName,
  setNewVehicleName,
  clients,
  jobs,
  newVehicleExpense,
  setNewVehicleExpense,
  addVehicleExpense,
  vehicleExpenses,
  setVehicleExpenses,
  filteredVehicleExpenses,
  uploadReceiptForExpense,
  newGasLog,
  setNewGasLog,
  addGasLog,
  gasLogs,
  setGasLogs,
  filteredGasLogs,
  uploadReceiptForGas,
  generateMileageReport,
  generateExpenseReport,
}) {
  return (
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

      {/* Sub-tabs + action buttons */}
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
  );
}
