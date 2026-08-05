'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatPHP, formatDate } from '@/lib/utils';
import { Project, PROJECT_STATUSES } from '@/lib/types';

type ProjectRow = Project & { internal_total: number; client_total: number };

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', quoted: 'Quoted', won: 'Won', lost: 'Lost', in_production: 'In Production', completed: 'Completed',
};
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-white/10 text-white/50 border-white/20',
  quoted: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  won: 'bg-green-500/20 text-green-400 border-green-500/30',
  lost: 'bg-red-500/20 text-red-400 border-red-500/30',
  in_production: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => { fetch('/api/projects').then(r => r.json()).then(setProjects); }, []);

  if (!projects) return <div className="flex items-center justify-center h-64 text-white/30 pt-14 md:pt-0">Loading projects...</div>;

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter);
  const totalClient = filtered.reduce((s, p) => s + p.client_total, 0);
  const totalMargin = filtered.reduce((s, p) => s + (p.client_total - p.internal_total), 0);

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Production Projects</h1>
          <p className="text-white/40 text-xs mt-0.5">Video production budgets — internal cost vs. client-billed cost</p>
        </div>
        <Link href="/projects/new" className="bg-[#E32726] text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-[#c41f1e] transition-colors">+ New Project</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="text-lg font-black text-white">{filtered.length}</div>
          <div className="text-xs text-white/40 mt-1">Projects{filter !== 'all' ? ` (${STATUS_LABELS[filter]})` : ''}</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="text-lg font-black text-green-400">{formatPHP(totalClient)}</div>
          <div className="text-xs text-white/40 mt-1">Total Client-Billed (net)</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="text-lg font-black text-yellow-400">{formatPHP(totalMargin)}</div>
          <div className="text-xs text-white/40 mt-1">Margin Before Markup/VAT</div>
        </div>
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === 'all' ? 'bg-[#E32726] text-white' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-white/50 hover:text-white'}`}>All</button>
        {PROJECT_STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === s ? 'bg-[#E32726] text-white' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-white/50 hover:text-white'}`}>{STATUS_LABELS[s]}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-10 text-center text-white/30 text-sm">No projects yet</div>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl divide-y divide-[#2a2a2a]">
          {filtered.map(p => (
            <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">{p.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold shrink-0 ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</span>
                </div>
                <div className="text-xs text-white/40 mt-0.5">
                  {p.client_name || 'No client set'}{p.quote_number ? ` · ${p.quote_number}` : ''} · {formatDate(p.created_at)}
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <div className="text-sm font-semibold text-green-400">{formatPHP(p.client_total)}</div>
                <div className="text-[10px] text-white/30">margin {formatPHP(p.client_total - p.internal_total)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
