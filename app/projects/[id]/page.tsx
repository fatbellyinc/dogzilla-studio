'use client';
import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { formatPHP } from '@/lib/utils';
import { Project, ProjectCost, PROJECT_CATEGORIES, PROJECT_CATEGORY_LABELS, PROJECT_STATUSES, ProjectCategory, Contact, RATE_UNIT_LABELS, Equipment, STUDIO_RATES, CATEGORY_LABELS } from '@/lib/types';
import BackButton from '@/components/BackButton';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', quoted: 'Quoted', won: 'Won', lost: 'Lost', in_production: 'In Production', completed: 'Completed',
};

interface EmptyItem { category: ProjectCategory; description: string; note: string; internal_cost: string; client_cost: string; contact_id: number | null; }
const emptyItem = (category: ProjectCategory): EmptyItem => ({ category, description: '', note: '', internal_cost: '', client_cost: '', contact_id: null });

function calcScenario(subtotal: number, markupPct: number, vatExempt: boolean) {
  const markup = subtotal * (markupPct / 100);
  const subtotal2 = subtotal + markup;
  const vat = vatExempt ? 0 : subtotal2 * 0.12;
  const total = subtotal2 + vat;
  return { markup, subtotal2, vat, total };
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [costs, setCosts] = useState<ProjectCost[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [newItem, setNewItem] = useState<EmptyItem>(emptyItem('pre_production'));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EmptyItem>(emptyItem('pre_production'));
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerForm, setHeaderForm] = useState({ name: '', client_name: '', client_company: '', client_title: '', description: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/projects/${id}`).then(r => r.json()).then(d => {
      setProject(d.project);
      setCosts(d.costs);
    });
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch('/api/contacts').then(r => r.json()).then(setContacts); }, []);
  useEffect(() => { fetch('/api/equipment').then(r => r.json()).then(setEquipment); }, []);

  if (!project) return <div className="flex items-center justify-center h-64 text-white/30 pt-14 md:pt-0">Loading project...</div>;

  const internalTotal = costs.reduce((s, c) => s + c.internal_cost, 0);
  const clientTotal = costs.reduce((s, c) => s + c.client_cost, 0);
  const margin = clientTotal - internalTotal;
  const vatExempt = !!project.vat_exempt;
  const withDP = calcScenario(clientTotal, project.markup_pct_dp, vatExempt);
  const noDP = calcScenario(clientTotal, project.markup_pct_no_dp, vatExempt);

  const byCategory = PROJECT_CATEGORIES.map(cat => ({
    category: cat,
    items: costs.filter(c => c.category === cat),
  })).filter(g => g.items.length > 0 || g.category === newItem.category);

  // Equipment catalog grouped by category for the "Pick Equipment / Studio" selector, so
  // budgeting our own gear/venue against a project pulls from the same rate card used for
  // studio bookings instead of retyping numbers.
  const equipmentByCat = new Map<string, Equipment[]>();
  for (const e of equipment) {
    if (!equipmentByCat.has(e.category)) equipmentByCat.set(e.category, []);
    equipmentByCat.get(e.category)!.push(e);
  }

  async function updateProject(fields: Partial<Project>) {
    setSaving(true);
    await fetch(`/api/projects/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) });
    await load();
    setSaving(false);
  }

  async function addItem() {
    if (!newItem.description.trim()) return;
    await fetch('/api/project-costs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: Number(id), ...newItem }),
    });
    setNewItem(emptyItem(newItem.category));
    load();
  }

  // Picking a Personnel/Vendor prefills the description and internal cost from their default
  // rate, and remembers the link (contact_id) so this line item shows up in that contact's
  // project history later — matches every other field staying editable after loading.
  function pickContact(contactId: string, target: 'new' | 'edit') {
    const cid = contactId ? Number(contactId) : null;
    const contact = contacts.find(c => c.id === cid) || null;
    const update = (i: EmptyItem): EmptyItem => ({
      ...i,
      contact_id: cid,
      description: contact ? `${contact.role ? `${contact.role} — ` : ''}${contact.name}` : i.description,
      internal_cost: contact && contact.default_rate > 0 ? String(contact.default_rate) : i.internal_cost,
    });
    if (target === 'new') setNewItem(update);
    else setEditForm(update);
  }

  // Picking a catalog equipment item or a studio rate prefills description + both cost
  // columns from the same rate card used for studio bookings, so a project can budget "our
  // own" gear/venue alongside outside vendors without retyping numbers that already live in
  // the equipment database.
  function pickCatalogItem(value: string, target: 'new' | 'edit') {
    const update = (i: EmptyItem): EmptyItem => {
      if (!value) return i;
      if (value.startsWith('studio:')) {
        const rateKey = value.slice('studio:'.length) as keyof typeof STUDIO_RATES;
        const rate = STUDIO_RATES[rateKey];
        return { ...i, description: rate.label, internal_cost: String(rate.price), client_cost: String(rate.price) };
      }
      const eq = equipment.find(e => e.id === Number(value.slice('eq:'.length)));
      if (!eq) return i;
      return { ...i, description: eq.name, internal_cost: String(eq.daily_rate), client_cost: String(eq.daily_rate) };
    };
    if (target === 'new') setNewItem(update);
    else setEditForm(update);
  }

  function startEdit(c: ProjectCost) {
    setEditingId(c.id);
    setEditForm({ category: c.category, description: c.description, note: c.note || '', internal_cost: String(c.internal_cost), client_cost: String(c.client_cost), contact_id: c.contact_id });
  }

  async function saveEdit(costId: number) {
    await fetch(`/api/project-costs/${costId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm),
    });
    setEditingId(null);
    load();
  }

  async function deleteItem(costId: number) {
    if (!confirm('Delete this cost line item?')) return;
    await fetch(`/api/project-costs/${costId}`, { method: 'DELETE' });
    load();
  }

  async function deleteProject() {
    if (!project) return;
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    window.location.href = '/projects';
  }

  function startEditHeader() {
    if (!project) return;
    setHeaderForm({
      name: project.name, client_name: project.client_name || '', client_company: project.client_company || '',
      client_title: project.client_title || '', description: project.description || '',
    });
    setEditingHeader(true);
  }

  async function saveHeader() {
    await updateProject(headerForm);
    setEditingHeader(false);
  }

  const ic = 'bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-[#E32726]';

  return (
    <div className="pt-14 md:pt-0 p-4 md:p-6 max-w-5xl">
      <BackButton fallbackHref="/projects" />

      {/* Header */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mt-2 mb-4">
        {editingHeader ? (
          <div className="space-y-2">
            <input value={headerForm.name} onChange={e => setHeaderForm(f => ({ ...f, name: e.target.value }))} className={ic + ' w-full font-semibold'} placeholder="Project name" />
            <div className="grid grid-cols-2 gap-2">
              <input value={headerForm.client_name} onChange={e => setHeaderForm(f => ({ ...f, client_name: e.target.value }))} className={ic} placeholder="Client name" />
              <input value={headerForm.client_company} onChange={e => setHeaderForm(f => ({ ...f, client_company: e.target.value }))} className={ic} placeholder="Client company" />
            </div>
            <input value={headerForm.client_title} onChange={e => setHeaderForm(f => ({ ...f, client_title: e.target.value }))} className={ic + ' w-full'} placeholder="Client title" />
            <textarea value={headerForm.description} onChange={e => setHeaderForm(f => ({ ...f, description: e.target.value }))} rows={3} className={ic + ' w-full'} placeholder="Description / creative brief" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingHeader(false)} className="text-xs text-white/50 border border-[#2a2a2a] px-3 py-1.5 rounded">Cancel</button>
              <button onClick={saveHeader} className="text-xs bg-[#E32726] text-white px-3 py-1.5 rounded font-medium">Save</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-white">{project.name}</h1>
                <button onClick={startEditHeader} className="text-white/30 hover:text-white text-xs">✏️ Edit</button>
              </div>
              <div className="text-xs text-white/40 mt-1">
                {project.client_name || 'No client set'}{project.client_company ? ` — ${project.client_company}` : ''}
                {project.quote_number ? ` · ${project.quote_number}` : ''}
              </div>
              {project.description && <p className="text-xs text-white/50 mt-2 max-w-lg whitespace-pre-wrap">{project.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <select value={project.status} onChange={e => updateProject({ status: e.target.value as Project['status'] })} disabled={saving}
                className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-white">
                {PROJECT_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
              <Link href={`/print/project-quote/${id}`} target="_blank" className="bg-[#E32726] text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-[#c41f1e] transition-colors">📄 Cost Estimate / Quotation</Link>
              <button onClick={deleteProject} className="text-white/20 hover:text-red-400 text-xs border border-white/10 hover:border-red-400/40 px-2 py-1.5 rounded">✕ Delete</button>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="text-lg font-black text-white">{formatPHP(internalTotal)}</div>
          <div className="text-xs text-white/40 mt-1">Internal Cost (actual)</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="text-lg font-black text-blue-400">{formatPHP(clientTotal)}</div>
          <div className="text-xs text-white/40 mt-1">Client Cost (pre-markup)</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className={`text-lg font-black ${margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPHP(margin)}</div>
          <div className="text-xs text-white/40 mt-1">Margin (before markup/VAT)</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="text-lg font-black text-yellow-400">{vatExempt ? 'VAT-Exempt' : '12% VAT'}</div>
          <div className="text-xs text-white/40 mt-1 flex items-center gap-1.5">
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={vatExempt} onChange={e => updateProject({ vat_exempt: e.target.checked ? 1 : 0 })} />
              VAT-exempt client
            </label>
          </div>
        </div>
      </div>

      {/* Client-facing scenarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {[
          { label: 'With 50% DP Before Shoot', pct: project.markup_pct_dp, calc: withDP, key: 'markup_pct_dp' as const },
          { label: 'Without 50% DP', pct: project.markup_pct_no_dp, calc: noDP, key: 'markup_pct_no_dp' as const },
        ].map(s => (
          <div key={s.key} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className="text-xs text-white/50 mb-2 font-semibold">{s.label}</div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-white/40">Sub Total (client cost)</span>
              <span className="text-white">{formatPHP(clientTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-white/40 flex items-center gap-1">
                Markup <input type="number" value={s.pct} onChange={e => updateProject({ [s.key]: Number(e.target.value) } as Partial<Project>)}
                  className="w-12 bg-[#0f0f0f] border border-[#2a2a2a] rounded px-1 py-0.5 text-white text-xs" />%
              </span>
              <span className="text-white">{formatPHP(s.calc.markup)}</span>
            </div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-white/40">Sub Total 2</span>
              <span className="text-white">{formatPHP(s.calc.subtotal2)}</span>
            </div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-white/40">{vatExempt ? 'VAT (exempt)' : '12% VAT'}</span>
              <span className="text-white">{formatPHP(s.calc.vat)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-[#2a2a2a] pt-2">
              <span className="text-sm font-semibold text-white">TOTAL WITH VAT</span>
              <span className="text-lg font-black text-[#E32726]">{formatPHP(s.calc.total)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Add line item */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-4">
        <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">Add Cost Line Item</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
          <select value={newItem.category} onChange={e => setNewItem(i => ({ ...i, category: e.target.value as ProjectCategory }))} className={ic}>
            {PROJECT_CATEGORIES.map(c => <option key={c} value={c}>{PROJECT_CATEGORY_LABELS[c]}</option>)}
          </select>
          <select value={newItem.contact_id ?? ''} onChange={e => pickContact(e.target.value, 'new')} className={ic}>
            <option value="">— Pick Personnel / Vendor (optional) —</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.role ? ` — ${c.role}` : ''}{c.default_rate > 0 ? ` (${formatPHP(c.default_rate)}${RATE_UNIT_LABELS[c.rate_unit]})` : ''}</option>
            ))}
          </select>
        </div>
        <select defaultValue="" onChange={e => { pickCatalogItem(e.target.value, 'new'); e.target.value = ''; }} className={ic + ' w-full mb-2'}>
          <option value="">— Pick Equipment / Studio Rate (optional) —</option>
          <optgroup label="Studio">
            {(Object.entries(STUDIO_RATES) as [keyof typeof STUDIO_RATES, typeof STUDIO_RATES[keyof typeof STUDIO_RATES]][]).map(([key, rate]) => (
              <option key={key} value={`studio:${key}`}>{rate.label} ({formatPHP(rate.price)})</option>
            ))}
          </optgroup>
          {[...equipmentByCat.entries()].map(([cat, items]) => (
            <optgroup key={cat} label={CATEGORY_LABELS[cat] || cat}>
              {items.map(e => <option key={e.id} value={`eq:${e.id}`}>{e.name} ({formatPHP(e.daily_rate)}/day)</option>)}
            </optgroup>
          ))}
        </select>
        <input value={newItem.description} onChange={e => setNewItem(i => ({ ...i, description: e.target.value }))} placeholder="Description (e.g. Director — Treb Monteras)" className={ic + ' w-full mb-2'} />
        <input value={newItem.note} onChange={e => setNewItem(i => ({ ...i, note: e.target.value }))} placeholder="Note (optional — e.g. 2x AC, 2 Cam Op, Gaffer)" className={ic + ' w-full mb-2'} />
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Internal Cost (₱) — actual cost to Dogzilla</label>
            <input value={newItem.internal_cost} onChange={e => setNewItem(i => ({ ...i, internal_cost: e.target.value }))} type="number" className={ic + ' w-full'} />
          </div>
          <div>
            <label className="text-[10px] text-white/40 block mb-1">Client Cost (₱) — pre-markup, shown to client</label>
            <input value={newItem.client_cost} onChange={e => setNewItem(i => ({ ...i, client_cost: e.target.value }))} type="number" className={ic + ' w-full'} />
          </div>
        </div>
        <button onClick={addItem} disabled={!newItem.description.trim()} className="bg-[#E32726] text-white text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-40">+ Add Item</button>
      </div>

      {/* Line items by category */}
      <div className="space-y-3">
        {byCategory.map(g => {
          const catInternal = g.items.reduce((s, c) => s + c.internal_cost, 0);
          const catClient = g.items.reduce((s, c) => s + c.client_cost, 0);
          return (
            <div key={g.category} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f0f0f]">
                <span className="text-xs font-semibold text-white">{PROJECT_CATEGORY_LABELS[g.category]}</span>
                <div className="flex items-center gap-3 text-[10px] text-white/40">
                  <span>Internal: <span className="text-white/70">{formatPHP(catInternal)}</span></span>
                  <span>Client: <span className="text-blue-400">{formatPHP(catClient)}</span></span>
                </div>
              </div>
              {g.items.length === 0 ? (
                <div className="px-4 py-3 text-xs text-white/20">No items yet</div>
              ) : (
                <div className="divide-y divide-[#2a2a2a]">
                  {g.items.map(c => (
                    editingId === c.id ? (
                      <div key={c.id} className="px-4 py-3 space-y-1.5">
                        <select value={editForm.contact_id ?? ''} onChange={e => pickContact(e.target.value, 'edit')} className={ic + ' w-full'}>
                          <option value="">— Pick Personnel / Vendor (optional) —</option>
                          {contacts.map(ct => (
                            <option key={ct.id} value={ct.id}>{ct.name}{ct.role ? ` — ${ct.role}` : ''}{ct.default_rate > 0 ? ` (${formatPHP(ct.default_rate)}${RATE_UNIT_LABELS[ct.rate_unit]})` : ''}</option>
                          ))}
                        </select>
                        <select defaultValue="" onChange={e => { pickCatalogItem(e.target.value, 'edit'); e.target.value = ''; }} className={ic + ' w-full'}>
                          <option value="">— Pick Equipment / Studio Rate (optional) —</option>
                          <optgroup label="Studio">
                            {(Object.entries(STUDIO_RATES) as [keyof typeof STUDIO_RATES, typeof STUDIO_RATES[keyof typeof STUDIO_RATES]][]).map(([key, rate]) => (
                              <option key={key} value={`studio:${key}`}>{rate.label} ({formatPHP(rate.price)})</option>
                            ))}
                          </optgroup>
                          {[...equipmentByCat.entries()].map(([cat, items]) => (
                            <optgroup key={cat} label={CATEGORY_LABELS[cat] || cat}>
                              {items.map(e => <option key={e.id} value={`eq:${e.id}`}>{e.name} ({formatPHP(e.daily_rate)}/day)</option>)}
                            </optgroup>
                          ))}
                        </select>
                        <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className={ic + ' w-full'} />
                        <input value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} placeholder="Note" className={ic + ' w-full'} />
                        <div className="grid grid-cols-2 gap-2">
                          <input value={editForm.internal_cost} onChange={e => setEditForm(f => ({ ...f, internal_cost: e.target.value }))} type="number" className={ic} placeholder="Internal cost" />
                          <input value={editForm.client_cost} onChange={e => setEditForm(f => ({ ...f, client_cost: e.target.value }))} type="number" className={ic} placeholder="Client cost" />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingId(null)} className="text-xs text-white/50 border border-[#2a2a2a] px-3 py-1.5 rounded">Cancel</button>
                          <button onClick={() => saveEdit(c.id)} className="text-xs bg-[#E32726] text-white px-3 py-1.5 rounded font-medium">Save</button>
                        </div>
                      </div>
                    ) : (
                      <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="min-w-0">
                          <div className="text-sm text-white truncate flex items-center gap-1.5">
                            {c.description}
                            {c.contact_id && contacts.find(ct => ct.id === c.contact_id) && (
                              <span className="text-[9px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded shrink-0">
                                {contacts.find(ct => ct.id === c.contact_id)!.type === 'crew' ? '🎬' : '🏢'} linked
                              </span>
                            )}
                          </div>
                          {c.note && <div className="text-[11px] text-white/30 truncate">{c.note}</div>}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          <div className="text-right">
                            <div className="text-xs text-white/60">{formatPHP(c.internal_cost)}</div>
                            <div className="text-xs text-blue-400">{formatPHP(c.client_cost)}</div>
                          </div>
                          <button onClick={() => startEdit(c)} className="text-white/20 hover:text-white text-xs">✏</button>
                          <button onClick={() => deleteItem(c.id)} className="text-white/20 hover:text-red-400 text-xs">✕</button>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
