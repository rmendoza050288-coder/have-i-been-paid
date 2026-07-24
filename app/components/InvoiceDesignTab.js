"use client";
import React from "react";
import { Palette, RotateCcw, Check } from "lucide-react";
import { Card, Button } from "./ui";
import {
  buildInvoiceHtml,
  DEFAULT_INVOICE_THEME,
  INVOICE_FONT_STACKS,
  INVOICE_LAYOUTS,
  INVOICE_THEME_PRESETS,
} from "../lib/utils";

// Canned sample data so the preview looks like a real invoice regardless of
// what the user has actually entered anywhere else in the app.
const SAMPLE_FORM = {
  senderName: "Alex Rivera",
  senderAddress: "123 Production Way",
  senderCity: "Los Angeles",
  senderState: "CA",
  senderZip: "90028",
  senderPhone: "(555) 123-4567",
  senderEmail: "alex@example.com",
  clientName: "Acme Productions",
  clientAddress: "456 Studio Blvd",
  clientCity: "Burbank",
  clientState: "CA",
  clientZip: "91502",
  invoiceNumber: "INV-20260115-001",
  invoiceDate: "2026-01-15",
  dueDate: "2026-02-14",
  paymentTerms: "Net 30",
  jobName: "Sample Production",
  lineItems: [
    { id: "1", description: "Day Rate — Camera Operator", qty: "3", rate: "850", amount: 2550 },
    { id: "2", description: "Kit Rental", qty: "3", rate: "150", amount: 450 },
  ],
  taxRate: "",
  notes: "Thank you for the opportunity to work on this project!",
  paymentMethods: ["ACH"],
  bankName: "Chase Bank",
  routingNumber: "123456789",
  accountNumber: "987654321",
  logoDataUrl: "",
};

const COLOR_FIELDS = [
  { key: "accentColor", label: "Accent Fill", hint: "Section headers & backgrounds" },
  { key: "borderColor", label: "Border / Lines", hint: "Table & box borders" },
  { key: "topBarColor", label: "Header Bar", hint: "Top bar (or full header on Bold)" },
  { key: "textColor", label: "Text", hint: "Body text color" },
];

export default function InvoiceDesignTab({ theme, setTheme }) {
  const t = { ...DEFAULT_INVOICE_THEME, ...theme };

  const updateTheme = (patch) => setTheme(prev => ({ ...DEFAULT_INVOICE_THEME, ...prev, ...patch }));
  const applyPreset = (preset) => updateTheme({ accentColor: preset.accentColor, borderColor: preset.borderColor, topBarColor: preset.topBarColor });
  const resetTheme = () => setTheme({ ...DEFAULT_INVOICE_THEME });

  const previewHtml = buildInvoiceHtml(SAMPLE_FORM, t);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* ── Controls ── */}
      <div className="space-y-5">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Palette size={18} className="text-blue-600" />
              <h2 className="font-bold text-slate-800 text-base">Invoice Design</h2>
            </div>
            <Button variant="ghost" className="h-8 text-xs gap-1.5 text-slate-500" onClick={resetTheme}>
              <RotateCcw size={13} />Reset to Default
            </Button>
          </div>
          <p className="text-xs text-slate-400">
            Customize the colors, font, and layout used for every invoice you generate from here on. Changes apply automatically — no need to save.
          </p>
        </Card>

        {/* Presets */}
        <Card className="p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Color Presets</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {INVOICE_THEME_PRESETS.map(preset => {
              const isActive = t.accentColor === preset.accentColor && t.borderColor === preset.borderColor && t.topBarColor === preset.topBarColor;
              return (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${isActive ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <span className="flex -space-x-1 shrink-0">
                    <span className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ background: preset.topBarColor }} />
                    <span className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ background: preset.accentColor }} />
                  </span>
                  <span className="text-xs font-semibold text-slate-700 truncate flex-1">{preset.name}</span>
                  {isActive && <Check size={13} className="text-blue-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Colors */}
        <Card className="p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Custom Colors</p>
          <div className="grid grid-cols-2 gap-3">
            {COLOR_FIELDS.map(f => (
              <div key={f.key} className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">{f.label}</label>
                <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-2 py-1.5 bg-white">
                  <input
                    type="color"
                    value={t[f.key]}
                    onChange={e => updateTheme({ [f.key]: e.target.value })}
                    className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={t[f.key]}
                    onChange={e => updateTheme({ [f.key]: e.target.value })}
                    className="flex-1 min-w-0 text-xs font-mono text-slate-600 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-400">{f.hint}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Font */}
        <Card className="p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Font</p>
          <select
            value={t.fontFamily}
            onChange={e => updateTheme({ fontFamily: e.target.value })}
            className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            {Object.entries(INVOICE_FONT_STACKS).map(([key, f]) => (
              <option key={key} value={key}>{f.label}</option>
            ))}
          </select>
        </Card>

        {/* Layout */}
        <Card className="p-5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Layout</p>
          <div className="space-y-2">
            {INVOICE_LAYOUTS.map(l => {
              const isActive = t.layout === l.value;
              return (
                <button
                  key={l.value}
                  onClick={() => updateTheme({ layout: l.value })}
                  className={`w-full flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-left transition-all ${isActive ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{l.label}</p>
                    <p className="text-[11px] text-slate-400">{l.description}</p>
                  </div>
                  {isActive && <Check size={16} className="text-blue-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Live Preview ── */}
      <div className="lg:sticky lg:top-4">
        <Card className="p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Live Preview</p>
          <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50" style={{ height: 560 }}>
            <div style={{ width: "816px", height: "1056px", transform: "scale(0.58)", transformOrigin: "top left" }}>
              <iframe
                title="Invoice preview"
                srcDoc={previewHtml}
                sandbox=""
                style={{ width: "816px", height: "1056px", border: "none", pointerEvents: "none" }}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            Preview uses sample data. Your real invoices will use whatever details you enter in Create/Edit Invoice.
          </p>
        </Card>
      </div>
    </div>
  );
}
