"use client";

import React from "react";
import { FileText, ShoppingCart, Calculator, CalendarClock } from "lucide-react";
import { Card } from "./ui";
import { computeInvoiceStatus, calcEquipDeduction, DEPR_LABELS } from "../lib/utils";

export default function TaxTab({
  selectedYear,
  allYears,
  setSelectedYear,
  invoices,
  purchases,
  mileageLogs,
  timecards,
  gasLogs,
  vehicleExpenses,
}) {
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
}
