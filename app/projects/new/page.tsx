'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BackButton from '@/components/BackButton';

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', client_name: '', client_company: '', client_title: '', description: '',
    markup_pct_dp: '10', markup_pct_no_dp: '15', vat_exempt: false,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name.trim()) return alert('Project name is required');
    setSaving(true);
    const res = await fetch('/api/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, markup_pct_dp: Number(form.markup_pct_dp), markup_pct_no_dp: Number(form.markup_pct_no_dp) }),
    });
    const project = await res.json();
    setSaving(false);
    router.push(`/projects/${project.id}`);
  }

  const ic = 'w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E32726]';

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-xl">
      <BackButton fallbackHref="/projects" />
      <h1 className="text-xl font-bold text-white mb-1 mt-2">New Production Project</h1>
      <p className="text-white/40 text-xs mb-6">Set up the budget — you&apos;ll add cost line items on the next page</p>

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
        <div>
          <label className="text-xs text-white/50 block mb-1">Project Name *</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. PurPle Ad — 1 Day Studio Chroma Shoot" className={ic} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/50 block mb-1">Client Name</label>
            <input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} className={ic} />
          </div>
          <div>
            <label className="text-xs text-white/50 block mb-1">Client Company</label>
            <input value={form.client_company} onChange={e => setForm(f => ({ ...f, client_company: e.target.value }))} className={ic} />
          </div>
        </div>
        <div>
          <label className="text-xs text-white/50 block mb-1">Client Title / Position</label>
          <input value={form.client_title} onChange={e => setForm(f => ({ ...f, client_title: e.target.value }))} placeholder="e.g. Brand Manager" className={ic} />
        </div>
        <div>
          <label className="text-xs text-white/50 block mb-1">Description / Creative Brief</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
            placeholder="e.g. Director Treb Monteras — 1 Day Studio Chroma Shoot, 3x15s 16:9 with 3x15 9:16 and 1:1" className={ic} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/50 block mb-1">Markup % (with 50% DP)</label>
            <input value={form.markup_pct_dp} onChange={e => setForm(f => ({ ...f, markup_pct_dp: e.target.value }))} type="number" className={ic} />
          </div>
          <div>
            <label className="text-xs text-white/50 block mb-1">Markup % (no DP)</label>
            <input value={form.markup_pct_no_dp} onChange={e => setForm(f => ({ ...f, markup_pct_no_dp: e.target.value }))} type="number" className={ic} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
          <input type="checkbox" checked={form.vat_exempt} onChange={e => setForm(f => ({ ...f, vat_exempt: e.target.checked }))} />
          VAT-exempt client
        </label>
        <button onClick={save} disabled={saving} className="w-full bg-[#E32726] text-white text-sm py-2.5 rounded-lg font-semibold hover:bg-[#c41f1e] transition-colors disabled:opacity-50">
          {saving ? 'Creating...' : 'Create Project →'}
        </button>
      </div>
    </div>
  );
}
