import React, { useState, useEffect } from 'react';
import {
  Shield, Info, Save, RotateCcw, Loader2, CheckCircle2,
  Sliders, SlidersHorizontal, Check, X, AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  PROCTORING_FEATURES,
  STRICTNESS_LEVELS,
} from '../proctoringConfig';

const TEMPLATE_KEYS = ['lenient', 'balanced', 'strict'];

const TEMPLATE_METADATA = {
  lenient: {
    label: 'Lenient Template',
    badge: 'Low-Stakes / Practice',
    color: '#22c55e',
    borderColor: 'border-emerald-300',
    bgActive: 'bg-emerald-50/70',
    tagBg: 'bg-emerald-100 text-emerald-800',
    description: 'Relaxed monitoring for practice assessments or formative evaluations. Flags only sustained, obvious violations.',
  },
  balanced: {
    label: 'Balanced Template',
    badge: 'Standard / Recommended',
    color: '#eab308',
    borderColor: 'border-amber-300',
    bgActive: 'bg-amber-50/70',
    tagBg: 'bg-amber-100 text-amber-800',
    description: 'Recommended default for general hiring and corporate evaluations. Balances cheating prevention with anti-false-positive guards.',
  },
  strict: {
    label: 'Strict Template',
    badge: 'High-Security / Exam',
    color: '#ef4444',
    borderColor: 'border-rose-300',
    bgActive: 'bg-rose-50/70',
    tagBg: 'bg-rose-100 text-rose-800',
    description: 'High-security exam mode. Rapid deviation flags and tight strike limits for certification or high-stakes screening.',
  },
};

const DEFAULT_FEATURE_TOGGLES = {
  lenient: {
    full_screen: true,
    tab_switch: true,
    multiple_people: true,
    face_not_visible: true,
    eye_tracking: false,
    head_turn: false,
    audio_detect: false,
    block_paste: true,
  },
  balanced: {
    full_screen: true,
    tab_switch: true,
    multiple_people: true,
    face_not_visible: true,
    eye_tracking: true,
    head_turn: true,
    audio_detect: true,
    block_paste: true,
  },
  strict: {
    full_screen: true,
    tab_switch: true,
    multiple_people: true,
    face_not_visible: true,
    eye_tracking: true,
    head_turn: true,
    audio_detect: true,
    block_paste: true,
  },
};

const THRESHOLD_LABELS = {
  max_strikes:                 { label: 'Max Strikes before Termination', unit: 'strikes', desc: 'Number of violations before test is automatically terminated.' },
  gaze_averted_sustain_ms:     { label: 'Gaze Away Sustain', unit: 'ms', desc: 'Duration off-screen looking is tolerated before triggering a strike.' },
  head_turn_sustain_ms:        { label: 'Head Turn Sustain', unit: 'ms', desc: 'Duration of excessive head turn tolerated before flagging.' },
  face_missing_sustain_ms:     { label: 'Face Missing Sustain', unit: 'ms', desc: 'Duration candidate face can be missing from webcam.' },
  multiple_people_min_samples: { label: 'Multi-Face Sample Threshold', unit: 'samples', desc: 'Consecutive detection frames required to flag extra people.' },
  voice_sustain_ms:            { label: 'Voice / Murmur Sustain', unit: 'ms', desc: 'Duration of detected voice audio needed to issue a strike.' },
  tab_switch_cooldown_ms:      { label: 'Tab Switch Cooldown', unit: 'ms', desc: 'Cooldown window between consecutive tab switch strikes.' },
};

export default function ProctoringSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('balanced');

  const [templates, setTemplates] = useState(() => {
    const init = {};
    TEMPLATE_KEYS.forEach(key => {
      init[key] = {
        toggles: { ...DEFAULT_FEATURE_TOGGLES[key] },
        thresholds: { ...STRICTNESS_LEVELS[key] },
      };
    });
    return init;
  });

  // ── Load Saved Template Settings on Mount ──────────────────────────────────
  useEffect(() => {
    fetch('/api/verify/builder/proctoring-settings', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!d.success) return;
        const pd = d.data?.proctoring_defaults || {};

        setTemplates(prev => {
          const next = { ...prev };

          // If structured templates exist
          if (pd.templates) {
            TEMPLATE_KEYS.forEach(key => {
              if (pd.templates[key]) {
                next[key] = {
                  toggles: { ...next[key].toggles, ...(pd.templates[key].toggles || {}) },
                  thresholds: { ...next[key].thresholds, ...(pd.templates[key].thresholds || {}) },
                };
              }
            });
          } else {
            // Backwards compatibility with legacy flat format
            if (pd.feature_toggles) {
              TEMPLATE_KEYS.forEach(key => {
                next[key].toggles = { ...next[key].toggles, ...pd.feature_toggles };
              });
            }
            if (pd.custom_thresholds) {
              TEMPLATE_KEYS.forEach(key => {
                if (pd.custom_thresholds[key]) {
                  next[key].thresholds = { ...next[key].thresholds, ...pd.custom_thresholds[key] };
                }
              });
            }
          }

          return next;
        });
      })
      .catch(() => toast.error('Could not load proctoring templates'))
      .finally(() => setLoading(false));
  }, []);

  // ── Save All Templates ────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/verify/builder/proctoring-settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proctoring_defaults: {
            templates,
            // also persist legacy keys for backwards-compatibility
            global_strictness: activeTab,
            feature_toggles: templates.balanced.toggles,
            custom_thresholds: {
              lenient: templates.lenient.thresholds,
              balanced: templates.balanced.thresholds,
              strict: templates.strict.thresholds,
            },
          },
        }),
      });
      const d = await res.json();
      if (d.success) toast.success('Proctoring templates saved successfully!');
      else toast.error(d.detail || 'Failed to save templates');
    } catch {
      toast.error('Network error while saving templates');
    } finally {
      setSaving(false);
    }
  };

  // ── Reset Specific Template ───────────────────────────────────────────────
  const resetTemplate = (key) => {
    setTemplates(prev => ({
      ...prev,
      [key]: {
        toggles: { ...DEFAULT_FEATURE_TOGGLES[key] },
        thresholds: { ...STRICTNESS_LEVELS[key] },
      },
    }));
    toast.success(`${TEMPLATE_METADATA[key].label} reset to defaults`);
  };

  const toggleFeature = (templateKey, featureKey) => {
    setTemplates(prev => ({
      ...prev,
      [templateKey]: {
        ...prev[templateKey],
        toggles: {
          ...prev[templateKey].toggles,
          [featureKey]: !prev[templateKey].toggles[featureKey],
        },
      },
    }));
  };

  const setAllFeatures = (templateKey, enable) => {
    setTemplates(prev => {
      const nextToggles = {};
      PROCTORING_FEATURES.forEach(f => { nextToggles[f.key] = enable; });
      return {
        ...prev,
        [templateKey]: {
          ...prev[templateKey],
          toggles: nextToggles,
        },
      };
    });
  };

  const setThresholdVal = (templateKey, thresholdKey, val) => {
    setTemplates(prev => ({
      ...prev,
      [templateKey]: {
        ...prev[templateKey],
        thresholds: {
          ...prev[templateKey].thresholds,
          [thresholdKey]: Number(val),
        },
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-purple-600" size={28} />
      </div>
    );
  }

  const currentTemplate = templates[activeTab] || templates.balanced;
  const currentMeta = TEMPLATE_METADATA[activeTab] || TEMPLATE_METADATA.balanced;
  const activeFeaturesCount = Object.values(currentTemplate.toggles || {}).filter(Boolean).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-4 px-2 light-theme-override text-gray-900">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-purple-50 text-purple-700 border border-purple-100 shadow-xs">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              Proctoring Templates & Policy Configuration
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Customize the 3 proctoring strictness templates. Configure feature toggles and threshold limits applied when assigning assessments.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving Templates…' : 'Save All Templates'}
        </button>
      </div>

      {/* 3 Template Cards Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TEMPLATE_KEYS.map(key => {
          const meta = TEMPLATE_METADATA[key];
          const templ = templates[key];
          const isSelected = activeTab === key;
          const enabledCount = Object.values(templ.toggles || {}).filter(Boolean).length;
          const strikes = templ.thresholds?.max_strikes ?? STRICTNESS_LEVELS[key].max_strikes;

          return (
            <div
              key={key}
              onClick={() => setActiveTab(key)}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 shadow-xs ${
                isSelected
                  ? `${meta.borderColor} ${meta.bgActive} ring-2 ring-purple-100 shadow-sm`
                  : 'bg-white border-gray-200 hover:border-gray-300 opacity-80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${meta.tagBg}`}>
                    {meta.badge}
                  </span>
                  {isSelected && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-purple-700">
                      <CheckCircle2 size={13} /> Editing
                    </span>
                  )}
                </div>
                <h3 className="text-base font-extrabold text-gray-900" style={{ color: meta.color }}>
                  {meta.label}
                </h3>
                <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                  {meta.description}
                </p>
              </div>

              <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-xs text-gray-600 font-semibold">
                <span>{enabledCount} of {PROCTORING_FEATURES.length} Features Active</span>
                <span className="text-gray-900 font-bold">Max {strikes} Strikes</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Template Customization Workspace */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-6">
        
        {/* Workspace Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentMeta.color }} />
              <h2 className="text-lg font-bold text-gray-900">
                Customizing: <span style={{ color: currentMeta.color }}>{currentMeta.label}</span>
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {currentMeta.description}
            </p>
          </div>

          <button
            onClick={() => resetTemplate(activeTab)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:text-purple-700 hover:bg-gray-50 transition-colors self-start sm:self-auto"
          >
            <RotateCcw size={13} /> Reset to Defaults
          </button>
        </div>

        {/* 2-Column Configuration: Features (Left) & Thresholds (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Feature Toggles */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders size={14} className="text-purple-600" />
                  Monitored Features ({activeFeaturesCount} of {PROCTORING_FEATURES.length} Enabled)
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Enable or disable specific security checks for this template.</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setAllFeatures(activeTab, true)}
                  className="text-[11px] font-semibold text-purple-600 hover:text-purple-800"
                >
                  All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => setAllFeatures(activeTab, false)}
                  className="text-[11px] font-semibold text-gray-400 hover:text-gray-600"
                >
                  None
                </button>
              </div>
            </div>

            <div className="space-y-2.5 bg-gray-50/70 p-3 rounded-2xl border border-gray-200/80">
              {PROCTORING_FEATURES.map(f => {
                const isEnabled = !!currentTemplate.toggles?.[f.key];
                return (
                  <div
                    key={f.key}
                    onClick={() => toggleFeature(activeTab, f.key)}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      isEnabled
                        ? 'bg-white border-purple-200 shadow-xs'
                        : 'bg-white/60 border-gray-200 opacity-60'
                    }`}
                  >
                    <div className="flex-1 pr-2">
                      <p className={`text-xs font-bold ${isEnabled ? 'text-gray-900' : 'text-gray-500'}`}>
                        {f.label}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">
                        {f.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFeature(activeTab, f.key);
                      }}
                      className={`relative w-10 h-5.5 rounded-full transition-colors focus:outline-none shrink-0 ${
                        isEnabled ? 'bg-purple-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${
                        isEnabled ? 'translate-x-4.5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Fine-Tune Thresholds */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal size={14} className="text-indigo-600" />
                Fine-Tune Threshold Limits
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Customize sensitivity sustain durations and strike tolerances.</p>
            </div>

            <div className="space-y-3 bg-gray-50/70 p-3 rounded-2xl border border-gray-200/80">
              {Object.entries(THRESHOLD_LABELS).map(([key, { label, unit, desc }]) => {
                const currentVal = currentTemplate.thresholds?.[key] ?? STRICTNESS_LEVELS[activeTab][key];
                const defVal = STRICTNESS_LEVELS[activeTab][key];
                const isModified = currentVal !== defVal;

                return (
                  <div key={key} className="p-3 bg-white rounded-xl border border-gray-200 shadow-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-gray-800">{label}</span>
                        <p className="text-[10px] text-gray-400">{desc}</p>
                      </div>
                      {isModified && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800" title={`Default: ${defVal} ${unit}`}>
                          Modified (def: {defVal})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="number"
                        min={0}
                        step={unit === 'ms' ? 500 : 1}
                        value={currentVal}
                        onChange={e => setThresholdVal(activeTab, key, e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-800 font-semibold focus:bg-white focus:border-purple-400 focus:ring-1 focus:ring-purple-100 outline-none"
                      />
                      <span className="text-xs text-gray-400 font-semibold shrink-0 min-w-[45px]">
                        {unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* Bottom Save Bar */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-200">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Info size={14} className="text-purple-600" />
          <span>These template configurations will be automatically used when dispatching assessments with the corresponding strictness level.</span>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

    </div>
  );
}
