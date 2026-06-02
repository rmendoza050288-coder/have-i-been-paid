import React from "react";

export const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700 ${className}`}>
    {children}
  </div>
);

export const Button = ({ children, onClick, disabled, variant = "primary", className = "" }) => {
  const base = "inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";
  const v = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    outline: "border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 dark:border-slate-600 dark:text-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    danger: "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30",
    ghost: "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700",
  };
  return <button onClick={onClick} disabled={disabled} className={`${base} ${v[variant]} ${className}`}>{children}</button>;
};

export const Input = ({ type = "text", value, onChange, placeholder, className = "", disabled = false }) => (
  <input type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}
    className={`flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500 dark:disabled:bg-slate-800 ${className}`} />
);
