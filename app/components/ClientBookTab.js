"use client";
import React, { useState, useMemo } from "react";
import {
  Users, User, Plus, Trash2, Mail, Phone, MapPin,
  ChevronDown, ChevronRight, Pencil, Building2, X, Check,
  FileText, StickyNote, DollarSign
} from "lucide-react";
import { Button, Input } from "./ui";
import { computeInvoiceStatus } from "../lib/utils";

const BLANK_CLIENT = { name: "", address: "", city: "", state: "", zip: "", email: "", phone: "" };
const BLANK_CONTACT = { name: "", title: "", email: "", phone: "" };
const BLANK_RATES = { dayRate: "", kitFee: "", otMultiplier: "1.5", doubleOtMultiplier: "2.0", guarHours: "10", paymentTerms: "Net 30", notes: "" };
const PAYMENT_TERMS_OPTIONS = ["Net 15", "Net 30", "Net 45", "Net 60", "Due on receipt"];

const fmt = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => { if (!d) return ""; const [y, m, dy] = d.split("-"); return `${m}/${dy}/${y}`; };

export default function ClientBookTab({ clients, setClients, invoices = [] }) {
  const [expandedIds, setExpandedIds] = useState({});
  const [activePanel, setActivePanel] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [addContactFor, setAddContactFor] = useState(null);
  const [contactForm, setContactForm] = useState(BLANK_CONTACT);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState(BLANK_CLIENT);
  const [filterQuery, setFilterQuery] = useState("");
  const [sortMode, setSortMode] = useState("recent");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [editingRatesId, setEditingRatesId] = useState(null);
  const [ratesForm, setRatesForm] = useState(BLANK_RATES);

  const toggleExpand = (id, panel) => {
    const current = expandedIds[id];
    const currentPanel = activePanel[id];
    if (current && currentPanel === panel) {
      setExpandedIds(prev => ({ ...prev, [id]: false }));
    } else {
      setExpandedIds(prev => ({ ...prev, [id]: true }));
      setActivePanel(prev => ({ ...prev, [id]: panel }));
    }
  };

  const clientInvoiceMap = useMemo(() => {
    const map = {};
    for (const inv of invoices) {
      const name = (inv.company || "").trim().toLowerCase();
      if (!name) continue;
      if (!map[name]) map[name] = [];
      map[name].push(inv);
    }
    return map;
  }, [invoices]);

  const getClientInvoices = (name) => clientInvoiceMap[(name || "").trim().toLowerCase()] || [];
  const getLastWorked = (name) => {
    const dates = getClientInvoices(name).map(i => i.date || "").filter(Boolean).sort().reverse();
    return dates[0] || null;
  };
  const getTotalBilled = (name) => getClientInvoices(name).reduce((s, i) => s + Number(i.amount || 0), 0);

  const handleAddClient = () => {
    if (!newClient.name.trim()) return;
    setClients(prev => [...prev, { id: crypto.randomUUID(), contacts: [], notes: "", ...newClient }]);
    setNewClient(BLANK_CLIENT);
    setShowAddClient(false);
  };
  const handleDeleteClient = (id) => {
    if (!window.confirm("Remove this client and all their contacts?")) return;
    setClients(prev => prev.filter(c => c.id !== id));
  };
  const startEdit = (c) => {
    setEditingId(c.id);
    setEditForm({ name: c.name||"", address: c.address||"", city: c.city||"", state: c.state||"", zip: c.zip||"", email: c.email||"", phone: c.phone||"" });
  };
  const saveEdit = (id) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...editForm } : c));
    setEditingId(null);
  };
  const handleAddContact = (clientId) => {
    if (!contactForm.name.trim()) return;
    setClients(prev => prev.map(c =>
      c.id === clientId ? { ...c, contacts: [...(c.contacts||[]), { id: crypto.randomUUID(), ...contactForm }] } : c
    ));
    setContactForm(BLANK_CONTACT);
    setAddContactFor(null);
  };
  const handleDeleteContact = (clientId, contactId) => {
    setClients(prev => prev.map(c =>
      c.id === clientId ? { ...c, contacts: (c.contacts||[]).filter(ct => ct.id !== contactId) } : c
    ));
  };
  const startEditNote = (c) => { setEditingNoteId(c.id); setNoteText(c.notes || ""); };
  const saveNote = (id) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, notes: noteText } : c));
    setEditingNoteId(null);
  };

  const startEditRates = (c) => {
    setEditingRatesId(c.id);
    setRatesForm({ ...BLANK_RATES, ...(c.rates || {}) });
  };
  const saveRates = (id) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, rates: { ...ratesForm } } : c));
    setEditingRatesId(null);
  };

  const sorted = useMemo(() => {
    const list = [...clients];
    if (sortMode === "az") list.sort((a, b) => (a.name||"").localeCompare(b.name||""));
    else if (sortMode === "recent") list.sort((a, b) => (getLastWorked(b.name)||"0").localeCompare(getLastWorked(a.name)||"0"));
    else if (sortMode === "billed") list.sort((a, b) => getTotalBilled(b.name) - getTotalBilled(a.name));
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, sortMode, clientInvoiceMap]);

  const filtered = sorted.filter(c => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.notes?.toLowerCase().includes(q) ||
      (c.contacts||[]).some(ct => ct.name?.toLowerCase().includes(q) || ct.title?.toLowerCase().includes(q) || ct.email?.toLowerCase().includes(q))
    );
  });

  const statusBadge = (inv) => {
    const s = computeInvoiceStatus(inv);
    if (s === "Paid") return "bg-emerald-100 text-emerald-700";
    if (s === "Partially Paid") return "bg-amber-100 text-amber-700";
    if (s === "Overdue") return "bg-red-100 text-red-600";
    return "bg-slate-100 text-slate-600";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-blue-600" />
          <h2 className="text-lg font-bold text-slate-800">Client Book</h2>
          <span className="text-xs font-bold text-slate-400 bg-slate-100 rounded-full px-2.5 py-0.5">
            {clients.length} {clients.length === 1 ? "client" : "clients"}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
            {[["recent","Recent"],["az","A–Z"],["billed","$ Billed"]].map(([val, label]) => (
              <button key={val} onClick={() => setSortMode(val)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${sortMode === val ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="relative">
            <input type="text" value={filterQuery} onChange={e => setFilterQuery(e.target.value)}
              placeholder="Search clients or contacts…"
              className="pl-3 pr-7 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-52" />
            {filterQuery && (
              <button onClick={() => setFilterQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={12} /></button>
            )}
          </div>
          <Button onClick={() => setShowAddClient(v => !v)} className="gap-1.5 whitespace-nowrap">
            <Plus size={14} />Add Client
          </Button>
        </div>
      </div>

      {/* Add client form */}
      {showAddClient && (
        <div className="bg-white border border-blue-200 rounded-2xl shadow-sm p-5 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Client</p>
          <div className="grid grid-cols-2 gap-2.5">
            <Input value={newClient.name} onChange={e => setNewClient(p=>({...p,name:e.target.value}))} placeholder="Company / Client name *" className="col-span-2" />
            <Input value={newClient.address} onChange={e => setNewClient(p=>({...p,address:e.target.value}))} placeholder="Street address" className="col-span-2" />
            <Input value={newClient.city} onChange={e => setNewClient(p=>({...p,city:e.target.value}))} placeholder="City" />
            <div className="flex gap-2">
              <Input value={newClient.state} onChange={e => setNewClient(p=>({...p,state:e.target.value}))} placeholder="State" />
              <Input value={newClient.zip} onChange={e => setNewClient(p=>({...p,zip:e.target.value}))} placeholder="Zip" />
            </div>
            <Input value={newClient.email} onChange={e => setNewClient(p=>({...p,email:e.target.value}))} placeholder="Billing email" />
            <Input value={newClient.phone} onChange={e => setNewClient(p=>({...p,phone:e.target.value}))} placeholder="Billing phone" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => { setShowAddClient(false); setNewClient(BLANK_CLIENT); }}>Cancel</Button>
            <Button disabled={!newClient.name.trim()} onClick={handleAddClient} className="gap-1.5"><Check size={14} />Save Client</Button>
          </div>
        </div>
      )}

      {clients.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Building2 size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No clients yet.</p>
          <p className="text-xs mt-1">Click &ldquo;Add Client&rdquo; to get started.</p>
        </div>
      )}
      {filterQuery && filtered.length === 0 && clients.length > 0 && (
        <p className="text-sm text-slate-400 text-center py-8">No clients match &ldquo;{filterQuery}&rdquo;</p>
      )}

      {/* Client cards */}
      <div className="space-y-3">
        {filtered.map(c => {
          const isExpanded = !!expandedIds[c.id];
          const panel = activePanel[c.id] || "contacts";
          const isEditing = editingId === c.id;
          const contacts = c.contacts || [];
          const clientInvList = getClientInvoices(c.name);
          const lastWorked = getLastWorked(c.name);
          const totalBilled = getTotalBilled(c.name);

          return (
            <div key={c.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={editForm.name} onChange={e=>setEditForm(p=>({...p,name:e.target.value}))} placeholder="Company name *" className="col-span-2" />
                      <Input value={editForm.address} onChange={e=>setEditForm(p=>({...p,address:e.target.value}))} placeholder="Street address" className="col-span-2" />
                      <Input value={editForm.city} onChange={e=>setEditForm(p=>({...p,city:e.target.value}))} placeholder="City" />
                      <div className="flex gap-2">
                        <Input value={editForm.state} onChange={e=>setEditForm(p=>({...p,state:e.target.value}))} placeholder="State" />
                        <Input value={editForm.zip} onChange={e=>setEditForm(p=>({...p,zip:e.target.value}))} placeholder="Zip" />
                      </div>
                      <Input value={editForm.email} onChange={e=>setEditForm(p=>({...p,email:e.target.value}))} placeholder="Billing email" />
                      <Input value={editForm.phone} onChange={e=>setEditForm(p=>({...p,phone:e.target.value}))} placeholder="Billing phone" />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setEditingId(null)} className="gap-1"><X size={13} />Cancel</Button>
                      <Button onClick={() => saveEdit(c.id)} className="gap-1"><Check size={13} />Save</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Building2 size={15} className="text-blue-500 shrink-0" />
                        <h3 className="font-bold text-slate-800 text-base">{c.name}</h3>
                        {totalBilled > 0 && (
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                            {fmt(totalBilled)} billed
                          </span>
                        )}
                        {lastWorked && (
                          <span className="text-[11px] text-slate-400">Last: {fmtDate(lastWorked)}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                        {(c.address||c.city||c.state) && (
                          <span className="flex items-center gap-1">
                            <MapPin size={11} className="shrink-0 text-slate-400" />
                            {[c.address,c.city,c.state,c.zip].filter(Boolean).join(", ")}
                          </span>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-blue-600 transition-colors">
                            <Mail size={11} className="shrink-0" />{c.email}
                          </a>
                        )}
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-blue-600 transition-colors">
                            <Phone size={11} className="shrink-0" />{c.phone}
                          </a>
                        )}
                        {c.notes && !isExpanded && (
                          <span className="flex items-center gap-1 text-slate-400 italic max-w-xs truncate">
                            <StickyNote size={11} className="shrink-0" />{c.notes}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      <button onClick={() => toggleExpand(c.id, "contacts")}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors border ${isExpanded && panel === "contacts" ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"}`}
                        title="Contacts">
                        <User size={12} />{contacts.length}
                        {isExpanded && panel === "contacts" ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      </button>
                      <button onClick={() => toggleExpand(c.id, "invoices")}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors border ${isExpanded && panel === "invoices" ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"}`}
                        title="Invoice history">
                        <FileText size={12} />{clientInvList.length}
                        {isExpanded && panel === "invoices" ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      </button>
                      <button onClick={() => toggleExpand(c.id, "notes")}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors border ${isExpanded && panel === "notes" ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"}`}
                        title="Notes">
                        <StickyNote size={12} />
                        {isExpanded && panel === "notes" ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      </button>
                      <button onClick={() => toggleExpand(c.id, "rates")}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors border ${isExpanded && panel === "rates" ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"}`}
                        title="Rate sheet">
                        <DollarSign size={12} />
                        {isExpanded && panel === "rates" ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      </button>
                      <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit client">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDeleteClient(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete client">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {isExpanded && !isEditing && (
                <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 space-y-3">

                  {/* CONTACTS */}
                  {panel === "contacts" && (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contacts</p>
                        <button onClick={() => { setAddContactFor(addContactFor === c.id ? null : c.id); setContactForm(BLANK_CONTACT); }}
                          className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                          <Plus size={12} />Add Contact
                        </button>
                      </div>
                      {contacts.length === 0 && addContactFor !== c.id && (
                        <p className="text-xs text-slate-400 text-center py-3">No contacts yet.</p>
                      )}
                      <div className="space-y-2">
                        {contacts.map(ct => (
                          <div key={ct.id} className="flex items-start justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <User size={13} className="text-slate-400 shrink-0" />
                                <span className="font-semibold text-slate-800 text-sm">{ct.name}</span>
                                {ct.title && <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{ct.title}</span>}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 pl-5 mt-1">
                                {ct.email && (
                                  <a href={`mailto:${ct.email}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors">
                                    <Mail size={11} />{ct.email}
                                  </a>
                                )}
                                {ct.phone && (
                                  <a href={`tel:${ct.phone}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors">
                                    <Phone size={11} />{ct.phone}
                                  </a>
                                )}
                              </div>
                            </div>
                            <button onClick={() => handleDeleteContact(c.id, ct.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                      {addContactFor === c.id && (
                        <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-2.5">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">New Contact</p>
                          <div className="grid grid-cols-2 gap-2">
                            <Input value={contactForm.name} onChange={e=>setContactForm(p=>({...p,name:e.target.value}))} placeholder="Full name *" />
                            <Input value={contactForm.title} onChange={e=>setContactForm(p=>({...p,title:e.target.value}))} placeholder="Title / Role" />
                            <Input value={contactForm.email} onChange={e=>setContactForm(p=>({...p,email:e.target.value}))} placeholder="Email" type="email" />
                            <Input value={contactForm.phone} onChange={e=>setContactForm(p=>({...p,phone:e.target.value}))} placeholder="Phone" type="tel" />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => { setAddContactFor(null); setContactForm(BLANK_CONTACT); }} className="gap-1"><X size={13} />Cancel</Button>
                            <Button disabled={!contactForm.name.trim()} onClick={() => handleAddContact(c.id)} className="gap-1"><Check size={13} />Add</Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* INVOICE HISTORY */}
                  {panel === "invoices" && (
                    <>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Invoice History</p>
                      {clientInvList.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-3">No invoices found for &ldquo;{c.name}&rdquo;.</p>
                      ) : (
                        <div className="space-y-2">
                          {[...clientInvList].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(inv => {
                            const s = computeInvoiceStatus(inv);
                            return (
                              <div key={inv.id} className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-slate-800">{inv.invoiceNumber || "Invoice"}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge(inv)}`}>{s}</span>
                                  </div>
                                  <div className="text-xs text-slate-400 mt-0.5">
                                    {inv.date ? fmtDate(inv.date) : "No date"}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-bold text-slate-800">{fmt(inv.amount)}</p>
                                  {Number(inv.amountReceived||0) > 0 && Number(inv.amountReceived) < Number(inv.amount) && (
                                    <p className="text-[11px] text-amber-600">{fmt(inv.amountReceived)} received</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <div className="flex justify-between items-center pt-1 border-t border-slate-200 px-1">
                            <span className="text-xs text-slate-500 font-semibold">{clientInvList.length} invoice{clientInvList.length !== 1 ? "s" : ""}</span>
                            <span className="text-sm font-bold text-slate-800">{fmt(totalBilled)} total billed</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* NOTES */}
                  {panel === "notes" && (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Notes</p>
                        {editingNoteId !== c.id && (
                          <button onClick={() => startEditNote(c)} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                            <Pencil size={12} />Edit
                          </button>
                        )}
                      </div>
                      {editingNoteId === c.id ? (
                        <div className="space-y-2">
                          <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} rows={5}
                            placeholder="Add notes about this client — rates, preferences, contacts to avoid, etc."
                            className="w-full text-sm border border-slate-200 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                            autoFocus />
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setEditingNoteId(null)} className="gap-1"><X size={13} />Cancel</Button>
                            <Button onClick={() => saveNote(c.id)} className="gap-1"><Check size={13} />Save</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="min-h-[60px] text-sm text-slate-600 bg-white border border-slate-200 rounded-xl p-3 whitespace-pre-wrap cursor-pointer hover:border-blue-300 transition-colors"
                          onClick={() => startEditNote(c)}>
                          {c.notes ? c.notes : <span className="text-slate-300 italic">No notes yet. Click to add.</span>}
                        </div>
                      )}
                    </>
                  )}

                  {/* RATES */}
                  {panel === "rates" && (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rate Sheet</p>
                        {editingRatesId !== c.id && (
                          <button onClick={() => startEditRates(c)} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                            <Pencil size={12} />Edit
                          </button>
                        )}
                      </div>
                      {editingRatesId === c.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Day Rate</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                <Input value={ratesForm.dayRate} onChange={e=>setRatesForm(p=>({...p,dayRate:e.target.value}))} placeholder="0.00" className="pl-6" type="number" min="0" step="0.01" />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kit / Equipment Fee</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                <Input value={ratesForm.kitFee} onChange={e=>setRatesForm(p=>({...p,kitFee:e.target.value}))} placeholder="0.00" className="pl-6" type="number" min="0" step="0.01" />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">OT Multiplier (1.5×)</label>
                              <Input value={ratesForm.otMultiplier} onChange={e=>setRatesForm(p=>({...p,otMultiplier:e.target.value}))} placeholder="1.5" type="number" min="1" step="0.1" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Double OT Multiplier (2.0×)</label>
                              <Input value={ratesForm.doubleOtMultiplier} onChange={e=>setRatesForm(p=>({...p,doubleOtMultiplier:e.target.value}))} placeholder="2.0" type="number" min="1" step="0.1" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Guaranteed Hours</label>
                              <Input value={ratesForm.guarHours} onChange={e=>setRatesForm(p=>({...p,guarHours:e.target.value}))} placeholder="10" type="number" min="1" step="1" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payment Terms</label>
                              <select value={ratesForm.paymentTerms} onChange={e=>setRatesForm(p=>({...p,paymentTerms:e.target.value}))}
                                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                {PAYMENT_TERMS_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                            <div className="space-y-1 col-span-2">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Additional Notes</label>
                              <Input value={ratesForm.notes} onChange={e=>setRatesForm(p=>({...p,notes:e.target.value}))} placeholder="e.g. box rental included, meal penalties apply…" />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setEditingRatesId(null)} className="gap-1"><X size={13} />Cancel</Button>
                            <Button onClick={() => saveRates(c.id)} className="gap-1"><Check size={13} />Save</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-blue-300 transition-colors" onClick={() => startEditRates(c)}>
                          {c.rates && (c.rates.dayRate || c.rates.kitFee) ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {c.rates.dayRate && (
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Day Rate</p>
                                  <p className="text-base font-bold text-slate-800 mt-0.5">{fmt(c.rates.dayRate)}</p>
                                </div>
                              )}
                              {c.rates.kitFee && (
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kit Fee</p>
                                  <p className="text-base font-bold text-slate-800 mt-0.5">{fmt(c.rates.kitFee)}/day</p>
                                </div>
                              )}
                              {c.rates.guarHours && (
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Guar. Hours</p>
                                  <p className="text-base font-bold text-slate-800 mt-0.5">{c.rates.guarHours} hrs</p>
                                </div>
                              )}
                              {c.rates.otMultiplier && (
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">OT</p>
                                  <p className="text-sm font-semibold text-slate-700 mt-0.5">{c.rates.otMultiplier}× / {c.rates.doubleOtMultiplier}×</p>
                                </div>
                              )}
                              {c.rates.paymentTerms && (
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Terms</p>
                                  <p className="text-sm font-semibold text-slate-700 mt-0.5">{c.rates.paymentTerms}</p>
                                </div>
                              )}
                              {c.rates.notes && (
                                <div className="col-span-2 sm:col-span-3">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notes</p>
                                  <p className="text-xs text-slate-600 mt-0.5">{c.rates.notes}</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 italic text-sm">No rates saved yet. Click to add.</span>
                          )}
                        </div>
                      )}
                    </>
                  )}

                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
