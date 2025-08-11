'use client';
import React, { useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

export type Field = {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'url' | 'date';
  placeholder?: string;
  required?: boolean;
  help?: string;
  options?: { label: string; value: string | number }[];
  pattern?: RegExp;
};

export default function SupabaseIntakeForm({
  table,
  fields,
  title,
  successMessage = 'Thanks! We received your submission.',
  buttonLabel = 'Submit',
  defaultValues = {},
}: {
  table: string;
  fields: Field[];
  title?: string;
  successMessage?: string;
  buttonLabel?: string;
  defaultValues?: Record<string, any>;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>(defaultValues);

  useMemo(() => new Set(fields.filter(f => f.required).map(f => f.name)), [fields]);

  function handleChange(name: string, value: any) {
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  function validate(): string[] {
    const errs: string[] = [];
    for (const f of fields) {
      const val = formData[f.name];
      if (f.required && (val === undefined || val === null || String(val).trim() === '')) {
        errs.push(`${f.label} is required`);
      }
      if (f.pattern && val && !f.pattern.test(String(val))) {
        errs.push(`${f.label} is invalid`);
      }
    }
    return errs;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const errs = validate();
    if (errs.length) return setError(errs[0]);

    setStatus('loading');
    const { error: insertError } = await supabase.from(table).insert([formData]);
    if (insertError) { setError(insertError.message); setStatus('error'); return; }
    setStatus('success');
    setFormData({});
  }

  if (status === 'success') {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border p-6 shadow-sm">
        {title && <h2 className="mb-2 text-2xl font-semibold">{title}</h2>}
        <p className="text-[#AAEEFF]">{successMessage}</p>
        <button type="button" className="mt-4 rounded-xl border px-4 py-2" onClick={() => setStatus('idle')}>
          Return
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-5 rounded-2xl border p-6 shadow-sm">
      {title && <h2 className="text-2xl font-semibold">{title}</h2>}
      {fields.map(f => (
        <div key={f.name} className="space-y-1">
          <label className="block text-sm font-medium" htmlFor={f.name}>
            {f.label}{f.required && <span className="text-red-600"> *</span>}
          </label>
          {f.type === 'textarea' ? (
            <textarea id={f.name} placeholder={f.placeholder} required={!!f.required}
              className="w-full rounded-xl border p-3"
              value={formData[f.name] ?? ''} onChange={e => handleChange(f.name, e.target.value)} />
          ) : f.type === 'select' ? (
            <select id={f.name} required={!!f.required} className="w-full rounded-xl border p-3"
              value={formData[f.name] ?? ''} onChange={e => handleChange(f.name, e.target.value)}>
              <option value="" disabled>{f.placeholder || 'Select one'}</option>
              {f.options?.map(opt => <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>)}
            </select>
          ) : (
            <input id={f.name} type={f.type} placeholder={f.placeholder} required={!!f.required}
              className="w-full rounded-xl border p-3"
              value={formData[f.name] ?? ''} onChange={e => handleChange(f.name, e.target.value)} />
          )}
          {f.help && <p className="text-xs text-gray-500">{f.help}</p>}
        </div>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={status === 'loading'}
        className="w-full rounded-xl bg-black px-4 py-3 text-white disabled:opacity-60">
        {status === 'loading' ? 'Submitting…' : buttonLabel}
      </button>
      <p className="pt-2 text-xs text-gray-500">
        Ensure RLS allows inserts for this table. Don’t store secrets in client.
      </p>
    </form>
  );
}
