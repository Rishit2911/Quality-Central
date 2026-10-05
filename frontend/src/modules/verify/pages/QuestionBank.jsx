import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Loader2, RefreshCw, Filter, Trash2, Edit3, Search, UploadCloud, Library, Folder, Link as LinkIcon, FolderOpen, Tag, X, FileJson, Copy, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import HorizontalLoader from '../../../core/components/HorizontalLoader';
import useEscapeClose from '../../../core/hooks/useEscapeClose';
import useOverlayClose from '../../../core/hooks/useOverlayClose';
import { useAuth } from '../../../core/auth/AuthContext';
import { createPortal } from 'react-dom';

const QTYPES = [
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'mcq_multi', label: 'Multiple Select' },
  { value: 'written', label: 'Written Answer' },
  { value: 'coding', label: 'Coding' },
  { value: 'file_upload', label: 'File Upload' }
];

function Modal({ onClose, title, children, maxWidth = "max-w-lg" }) {
  useEscapeClose(onClose);
  const overlayHandlers = useOverlayClose(onClose);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" {...overlayHandlers}>
      <div className={`bg-white text-gray-900 rounded-2xl w-full ${maxWidth} p-8 relative shadow-2xl border border-gray-200 my-8 light-theme-override`} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  ,
    document.body
  );
}

function ImportModal({ onClose, onImport, uniqueTopics }) {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [topic, setTopic] = useState('');
  const [tags, setTags] = useState('');
  const [preview, setPreview] = useState(null); // null = not extracted, [] = extracted list

  const handleExtract = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Please select a file');
    setImporting(true);
    const fd = new FormData();
    fd.append('file', file);
    if (topic.trim()) fd.append('topic', topic.trim());
    if (tags.trim()) fd.append('tags', tags.trim());

    try {
      const r = await fetch('/api/verify/question-bank/import-file', {
        method: 'POST', credentials: 'include', body: fd
      });
      const d = await r.json();
      if (r.ok && d.data) {
        setPreview(d.data);
        toast.success(`AI extracted ${d.data.length} questions — review before saving.`);
      } else {
        toast.error(d.detail || 'No questions could be extracted');
      }
    } catch {
      toast.error('Network error during extraction');
    } finally {
      setImporting(false);
    }
  };

  const handleSave = async () => {
    if (!preview?.length) return;
    setImporting(true);
    try {
      const r = await fetch('/api/verify/question-bank/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items: preview })
      });
      const d = await r.json();
      if (r.ok) {
        toast.success(d.message);
        onImport();
        onClose();
      } else {
        toast.error(d.detail || 'Save failed');
      }
    } catch {
      toast.error('Network error during save');
    } finally {
      setImporting(false);
    }
  };

  const removePreviewItem = (idx) => setPreview(prev => prev.filter((_, i) => i !== idx));
  const updatePreviewItem = (idx, field, val) =>
    setPreview(prev => prev.map((q, i) => i === idx ? { ...q, [field]: val } : q));

  // Preview step
  if (preview) {
    return (
      <Modal onClose={onClose} title={`Review Extracted Questions (${preview.length})`}>
        <p className="text-xs text-gray-500 mb-4">
          Review the AI-extracted questions below. Edit or delete any incorrect entries before saving to the bank.
        </p>
        <div className="max-h-[50vh] overflow-y-auto space-y-3 mb-4 pr-1">
          {preview.length === 0 && <p className="text-sm text-gray-400 text-center py-8">All questions removed.</p>}
          {preview.map((q, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl p-4 bg-gray-50 relative">
              <button onClick={() => removePreviewItem(idx)} className="absolute top-3 right-3 p-1 rounded-lg text-rose-500 hover:bg-rose-50"><X size={13}/></button>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full uppercase">{q.question_type}</span>
                <span className="text-[10px] text-gray-400">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
              </div>
              <textarea
                value={q.question_text}
                onChange={e => updatePreviewItem(idx, 'question_text', e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 outline-none resize-y min-h-[100px]"
                ref={el => {
                          if (el) {
                            el.style.height = 'auto';
                            el.style.height = (el.scrollHeight) + 'px';
                          }
                        }}
                        onInput={e => {
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
              />
              {(q.question_type === 'mcq' || q.question_type === 'mcq_multi') && (
                <p className="text-[10px] text-gray-400 mt-1">✓ Correct: {q.correct_answer}</p>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={() => setPreview(null)} className="px-4 py-2 rounded-xl text-gray-500 font-medium hover:bg-gray-100 text-sm">← Back</button>
          <button onClick={handleSave} disabled={importing || preview.length === 0} className="flex items-center gap-2 px-6 py-2 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 text-sm">
            {importing ? <Loader2 size={16} className="animate-spin" /> : `Save ${preview.length} to Bank`}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="Import Questions with AI">
      <form onSubmit={handleExtract} className="flex flex-col gap-5">
        <p className="text-sm text-gray-600">
          Upload a <span className="font-medium">PDF, Word, Excel, CSV, or JSON</span> file. AI will extract questions for you to review before saving.
        </p>
        <div className="border-2 border-dashed border-purple-200 rounded-xl p-8 text-center bg-purple-50">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept=".pdf,.txt,.docx,.doc,.xlsx,.xls,.csv,.json"
            onChange={e => setFile(e.target.files[0])}
          />
          <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
            <UploadCloud size={32} className="text-purple-500" />
            <span className="text-sm font-medium text-purple-700">
              {file ? file.name : "Click to select a file"}
            </span>
            <span className="text-xs text-gray-400">PDF, Word, Excel, CSV, JSON</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Topic Folder (Optional)</label>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              list="topic-list"
              className="w-full bg-gray-50 text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none"
              placeholder="e.g. Java Basics"
            />
            <datalist id="topic-list">
              {uniqueTopics.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Tags (Optional)</label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="w-full bg-gray-50 text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none"
              placeholder="Comma separated"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-gray-500 font-medium hover:bg-gray-100">Cancel</button>
          <button type="submit" disabled={importing || !file} className="flex items-center gap-2 px-6 py-2 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50">
            {importing ? <Loader2 size={16} className="animate-spin" /> : "Extract & Preview"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ImportUrlModal({ onClose, onImport, uniqueTopics }) {
  const [url, setUrl] = useState('');
  const [topic, setTopic] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);

  const handleExtract = async () => {
    if (!url.trim()) { toast.error('URL required'); return; }
    setSaving(true);
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const r = await fetch('/api/verify/question-bank/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: url.trim(), topic: topic.trim() || null, tags: tags.length ? tags : null })
      });
      const res = await r.json();
      if (r.ok && res.data) {
        setPreview(res.data);
        toast.success(`AI extracted ${res.data.length} question(s) — review before saving.`);
      } else {
        toast.error(res.detail || 'Failed to extract from URL');
      }
    } catch {
      toast.error('Network error during extraction');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!preview?.length) return;
    setSaving(true);
    try {
      const r = await fetch('/api/verify/question-bank/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items: preview })
      });
      const d = await r.json();
      if (r.ok) {
        toast.success(d.message);
        onImport();
        onClose();
      } else {
        toast.error(d.detail || 'Save failed');
      }
    } catch {
      toast.error('Network error during save');
    } finally {
      setSaving(false);
    }
  };

  const removePreviewItem = (idx) => setPreview(prev => prev.filter((_, i) => i !== idx));
  const updatePreviewItem = (idx, field, val) =>
    setPreview(prev => prev.map((q, i) => i === idx ? { ...q, [field]: val } : q));

  if (preview) {
    return (
      <Modal onClose={onClose} title={`Review URL Questions (${preview.length})`}>
        <p className="text-xs text-gray-500 mb-4">
          Review the AI-extracted questions below. Edit or delete any incorrect entries before saving to the bank.
        </p>
        <div className="max-h-[50vh] overflow-y-auto space-y-3 mb-4 pr-1">
          {preview.length === 0 && <p className="text-sm text-gray-400 text-center py-8">All questions removed.</p>}
          {preview.map((q, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl p-4 bg-gray-50 relative">
              <button onClick={() => removePreviewItem(idx)} className="absolute top-3 right-3 p-1 rounded-lg text-rose-500 hover:bg-rose-50"><X size={13}/></button>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full uppercase">{q.question_type}</span>
                <span className="text-[10px] text-gray-400">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
              </div>
              <textarea
                value={q.question_text}
                onChange={e => updatePreviewItem(idx, 'question_text', e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-300 outline-none resize-y min-h-[100px]"
                ref={el => {
                          if (el) {
                            el.style.height = 'auto';
                            el.style.height = (el.scrollHeight) + 'px';
                          }
                        }}
                        onInput={e => {
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
              />
              {q.question_type === 'coding' && (
                <div className="mt-2 text-[10px] text-gray-500 font-mono bg-white p-2 border border-gray-200 rounded">
                  {q.starter_code ? 'Starter code included' : 'No starter code'}
                  {q.test_cases?.length > 0 ? ` | ${q.test_cases.length} test cases` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={() => setPreview(null)} className="px-4 py-2 rounded-xl text-gray-500 font-medium hover:bg-gray-100 text-sm">← Back</button>
          <button onClick={handleSave} disabled={saving || preview.length === 0} className="flex items-center gap-2 px-6 py-2 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 text-sm">
            {saving ? <Loader2 size={16} className="animate-spin" /> : `Save ${preview.length} to Bank`}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="Import from URL">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-gray-600">
          Paste a URL to a coding problem (<span className="font-semibold text-purple-600">LeetCode</span> / <span className="font-semibold text-orange-500">HackerRank</span>) or any web page. The AI will extract questions for you to review.
        </p>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Page URL <span className="text-red-500">*</span></label>
          <input 
            type="url" 
            value={url} 
            onChange={e=>setUrl(e.target.value)} 
            className="w-full bg-gray-50 text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none"
            placeholder="https://leetcode.com/problems/..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Topic Folder (Optional)</label>
            <input 
              type="text" 
              value={topic} 
              onChange={e=>setTopic(e.target.value)} 
              list="topic-list-url"
              className="w-full bg-gray-50 text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none"
              placeholder="e.g. DSA"
            />
            <datalist id="topic-list-url">
              {uniqueTopics.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Tags (Optional)</label>
            <input 
              type="text" 
              value={tagsInput} 
              onChange={e=>setTagsInput(e.target.value)} 
              className="w-full bg-gray-50 text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none"
              placeholder="Comma separated"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-gray-500 font-medium hover:bg-gray-100">Cancel</button>
          <button type="button" onClick={handleExtract} disabled={saving || !url.trim()} className="flex items-center gap-2 px-6 py-2 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : "Extract & Preview"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ManualEntryModal({ onClose, onSaved, uniqueTopics, initialData = null }) {
  const parseTags = (t) => {
    if (Array.isArray(t)) return t.filter(x => x && String(x).toLowerCase() !== 'extracted' && String(x).toLowerCase() !== 'extracted_tag');
    if (typeof t === 'string') {
      try {
        const p = JSON.parse(t);
        if (Array.isArray(p)) return p.filter(x => x && String(x).toLowerCase() !== 'extracted' && String(x).toLowerCase() !== 'extracted_tag');
      } catch {}
      return t.split(',').map(s => s.trim()).filter(x => x && x.toLowerCase() !== 'extracted' && x.toLowerCase() !== 'extracted_tag');
    }
    return [];
  };

  const parseOptions = (opts) => {
    if (Array.isArray(opts)) return opts;
    if (typeof opts === 'string') {
      try {
        const p = JSON.parse(opts);
        if (Array.isArray(p)) return p;
      } catch {}
    }
    return ['', '', '', ''];
  };

  const parseTestCases = (tc) => {
    if (Array.isArray(tc)) return tc;
    if (typeof tc === 'string') {
      try {
        const p = JSON.parse(tc);
        if (Array.isArray(p)) return p;
      } catch {}
    }
    return [];
  };

  const [form, setForm] = useState({
    question_text: initialData?.question_text || '',
    question_type: initialData?.question_type || 'mcq',
    options: parseOptions(initialData?.options),
    correct_answer: initialData?.correct_answer || '',
    model_answer: initialData?.model_answer || '',
    marks: initialData?.marks || 1,
    topic: initialData?.topic || '',
    tags: parseTags(initialData?.tags),
    starter_code: initialData?.starter_code || '',
    programming_language: initialData?.programming_language || 'python',
    test_cases: parseTestCases(initialData?.test_cases)
  });
  
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({...f, [k]:v}));

  const addTagsFromString = (str) => {
    if (!str || !str.trim()) return;
    const incoming = str.split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'extracted' && s.toLowerCase() !== 'extracted_tag');
    if (!incoming.length) return;
    const merged = [...(form.tags || [])];
    incoming.forEach(tag => {
      if (!merged.includes(tag)) {
        merged.push(tag);
      }
    });
    set('tags', merged);
    setTagInput('');
  };

  const save = async () => {
    if(!form.question_text.trim()) { toast.error('Question text required'); return; }
    
    let currentTags = [...(form.tags || [])];
    if (tagInput.trim()) {
      const incoming = tagInput.split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'extracted' && s.toLowerCase() !== 'extracted_tag');
      incoming.forEach(tag => {
        if (!currentTags.includes(tag)) currentTags.push(tag);
      });
    }

    setSaving(true);
    const payload = { ...form, tags: currentTags, topic: form.topic.trim() || null };
    
    try {
      const url = initialData ? `/api/verify/question-bank/${initialData.id}` : '/api/verify/question-bank';
      const method = initialData ? 'PUT' : 'POST';
      
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const d = await r.json();
      if (r.ok) {
        toast.success(initialData ? 'Question updated' : 'Added to bank');
        onSaved();
      } else {
        toast.error(d.detail || 'Operation failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title={initialData ? "Edit Question" : "Add to Question Bank"} maxWidth="max-w-3xl">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Question Type</label>
            <select className="w-full bg-gray-50 text-gray-900 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-purple-400 outline-none" value={form.question_type} onChange={e=>set('question_type',e.target.value)}>
              {QTYPES.map(t=><option key={t.value} value={t.value} className="bg-white text-gray-900">{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Topic Folder</label>
            <input type="text" list="topic-list-manual" className="w-full bg-gray-50 text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-purple-400 outline-none" value={form.topic} onChange={e=>set('topic',e.target.value)} placeholder="e.g. React" />
            <datalist id="topic-list-manual">
              {uniqueTopics.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marks</label>
            <input type="number" className="w-full bg-gray-50 text-gray-900 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-purple-400 outline-none" min={0.5} step={0.5} value={form.marks} onChange={e=>set('marks',parseFloat(e.target.value))} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Question Text <span className="text-red-500">*</span></label>
          <textarea className="w-full bg-gray-50 text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-purple-400 outline-none" rows={4} value={form.question_text} onChange={e=>set('question_text',e.target.value)} placeholder="Enter question..." />
        </div>

        {(form.question_type==='mcq'||form.question_type==='mcq_multi') && (
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
            <label className="block text-sm font-medium text-gray-700 mb-3">Options</label>
            {(form.options||[]).map((opt,oi)=>(
              <div key={oi} className="flex items-center gap-3 mb-2">
                <input 
                  type={form.question_type==='mcq'?'radio':'checkbox'} 
                  className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                  checked={form.question_type==='mcq' ? form.correct_answer===opt : (() => { try { return JSON.parse(form.correct_answer||'[]').includes(opt); } catch { return false; } })()} 
                  onChange={()=>{
                    if(form.question_type==='mcq') set('correct_answer',opt);
                    else { 
                      try { 
                        let a=JSON.parse(form.correct_answer||'[]'); 
                        a=a.includes(opt)?a.filter(x=>x!==opt):[...a,opt]; 
                        set('correct_answer',JSON.stringify(a)); 
                      } catch { 
                        set('correct_answer',JSON.stringify([opt])); 
                      } 
                    }
                  }} 
                />
                <input className="flex-1 bg-white text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-400" value={opt} onChange={e=>{const o=[...form.options];o[oi]=e.target.value;set('options',o);}} placeholder={`Option ${String.fromCharCode(65+oi)}`}/>
                <button type="button" className="p-2 text-gray-400 hover:text-rose-500" onClick={()=>set('options',form.options.filter((_,i)=>i!==oi))}><Trash2 size={16}/></button>
              </div>
            ))}
            <button type="button" className="mt-2 text-sm font-medium text-purple-600 flex items-center gap-1 hover:text-purple-700" onClick={()=>set('options',[...form.options,''])}><Plus size={14}/> Add Option</button>
          </div>
        )}

        {form.question_type==='written' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model Answer</label>
            <textarea className="w-full bg-gray-50 text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-purple-400 outline-none" rows={3} value={form.model_answer} onChange={e=>set('model_answer',e.target.value)} placeholder="Ideal answer to guide grading..." />
          </div>
        )}

        {form.question_type==='coding' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Starter Code (Python)</label>
              <textarea className="w-full bg-gray-900 text-green-400 font-mono border border-gray-800 rounded-lg px-3 py-2 text-sm outline-none h-32" value={form.starter_code} onChange={e=>set('starter_code',e.target.value)} placeholder="def solve():\n    pass" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Cases (JSON List)</label>
              <textarea className="w-full bg-gray-900 text-blue-400 font-mono border border-gray-800 rounded-lg px-3 py-2 text-sm outline-none h-32" value={typeof form.test_cases === 'string' ? form.test_cases : JSON.stringify(form.test_cases, null, 2)} onChange={e=>set('test_cases',e.target.value)} placeholder='[{"input":"...", "expected_output":"..."}]' />
              <p className="text-xs text-gray-500 mt-1">Must be valid JSON array of objects</p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Tag size={14} /> Tags</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {(form.tags || []).map((tag,ti)=>(
              <span key={ti} className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                #{tag}
                <button type="button" onClick={()=>set('tags',form.tags.filter((_,i)=>i!==ti))} className="hover:text-purple-900"><X size={12}/></button>
              </span>
            ))}
          </div>
          <input 
            className="w-full bg-gray-50 text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-purple-400 outline-none" 
            value={tagInput} 
            onChange={e => {
              const val = e.target.value;
              if (val.includes(',')) {
                addTagsFromString(val);
              } else {
                setTagInput(val);
              }
            }} 
            placeholder="Type tag and press Enter (or separate by commas)"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTagsFromString(tagInput);
              }
            }}
            onBlur={() => addTagsFromString(tagInput)}
          />
        </div>

        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
          <button type="button" className="px-4 py-2 rounded-xl text-gray-500 font-medium hover:bg-gray-100" onClick={onClose}>Cancel</button>
          <button type="button" className="px-6 py-2 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50" onClick={save} disabled={saving}>{saving?'Saving...':(initialData ? 'Update Question' : 'Add to Bank')}</button>
        </div>
      </div>
    </Modal>
  );
}

export default function QuestionBank() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('verify.questions.manage');

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedTag, setSelectedTag] = useState(null);

  // Modals
  const [showImport, setShowImport] = useState(false);
  const [showImportUrl, setShowImportUrl] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [editQuestion, setEditQuestion] = useState(null);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/verify/question-bank', { credentials: 'include' });
      const d = await r.json();
      const raw = d.data || [];
      const formatted = raw.map(q => {
        let tags = q.tags;
        if (typeof tags === 'string') {
          try { tags = JSON.parse(tags); } catch { tags = tags.split(',').map(s=>s.trim()).filter(Boolean); }
        }
        if (!Array.isArray(tags)) tags = [];

        let options = q.options;
        if (typeof options === 'string') {
          try { options = JSON.parse(options); } catch { options = []; }
        }

        let test_cases = q.test_cases;
        if (typeof test_cases === 'string') {
          try { test_cases = JSON.parse(test_cases); } catch { test_cases = []; }
        }

        return {
          ...q,
          tags: tags.filter(t => t && String(t).toLowerCase() !== 'extracted' && String(t).toLowerCase() !== 'extracted_tag'),
          options,
          test_cases
        };
      });
      setQuestions(formatted);
    } catch {
      toast.error('Failed to load question bank');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question from the bank?')) return;
    try {
      const r = await fetch(`/api/verify/question-bank/${id}`, { method: 'DELETE', credentials: 'include' });
      if (r.ok) {
        toast.success('Question deleted');
        fetchQuestions();
      } else {
        toast.error('Delete failed');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const handleEdit = async (q) => {
    try {
      // Fetch full details
      const r = await fetch(`/api/verify/question-bank/${q.id}`, { credentials: 'include' });
      const d = await r.json();
      if (r.ok) {
        const item = d.data;
        if (typeof item.test_cases === 'string') {
           try { item.test_cases = JSON.parse(item.test_cases); } catch {}
        }
        if (typeof item.options === 'string') {
           try { item.options = JSON.parse(item.options); } catch {}
        }
        if (typeof item.tags === 'string') {
           try { item.tags = JSON.parse(item.tags); } catch {}
        }
        setEditQuestion(item);
      }
    } catch {
      toast.error('Failed to load question details');
    }
  };

  const uniqueTopics = useMemo(() => {
    const topics = questions.map(q => q.topic).filter(Boolean);
    return [...new Set(topics)].sort();
  }, [questions]);

  const uniqueTags = useMemo(() => {
    const tagSet = new Set();
    questions.forEach(q => {
      if (Array.isArray(q.tags)) {
        q.tags.forEach(t => {
          if (t && String(t).trim()) tagSet.add(String(t).trim());
        });
      }
    });
    return [...tagSet].sort();
  }, [questions]);

  const filtered = questions.filter(q => {
    const qText = (q.question_text || '').toLowerCase();
    const qTopic = (q.topic || '').toLowerCase();
    const qTags = (Array.isArray(q.tags) ? q.tags : []).map(t => String(t).toLowerCase());

    const term = searchTerm.toLowerCase().trim();
    const cleanTerm = term.startsWith('#') ? term.slice(1) : term;

    const matchSearch = !term ||
      qText.includes(term) ||
      qTopic.includes(term) ||
      qTags.some(t => t.includes(cleanTerm) || t.includes(term));

    const matchTopic = selectedTopic === 'All' || q.topic === selectedTopic;
    const matchType = selectedType === 'All' || q.question_type === selectedType;
    const matchTag = !selectedTag || (Array.isArray(q.tags) && q.tags.includes(selectedTag));

    return matchSearch && matchTopic && matchType && matchTag;
  });

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      {/* Sidebar Folders & Tags */}
      <div className="w-64 border-r border-gray-200 pr-6 overflow-y-auto flex-shrink-0 flex flex-col gap-6">
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-2">Topics / Folders</h3>
          
          <div className="flex flex-col gap-1">
            <button 
              onClick={() => setSelectedTopic('All')}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${selectedTopic === 'All' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <FolderOpen size={16} className={selectedTopic === 'All' ? 'text-purple-600' : 'text-gray-400'} />
              All Questions
              <span className="ml-auto bg-white border border-gray-200 text-gray-500 text-[10px] px-2 py-0.5 rounded-full">{questions.length}</span>
            </button>

            {uniqueTopics.map(topic => {
              const count = questions.filter(q => q.topic === topic).length;
              const isSelected = selectedTopic === topic;
              return (
                <button 
                  key={topic}
                  onClick={() => setSelectedTopic(topic)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${isSelected ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <Folder size={16} className={isSelected ? 'text-purple-600' : 'text-gray-400'} />
                  <span className="truncate">{topic}</span>
                  <span className={`ml-auto border text-[10px] px-2 py-0.5 rounded-full ${isSelected ? 'bg-white border-purple-200 text-purple-600' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>{count}</span>
                </button>
              );
            })}
            {uniqueTopics.length === 0 && (
              <div className="text-xs text-gray-400 italic px-3 py-1">No topics created yet.</div>
            )}
          </div>
        </div>

        {/* Tags List in Sidebar */}
        {uniqueTags.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2 ml-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tags</h3>
              {selectedTag && (
                <button 
                  onClick={() => setSelectedTag(null)}
                  className="text-[10px] text-purple-600 hover:underline font-semibold"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 px-2">
              {uniqueTags.map(t => {
                const count = questions.filter(q => Array.isArray(q.tags) && q.tags.includes(t)).length;
                const isSelected = selectedTag === t;
                return (
                  <button
                    key={t}
                    onClick={() => setSelectedTag(isSelected ? null : t)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      isSelected
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-purple-50 hover:text-purple-700'
                    }`}
                  >
                    <span>#{t}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-purple-200' : 'text-gray-400'}`}>({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 pl-6 flex flex-col gap-6 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 max-w-2xl">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search size={15} />
              </span>
              <input
                type="text"
                placeholder="Search questions by keyword, topic, or #tag..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              />
            </div>
            
            <select 
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-purple-400"
            >
              <option value="All">All Types</option>
              {QTYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            {selectedTag && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-xl border border-purple-200 shrink-0">
                <Tag size={12} />
                <span>#{selectedTag}</span>
                <button 
                  onClick={() => setSelectedTag(null)} 
                  className="hover:bg-purple-200 p-0.5 rounded-full text-purple-700 transition"
                  title="Remove tag filter"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button onClick={fetchQuestions} className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50" title="Refresh">
              <RefreshCw size={16} />
            </button>
            {canManage && (
              <>
                <div className="h-6 w-px bg-gray-200 mx-1"></div>
                <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-50 text-purple-700 font-medium hover:bg-purple-100 border border-purple-200 text-sm">
                  <UploadCloud size={16} /> Import File
                </button>
                <button onClick={() => setShowImportUrl(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-50 text-purple-700 font-medium hover:bg-purple-100 border border-purple-200 text-sm">
                  <LinkIcon size={16} /> URL Scrape
                </button>
                <button onClick={() => setShowManual(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 shadow-sm text-sm">
                  <Plus size={16} /> Manual Entry
                </button>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex justify-center items-center"><Loader2 className="animate-spin text-purple-600" size={32} /></div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <Library size={48} className="text-gray-300 mb-4" />
            <h3 className="text-lg font-bold text-gray-800">No Questions Found</h3>
            <p className="text-sm text-gray-500 mt-1">
              {selectedTag ? `No questions matching tag #${selectedTag}.` : 'Adjust your filters or add new questions to the bank.'}
            </p>
            {selectedTag && (
              <button 
                onClick={() => setSelectedTag(null)}
                className="mt-3 px-3 py-1.5 text-xs font-semibold text-purple-600 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100"
              >
                Clear Tag Filter
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2 pb-10 space-y-3">
            {filtered.map(q => {
              const typeInfo = QTYPES.find(t => t.value === q.question_type);
              const TYPE_STYLES = {
                mcq:         { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
                mcq_multi:   { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200'   },
                written:     { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200'  },
                coding:      { bg: 'bg-emerald-100',text: 'text-emerald-700',border: 'border-emerald-200'},
                file_upload: { bg: 'bg-rose-100',   text: 'text-rose-700',   border: 'border-rose-200'   },
              };
              const style = TYPE_STYLES[q.question_type] || { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };

              // Options
              const options = Array.isArray(q.options) ? q.options : [];

              // Clean tags
              const displayTags = (Array.isArray(q.tags) ? q.tags : [])
                .filter(t => t && String(t).toLowerCase() !== 'extracted' && String(t).toLowerCase() !== 'extracted_tag');

              return (
                <div key={q.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden shrink-0">
                  <div className="flex gap-4 items-start p-5">
                    <div className="flex-1 min-w-0">
                      {/* Header: topic folder + type badge + points */}
                      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                        {q.topic && (
                          <span className="px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-600 text-[10px] font-bold uppercase rounded-md flex items-center gap-1">
                            <Folder size={9}/> {q.topic}
                          </span>
                        )}
                        <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-md border ${style.bg} ${style.text} ${style.border}`}>
                          {typeInfo?.label || q.question_type}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium ml-auto">
                          {q.marks} {q.marks === 1 ? 'pt' : 'pts'}
                        </span>
                      </div>

                      {/* Question text */}
                      <p className="text-sm font-medium text-gray-800 leading-relaxed whitespace-pre-wrap">{q.question_text}</p>

                      {/* MCQ options preview */}
                      {(q.question_type === 'mcq' || q.question_type === 'mcq_multi') && options.length > 0 && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {options.map((opt, i) => {
                            const isCorrect = q.correct_answer === opt ||
                              (Array.isArray(q.correct_answer) && q.correct_answer.includes(opt)) ||
                              (typeof q.correct_answer === 'string' && (() => { try { return JSON.parse(q.correct_answer).includes(opt); } catch { return false; } })());
                            return (
                              <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                                isCorrect
                                   ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : 'bg-gray-50 border-gray-100 text-gray-600'
                              }`}>
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                                  isCorrect ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
                                }`}>
                                  {String.fromCharCode(65 + i)}
                                </span>
                                {opt}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Tags */}
                      {displayTags.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                          {displayTags.map((t, idx) => {
                            const isTagSelected = selectedTag === t;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTag(isTagSelected ? null : t);
                                }}
                                className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border transition cursor-pointer ${
                                  isTagSelected
                                    ? 'bg-purple-600 text-white border-purple-600'
                                    : 'bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100 hover:border-purple-200'
                                }`}
                                title={`Filter by #${t}`}
                              >
                                #{t}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {canManage && (
                      <div className="flex flex-col items-center gap-1.5 shrink-0 border-l border-gray-100 pl-4 py-1">
                        <button onClick={() => handleEdit(q)} className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition" title="Edit Question">
                          <Edit3 size={15} />
                        </button>
                        <button onClick={() => handleDelete(q.id)} className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Delete Question">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={fetchQuestions} uniqueTopics={uniqueTopics} />}
      {showImportUrl && <ImportUrlModal onClose={() => setShowImportUrl(false)} onImport={fetchQuestions} uniqueTopics={uniqueTopics} />}
      {showManual && <ManualEntryModal onClose={() => setShowManual(false)} onSaved={()=>{setShowManual(false); fetchQuestions();}} uniqueTopics={uniqueTopics} />}
      {editQuestion && <ManualEntryModal onClose={() => setEditQuestion(null)} onSaved={()=>{setEditQuestion(null); fetchQuestions();}} uniqueTopics={uniqueTopics} initialData={editQuestion} />}
    </div>
  );
}
