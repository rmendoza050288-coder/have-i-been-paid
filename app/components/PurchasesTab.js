"use client";

import React from "react";
import {
  Package, Wrench, Utensils, FileDown, Receipt, Plus, ShoppingCart,
  Briefcase, Lock, LockOpen, UploadCloud, Eye, X, ChevronDown, ChevronRight,
  Trash2, Layers, Calculator,
} from "lucide-react";
import { Card, Button, Input } from "./ui";
import { downloadCSV, calcEquipDeduction, MACRS_TABLES, DEPR_LABELS } from "../lib/utils";

export default function PurchasesTab({
  purchases,
  setPurchases,
  newPurchase,
  setNewPurchase,
  purchaseSubTab,
  setPurchaseSubTab,
  purchaseGroupBy,
  setPurchaseGroupBy,
  filteredPurchases,
  filteredExpendables,
  filteredMeals,
  filteredEquipment,
  totalPurchases,
  totalExpendables,
  totalEquipment,
  jobs,
  selectedYear,
  expandedJobs,
  toggleJobExpanded,
  highlightedId,
  sq,
  blobCache,
  addPurchase,
  deletePurchase,
  deleteJob,
  handleReceiptUpload,
  generateExpenseReport,
  setPreviewItem,
}) {
  return (
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

      {/* Sub-tabs + export buttons */}
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
                          {p.depreciationMethod === "straight-line" && (
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
                          {p.depreciationMethod === "macrs" && (
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
                      <Button variant="danger" onClick={() => {
                        setPurchases(prev => prev.map(x => x.id === p.id ? { ...x, receipt: undefined } : x));
                        URL.revokeObjectURL(blobCache.current.get("receipt_" + p.id)?.url);
                        blobCache.current.delete("receipt_" + p.id);
                      }} className="!px-2" title="Remove receipt">
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
  );
}
