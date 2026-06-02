"use client";

import React from "react";
import { Lock, LockOpen, Layers, Package, Plus } from "lucide-react";
import { Card, Button, Input } from "./ui";

export default function KitTab({
  purchases,
  setPurchases,
  kitPackages,
  setKitPackages,
  kitSubTab,
  setKitSubTab,
  newPackage,
  setNewPackage,
}) {
  const kitItems = purchases.filter(p => p.isKit);

  const updKitItem = (id, field, val) => {
    setPurchases(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  const deletePackage = (pkgId) => setKitPackages(prev => prev.filter(x => x.id !== pkgId));

  const updPackage = (pkgId, field, val) =>
    setKitPackages(prev => prev.map(p => p.id === pkgId ? { ...p, [field]: val } : p));

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
              <p className="text-slate-500 text-sm mt-1">Check the &quot;Kit&quot; box on a purchase entry to add it here.</p>
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

          {/* Existing packages */}
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
                          className="p-1 rounded hover:bg-white/20 transition-colors"
                          title={pkgLocked ? "Unlock to edit" : "Lock package"}
                        >
                          {pkgLocked ? <Lock size={13} /> : <LockOpen size={13} />}
                        </button>
                        <button onClick={() => { if (window.confirm("Delete this package?")) deletePackage(pkg.id); }} className="p-1 rounded hover:bg-white/20 transition-colors opacity-70 hover:opacity-100" title="Delete package">×</button>
                      </div>
                    </div>

                    <div className="p-4 space-y-3 flex-1">
                      {/* Rate fields */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Daily ($)</label>
                          <Input type="number" value={pkg.dailyRate || ""} placeholder="0.00" disabled={pkgLocked} onChange={e => updPackage(pkg.id, "dailyRate", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Weekly ($)</label>
                          <Input type="number" value={pkg.weeklyRate || ""} placeholder="0.00" disabled={pkgLocked} onChange={e => updPackage(pkg.id, "weeklyRate", e.target.value)} />
                        </div>
                      </div>

                      {/* Barcode */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Barcode</label>
                        <Input value={pkg.barcode || ""} placeholder="Scan or enter barcode" disabled={pkgLocked} onChange={e => updPackage(pkg.id, "barcode", e.target.value)} className="font-mono" />
                      </div>

                      {/* Items in package */}
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Items ({pkgItems.length})</p>
                        {pkgItems.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No items yet</p>
                        ) : (
                          <div className="space-y-1">
                            {pkgItems.map(item => (
                              <div key={item.id} className="flex items-center justify-between bg-indigo-50 rounded-lg px-2.5 py-1.5 gap-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-slate-700 truncate">{item.name}</p>
                                  {item.serial && <p className="text-[9px] text-slate-400 font-mono">SN: {item.serial}</p>}
                                </div>
                                {!pkgLocked && (
                                  <button onClick={() => removeItemFromPackage(pkg.id, item.id)} className="text-slate-400 hover:text-red-500 text-sm shrink-0 leading-none" title="Remove">×</button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {!pkgLocked && availableToAdd.length > 0 && (
                          <select
                            defaultValue=""
                            onChange={e => { addItemToPackage(pkg.id, e.target.value); e.target.value = ""; }}
                            className="mt-1 w-full border border-dashed border-indigo-300 rounded-lg px-2 py-1.5 text-xs text-indigo-600 bg-indigo-50 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          >
                            <option value="">+ Add item to package…</option>
                            {availableToAdd.map(item => (
                              <option key={item.id} value={item.id}>{item.name}{item.serial ? ` (SN: ${item.serial})` : ""}</option>
                            ))}
                          </select>
                        )}
                      </div>
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
}
