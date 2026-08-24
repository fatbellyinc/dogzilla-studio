'use client';
import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { formatPHP, formatDateShort, calcDiscountAmount, calcListPriceFromNet, sortDeliverables } from '@/lib/utils';
import { Project, ProjectCost, ProjectPayment, PROJECT_CATEGORIES, PROJECT_CATEGORY_LABELS, PROJECT_STATUSES, ProjectCategory, Contact, RATE_UNIT_LABELS, Equipment, STUDIO_RATES, CATEGORY_LABELS, PROJECT_CATEGORY_EQUIPMENT_CATALOG_CATS, PROJECT_CATEGORY_SHOWS_STUDIO, PROJECT_CATEGORY_ROLE_SUGGESTIONS, ADDON_ITEMS, DELIVERABLE_DURATIONS, DELIVERABLE_RATIOS, DELIVERABLE_CONTENT_TYPES } from '@/lib/types';
import BackButton from '@/components/BackButton';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', quoted: 'Quoted', won: 'Won', lost: 'Lost', in_production: 'In Production', completed: 'Completed',
};

// Common exclusions pulled from past Dogzilla quotations — clickable suggestions so a producer
// doesn't have to remember or retype the standard list from scratch every time. Chosen here in
// the app, not on the printed document — the quotation just displays whatever ends up saved.
const EXCLUSION_SUGGESTIONS = [
  'Stock footage or photos purchase, if needed',
  'All products',
  'Agency boards and final copy',
  'Talent usage beyond stated period/territory',
  'Livestreaming services, unless specified',
  'Drone / aerial cinematography, unless specified',
  'Government permits, fees and licenses',
  'Client-side revisions beyond two (2) rounds',
  'Overtime beyond the agreed call time',
  'Music licensing beyond stock/library tracks',
  'Import duties and customs fees for equipment',
  'Insurance beyond standard equipment coverage',
  'Wardrobe and styling purchases (rental only)',
  'COVID / health testing, unless specified',
  'Translation / subtitling beyond English',
];

type DiscountType = 'percent' | 'fixed' | null;
type CostFlow = 'external' | 'internal';
interface EmptyItem {
  category: ProjectCategory; description: string; note: string; internal_cost: string; client_cost: string;
  contact_id: number | null; qty: string; discount_type: DiscountType; discount_value: string; cost_flow: CostFlow; days: string;
}
const emptyItem = (category: ProjectCategory): EmptyItem => ({
  category, description: '', note: '', internal_cost: '', client_cost: '', contact_id: null, qty: '1',
  discount_type: null, discount_value: '', cost_flow: 'external', days: '1',
});
const CLIENT_MODES = ['sync', 'markup', 'custom'] as const;
type ClientMode = typeof CLIENT_MODES[number];
const DISCOUNT_TYPES: DiscountType[] = [null, 'percent', 'fixed'];
const DISCOUNT_PRESETS = [5, 10, 15, 20, 25, 30, 50];
interface StagedItem extends EmptyItem {
  key: string;
  unit_internal: number; // per-unit rate — qty × this = internal cost, recomputed automatically
  client_mode: ClientMode; // 'sync': client cost auto-copies internal (default); 'markup': internal × (1 + markup_pct); 'custom': a flat client price typed in directly
  markup_pct: string;
}
function recomputeStaged(s: Pick<StagedItem, 'qty' | 'days' | 'unit_internal' | 'client_mode' | 'markup_pct' | 'internal_cost' | 'client_cost' | 'discount_type' | 'discount_value'>) {
  const qty = Math.max(1, Number(s.qty) || 1);
  const days = Math.max(1, Number(s.days) || 1);
  const internal = s.unit_internal > 0 ? s.unit_internal * qty * days : Number(s.internal_cost) || 0;
  // Discount only applies on top of Sync/Markup — Custom mode already lets the price be typed
  // in directly, so discounting it further would be redundant and confusing.
  if (s.client_mode === 'custom') {
    return { internal_cost: String(internal), client_cost: s.client_cost };
  }
  const listClient = s.client_mode === 'markup' ? internal * (1 + (Number(s.markup_pct) || 0) / 100) : internal;
  const client = listClient - calcDiscountAmount(listClient, s.discount_type, Number(s.discount_value) || 0);
  return { internal_cost: String(internal), client_cost: String(Math.round(client * 100) / 100) };
}

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
  const [payments, setPayments] = useState<ProjectPayment[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [newItem, setNewItem] = useState<EmptyItem>(emptyItem('pre_production'));
  const [staged, setStaged] = useState<StagedItem[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EmptyItem>(emptyItem('pre_production'));
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerForm, setHeaderForm] = useState({ name: '', client_name: '', client_company: '', client_title: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', type: 'deposit', method: '', reference: '' });
  const [exclusionsText, setExclusionsText] = useState('');
  const [deliverablesText, setDeliverablesText] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [mealCalcOpen, setMealCalcOpen] = useState(false);
  const MEAL_TYPES = [
    ['breakfast', 'Breakfast', '150'], ['amSnack', 'Snack AM', '100'], ['lunch', 'Lunch', '200'],
    ['pmSnack', 'Snack PM', '100'], ['dinner', 'Dinner', '200'], ['midnight', 'Midnight Snack', '120'],
  ] as const;
  const emptyMealCalc = Object.fromEntries(MEAL_TYPES.map(([key, , defaultRate]) => [key, { count: '0', pax: '', rate: defaultRate }])) as
    Record<typeof MEAL_TYPES[number][0], { count: string; pax: string; rate: string }>;
  const [mealCalc, setMealCalc] = useState(emptyMealCalc);
  const [mealDate, setMealDate] = useState('');
  const [customItemOpen, setCustomItemOpen] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/projects/${id}`).then(r => r.json()).then(d => {
      setProject(d.project);
      setCosts(d.costs);
      setPayments(d.payments || []);
      setExclusionsText(d.project.cost_exclusions || '');
      setDeliverablesText(d.project.deliverables || '');
    });
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch('/api/contacts').then(r => r.json()).then(setContacts); }, []);
  useEffect(() => { fetch('/api/equipment').then(r => r.json()).then(setEquipment); }, []);

  if (!project) return <div className="flex items-center justify-center h-64 text-white/30 pt-14 md:pt-0">Loading project...</div>;

  const internalTotal = costs.reduce((s, c) => s + c.internal_cost, 0);
  const clientTotal = costs.reduce((s, c) => s + c.client_cost, 0);
  const margin = clientTotal - internalTotal;
  // What actually leaves the business (paid to vendors/contractors/crew) vs. what stays with
  // Dogzilla because the "cost" is our own studio/equipment/in-house crew — that in-house
  // portion is really captured revenue, not a real expense, so it belongs in earnings.
  const paidOut = costs.filter(c => c.cost_flow === 'external').reduce((s, c) => s + c.internal_cost, 0);
  const keptInHouse = costs.filter(c => c.cost_flow === 'internal').reduce((s, c) => s + c.internal_cost, 0);
  const trueEarnings = clientTotal - paidOut;
  const vatExempt = !!project.vat_exempt;
  const noMarkup = !!project.no_markup;
  const noDP = calcScenario(clientTotal, noMarkup ? 0 : project.markup_pct_no_dp, vatExempt);

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

  // Both pickers only ever show entries relevant to the line item's own category — a caterer
  // shouldn't turn up while adding a Post Production cost, and camera gear shouldn't turn up
  // under Food & Transportation. Grouping (Crew/Vendor, or by equipment catalog category) is
  // preserved within whatever survives the filter.
  function contactOptionGroups(category: ProjectCategory) {
    const relevant = contacts.filter(c => c.default_category === category);
    const crew = relevant.filter(c => c.type === 'crew');
    const vendors = relevant.filter(c => c.type === 'vendor');
    const renderGroup = (label: string, list: Contact[]) => list.length > 0 && (
      <optgroup key={label} label={label}>
        {list.map(c => (
          <option key={c.id} value={c.id}>{c.name}{c.role ? ` — ${c.role}` : ''}{c.default_rate > 0 ? ` (${formatPHP(c.default_rate)}${RATE_UNIT_LABELS[c.rate_unit]})` : ''}</option>
        ))}
      </optgroup>
    );
    return <>{renderGroup('Crew & Talent', crew)}{renderGroup('Vendors & Suppliers', vendors)}</>;
  }

  function equipmentOptionGroups(category: ProjectCategory) {
    const showStudio = !!PROJECT_CATEGORY_SHOWS_STUDIO[category];
    const catalogCats = PROJECT_CATEGORY_EQUIPMENT_CATALOG_CATS[category] ?? [];
    return (
      <>
        {showStudio && (
          <optgroup label="Studio">
            {(Object.entries(STUDIO_RATES) as [keyof typeof STUDIO_RATES, typeof STUDIO_RATES[keyof typeof STUDIO_RATES]][]).map(([key, rate]) => (
              <option key={key} value={`studio:${key}`}>{rate.label} ({formatPHP(rate.price)})</option>
            ))}
          </optgroup>
        )}
        {catalogCats.filter(cat => equipmentByCat.has(cat)).map(cat => (
          <optgroup key={cat} label={CATEGORY_LABELS[cat] || cat}>
            {equipmentByCat.get(cat)!.map(e => <option key={e.id} value={`eq:${e.id}`}>{e.name} ({formatPHP(e.daily_rate)}/day)</option>)}
          </optgroup>
        ))}
      </>
    );
  }

  // Card-based multi-select staging, matching the booking flow's "click to toggle, add many
  // at once" pattern — clicking a card immediately queues (or un-queues) a fully-formed line
  // item instead of forcing a pick-then-click-Add cycle per item.
  function toggleStage(key: string, build: () => Omit<StagedItem, 'key'>) {
    setStaged(prev => {
      if (prev.some(s => s.key === key)) return prev.filter(s => s.key !== key);
      return [...prev, { key, ...build() }];
    });
  }

  function toggleContactStage(contact: Contact, category: ProjectCategory) {
    const unit = contact.default_rate > 0 ? contact.default_rate : 0;
    const description = `${contact.role ? `${contact.role} — ` : ''}${contact.name}`;
    const existing = !staged.some(s => s.key === `contact:${contact.id}`) && findExistingCost(category, description);
    if (existing) { bumpExistingQty(existing); return; }
    toggleStage(`contact:${contact.id}`, () => ({
      category, contact_id: contact.id, description,
      note: '', internal_cost: unit > 0 ? String(unit) : '', client_cost: unit > 0 ? String(unit) : '',
      qty: '1', unit_internal: unit, client_mode: 'sync', markup_pct: '0', discount_type: null, discount_value: '', cost_flow: 'external', days: '1',
    }));
  }

  // Quick-add checklist chips (e.g. "Cinematographer", "Assistant Director") so a producer can
  // click through the roles/items a shoot of this type usually needs without first having every
  // one of them saved as a Contact — a ₱0 reminder placeholder, cost filled in once quoted.
  function toggleRoleSuggestionStage(label: string, category: ProjectCategory) {
    const existing = !staged.some(s => s.key === `role:${label}`) && findExistingCost(category, label);
    if (existing) { bumpExistingQty(existing); return; }
    toggleStage(`role:${label}`, () => ({
      category, contact_id: null, description: label, note: '', internal_cost: '', client_cost: '',
      qty: '1', unit_internal: 0, client_mode: 'sync', markup_pct: '0', discount_type: null, discount_value: '', cost_flow: 'external', days: '1',
    }));
  }

  function toggleCatalogStage(value: string, category: ProjectCategory) {
    const alreadyStaged = staged.some(s => s.key === value);
    if (value.startsWith('studio:')) {
      const rateKey = value.slice('studio:'.length) as keyof typeof STUDIO_RATES;
      const rate = STUDIO_RATES[rateKey];
      const existing = !alreadyStaged && findExistingCost(category, rate.label);
      if (existing) { bumpExistingQty(existing); return; }
      toggleStage(value, () => ({ category, contact_id: null, description: rate.label, note: '', internal_cost: String(rate.price), client_cost: String(rate.price), qty: '1', unit_internal: rate.price, client_mode: 'sync', markup_pct: '0', discount_type: null, discount_value: '', cost_flow: 'internal', days: '1' }));
    } else if (value.startsWith('eq:')) {
      const eq = equipment.find(e => e.id === Number(value.slice('eq:'.length)));
      if (!eq) return;
      const existing = !alreadyStaged && findExistingCost(category, eq.name);
      if (existing) { bumpExistingQty(existing); return; }
      toggleStage(value, () => ({ category, contact_id: null, description: eq.name, note: '', internal_cost: String(eq.daily_rate), client_cost: String(eq.daily_rate), qty: '1', unit_internal: eq.daily_rate, client_mode: 'sync', markup_pct: '0', discount_type: null, discount_value: '', cost_flow: 'internal', days: '1' }));
    } else if (value.startsWith('addon:')) {
      const addon = ADDON_ITEMS.find(a => a.id === value.slice('addon:'.length));
      if (!addon) return;
      const existing = !alreadyStaged && findExistingCost(category, addon.label);
      if (existing) { bumpExistingQty(existing); return; }
      toggleStage(value, () => ({
        category, contact_id: null, description: addon.label,
        note: 'perHour' in addon && addon.perHour ? addon.description : '',
        internal_cost: String(addon.price), client_cost: String(addon.price), qty: '1', unit_internal: addon.price, client_mode: 'sync', markup_pct: '0', discount_type: null, discount_value: '', cost_flow: 'internal', days: '1',
      }));
    }
  }

  function updateStaged(key: string, fields: Partial<EmptyItem>) {
    setStaged(prev => prev.map(s => (s.key === key ? { ...s, ...fields } : s)));
  }

  // Quantity, rate, client mode (sync / markup% / custom flat price) all feed the same
  // auto-compute: internal cost = rate × qty, and client cost either mirrors internal cost
  // (default), applies a markup% on top, or is a flat price typed in directly — matching
  // "3 Grip @ ₱1,500" auto-totaling to ₱4,500 without retyping the total by hand.
  function updateStagedCompute(key: string, fields: Partial<Pick<StagedItem, 'qty' | 'days' | 'unit_internal' | 'client_mode' | 'markup_pct' | 'client_cost' | 'discount_type' | 'discount_value'>>) {
    setStaged(prev => prev.map(s => {
      if (s.key !== key) return s;
      const next = { ...s, ...fields };
      return { ...next, ...recomputeStaged(next) };
    }));
  }

  function cycleStagedDiscountType(key: string) {
    setStaged(prev => prev.map(s => {
      if (s.key !== key) return s;
      const idx = DISCOUNT_TYPES.indexOf(s.discount_type);
      const next = { ...s, discount_type: DISCOUNT_TYPES[(idx + 1) % DISCOUNT_TYPES.length] };
      return { ...next, ...recomputeStaged(next) };
    }));
  }

  function cycleClientMode(key: string) {
    setStaged(prev => prev.map(s => {
      if (s.key !== key) return s;
      const idx = CLIENT_MODES.indexOf(s.client_mode);
      const next = { ...s, client_mode: CLIENT_MODES[(idx + 1) % CLIENT_MODES.length] };
      return { ...next, ...recomputeStaged(next) };
    }));
  }

  function removeStaged(key: string) {
    setStaged(prev => prev.filter(s => s.key !== key));
  }

  async function commitStaged() {
    const items = staged.filter(s => s.description.trim());
    if (!items.length) return;
    await Promise.all(items.map(item => fetch('/api/project-costs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: Number(id), category: item.category, description: item.description, note: item.note, internal_cost: item.internal_cost, client_cost: item.client_cost, contact_id: item.contact_id, qty: item.qty, days: item.days, discount_type: item.client_mode === 'custom' ? null : item.discount_type, discount_value: item.client_mode === 'custom' ? 0 : item.discount_value, cost_flow: item.cost_flow }),
    })));
    setStaged([]);
    load();
  }

  async function updateProject(fields: Partial<Project>) {
    setSaving(true);
    await fetch(`/api/projects/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) });
    await load();
    setSaving(false);
  }

  // Manually (re)sync the linked studio booking — auto-fires on any project save once the
  // project is Won and has a shoot date, but this button lets a producer pull in cost-line
  // changes (new equipment, a different studio package) without touching an unrelated field.
  async function syncBooking() {
    setSyncing(true);
    setSyncMsg('');
    const res = await fetch(`/api/projects/${id}/sync-booking`, { method: 'POST' });
    const result = await res.json();
    setSyncMsg(res.ok ? '✓ Studio booking synced' : `✗ ${result.error}`);
    await load();
    setSyncing(false);
  }

  // Clicking a suggested/auto-detected exclusion toggles it in the list and saves immediately —
  // the printed Quotation only ever displays this text, never edits it. Computed via the
  // functional setState form so rapid successive clicks each build on the latest state instead
  // of racing against a stale closure snapshot (which was silently dropping earlier clicks).
  function toggleExclusionLine(line: string) {
    setExclusionsText(prev => {
      const lines = prev.split('\n').map(l => l.trim()).filter(Boolean);
      const next = lines.includes(line) ? lines.filter(l => l !== line) : [...lines, line];
      const joined = next.join('\n');
      fetch(`/api/projects/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cost_exclusions: joined }) });
      return joined;
    });
  }

  async function saveExclusionsText() {
    await fetch(`/api/projects/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cost_exclusions: exclusionsText }) });
  }

  // Same click-to-toggle pattern as Cost Exclusions — pick from duration x aspect-ratio combos
  // and common content types instead of retyping "30s 16:9, 30s 9:16..." from scratch.
  function toggleDeliverableLine(line: string) {
    setDeliverablesText(prev => {
      const lines = prev.split('\n').map(l => l.trim()).filter(Boolean);
      const next = lines.includes(line) ? lines.filter(l => l !== line) : [...lines, line];
      const joined = sortDeliverables(next).join('\n');
      fetch(`/api/projects/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deliverables: joined }) });
      return joined;
    });
  }

  async function saveDeliverablesText() {
    await fetch(`/api/projects/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deliverables: deliverablesText }) });
  }

  async function addPayment() {
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) return;
    await fetch('/api/project-payments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: Number(id), ...paymentForm }),
    });
    setPaymentForm({ amount: '', type: 'deposit', method: '', reference: '' });
    load();
  }

  async function deletePayment(paymentId: number) {
    if (!confirm('Delete this payment record?')) return;
    await fetch(`/api/project-payments/${paymentId}`, { method: 'DELETE' });
    load();
  }

  // Clicking a card for something already in the budget used to add a second, duplicate row.
  // Now it bumps the existing row's quantity by 1 instead — same total math, no duplicate line.
  function findExistingCost(category: ProjectCategory, description: string) {
    return costs.find(c => c.category === category && c.description === description);
  }

  async function bumpExistingQty(c: ProjectCost) {
    const newQty = (c.qty || 1) + 1;
    const unitInternal = c.internal_cost / (c.qty || 1);
    const listClient = calcListPriceFromNet(c.client_cost, c.discount_type, c.discount_value) / (c.qty || 1) * newQty;
    const newInternal = unitInternal * newQty;
    const newClient = listClient - calcDiscountAmount(listClient, c.discount_type, c.discount_value);
    await fetch(`/api/project-costs/${c.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: c.category, description: c.description, note: c.note, internal_cost: Math.round(newInternal * 100) / 100,
        client_cost: Math.round(newClient * 100) / 100, contact_id: c.contact_id, qty: newQty, days: c.days, discount_type: c.discount_type,
        discount_value: c.discount_value, cost_flow: c.cost_flow,
      }),
    });
    load();
  }

  // One-click flip for a single item, right from the list — no need to open the edit form
  // just to change whether a cost is paid out or kept in-house.
  async function quickToggleCostFlow(c: ProjectCost) {
    const flow: CostFlow = c.cost_flow === 'internal' ? 'external' : 'internal';
    await fetch(`/api/project-costs/${c.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: c.category, description: c.description, note: c.note, internal_cost: c.internal_cost,
        client_cost: c.client_cost, contact_id: c.contact_id, qty: c.qty, days: c.days, discount_type: c.discount_type,
        discount_value: c.discount_value, cost_flow: flow,
      }),
    });
    load();
  }

  // Bulk-flip every item in a category at once — e.g. "all my Equipment Rental items are our
  // own gear, not paid out to a rental house" — instead of opening each line item one by one.
  async function markCategoryFlow(category: ProjectCategory, flow: CostFlow) {
    const items = costs.filter(c => c.category === category && c.cost_flow !== flow);
    if (!items.length) return;
    await Promise.all(items.map(c => fetch(`/api/project-costs/${c.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: c.category, description: c.description, note: c.note, internal_cost: c.internal_cost,
        client_cost: c.client_cost, contact_id: c.contact_id, qty: c.qty, days: c.days, discount_type: c.discount_type,
        discount_value: c.discount_value, cost_flow: flow,
      }),
    })));
    load();
  }

  // Client Cost in this form is the list/sticker price; the discount (if any) is applied on
  // top when saving, so what's actually stored/billed is already net of the discount.
  async function addItem() {
    if (!newItem.description.trim()) return;
    const listClient = Number(newItem.client_cost) || 0;
    const netClient = listClient - calcDiscountAmount(listClient, newItem.discount_type, Number(newItem.discount_value) || 0);
    await fetch('/api/project-costs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: Number(id), ...newItem, client_cost: String(Math.round(netClient * 100) / 100) }),
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
    const listClient = calcListPriceFromNet(c.client_cost, c.discount_type, c.discount_value);
    setEditForm({
      category: c.category, description: c.description, note: c.note || '', internal_cost: String(c.internal_cost),
      client_cost: String(Math.round(listClient * 100) / 100), contact_id: c.contact_id, qty: String(c.qty || 1),
      discount_type: c.discount_type, discount_value: c.discount_value > 0 ? String(c.discount_value) : '',
      cost_flow: c.cost_flow || 'external', days: String(c.days || 1),
    });
  }

  // Mirrors addItem: editForm.client_cost is the list price shown for editing (re-derived from
  // the stored net amount), the discount is re-applied on save to produce the new net amount.
  async function saveEdit(costId: number) {
    const listClient = Number(editForm.client_cost) || 0;
    const netClient = listClient - calcDiscountAmount(listClient, editForm.discount_type, Number(editForm.discount_value) || 0);
    await fetch(`/api/project-costs/${costId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, client_cost: String(Math.round(netClient * 100) / 100) }),
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
              <Link href={`/print/project-invoice/${id}`} target="_blank" className="bg-[#1a1a1a] border border-[#2a2a2a] text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:border-white/30 transition-colors">🧾 Invoice</Link>
              <button onClick={deleteProject} className="text-white/20 hover:text-red-400 text-xs border border-white/10 hover:border-red-400/40 px-2 py-1.5 rounded">✕ Delete</button>
            </div>
          </div>
        )}
      </div>

      {/* Shoot Date + Studio Booking — a confirmed date on a Won project keeps a linked
          booking in sync automatically (studio rate + equipment lines mirrored from the
          budget), so the studio calendar and equipment inventory reflect what's confirmed. */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-4">
        <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">Shoot Date &amp; Studio Booking</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-white/50">
            <div className="mb-1">Shoot Date</div>
            <input type="date" value={project.shoot_date || ''} onChange={e => updateProject({ shoot_date: e.target.value })} className={ic} />
          </label>
          <label className="text-xs text-white/50">
            <div className="mb-1">End Date (multi-day, optional)</div>
            <input type="date" value={project.shoot_end_date || ''} onChange={e => updateProject({ shoot_end_date: e.target.value })} className={ic} />
          </label>
          <div className="flex-1 min-w-[200px]">
            {project.status !== 'won' ? (
              <div className="text-xs text-white/30">Mark this project Won to enable studio booking sync.</div>
            ) : !project.shoot_date ? (
              <div className="text-xs text-white/30">Set a shoot date above to book the studio.</div>
            ) : project.booking_id ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-green-400">🔗 Linked to Studio Booking #{project.booking_id}</span>
                <Link href={`/bookings/${project.booking_id}`} target="_blank" className="text-xs text-[#E32726] hover:underline">View Booking</Link>
                <button onClick={syncBooking} disabled={syncing} className="text-xs bg-[#0f0f0f] border border-[#2a2a2a] text-white/70 px-2.5 py-1 rounded hover:border-white/30 disabled:opacity-50">
                  {syncing ? 'Syncing…' : '🔄 Re-sync Now'}
                </button>
              </div>
            ) : (
              <button onClick={syncBooking} disabled={syncing} className="text-xs bg-[#E32726] text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-50">
                {syncing ? 'Booking…' : '📅 Book Studio Now'}
              </button>
            )}
            {syncMsg && <div className="text-xs text-white/50 mt-1">{syncMsg}</div>}
          </div>
        </div>
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
          <div className="text-lg font-black text-yellow-400">{noMarkup ? 'At Cost' : vatExempt ? 'NON-VAT' : '12% VAT'}</div>
          <div className="text-xs text-white/40 mt-1 flex flex-col gap-1">
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={vatExempt} onChange={e => updateProject({ vat_exempt: e.target.checked ? 1 : 0 })} />
              VAT-exempt client
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={noMarkup} onChange={e => updateProject({ no_markup: e.target.checked ? 1 : 0 })} />
              No markup (bill at cost)
            </label>
          </div>
        </div>
      </div>

      {/* Earnings — separates cost that actually leaves the business (paid to vendors/crew)
          from cost the project "pays" to Dogzilla's own studio/equipment, which is really
          captured revenue, not a real expense. Mark each line item 💸/🏠 below to drive this. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="text-lg font-black text-red-400">{formatPHP(paidOut)}</div>
          <div className="text-xs text-white/40 mt-1">💸 Paid Out (vendors/crew)</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="text-lg font-black text-white/70">{formatPHP(keptInHouse)}</div>
          <div className="text-xs text-white/40 mt-1">🏠 Kept In-House (own studio/gear)</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className={`text-lg font-black ${trueEarnings >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatPHP(trueEarnings)}</div>
          <div className="text-xs text-white/40 mt-1">✅ True Earnings (client cost − paid out)</div>
        </div>
      </div>

      {/* Client-facing total — one definitive billing scenario, matching the Quotation/Invoice */}
      <div className="grid grid-cols-1 mb-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="text-xs text-white/50 mb-2 font-semibold">Client Total</div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-white/40">Sub Total (client cost)</span>
            <span className="text-white">{formatPHP(clientTotal)}</span>
          </div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-white/40 flex items-center gap-1">
              Markup <input type="number" value={project.markup_pct_no_dp} disabled={noMarkup} onChange={e => updateProject({ markup_pct_no_dp: Number(e.target.value) })}
                className="w-12 bg-[#0f0f0f] border border-[#2a2a2a] rounded px-1 py-0.5 text-white text-xs disabled:opacity-30" />%{noMarkup && <span className="text-white/30">(off)</span>}
            </span>
            <span className="text-white">{formatPHP(noDP.markup)}</span>
          </div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-white/40">Sub Total 2</span>
            <span className="text-white">{formatPHP(noDP.subtotal2)}</span>
          </div>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-white/40">{vatExempt ? 'NON-VAT' : '12% VAT'}</span>
            <span className="text-white">{formatPHP(noDP.vat)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#2a2a2a] pt-2">
            <span className="text-sm font-semibold text-white">{vatExempt ? 'GRAND TOTAL' : 'TOTAL WITH VAT'}</span>
            <span className="text-lg font-black text-[#E32726]">{formatPHP(noDP.total)}</span>
          </div>
        </div>
      </div>

      {/* Add line items — click cards to multi-select (like the booking picker), then commit the batch */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-4">
        <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">Add Cost Line Items</h2>
        <select value={newItem.category} onChange={e => setNewItem(i => ({ ...i, category: e.target.value as ProjectCategory }))} className={ic + ' w-full mb-3'}>
          {PROJECT_CATEGORIES.map(c => <option key={c} value={c}>{PROJECT_CATEGORY_LABELS[c]}</option>)}
        </select>

        {(PROJECT_CATEGORY_ROLE_SUGGESTIONS[newItem.category] ?? []).length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Common items for this category — click to add (₱0 reminder, edit cost after)</div>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_CATEGORY_ROLE_SUGGESTIONS[newItem.category]!.map(label => {
                const active = staged.some(s => s.key === `role:${label}`);
                const existing = findExistingCost(newItem.category, label);
                return (
                  <button key={label} onClick={() => toggleRoleSuggestionStage(label, newItem.category)} title={existing ? 'Already in the budget — click to add another' : undefined}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${active ? 'bg-[#E32726] border-[#E32726] text-white' : existing ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-[#0f0f0f] border-[#2a2a2a] text-white/70 hover:border-white/30'}`}>
                    {existing && !active ? '✓ ' : ''}{label}{existing && !active ? ` ×${existing.qty}` : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {contacts.some(c => c.default_category === newItem.category) && (
          <div className="mb-3">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Personnel / Vendor — click to add</div>
            {(['crew', 'vendor'] as const).map(t => {
              const list = contacts.filter(c => c.default_category === newItem.category && c.type === t);
              if (!list.length) return null;
              return (
                <div key={t} className="mb-1.5">
                  <div className="text-[10px] text-white/30 mb-1">{t === 'crew' ? '🎬 Crew & Talent' : '🏢 Vendors & Suppliers'}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map(c => {
                      const active = staged.some(s => s.key === `contact:${c.id}`);
                      const existing = findExistingCost(newItem.category, `${c.role ? `${c.role} — ` : ''}${c.name}`);
                      return (
                        <button key={c.id} onClick={() => toggleContactStage(c, newItem.category)} title={existing ? 'Already in the budget — click to add another' : undefined}
                          className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${active ? 'bg-[#E32726] border-[#E32726] text-white' : existing ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-[#0f0f0f] border-[#2a2a2a] text-white/70 hover:border-white/30'}`}>
                          {existing && !active ? '✓ ' : ''}{c.name}{c.role ? ` — ${c.role}` : ''}{c.default_rate > 0 ? ` (${formatPHP(c.default_rate)}${RATE_UNIT_LABELS[c.rate_unit]})` : ''}{existing && !active ? ` ×${existing.qty}` : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(PROJECT_CATEGORY_SHOWS_STUDIO[newItem.category] || (PROJECT_CATEGORY_EQUIPMENT_CATALOG_CATS[newItem.category] ?? []).some(cat => equipmentByCat.has(cat))) && (
          <div className="mb-3">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Equipment / Studio / Add-ons — click to add</div>
            {PROJECT_CATEGORY_SHOWS_STUDIO[newItem.category] && (
              <div className="mb-1.5">
                <div className="text-[10px] text-white/30 mb-1">Studio</div>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.entries(STUDIO_RATES) as [keyof typeof STUDIO_RATES, typeof STUDIO_RATES[keyof typeof STUDIO_RATES]][]).map(([key, rate]) => {
                    const value = `studio:${key}`;
                    const active = staged.some(s => s.key === value);
                    const existing = findExistingCost(newItem.category, rate.label);
                    return (
                      <button key={key} onClick={() => toggleCatalogStage(value, newItem.category)} title={existing ? 'Already in the budget — click to add another' : undefined}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${active ? 'bg-[#E32726] border-[#E32726] text-white' : existing ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-[#0f0f0f] border-[#2a2a2a] text-white/70 hover:border-white/30'}`}>
                        {existing && !active ? '✓ ' : ''}{rate.label} ({formatPHP(rate.price)}){existing && !active ? ` ×${existing.qty}` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {(PROJECT_CATEGORY_EQUIPMENT_CATALOG_CATS[newItem.category] ?? []).filter(cat => equipmentByCat.has(cat)).map(cat => (
              <div key={cat} className="mb-1.5">
                <div className="text-[10px] text-white/30 mb-1">{CATEGORY_LABELS[cat] || cat}</div>
                <div className="flex flex-wrap gap-1.5">
                  {equipmentByCat.get(cat)!.map(e => {
                    const value = `eq:${e.id}`;
                    const active = staged.some(s => s.key === value);
                    const existing = findExistingCost(newItem.category, e.name);
                    return (
                      <button key={e.id} onClick={() => toggleCatalogStage(value, newItem.category)} title={existing ? 'Already in the budget — click to add another' : undefined}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${active ? 'bg-[#E32726] border-[#E32726] text-white' : existing ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-[#0f0f0f] border-[#2a2a2a] text-white/70 hover:border-white/30'}`}>
                        {existing && !active ? '✓ ' : ''}{e.name} ({formatPHP(e.daily_rate)}/day){existing && !active ? ` ×${existing.qty}` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {PROJECT_CATEGORY_SHOWS_STUDIO[newItem.category] && (
              <div className="mb-1.5">
                <div className="text-[10px] text-white/30 mb-1">Add-ons (from the booking app)</div>
                <div className="flex flex-wrap gap-1.5">
                  {ADDON_ITEMS.map(a => {
                    const value = `addon:${a.id}`;
                    const active = staged.some(s => s.key === value);
                    const existing = findExistingCost(newItem.category, a.label);
                    return (
                      <button key={a.id} onClick={() => toggleCatalogStage(value, newItem.category)} title={existing ? 'Already in the budget — click to add another' : a.description}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${active ? 'bg-[#E32726] border-[#E32726] text-white' : existing ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-[#0f0f0f] border-[#2a2a2a] text-white/70 hover:border-white/30'}`}>
                        {existing && !active ? '✓ ' : ''}{a.label}{a.price > 0 ? ` (${formatPHP(a.price)}${'perHour' in a && a.perHour ? '/hr' : ''})` : ' (custom quote)'}{existing && !active ? ` ×${existing.qty}` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {staged.length > 0 && (
          <div className="mb-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3 space-y-2">
            <div className="text-[10px] text-white/40 uppercase tracking-wider">Staged — Qty × Rate auto-computes cost. Click the client-cost mode to cycle Sync / Markup % / Custom price ({staged.length})</div>
            {staged.map(s => (
              <div key={s.key} className="space-y-1 border-b border-[#2a2a2a] last:border-0 pb-2 last:pb-0">
                <div className="flex items-center gap-2">
                  <input value={s.description} onChange={e => updateStaged(s.key, { description: e.target.value })} className={ic + ' flex-1 min-w-0'} />
                  <button onClick={() => removeStaged(s.key)} className="text-white/30 hover:text-red-400 text-xs shrink-0">✕</button>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-[10px] text-white/40">
                  <span className="flex items-center gap-1">
                    Qty <input value={s.qty} onChange={e => updateStagedCompute(s.key, { qty: e.target.value })} type="number" min="1" title="Quantity" className={ic + ' w-14'} />
                  </span>
                  <span className="flex items-center gap-1">
                    × Days <input value={s.days} onChange={e => updateStagedCompute(s.key, { days: e.target.value })} type="number" min="1" title="Days booked" className={ic + ' w-14'} />
                  </span>
                  <span className="flex items-center gap-1">
                    × Rate ₱ <input value={s.unit_internal || ''} onChange={e => updateStagedCompute(s.key, { unit_internal: Number(e.target.value) || 0 })} type="number" placeholder="0" title="Rate per unit — internal cost" className={ic + ' w-24'} />
                  </span>
                  <span className="text-white/60">= Internal {formatPHP(Number(s.internal_cost) || 0)}</span>
                  <button onClick={() => cycleClientMode(s.key)}
                    className={`px-2 py-1 rounded border ${s.client_mode === 'sync' ? 'border-green-500/30 text-green-400 bg-green-500/10' : s.client_mode === 'markup' ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10' : 'border-blue-500/30 text-blue-400 bg-blue-500/10'}`}>
                    {s.client_mode === 'sync' ? '🔗 Client = Internal' : s.client_mode === 'markup' ? '✏️ Markup %' : '💰 Custom price'}
                  </button>
                  {s.client_mode === 'markup' && (
                    <span className="flex items-center gap-1">
                      Markup <input value={s.markup_pct} onChange={e => updateStagedCompute(s.key, { markup_pct: e.target.value })} type="number" title="Markup % over internal cost" className={ic + ' w-14'} />%
                    </span>
                  )}
                  {s.client_mode === 'custom' ? (
                    <span className="flex items-center gap-1">
                      = Client ₱ <input value={s.client_cost} onChange={e => updateStagedCompute(s.key, { client_cost: e.target.value })} type="number" title="Custom client price" className={ic + ' w-24'} />
                    </span>
                  ) : (
                    <>
                      <button onClick={() => cycleStagedDiscountType(s.key)}
                        className={`px-2 py-1 rounded border ${s.discount_type ? 'border-orange-500/30 text-orange-400 bg-orange-500/10' : 'border-[#2a2a2a] text-white/40'}`}>
                        {s.discount_type === 'percent' ? '🏷️ % off' : s.discount_type === 'fixed' ? '🏷️ ₱ off' : '🏷️ No discount'}
                      </button>
                      {s.discount_type && (
                        <input value={s.discount_value} onChange={e => updateStagedCompute(s.key, { discount_value: e.target.value })} type="number" min="0"
                          title={s.discount_type === 'percent' ? 'Discount %' : 'Discount ₱'} className={ic + ' w-16'} />
                      )}
                      {s.discount_type === 'percent' && (
                        <span className="flex gap-1">
                          {DISCOUNT_PRESETS.map(p => (
                            <button key={p} onClick={() => updateStagedCompute(s.key, { discount_value: String(p) })}
                              className={`px-1.5 py-0.5 rounded border text-[10px] ${Number(s.discount_value) === p ? 'border-orange-500/50 bg-orange-500/20 text-orange-300' : 'border-[#2a2a2a] text-white/40 hover:border-white/30'}`}>
                              {p}%
                            </button>
                          ))}
                        </span>
                      )}
                      <span className="text-blue-400">= Client {formatPHP(Number(s.client_cost) || 0)}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
            <button onClick={commitStaged} className="bg-[#E32726] text-white text-sm px-4 py-2 rounded-lg font-medium">+ Add {staged.length} Item{staged.length > 1 ? 's' : ''} to Budget</button>
          </div>
        )}

        {newItem.category === 'food_transpo' && (() => {
          // Every date between the project's shoot date and end date — lets a multi-day shoot
          // add one meal-cost line per date instead of one lump sum for the whole project.
          const shootDates: string[] = [];
          if (project.shoot_date) {
            // Pure UTC date math — parsing "YYYY-MM-DD" with `new Date()` uses local time, and
            // toISOString() converts back to UTC, which silently shifts the whole range back a
            // day in any timezone behind UTC. Staying in UTC end-to-end avoids that entirely.
            const [sy, sm, sd] = project.shoot_date.split('-').map(Number);
            const endStr = project.shoot_end_date || project.shoot_date;
            const [ey, em, ed] = endStr.split('-').map(Number);
            const startUTC = Date.UTC(sy, sm - 1, sd);
            const endUTC = Date.UTC(ey, em - 1, ed);
            for (let t = startUTC; t <= endUTC; t += 86400000) {
              const dt = new Date(t);
              shootDates.push(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`);
            }
          }
          const rowTotals = MEAL_TYPES.map(([key]) => {
            const row = mealCalc[key];
            const count = Number(row.count) || 0;
            const pax = Number(row.pax) || 0;
            const rate = Number(row.rate) || 0;
            return { key, count, pax, rate, total: count * pax * rate };
          });
          const totalMeals = rowTotals.reduce((s, r) => s + r.count * r.pax, 0);
          const mealTotal = rowTotals.reduce((s, r) => s + r.total, 0);
          return (
            <div className="mb-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3">
              <button type="button" onClick={() => setMealCalcOpen(o => !o)} className="text-xs text-white/40 flex items-center gap-1">
                🍽️ Meal Calculator {mealCalcOpen ? '▲' : '▼'}
              </button>
              {mealCalcOpen && (
                <div className="mt-2 space-y-2">
                  {shootDates.length > 1 ? (
                    <div>
                      <label className="text-[10px] text-white/40 block mb-1">Shoot Date (multi-day — pick which day this is for)</label>
                      <select value={mealDate} onChange={e => setMealDate(e.target.value)} className={ic}>
                        <option value="">No specific date</option>
                        {shootDates.map(d => <option key={d} value={d}>{formatDateShort(d)}</option>)}
                      </select>
                    </div>
                  ) : project.shoot_date ? (
                    <div className="text-[10px] text-white/30">For {formatDateShort(project.shoot_date)}</div>
                  ) : null}
                  <div className="text-[10px] text-white/30">Servings, pax, and rate per meal type — each can differ (fewer people at breakfast, dinner priced higher, etc.)</div>
                  <div className="space-y-1.5">
                    {MEAL_TYPES.map(([key, label]) => {
                      const row = mealCalc[key];
                      const rowTotal = rowTotals.find(r => r.key === key)!.total;
                      return (
                        <div key={key} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-end gap-2">
                          <div>
                            <label className="text-[10px] text-white/40 block mb-1">{label}</label>
                          </div>
                          <div>
                            <label className="text-[10px] text-white/30 block mb-1">Servings</label>
                            <input value={row.count} onChange={e => setMealCalc(m => ({ ...m, [key]: { ...m[key], count: e.target.value } }))} type="number" min="0" className={ic + ' w-14'} />
                          </div>
                          <div>
                            <label className="text-[10px] text-white/30 block mb-1">Pax</label>
                            <input value={row.pax} onChange={e => setMealCalc(m => ({ ...m, [key]: { ...m[key], pax: e.target.value } }))} type="number" min="0" placeholder="0" className={ic + ' w-14'} />
                          </div>
                          <div>
                            <label className="text-[10px] text-white/30 block mb-1">₱/meal</label>
                            <input value={row.rate} onChange={e => setMealCalc(m => ({ ...m, [key]: { ...m[key], rate: e.target.value } }))} type="number" min="0" className={ic + ' w-16'} />
                          </div>
                          <div className="text-xs text-white/40 pb-1.5 w-20 text-right">{rowTotal > 0 ? formatPHP(rowTotal) : ''}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-xs text-white/60">
                    {totalMeals} total meal{totalMeals === 1 ? '' : 's'} = <span className="text-blue-400 font-semibold">{formatPHP(mealTotal)}</span>
                  </div>
                  <button type="button" disabled={mealTotal <= 0} onClick={() => {
                    // Only meal types the producer actually filled in (servings AND pax both
                    // set) show up — a project only needing Lunch shouldn't require touching
                    // the other four fields, and leaving them at 0 must not block applying.
                    const breakdown = MEAL_TYPES
                      .filter(([key]) => Number(mealCalc[key].count) > 0 && Number(mealCalc[key].pax) > 0)
                      .map(([key, label]) => `${label} x${mealCalc[key].count} (${mealCalc[key].pax} pax @ ${formatPHP(Number(mealCalc[key].rate) || 0)})`).join(', ');
                    const dateLabel = mealDate ? formatDateShort(mealDate) : (shootDates.length <= 1 && project.shoot_date ? formatDateShort(project.shoot_date) : '');
                    setNewItem(i => ({
                      ...i,
                      description: `Meals / Catering${dateLabel ? ` — ${dateLabel}` : ''}`,
                      note: breakdown || i.note,
                      internal_cost: String(mealTotal),
                      client_cost: String(mealTotal),
                    }));
                    // The computed values land in the "Custom / one-off item" fields just below —
                    // force that section open so applying actually shows something happened,
                    // instead of silently updating state behind a collapsed disclosure.
                    setCustomItemOpen(true);
                  }} className="text-xs bg-[#E32726] text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-40">
                    Apply to Cost Fields Below ↓
                  </button>
                  {mealTotal <= 0 && <div className="text-[10px] text-white/30">Enter servings and pax for at least one meal type above.</div>}
                </div>
              )}
            </div>
          );
        })()}

        <details className="text-xs" open={customItemOpen} onToggle={e => setCustomItemOpen(e.currentTarget.open)}>
          <summary className="text-white/40 cursor-pointer select-none mb-2">✏️ Custom / one-off item</summary>
          <input value={newItem.description} onChange={e => setNewItem(i => ({ ...i, description: e.target.value }))} placeholder="Description (e.g. Director — Treb Monteras)" className={ic + ' w-full mb-2'} />
          <input value={newItem.note} onChange={e => setNewItem(i => ({ ...i, note: e.target.value }))} placeholder="Note (optional — e.g. 2x AC, 2 Cam Op, Gaffer)" className={ic + ' w-full mb-2'} />
          <div className="grid grid-cols-4 gap-2 mb-2">
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Qty</label>
              <input value={newItem.qty} onChange={e => setNewItem(i => ({ ...i, qty: e.target.value }))} type="number" min="1" className={ic + ' w-full'} />
            </div>
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Days booked</label>
              <input value={newItem.days} onChange={e => setNewItem(i => ({ ...i, days: e.target.value }))} type="number" min="1" className={ic + ' w-full'} />
            </div>
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Internal Cost (₱) — actual cost to Dogzilla</label>
              <input value={newItem.internal_cost} onChange={e => setNewItem(i => ({ ...i, internal_cost: e.target.value }))} type="number" className={ic + ' w-full'} />
            </div>
            <div>
              <label className="text-[10px] text-white/40 block mb-1">Client Cost (₱) — list price, before discount</label>
              <input value={newItem.client_cost} onChange={e => setNewItem(i => ({ ...i, client_cost: e.target.value }))} type="number" className={ic + ' w-full'} />
            </div>
          </div>
          <div className="flex items-center gap-2 mb-2 text-[10px] text-white/40">
            <button type="button" onClick={() => setNewItem(i => ({ ...i, discount_type: DISCOUNT_TYPES[(DISCOUNT_TYPES.indexOf(i.discount_type) + 1) % DISCOUNT_TYPES.length] }))}
              className={`px-2 py-1 rounded border ${newItem.discount_type ? 'border-orange-500/30 text-orange-400 bg-orange-500/10' : 'border-[#2a2a2a] text-white/40'}`}>
              {newItem.discount_type === 'percent' ? '🏷️ % off' : newItem.discount_type === 'fixed' ? '🏷️ ₱ off' : '🏷️ No discount'}
            </button>
            {newItem.discount_type && (
              <input value={newItem.discount_value} onChange={e => setNewItem(i => ({ ...i, discount_value: e.target.value }))} type="number" min="0"
                title={newItem.discount_type === 'percent' ? 'Discount %' : 'Discount ₱'} className={ic + ' w-16'} />
            )}
            {newItem.discount_type === 'percent' && (
              <span className="flex gap-1">
                {DISCOUNT_PRESETS.map(p => (
                  <button key={p} onClick={() => setNewItem(i => ({ ...i, discount_value: String(p) }))}
                    className={`px-1.5 py-0.5 rounded border text-[10px] ${Number(newItem.discount_value) === p ? 'border-orange-500/50 bg-orange-500/20 text-orange-300' : 'border-[#2a2a2a] text-white/40 hover:border-white/30'}`}>
                    {p}%
                  </button>
                ))}
              </span>
            )}
            {newItem.discount_type && (
              <span className="text-blue-400">
                = Net {formatPHP((Number(newItem.client_cost) || 0) - calcDiscountAmount(Number(newItem.client_cost) || 0, newItem.discount_type, Number(newItem.discount_value) || 0))}
              </span>
            )}
          </div>
          <button onClick={addItem} disabled={!newItem.description.trim()} className="bg-[#E32726] text-white text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-40">+ Add Item</button>
        </details>
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
                  {g.items.length > 0 && (
                    <>
                      <button onClick={() => markCategoryFlow(g.category, 'internal')} className="text-green-400/70 hover:text-green-400" title="Mark every item in this category as kept in-house">
                        🏠 Mark all in-house
                      </button>
                      <button onClick={() => markCategoryFlow(g.category, 'external')} className="text-red-400/70 hover:text-red-400" title="Mark every item in this category as paid out">
                        💸 Mark all paid out
                      </button>
                    </>
                  )}
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
                        {contacts.some(ct => ct.default_category === editForm.category) && (
                          <select value={editForm.contact_id ?? ''} onChange={e => pickContact(e.target.value, 'edit')} className={ic + ' w-full'}>
                            <option value="">— Pick Personnel / Vendor (optional) —</option>
                            {contactOptionGroups(editForm.category)}
                          </select>
                        )}
                        {(PROJECT_CATEGORY_SHOWS_STUDIO[editForm.category] || (PROJECT_CATEGORY_EQUIPMENT_CATALOG_CATS[editForm.category] ?? []).some(cat => equipmentByCat.has(cat))) && (
                          <select defaultValue="" onChange={e => { pickCatalogItem(e.target.value, 'edit'); e.target.value = ''; }} className={ic + ' w-full'}>
                            <option value="">— Pick Equipment / Studio Rate (optional) —</option>
                            {equipmentOptionGroups(editForm.category)}
                          </select>
                        )}
                        <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className={ic + ' w-full'} />
                        <input value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} placeholder="Note" className={ic + ' w-full'} />
                        <div className="grid grid-cols-4 gap-2">
                          <input value={editForm.qty} onChange={e => setEditForm(f => ({ ...f, qty: e.target.value }))} type="number" min="1" className={ic} placeholder="Qty" />
                          <input value={editForm.days} onChange={e => setEditForm(f => ({ ...f, days: e.target.value }))} type="number" min="1" className={ic} placeholder="Days" />
                          <input value={editForm.internal_cost} onChange={e => setEditForm(f => ({ ...f, internal_cost: e.target.value }))} type="number" className={ic} placeholder="Internal cost" />
                          <input value={editForm.client_cost} onChange={e => setEditForm(f => ({ ...f, client_cost: e.target.value }))} type="number" className={ic} placeholder="Client cost (list price)" />
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-white/40">
                          <button type="button" onClick={() => setEditForm(f => ({ ...f, discount_type: DISCOUNT_TYPES[(DISCOUNT_TYPES.indexOf(f.discount_type) + 1) % DISCOUNT_TYPES.length] }))}
                            className={`px-2 py-1 rounded border ${editForm.discount_type ? 'border-orange-500/30 text-orange-400 bg-orange-500/10' : 'border-[#2a2a2a] text-white/40'}`}>
                            {editForm.discount_type === 'percent' ? '🏷️ % off' : editForm.discount_type === 'fixed' ? '🏷️ ₱ off' : '🏷️ No discount'}
                          </button>
                          {editForm.discount_type && (
                            <input value={editForm.discount_value} onChange={e => setEditForm(f => ({ ...f, discount_value: e.target.value }))} type="number" min="0"
                              title={editForm.discount_type === 'percent' ? 'Discount %' : 'Discount ₱'} className={ic + ' w-16'} />
                          )}
                          {editForm.discount_type === 'percent' && (
                            <span className="flex gap-1">
                              {DISCOUNT_PRESETS.map(p => (
                                <button key={p} onClick={() => setEditForm(f => ({ ...f, discount_value: String(p) }))}
                                  className={`px-1.5 py-0.5 rounded border text-[10px] ${Number(editForm.discount_value) === p ? 'border-orange-500/50 bg-orange-500/20 text-orange-300' : 'border-[#2a2a2a] text-white/40 hover:border-white/30'}`}>
                                  {p}%
                                </button>
                              ))}
                            </span>
                          )}
                          {editForm.discount_type && (
                            <span className="text-blue-400">
                              = Net {formatPHP((Number(editForm.client_cost) || 0) - calcDiscountAmount(Number(editForm.client_cost) || 0, editForm.discount_type, Number(editForm.discount_value) || 0))}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-white/40">
                          <span>Internal cost:</span>
                          <button type="button" onClick={() => setEditForm(f => ({ ...f, cost_flow: 'external' }))}
                            className={`px-2 py-1 rounded border ${editForm.cost_flow === 'external' ? 'border-red-500/30 text-red-400 bg-red-500/10' : 'border-[#2a2a2a] text-white/40'}`}>
                            💸 Paid out
                          </button>
                          <button type="button" onClick={() => setEditForm(f => ({ ...f, cost_flow: 'internal' }))}
                            className={`px-2 py-1 rounded border ${editForm.cost_flow === 'internal' ? 'border-green-500/30 text-green-400 bg-green-500/10' : 'border-[#2a2a2a] text-white/40'}`}>
                            🏠 Kept in-house
                          </button>
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
                            {c.qty > 1 && (
                              <span className="text-[9px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded shrink-0">× {c.qty}</span>
                            )}
                            {c.days > 1 && (
                              <span className="text-[9px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded shrink-0">📅 {c.days} days</span>
                            )}
                            {c.discount_type && c.discount_value > 0 && (
                              <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded shrink-0">
                                🏷️ -{c.discount_type === 'percent' ? `${c.discount_value}%` : formatPHP(c.discount_value)}
                              </span>
                            )}
                            <button onClick={() => quickToggleCostFlow(c)} title="Click to flip in-house / paid out"
                              className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 cursor-pointer hover:opacity-80 ${c.cost_flow === 'internal' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                              {c.cost_flow === 'internal' ? '🏠 in-house' : '💸 paid out'}
                            </button>
                            {c.contact_id && contacts.find(ct => ct.id === c.contact_id) && (
                              <span className="text-[9px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded shrink-0">
                                {contacts.find(ct => ct.id === c.contact_id)!.type === 'crew' ? '🎬' : '🏢'} linked
                              </span>
                            )}
                          </div>
                          {c.note && <div className="text-[11px] text-white/30 truncate">{c.note}</div>}
                          {(c.qty > 1 || c.days > 1) && (
                            <div className="text-[10px] text-white/25">@ {formatPHP(c.internal_cost / c.qty / c.days)}/unit{c.days > 1 ? '/day' : ''}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          <div className="text-right">
                            <div className="text-xs text-white/60">{formatPHP(c.internal_cost)}</div>
                            {c.discount_type && c.discount_value > 0 && (
                              <div className="text-[10px] text-white/30 line-through">{formatPHP(calcListPriceFromNet(c.client_cost, c.discount_type, c.discount_value))}</div>
                            )}
                            <div className="text-xs text-blue-400">{formatPHP(c.client_cost)}</div>
                          </div>
                          <button onClick={() => startEdit(c)} className="text-white/60 hover:text-white hover:bg-white/10 text-xs border border-[#2a2a2a] rounded px-2 py-1">✏️ Edit</button>
                          <button onClick={() => deleteItem(c.id)} className="text-white/40 hover:text-red-400 hover:bg-red-500/10 text-xs border border-[#2a2a2a] rounded px-2 py-1">✕</button>
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

      {/* Payments — recording one here immediately makes an Acknowledgement Receipt (deposit)
          or Official Receipt (balance/full) available to print/share for that specific payment. */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs text-white/40 uppercase tracking-wider">Payments</h2>
          <div className="text-xs text-white/50">
            Paid: <span className="text-green-400 font-semibold">{formatPHP(payments.reduce((s, p) => s + p.amount, 0))}</span>
          </div>
        </div>
        {payments.length > 0 && (
          <div className="divide-y divide-[#2a2a2a] mb-3">
            {payments.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="text-white font-medium">{formatPHP(p.amount)}</span>
                  <span className="text-white/40 ml-2 capitalize">{p.type}</span>
                  {p.method && <span className="text-white/30 ml-2">· {p.method}</span>}
                  {p.reference && <span className="text-white/30 ml-2 font-mono text-xs">#{p.reference}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-white/30">{new Date(p.paid_at).toLocaleDateString('en-PH')}</span>
                  <Link href={`/print/project-receipt/${p.id}`} target="_blank" className="text-[#E32726] hover:underline">
                    {p.type === 'deposit' ? '🧾 AR' : '🧾 OR'}
                  </Link>
                  <button onClick={() => deletePayment(p.id)} className="text-white/20 hover:text-red-400">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <input value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} type="number" placeholder="Amount ₱" className={ic} />
          <select value={paymentForm.type} onChange={e => setPaymentForm(f => ({ ...f, type: e.target.value }))} className={ic}>
            <option value="deposit">Deposit (→ AR)</option>
            <option value="balance">Balance (→ OR)</option>
            <option value="full">Full Payment (→ OR)</option>
          </select>
          <input value={paymentForm.method} onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))} placeholder="Method (bank, cash...)" className={ic} />
          <input value={paymentForm.reference} onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))} placeholder="Reference #" className={ic} />
          <button onClick={addPayment} disabled={!paymentForm.amount} className="bg-[#E32726] text-white text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-40">+ Record Payment</button>
        </div>
      </div>

      {/* Deliverables — picked here in the app; shown as its own section on the Quotation and
          Invoice, right under the project title. */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mt-4">
        <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">Deliverables (shown on Quotation &amp; Invoice)</h2>
        {(() => {
          const activeLines = deliverablesText.split('\n').map(l => l.trim()).filter(Boolean);
          const chip = (line: string) => {
            const active = activeLines.includes(line);
            return (
              <button key={line} onClick={() => toggleDeliverableLine(line)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${active ? 'bg-[#E32726] border-[#E32726] text-white' : 'bg-[#0f0f0f] border-[#2a2a2a] text-white/70 hover:border-white/30'}`}>
                {line}
              </button>
            );
          };
          return (
            <>
              <div className="mb-3">
                <div className="text-[10px] text-white/30 mb-1">Duration × Aspect Ratio — click to add/remove</div>
                {DELIVERABLE_DURATIONS.map(dur => (
                  <div key={dur} className="flex flex-wrap gap-1.5 mb-1.5">
                    {DELIVERABLE_RATIOS.map(ratio => chip(`${dur} ${ratio}`))}
                  </div>
                ))}
              </div>
              <div className="mb-3">
                <div className="text-[10px] text-white/30 mb-1">Content type</div>
                <div className="flex flex-wrap gap-1.5">
                  {DELIVERABLE_CONTENT_TYPES.map(chip)}
                </div>
              </div>
            </>
          );
        })()}
        <textarea value={deliverablesText} onChange={e => setDeliverablesText(e.target.value)} onBlur={saveDeliverablesText} rows={3}
          placeholder="Nothing set yet — click a suggestion above, or type your own line here (e.g. 3x15s, 9:16 or 4:5, Digital only)"
          className={ic + ' w-full'} />
      </div>

      {/* Cost Exclusions — picked here in the app; the printed Quotation only displays the
          resulting text, it never hosts the editing controls. */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mt-4">
        <h2 className="text-xs text-white/40 uppercase tracking-wider mb-3">Cost Exclusions (shown on Quotation)</h2>
        {(() => {
          const budgetedCategories = new Set(costs.map(c => c.category));
          const autoExclusions = PROJECT_CATEGORIES
            .filter(cat => !budgetedCategories.has(cat))
            .map(cat => `${PROJECT_CATEGORY_LABELS[cat]} (not included in this quote)`);
          const activeLines = exclusionsText.split('\n').map(l => l.trim()).filter(Boolean);
          return (
            <>
              {autoExclusions.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] text-white/30 mb-1">Not budgeted in this project</div>
                  <div className="flex flex-wrap gap-1.5">
                    {autoExclusions.map(line => {
                      const active = activeLines.includes(line);
                      return (
                        <button key={line} onClick={() => toggleExclusionLine(line)}
                          className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${active ? 'bg-[#E32726] border-[#E32726] text-white' : 'bg-[#0f0f0f] border-[#2a2a2a] text-white/70 hover:border-white/30'}`}>
                          {line}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="mb-3">
                <div className="text-[10px] text-white/30 mb-1">Common exclusions — click to add/remove</div>
                <div className="flex flex-wrap gap-1.5">
                  {EXCLUSION_SUGGESTIONS.map(line => {
                    const active = activeLines.includes(line);
                    return (
                      <button key={line} onClick={() => toggleExclusionLine(line)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${active ? 'bg-[#E32726] border-[#E32726] text-white' : 'bg-[#0f0f0f] border-[#2a2a2a] text-white/70 hover:border-white/30'}`}>
                        {line}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          );
        })()}
        <textarea value={exclusionsText} onChange={e => setExclusionsText(e.target.value)} onBlur={saveExclusionsText} rows={3}
          placeholder="Nothing excluded yet — click a suggestion above, or type your own line here"
          className={ic + ' w-full'} />
      </div>
    </div>
  );
}
