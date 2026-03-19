import * as React from 'react';
import {
  Plus, Edit, Trash2, X, Copy, Search,
  CheckSquare, List, Type, Image, Hash,
  ChevronUp, ChevronDown, Save, AlertCircle,
  GripVertical, ClipboardList, Loader2,
} from 'lucide-react';
import { User } from '../../types';
import {
  getTemplates, createTemplate, updateTemplate,
  deleteTemplate as deleteTemplateDB,
} from '../../supabase/services/templates.service';
import { logAction } from '../../supabase/services/audit.service';
import type { TemplateRow } from '../../supabase/database.types';

/* ─── Types ──────────────────────────────────────────────────────── */
type QuestionType = 'checkbox' | 'text' | 'number' | 'select' | 'photo';
type Frequency    = 'daily' | 'weekly' | 'monthly' | 'custom';

interface Question {
  id: string; text: string; type: QuestionType;
  required: boolean; unit?: string; options?: string[];
}
interface Template {
  id: string; name: string; description: string;
  frequency: Frequency; questions: Question[];
  lastUsed: string; active: boolean;
}

/* ─── Config ─────────────────────────────────────────────────────── */
const QT: Record<QuestionType, {
  label: string; short: string;
  Icon: React.FC<{className?: string}>;
  badge: string; card: string;
}> = {
  checkbox: { label:'Pass / Fail', short:'Pass/Fail', Icon:CheckSquare, badge:'bg-emerald-100 text-emerald-700', card:'border-emerald-300 bg-emerald-50 text-emerald-700' },
  text:     { label:'Text Input',  short:'Text',      Icon:Type,        badge:'bg-blue-100 text-blue-700',     card:'border-blue-300 bg-blue-50 text-blue-700'         },
  number:   { label:'Number',      short:'Number',    Icon:Hash,        badge:'bg-violet-100 text-violet-700', card:'border-violet-300 bg-violet-50 text-violet-700'   },
  select:   { label:'Dropdown',    short:'Dropdown',  Icon:List,        badge:'bg-orange-100 text-orange-700', card:'border-orange-300 bg-orange-50 text-orange-700'   },
  photo:    { label:'Photo',       short:'Photo',     Icon:Image,       badge:'bg-rose-100 text-rose-700',     card:'border-rose-300 bg-rose-50 text-rose-700'         },
};

const FREQ_STYLE: Record<Frequency, { accent: string; badge: string; label: string }> = {
  daily:   { accent:'border-sky-500',     badge:'bg-sky-100 text-sky-700',       label:'Daily'   },
  weekly:  { accent:'border-violet-500',  badge:'bg-violet-100 text-violet-700', label:'Weekly'  },
  monthly: { accent:'border-emerald-500', badge:'bg-emerald-100 text-emerald-700',label:'Monthly'},
  custom:  { accent:'border-zinc-400',    badge:'bg-zinc-100 text-zinc-600',     label:'Custom'  },
};

/* ─── Helpers ────────────────────────────────────────────────────── */
const makeId = () => Math.random().toString(36).slice(2, 9);
const q = (text: string, type: QuestionType = 'checkbox', required = true, extras: Partial<Question> = {}): Question =>
  ({ id: makeId(), text, type, required, ...extras });

/* ─── Mock data ──────────────────────────────────────────────────── */
const INIT_TEMPLATES: Template[] = [
  {
    id:'1', name:'Daily Vehicle Check', description:'Standard pre-shift check for all road vehicles.',
    frequency:'daily', lastUsed:'2026-02-25', active:true,
    questions:[
      q('Fuel level adequate (minimum ½ tank)?'),
      q('Engine oil level checked and within range?'),
      q('Coolant level checked?'),
      q('Brakes functioning correctly?'),
      q('Seat belts in working condition?'),
      q('Horn operational?'),
      q('All lights operational (headlights, indicators, brake lights)?'),
      q('Windscreen clean and undamaged?'),
      q('Wiper blades operational?'),
      q('No visible body damage or fluid leaks?'),
      q('Tyres in good condition and inflated correctly?'),
      q('Current odometer reading', 'number', true, { unit:'km' }),
      q('Any defects or issues observed?', 'text', false),
      q('Photo of any damage (if applicable)', 'photo', false),
    ],
  },
  {
    id:'2', name:'Weekly Inspection', description:'Comprehensive weekly inspection for all fleet vehicles.',
    frequency:'weekly', lastUsed:'2026-02-24', active:true,
    questions:[
      q('Battery terminals clean and secure?'),
      q('Air filter condition acceptable?'),
      q('Power steering fluid level checked?'),
      q('Brake fluid level checked?'),
      q('All tyre pressures within manufacturer spec?'),
      q('Spare tyre present and inflated?'),
      q('Jack and wheel spanner present in vehicle?'),
      q('First aid kit present and stocked?'),
      q('Fire extinguisher present and in date?'),
      q('Warning triangles / hazard kit present?'),
      q('Vehicle registration disc valid and displayed?'),
      q('Roadworthy or COF certificate valid?'),
      q('All mirrors clean and properly adjusted?'),
      q('Windscreen washer fluid topped up?'),
      q('Interior clean — no loose / unsecured items?'),
      q('Seat belt retractors functioning on all seats?'),
      q('No dashboard warning lights illuminated?'),
      q('Exhaust — no excessive smoke or unusual noise?'),
      q('Drive belts — no cracking or fraying visible?'),
      q('Current odometer reading', 'number', true, { unit:'km' }),
      q('Engine hour meter reading', 'number', false, { unit:'hrs' }),
      q('Overall vehicle condition rating', 'select', true, { options:['Excellent','Good','Fair','Poor – action required'] }),
      q('Inspector comments / observations', 'text', false),
      q('Photo of vehicle — front', 'photo', false),
      q('Photo of vehicle — rear', 'photo', false),
    ],
  },
  {
    id:'3', name:'Pre-Trip Checklist', description:'Quick pre-departure safety check before any trip.',
    frequency:'daily', lastUsed:'2026-02-23', active:true,
    questions:[
      q('Driver licence and PDP valid and on person?'),
      q('Vehicle roadworthy certificate valid?'),
      q('Load secured and within legal limits?'),
      q('Route planned and communicated to base?'),
      q('Fuel level sufficient for trip?'),
      q('Tyres visually in good condition?'),
      q('No dashboard warning lights?'),
      q('Mirrors adjusted correctly?'),
      q('Seat belt operational?'),
      q('Mobile phone — hands-free only while driving?'),
      q('Weather conditions suitable for travel?'),
      q('Estimated departure time', 'text', true),
      q('Estimated arrival time', 'text', true),
      q('Destination / site name', 'text', true),
      q('Trip purpose', 'select', true, { options:['Site delivery','Client visit','Parts collection','Staff transport','Training','Other'] }),
      q('Starting odometer reading', 'number', true, { unit:'km' }),
      q('Driver notes or observations', 'text', false),
      q('Photo of vehicle before departure', 'photo', false),
    ],
  },
];

/* ─── TypeBadge ──────────────────────────────────────────────────── */
const TypeBadge: React.FC<{ type: QuestionType; size?: 'sm' | 'xs' }> = ({ type, size = 'sm' }) => {
  const { short, Icon, badge } = QT[type];
  return (
    <span className={`inline-flex items-center gap-1 font-medium rounded-full ${badge} ${
      size === 'xs' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
    }`}>
      <Icon className="h-3 w-3" />{short}
    </span>
  );
};

/* ─── QuestionRow ────────────────────────────────────────────────── */
interface QuestionRowProps {
  question: Question; index: number; total: number;
  onMove: (i: number, dir: -1|1) => void;
  onChange: (id: string, u: Partial<Question>) => void;
  onDelete: (id: string) => void;
}

const QuestionRow: React.FC<QuestionRowProps> = ({ question, index, total, onMove, onChange, onDelete }) => {
  const [expanded, setExpanded] = React.useState(false);
  const hasExtras = question.type === 'select' || question.type === 'number';

  return (
    <div className="group bg-white border border-zinc-200 rounded-xl hover:border-zinc-300 hover:shadow-sm transition-all">
      <div className="flex items-start gap-3 p-3">

        {/* Grip + arrows */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0 pt-1">
          <GripVertical className="h-4 w-4 text-zinc-300 group-hover:text-zinc-400 cursor-grab" />
          <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0}
            className="text-zinc-300 hover:text-zinc-500 disabled:opacity-20 transition-colors">
            <ChevronUp className="h-3 w-3" />
          </button>
          <button type="button" onClick={() => onMove(index, 1)} disabled={index === total - 1}
            className="text-zinc-300 hover:text-zinc-500 disabled:opacity-20 transition-colors">
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Number badge */}
        <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500 flex-shrink-0 mt-0.5 select-none">
          {index + 1}
        </div>

        {/* Question text (inline editable) */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <input
            className="w-full text-sm font-medium text-zinc-800 bg-transparent outline-none rounded-md px-2 py-1 -mx-2 focus:bg-zinc-50 focus:ring-2 focus:ring-sky-300 transition-all"
            value={question.text}
            onChange={e => onChange(question.id, { text: e.target.value })}
            placeholder="Question text…"
          />
          <TypeBadge type={question.type} />
          {question.unit && (
            <span className="ml-1 text-xs text-zinc-400">· unit: {question.unit}</span>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
          {/* Required pill */}
          <button type="button"
            onClick={() => onChange(question.id, { required: !question.required })}
            className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
              question.required
                ? 'bg-sky-50 border-sky-200 text-sky-700'
                : 'bg-zinc-50 border-zinc-200 text-zinc-400 hover:text-zinc-600'
            }`}>
            {question.required ? '● Required' : '○ Optional'}
          </button>

          {/* Expand (for extras) */}
          {hasExtras && (
            <button type="button" onClick={() => setExpanded(e => !e)}
              className={`text-xs px-2 py-1 rounded-md border font-medium transition-all ${
                expanded
                  ? 'bg-zinc-100 border-zinc-300 text-zinc-700'
                  : 'border-zinc-200 text-zinc-400 hover:text-zinc-600'
              }`}>
              {expanded ? 'Close' : 'Options ▾'}
            </button>
          )}

          {/* Delete */}
          <button type="button" onClick={() => onDelete(question.id)}
            className="p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded extras */}
      {expanded && question.type === 'number' && (
        <div className="px-4 pb-3 pt-1 border-t border-zinc-100 flex items-center gap-3">
          <span className="text-xs font-medium text-zinc-500">Unit label</span>
          <input
            className="text-sm border border-zinc-300 rounded-lg px-3 py-1.5 w-28 focus:ring-2 focus:ring-sky-400 outline-none"
            placeholder="e.g. km"
            value={question.unit || ''}
            onChange={e => onChange(question.id, { unit: e.target.value })}
          />
        </div>
      )}

      {expanded && question.type === 'select' && (
        <div className="px-4 pb-3 pt-1 border-t border-zinc-100 space-y-2">
          <p className="text-xs font-medium text-zinc-500">Dropdown options <span className="font-normal text-zinc-400">(one per line)</span></p>
          <textarea
            rows={Math.max(2, (question.options?.length ?? 2))}
            className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-sky-400 outline-none"
            value={(question.options || []).join('\n')}
            onChange={e => onChange(question.id, { options: e.target.value.split('\n') })}
          />
        </div>
      )}
    </div>
  );
};

/* ─── AddQuestionPanel ───────────────────────────────────────────── */
interface AddQuestionPanelProps {
  onAdd: (q: Omit<Question,'id'>) => void;
  onCancel: () => void;
}

const AddQuestionPanel: React.FC<AddQuestionPanelProps> = ({ onAdd, onCancel }) => {
  const [type, setType]         = React.useState<QuestionType>('checkbox');
  const [text, setText]         = React.useState('');
  const [required, setRequired] = React.useState(true);
  const [unit, setUnit]         = React.useState('');
  const [options, setOptions]   = React.useState('Option A\nOption B\nOption C');

  const commit = () => {
    if (!text.trim()) return;
    const extras: Partial<Question> = {};
    if (type === 'number') extras.unit    = unit;
    if (type === 'select') extras.options = options.split('\n').filter(Boolean);
    onAdd({ text: text.trim(), type, required, ...extras });
    setText(''); setType('checkbox'); setRequired(true); setUnit('');
    setOptions('Option A\nOption B\nOption C');
  };

  return (
    <div className="border-2 border-sky-300 rounded-xl bg-sky-50/60 p-4 space-y-4">
      <p className="text-xs font-bold text-sky-700 uppercase tracking-widest">Add Question</p>

      {/* Type picker — visual cards */}
      <div className="grid grid-cols-5 gap-2">
        {(Object.entries(QT) as [QuestionType, typeof QT[QuestionType]][]).map(([key, cfg]) => {
          const Icon = cfg.Icon;
          const sel  = type === key;
          return (
            <button key={key} type="button" onClick={() => setType(key)}
              className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all ${
                sel ? cfg.card : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300'
              }`}>
              <Icon className="h-5 w-5" />
              <span className="text-xs font-semibold leading-tight text-center">{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Question text */}
      <div>
        <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Question text *</label>
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), commit())}
          className="w-full text-sm border border-zinc-300 rounded-xl px-4 py-2.5 bg-white focus:ring-2 focus:ring-sky-400 outline-none shadow-sm"
          placeholder="e.g. Brakes functioning correctly?" />
      </div>

      {/* Extra fields */}
      <div className="flex flex-wrap gap-4 items-end">
        {type === 'number' && (
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Unit</label>
            <input value={unit} onChange={e => setUnit(e.target.value)}
              className="text-sm border border-zinc-300 rounded-xl px-3 py-2 w-24 bg-white focus:ring-2 focus:ring-sky-400 outline-none"
              placeholder="km" />
          </div>
        )}
        {/* Required toggle */}
        <button type="button" onClick={() => setRequired(r => !r)}
          className="flex items-center gap-2 pb-0.5 select-none">
          <div className={`relative w-10 h-5 rounded-full transition-colors ${required ? 'bg-sky-500' : 'bg-zinc-300'}`}>
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${required ? 'translate-x-5' : 'translate-x-0'}`} />
          </div>
          <span className="text-sm font-medium text-zinc-700">Required</span>
        </button>
      </div>

      {type === 'select' && (
        <div>
          <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Options <span className="font-normal text-zinc-400">(one per line)</span></label>
          <textarea rows={3} value={options} onChange={e => setOptions(e.target.value)}
            className="w-full text-sm border border-zinc-300 rounded-xl px-4 py-2.5 resize-none bg-white focus:ring-2 focus:ring-sky-400 outline-none" />
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={commit} disabled={!text.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white text-sm font-semibold rounded-xl hover:bg-sky-700 disabled:opacity-40 transition-colors shadow-sm">
          <Plus className="h-4 w-4" /> Add Question
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 border border-zinc-300 text-zinc-600 text-sm font-medium rounded-xl hover:bg-zinc-50 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
};

/* ─── ToggleSwitch ───────────────────────────────────────────────── */
const ToggleSwitch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
  <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-3 select-none">
    <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-sky-500' : 'bg-zinc-300'}`}>
      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </div>
    <span className="text-sm font-medium text-zinc-700">{label}</span>
  </button>
);

/* ─── Main Component ─────────────────────────────────────────────── */
interface TemplatesProps { user: User; }

const Templates: React.FC<TemplatesProps> = ({ user }) => {
  const [templates, setTemplates]     = React.useState<Template[]>([]);
  const [loading, setLoading]         = React.useState(true);
  const [saveError, setSaveError]     = React.useState<string | null>(null);
  const [saving, setSaving]           = React.useState(false);
  const [showModal, setShowModal]     = React.useState(false);
  const [editing, setEditing]         = React.useState<Template | null>(null);
  const [showAddQ, setShowAddQ]       = React.useState(false);
  const [previewId, setPreviewId]     = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm]   = React.useState('');

  // Form state
  const [formName, setFormName]           = React.useState('');
  const [formDesc, setFormDesc]           = React.useState('');
  const [formFreq, setFormFreq]           = React.useState<Frequency>('daily');
  const [formActive, setFormActive]       = React.useState(true);
  const [formQuestions, setFormQuestions] = React.useState<Question[]>([]);

  // Load templates from DB
  React.useEffect(() => {
    getTemplates()
      .then(rows => setTemplates(rows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        frequency: r.frequency as Frequency,
        questions: r.questions as Question[],
        lastUsed: r.last_used ?? '',
        active: r.active,
      }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openModal = (tpl: Template | null = null) => {
    if (tpl) {
      setEditing(tpl);
      setFormName(tpl.name); setFormDesc(tpl.description);
      setFormFreq(tpl.frequency); setFormActive(tpl.active);
      setFormQuestions(tpl.questions.map(q => ({ ...q })));
    } else {
      setEditing(null);
      setFormName(''); setFormDesc(''); setFormFreq('daily'); setFormActive(true); setFormQuestions([]);
    }
    setShowAddQ(false);
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); setShowAddQ(false); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      const payload = {
        name: formName,
        description: formDesc,
        frequency: formFreq,
        active: formActive,
        questions: formQuestions,
        last_used: new Date().toISOString().slice(0, 10),
        created_by: null as string | null,
      };
      if (editing) {
        const saved = await updateTemplate(editing.id, payload);
        const tpl: Template = { id: saved.id, name: saved.name, description: saved.description, frequency: saved.frequency as Frequency, questions: saved.questions as Question[], lastUsed: saved.last_used ?? '', active: saved.active };
        setTemplates(prev => prev.map(t => t.id === editing.id ? tpl : t));
        if (user) logAction(user.id, user.name, 'Updated', 'Templates', `Updated template "${payload.name}"`);
      } else {
        const saved = await createTemplate(payload);
        const tpl: Template = { id: saved.id, name: saved.name, description: saved.description, frequency: saved.frequency as Frequency, questions: saved.questions as Question[], lastUsed: saved.last_used ?? '', active: saved.active };
        setTemplates(prev => [...prev, tpl]);
        if (user) logAction(user.id, user.name, 'Created', 'Templates', `Created template "${payload.name}" with ${payload.questions?.length ?? 0} questions`);
      }
      closeModal();
    } catch (e: any) {
      setSaveError(e.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const moveQuestion = (i: number, dir: -1|1) => {
    const next = [...formQuestions]; const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setFormQuestions(next);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) =>
    setFormQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));

  const deleteQuestion = (id: string) =>
    setFormQuestions(prev => prev.filter(q => q.id !== id));

  const addQuestion = (newQ: Omit<Question,'id'>) => {
    setFormQuestions(prev => [...prev, { ...newQ, id: makeId() }]);
    setShowAddQ(false);
  };

  const duplicateTemplate = async (tpl: Template) => {
    try {
      const saved = await createTemplate({
        name: `${tpl.name} (Copy)`,
        description: tpl.description,
        frequency: tpl.frequency,
        active: tpl.active,
        questions: tpl.questions.map(q => ({ ...q, id: makeId() })),
        last_used: null,
        created_by: null,
      });
      setTemplates(prev => [...prev, { id: saved.id, name: saved.name, description: saved.description, frequency: saved.frequency as Frequency, questions: saved.questions as Question[], lastUsed: saved.last_used ?? '', active: saved.active }]);
      if (user) logAction(user.id, user.name, 'Created', 'Templates', `Duplicated template "${tpl.name}"`);
    } catch (e: any) {
      alert('Duplicate failed: ' + e.message);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await deleteTemplateDB(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
      if (user) logAction(user.id, user.name, 'Deleted', 'Templates', `Deleted template ${id}`);
    } catch (e: any) {
      alert('Delete failed: ' + e.message);
    }
  };

  if (user?.role !== 'Admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-zinc-400" />
          </div>
          <p className="text-base font-semibold text-zinc-900">Access Restricted</p>
          <p className="text-sm text-zinc-500">Only Admins can manage inspection templates.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading templates…</span>
      </div>
    );
  }

  const filteredTemplates = templates.filter(t =>
    !searchTerm ||
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Inspection Templates</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Build and manage reusable inspection checklists.</p>
        </div>
        <button onClick={() => openModal()}
          className="inline-flex items-center gap-2 bg-sky-600 text-white px-4 py-2.5 rounded-xl hover:bg-sky-700 text-sm font-semibold shadow-sm transition-colors">
          <Plus className="h-4 w-4" /> New Template
        </button>
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
          <input
            type="text"
            placeholder="Search templates by name or description…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Template table */}
      <div className="bg-white rounded-lg shadow">
        {filteredTemplates.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="mx-auto h-12 w-12 text-zinc-400" />
            <h3 className="mt-2 text-lg font-medium text-zinc-900">
              {searchTerm ? 'No templates match your search' : 'No templates yet'}
            </h3>
            <p className="mt-1 text-zinc-500">
              {searchTerm ? 'Try a different keyword.' : 'Create your first inspection template to get started.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Template</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Frequency</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Questions</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">Last Used</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-zinc-200">
                {filteredTemplates.map(tpl => {
                  const freq   = FREQ_STYLE[tpl.frequency];
                  const isOpen = previewId === tpl.id;
                  return (
                    <React.Fragment key={tpl.id}>
                      <tr className="hover:bg-zinc-50">
                        <td className="px-3 py-2">
                          <p className="font-medium text-zinc-900">{tpl.name}</p>
                          {tpl.description && (
                            <p className="text-xs text-zinc-500 mt-0.5 max-w-xs truncate">{tpl.description}</p>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${freq.badge}`}>
                            {freq.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-zinc-600">
                          <span className="inline-flex items-center gap-1">
                            <ClipboardList className="h-3.5 w-3.5 text-zinc-400" />
                            {tpl.questions.length}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${tpl.active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                            <span className="text-xs font-medium text-zinc-600">{tpl.active ? 'Active' : 'Inactive'}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-zinc-500">{tpl.lastUsed || '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setPreviewId(prev => prev === tpl.id ? null : tpl.id)}
                              className="text-xs font-medium text-sky-600 hover:text-sky-800 px-2 py-1 rounded hover:bg-sky-50 transition-colors whitespace-nowrap"
                            >
                              {isOpen ? 'Hide ↑' : 'Preview ↓'}
                            </button>
                            <button type="button" onClick={() => duplicateTemplate(tpl)}
                              className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-all" title="Duplicate">
                              <Copy className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => openModal(tpl)}
                              className="p-1.5 text-sky-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-all" title="Edit">
                              <Edit className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => handleDeleteTemplate(tpl.id)}
                              className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={6} className="bg-zinc-50 px-5 py-4 border-t border-zinc-100">
                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                              Questions ({tpl.questions.length})
                            </p>
                            <ol className="space-y-1.5">
                              {tpl.questions.map((ques, i) => {
                                const { Icon, badge } = QT[ques.type];
                                return (
                                  <li key={ques.id} className="flex items-start gap-2.5 text-sm">
                                    <span className="w-5 h-5 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-500 flex-shrink-0 mt-0.5">
                                      {i + 1}
                                    </span>
                                    <span className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium ${badge}`}>
                                      <Icon className="h-2.5 w-2.5" />
                                    </span>
                                    <span className="text-zinc-700 flex-1 leading-snug">{ques.text}</span>
                                    {ques.required && <span className="text-red-400 font-bold flex-shrink-0 text-xs">*</span>}
                                  </li>
                                );
                              })}
                            </ol>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Editor Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">
                  {editing ? 'Edit Template' : 'New Template'}
                </h3>
                {editing && (
                  <p className="text-xs text-zinc-500 mt-0.5">{editing.name}</p>
                )}
              </div>
              <button type="button" onClick={closeModal}
                className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-all">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
              {/* Two-panel body */}
              <div className="flex flex-col md:flex-row flex-1 min-h-0">

                {/* ── Left panel: settings ── */}
                <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-zinc-200 flex flex-col flex-shrink-0">
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Template Name *</label>
                      <input required value={formName} onChange={e => setFormName(e.target.value)}
                        className="w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-400 outline-none"
                        placeholder="e.g., Daily Vehicle Check" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Description</label>
                      <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={3}
                        className="w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-sm resize-none focus:ring-2 focus:ring-sky-400 outline-none"
                        placeholder="When is this template used?" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Frequency *</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['daily','weekly','monthly','custom'] as Frequency[]).map(f => (
                          <button key={f} type="button" onClick={() => setFormFreq(f)}
                            className={`py-2 px-3 rounded-xl border-2 text-sm font-semibold capitalize transition-all ${
                              formFreq === f
                                ? `${FREQ_STYLE[f].badge} border-current`
                                : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 bg-white'
                            }`}>
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Status</label>
                      <ToggleSwitch
                        checked={formActive}
                        onChange={setFormActive}
                        label={formActive ? 'Active' : 'Inactive'}
                      />
                    </div>

                    {/* Stats summary */}
                    <div className="bg-zinc-50 rounded-xl p-4 space-y-2">
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Summary</p>
                      <p className="text-2xl font-bold text-zinc-900">{formQuestions.length}</p>
                      <p className="text-xs text-zinc-500">questions total</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(Object.keys(QT) as QuestionType[]).map(type => {
                          const count = formQuestions.filter(q => q.type === type).length;
                          if (!count) return null;
                          return <TypeBadge key={type} type={type} size="xs" />;
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Right panel: question builder ── */}
                <div className="flex-1 flex flex-col min-h-0 min-w-0">
                  {/* Q builder toolbar */}
                  <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 bg-zinc-50 flex-shrink-0">
                    <span className="text-sm font-bold text-zinc-700">
                      Questions <span className="font-normal text-zinc-400">({formQuestions.length})</span>
                    </span>
                    {!showAddQ && (
                      <button type="button" onClick={() => setShowAddQ(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-lg hover:bg-sky-700 transition-colors shadow-sm">
                        <Plus className="h-3.5 w-3.5" /> Add Question
                      </button>
                    )}
                  </div>

                  {/* Scrollable question list */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {formQuestions.length === 0 && !showAddQ && (
                      <div className="flex flex-col items-center justify-center h-48 text-center space-y-3">
                        <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center">
                          <ClipboardList className="h-7 w-7 text-zinc-400" />
                        </div>
                        <p className="text-sm font-medium text-zinc-500">No questions yet</p>
                        <p className="text-xs text-zinc-400">Click "Add Question" to start building this template.</p>
                      </div>
                    )}

                    {formQuestions.map((ques, i) => (
                      <QuestionRow key={ques.id}
                        question={ques} index={i} total={formQuestions.length}
                        onMove={moveQuestion} onChange={updateQuestion} onDelete={deleteQuestion} />
                    ))}

                    {showAddQ && (
                      <AddQuestionPanel onAdd={addQuestion} onCancel={() => setShowAddQ(false)} />
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-zinc-200 flex items-center justify-between flex-shrink-0 bg-zinc-50 rounded-b-2xl">
                <div>
                  <span className="text-xs text-zinc-400">
                    {formQuestions.filter(q => q.required).length} required ·{' '}
                    {formQuestions.filter(q => !q.required).length} optional
                  </span>
                  {saveError && (
                    <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />{saveError}
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={closeModal}
                    className="px-4 py-2.5 border border-zinc-300 rounded-xl text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 text-white rounded-xl text-sm font-semibold hover:bg-sky-700 transition-colors shadow-sm disabled:opacity-60">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {editing ? 'Save Changes' : 'Create Template'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Templates;
