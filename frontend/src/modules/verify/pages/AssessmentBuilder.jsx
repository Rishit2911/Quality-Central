import React, { useState, useEffect, useMemo } from 'react';
import { verifyApi } from '../../../core/api/verifyApi';
import {
  Plus, Loader2, Save, Send, Upload, UploadCloud, Link as LinkIcon,
  Image as ImageIcon, Play, CheckCircle, Check, Trash2, ArrowUp, ArrowDown,
  Wand2, Settings, List, Eye, Shuffle, X, Folder, FolderOpen, Search
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import HorizontalLoader from '../../../core/components/HorizontalLoader';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  isPositiveNumber,
  isValidUrl,
  extractErrorMessage,
} from '../../../core/utils/validators';
import useEscapeClose from '../../../core/hooks/useEscapeClose';
import useOverlayClose from '../../../core/hooks/useOverlayClose';

const QUESTION_TYPES = [
  { id: 'mcq', label: 'Multiple Choice (Single)' },
  { id: 'mcq_multi', label: 'Multiple Choice (Multiple Correct)' },
  { id: 'written', label: 'Written Answer' },
  { id: 'coding', label: 'Coding Challenge' },
  { id: 'file_upload', label: 'File Upload' },
];

export default function AssessmentBuilder() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const asmId = params.get('id');

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingFor, setGeneratingFor] = useState(null);

  const handleAutoGenerate = async (index) => {
    const q = questions[index];
    if (!q.question_text?.trim()) { toast.error('Please enter the question text first'); return; }
    
    setGeneratingFor(index);
    try {
      const res = await verifyApi.aiGenerateCode({ question_text: q.question_text });
      const { starter_code, test_cases } = res.data?.data || res.data || {};
      
      const newQs = [...questions];
      newQs[index] = { 
        ...q, 
        starter_code: starter_code || q.starter_code,
        test_cases: test_cases || q.test_cases
      };
      setQuestions(newQs);
      toast.success('Generated! Please review and edit if needed.');
    } catch (err) {
      toast.error(extractErrorMessage(err?.response?.data?.detail || err, 'AI generation failed'));
    } finally {
      setGeneratingFor(null);
    }
  };

  // Settings
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Mixed');
  const [timeLimit, setTimeLimit] = useState(60);
  const [passScore, setPassScore] = useState(70);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [showResultImmediately, setShowResultImmediately] = useState(true);

  // Sections
  const [sections, setSections] = useState([]);

  // Questions
  const [questions, setQuestions] = useState([]);

  // File import
  const [importingFile, setImportingFile] = useState(false);
  
  // Modals
  const [showImportUrl, setShowImportUrl] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importingUrl, setImportingUrl] = useState(false);
  
  // Bank Import
  const [showBankImport, setShowBankImport] = useState(false);
  const [bankQuestions, setBankQuestions] = useState([]);
  const [bankSearch, setBankSearch] = useState('');
  const [selectedBankFolder, setSelectedBankFolder] = useState('All');
  useEscapeClose(() => setShowImportUrl(false), showImportUrl);
  useEscapeClose(() => setShowBankImport(false), showBankImport);
  const importUrlOverlayHandlers = useOverlayClose(() => setShowImportUrl(false));
  const bankImportOverlayHandlers = useOverlayClose(() => setShowBankImport(false));
  const [loadingBank, setLoadingBank] = useState(false);

  const fetchBankQuestions = async () => {
    setLoadingBank(true);
    try {
      const r = await fetch('/api/verify/question-bank', { credentials: 'include' });
      const d = await r.json();
      setBankQuestions(d.data || []);
    } catch {
      toast.error('Failed to load bank questions');
    } finally {
      setLoadingBank(false);
    }
  };

  useEffect(() => {
    if (showBankImport && bankQuestions.length === 0) {
      fetchBankQuestions();
    }
  }, [showBankImport]);

  useEffect(() => {
    if (asmId) {
      setLoading(true);
      fetch(`/api/verify/builder/assessments/${asmId}`)
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            const asm = d.data;
            setTitle(asm.title);
            setDescription(asm.description || '');
            setType(asm.type);
            setTimeLimit(asm.time_limit_minutes);
            setPassScore(asm.pass_score);
            setShuffleQuestions(asm.shuffle_questions);
            setShowResultImmediately(asm.show_result_immediately);
            setQuestions(asm.questions || []);
            setSections(Array.isArray(asm.sections) ? asm.sections : []);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [asmId]);

  // ── Section helpers ───────────────────────────────────────────────────────
  const addSection = () => {
    const id = `sec_${Date.now()}`;
    setSections(prev => [...prev, { id, title: `Section ${prev.length + 1}`, instructions: '', time_limit_minutes: null }]);
  };
  const updateSection = (id, field, value) =>
    setSections(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  const removeSection = (id) => {
    setSections(prev => prev.filter(s => s.id !== id));
    setQuestions(prev => prev.map(q => q.section_id === id ? { ...q, section_id: null } : q));
  };

  // ── File upload handler ───────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setImportingFile(true);
    const toastId = toast.loading(`AI is reading ${file.name}…`);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/verify/builder/import-questions', {
        method: 'POST', credentials: 'include', body: fd,
      });
      const d = await r.json();
      if (r.ok && d.success && Array.isArray(d.data) && d.data.length > 0) {
        setQuestions(prev => [...prev, ...d.data.map(q => ({
          id: `temp_${Date.now()}_${Math.random()}`,
          question_type: q.question_type || 'mcq',
          question_text: q.question_text || '',
          marks: q.marks || 1.0,
          options: q.options || ['', ''],
          correct_answer: q.correct_answer || '',
          model_answer: q.model_answer || '',
          starter_code: q.starter_code || '',
          test_cases: q.test_cases || [],
          programming_language: q.programming_language || 'python',
          section_id: null,
        }))]);
        toast.success(`AI extracted ${d.data.length} questions from ${file.name}!`, { id: toastId });
      } else {
        toast.error(extractErrorMessage(d?.detail, 'No questions could be extracted.'), { id: toastId });
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, 'File upload failed.'), { id: toastId });
    } finally {
      setImportingFile(false);
    }
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: `temp_${Date.now()}`,
        question_type: 'mcq',
        question_text: '',
        marks: 1.0,
        options: ['', ''],
        correct_answer: '',
        model_answer: '',
        programming_language: 'python',
        starter_code: '',
        test_cases: [],
      }
    ]);
  };

  const updateQuestion = (index, field, value) => {
    const newQs = [...questions];
    newQs[index] = { ...newQs[index], [field]: value };
    setQuestions(newQs);
  };

  const removeQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const moveQuestion = (index, direction) => {
    if (direction === 'up' && index > 0) {
      const newQs = [...questions];
      [newQs[index - 1], newQs[index]] = [newQs[index], newQs[index - 1]];
      setQuestions(newQs);
    } else if (direction === 'down' && index < questions.length - 1) {
      const newQs = [...questions];
      [newQs[index + 1], newQs[index]] = [newQs[index], newQs[index + 1]];
      setQuestions(newQs);
    }
  };

  const handleImportUrl = async (e) => {
    e.preventDefault();
    if (!importUrl) return;
    if (!isValidUrl(importUrl)) {
      toast.error('Enter a valid http:// or https:// URL');
      return;
    }
    setImportingUrl(true);
    try {
      const r = await fetch('/api/verify/builder/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl })
      });
      const d = await r.json();
      if (r.ok && d.success) {
        setQuestions([...questions, ...d.data]);
        setShowImportUrl(false);
        setImportUrl('');
        toast.success('Questions imported!');
      } else {
        toast.error(extractErrorMessage(d?.detail, 'Import failed'));
      }
    } catch (e) {
      toast.error(extractErrorMessage(e, 'Import failed'));
    } finally {
      setImportingUrl(false);
    }
  };

  const handleSave = async (publish = false) => {
    const validationError = validateAssessment(publish);
    if (validationError) return toast.error(validationError, { duration: 7000 });
    
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description ? description.trim() : null,
      type,
      time_limit_minutes: timeLimit !== '' && timeLimit !== null && !isNaN(Number(timeLimit)) ? Number(timeLimit) : null,
      pass_score: passScore !== '' && passScore !== null && !isNaN(Number(passScore)) ? Number(passScore) : 70.0,
      shuffle_questions: Boolean(shuffleQuestions),
      show_result_immediately: Boolean(showResultImmediately),
      sections: sections.map(s => ({
        id: String(s.id),
        title: String(s.title || '').trim(),
        instructions: s.instructions ? String(s.instructions).trim() : null,
        time_limit_minutes: s.time_limit_minutes !== '' && s.time_limit_minutes !== null && !isNaN(Number(s.time_limit_minutes)) ? Number(s.time_limit_minutes) : null,
      })),
      questions: questions.map((q, i) => {
        let opts = q.options;
        if (typeof opts === 'string') {
          try { opts = JSON.parse(opts); } catch { opts = []; }
        }
        if (!Array.isArray(opts)) opts = [];

        let tcs = q.test_cases;
        if (typeof tcs === 'string') {
          try { tcs = JSON.parse(tcs); } catch { tcs = []; }
        }
        if (!Array.isArray(tcs)) tcs = [];

        let qTags = q.tags;
        if (typeof qTags === 'string') {
          try { qTags = JSON.parse(qTags); } catch { qTags = []; }
        }
        if (!Array.isArray(qTags)) qTags = [];

        let qImages = q.images;
        if (typeof qImages === 'string') {
          try { qImages = JSON.parse(qImages); } catch { qImages = []; }
        }
        if (!Array.isArray(qImages)) qImages = [];

        return {
          question_text: q.question_text || '',
          question_type: q.question_type || 'mcq',
          options: opts,
          correct_answer: q.correct_answer ? String(q.correct_answer) : null,
          model_answer: q.model_answer ? String(q.model_answer) : null,
          starter_code: q.starter_code ? String(q.starter_code) : null,
          test_cases: tcs,
          programming_language: q.programming_language || 'python',
          accepted_file_types: q.accepted_file_types || null,
          skill_id: q.skill_id !== '' && q.skill_id !== null && !isNaN(Number(q.skill_id)) ? Number(q.skill_id) : null,
          marks: Number(q.marks) || 1.0,
          order_index: i,
          tags: qTags,
          images: qImages,
          section_id: q.section_id || null,
          difficulty: q.difficulty || 'medium',
        };
      })
    };

    try {
      let r, d;
      if (asmId) {
        r = await fetch(`/api/verify/builder/assessments/${asmId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        d = await r.json();
      } else {
        r = await fetch('/api/verify/builder/assessments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        d = await r.json();
      }

      if (r.ok && d.success) {
        const newId = asmId || d.data?.id;
        if (publish) {
          const pr = await fetch(`/api/verify/builder/assessments/${newId}/publish`, {
            method: 'POST'
          });
          const pd = await pr.json();
          if (pr.ok && pd.success) {
            toast.success('Assessment published!');
            navigate('/verify?tab=manage');
            return;
          } else {
            toast.error(extractErrorMessage(pd?.detail, 'Publish failed'));
            return;
          }
        }
        toast.success('Assessment saved!');
        if (!asmId) navigate(`/verify?tab=builder&id=${newId}`);
      } else {
        toast.error(extractErrorMessage(d?.detail, 'Save failed'));
      }
    } catch (e) {
      toast.error(extractErrorMessage(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const validateStep1 = () => {
    if (!title.trim()) {
      toast.error('Assessment title is required.');
      return false;
    }
    if (timeLimit === '' || !Number.isFinite(Number(timeLimit)) || Number(timeLimit) < 1 || Number(timeLimit) > 600) {
      toast.error('Time limit must be between 1 and 600 minutes.');
      return false;
    }
    if (passScore === '' || !Number.isFinite(Number(passScore)) || Number(passScore) < 0 || Number(passScore) > 100) {
      toast.error('Pass score must be between 0% and 100%.');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (questions.length === 0) {
      toast.error('Please add at least one question before proceeding.');
      return false;
    }
    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i];
      const label = `Question ${i + 1}`;
      if (!q.question_text?.trim()) {
        toast.error(`${label}: Question text is required.`);
        return false;
      }
      if (!isPositiveNumber(q.marks || 0)) {
        toast.error(`${label}: Marks must be greater than 0.`);
        return false;
      }
      if (q.question_type === 'mcq') {
        const filledOptions = (q.options || []).filter(opt => String(opt || '').trim());
        if (filledOptions.length < 2) {
          toast.error(`${label}: MCQ needs at least 2 options.`);
          return false;
        }
        if (!q.correct_answer || !filledOptions.includes(q.correct_answer)) {
          toast.error(`${label}: Please select a correct MCQ answer.`);
          return false;
        }
      }
      if (q.question_type === 'mcq_multi') {
        const filledOptions = (q.options || []).filter(opt => String(opt || '').trim());
        if (filledOptions.length < 2) {
          toast.error(`${label}: Multi-select MCQ needs at least 2 options.`);
          return false;
        }
      }
      if (q.question_type === 'coding') {
        const validTests = (q.test_cases || []).filter(tc => String(tc.expected_output ?? '').trim());
        if (validTests.length < 1) {
          toast.error(`${label}: Coding challenge needs at least 1 valid test case.`);
          return false;
        }
      }
    }

    if (sections.length > 0) {
      for (let s = 0; s < sections.length; s++) {
        const sec = sections[s];
        if (!sec.title?.trim()) {
          toast.error(`Section ${s + 1} must have a title.`);
          return false;
        }
        if (sec.time_limit_minutes !== null && sec.time_limit_minutes !== undefined && sec.time_limit_minutes !== '') {
          if (!Number.isFinite(Number(sec.time_limit_minutes)) || Number(sec.time_limit_minutes) < 1) {
            toast.error(`Section "${sec.title}" time limit must be at least 1 minute.`);
            return false;
          }
        }
      }
    }

    return true;
  };

  const handleNext = () => {
    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
    } else if (step === 2) {
      if (!validateStep2()) return;
      setStep(3);
    }
  };

  const validateAssessment = (publish) => {
    if (!title.trim()) return 'Title is required.';
    if (timeLimit !== '' && (!Number.isFinite(Number(timeLimit)) || Number(timeLimit) < 1 || Number(timeLimit) > 600)) {
      return 'Time limit must be between 1 and 600 minutes.';
    }
    if (!Number.isFinite(Number(passScore)) || Number(passScore) < 0 || Number(passScore) > 100) {
      return 'Pass score must be between 0 and 100.';
    }
    if (questions.length === 0 && publish) return 'Add questions before publishing.';

    if (sections.length > 0) {
      for (let s = 0; s < sections.length; s++) {
        const sec = sections[s];
        if (!sec.title?.trim()) return `Section ${s + 1} must have a title.`;
        if (sec.time_limit_minutes !== null && sec.time_limit_minutes !== undefined && sec.time_limit_minutes !== '') {
          if (!Number.isFinite(Number(sec.time_limit_minutes)) || Number(sec.time_limit_minutes) < 1) {
            return `Section "${sec.title}" time limit must be at least 1 minute.`;
          }
        }
      }
    }

    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i];
      const label = `Question ${i + 1}`;
      if (!q.question_text?.trim()) return `${label}: question text is required.`;
      if (!isPositiveNumber(q.marks || 0)) return `${label}: marks must be greater than 0.`;
      if (q.question_type === 'mcq') {
        const filledOptions = (q.options || []).filter(opt => String(opt || '').trim());
        if (filledOptions.length < 2) return `${label}: MCQ needs at least 2 options.`;
        if (!q.correct_answer || !filledOptions.includes(q.correct_answer)) return `${label}: select a correct MCQ answer.`;
      }
      if (q.question_type === 'coding') {
        const validTests = (q.test_cases || []).filter(tc => String(tc.expected_output ?? '').trim());
        if (validTests.length < 1) return `${label}: coding challenge needs at least 1 valid test case.`;
      }
      // Model answer - only validate on publish AND if it has a value (not empty)
      if (q.question_type === 'written' && publish && q.model_answer && !q.model_answer.trim()) {
        return `${label}: add a model answer before publishing written questions.`;
      }
    }
    return '';
  };

  // ── Bank Helpers ─────────────────────────────────────────────────────────
  const sanitizeBankQuestion = (bq) => {
    let opts = bq.options;
    if (typeof opts === 'string') {
      try { opts = JSON.parse(opts); } catch { opts = ['', '', '', '']; }
    }
    if (!Array.isArray(opts) || opts.length === 0) {
      if (bq.question_type === 'mcq' || bq.question_type === 'mcq_multi') opts = ['', '', '', ''];
      else opts = [];
    }

    let tcs = bq.test_cases;
    if (typeof tcs === 'string') {
      try { tcs = JSON.parse(tcs); } catch { tcs = []; }
    }
    if (!Array.isArray(tcs)) tcs = [];

    let qTags = bq.tags;
    if (typeof qTags === 'string') {
      try { qTags = JSON.parse(qTags); } catch { qTags = []; }
    }
    if (!Array.isArray(qTags)) qTags = [];
    qTags = qTags.filter(t => t && String(t).toLowerCase() !== 'extracted' && String(t).toLowerCase() !== 'extracted_tag');

    return {
      ...bq,
      bank_id: bq.id,
      id: `bank_${bq.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      options: opts,
      test_cases: tcs,
      tags: qTags
    };
  };

  const isQuestionAdded = (bq) => {
    return questions.some(q => 
      (q.bank_id && q.bank_id === bq.id) || 
      (q.id && (q.id === `bank_${bq.id}` || String(q.id).startsWith(`bank_${bq.id}_`))) ||
      (q.question_text && bq.question_text && q.question_text.trim().toLowerCase() === bq.question_text.trim().toLowerCase())
    );
  };

  const uniqueBankTopics = useMemo(() => {
    const topics = new Set();
    let hasUncategorized = false;
    bankQuestions.forEach(q => {
      if (q.topic && q.topic.trim()) {
        topics.add(q.topic.trim());
      } else {
        hasUncategorized = true;
      }
    });
    const list = [...topics].sort();
    if (hasUncategorized) list.push('Uncategorized');
    return list;
  }, [bankQuestions]);

  const filteredBankQuestions = useMemo(() => {
    return bankQuestions.filter(bq => {
      if (selectedBankFolder !== 'All') {
        if (selectedBankFolder === 'Uncategorized') {
          if (bq.topic && bq.topic.trim()) return false;
        } else {
          if ((bq.topic || '').trim() !== selectedBankFolder) return false;
        }
      }
      if (bankSearch.trim()) {
        const term = bankSearch.toLowerCase().trim();
        const cleanTerm = term.startsWith('#') ? term.slice(1) : term;
        const textMatch = (bq.question_text || '').toLowerCase().includes(term);
        const topicMatch = (bq.topic || '').toLowerCase().includes(term);
        const typeMatch = (bq.question_type || '').toLowerCase().includes(term);
        const tags = Array.isArray(bq.tags) ? bq.tags : (typeof bq.tags === 'string' ? (() => { try { return JSON.parse(bq.tags); } catch { return []; } })() : []);
        const tagMatch = tags.some(t => String(t).toLowerCase().includes(cleanTerm) || String(t).toLowerCase().includes(term));
        if (!textMatch && !topicMatch && !typeMatch && !tagMatch) return false;
      }
      return true;
    });
  }, [bankQuestions, selectedBankFolder, bankSearch]);

  const unaddedInCurrentView = filteredBankQuestions.filter(bq => !isQuestionAdded(bq));
  const totalAddedFromBank = bankQuestions.filter(bq => isQuestionAdded(bq)).length;

  const handleAddBankQuestion = (bq) => {
    if (isQuestionAdded(bq)) return;
    const newQ = sanitizeBankQuestion(bq);
    setQuestions(prev => [...prev, newQ]);
    toast.success('Question added to assessment');
  };

  const handleAddAllFromCurrentFolder = () => {
    if (unaddedInCurrentView.length === 0) {
      toast.error('All questions in this folder are already added.');
      return;
    }
    const formatted = unaddedInCurrentView.map(bq => sanitizeBankQuestion(bq));
    setQuestions(prev => [...prev, ...formatted]);
    toast.success(`Added ${formatted.length} question(s) to assessment!`);
  };

  const handleAddAllFromEntireBank = () => {
    const unaddedAll = bankQuestions.filter(bq => !isQuestionAdded(bq));
    if (unaddedAll.length === 0) {
      toast.error('All bank questions are already added.');
      return;
    }
    const formatted = unaddedAll.map(bq => sanitizeBankQuestion(bq));
    setQuestions(prev => [...prev, ...formatted]);
    toast.success(`Added ${formatted.length} question(s) to assessment!`);
  };

  if (loading) return <HorizontalLoader label="Loading assessment..." />;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Create Assessment</h2>
          <p className="text-sm text-gray-500 mt-1">Create and configure skills assessments</p>
        </div>
        <div className="flex gap-2">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors">
              Back
            </button>
          )}
          {step < 3 ? (
            <button onClick={handleNext} className="px-6 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors shadow-sm">
              Next Step
            </button>
          ) : (
            <>
              <button onClick={() => handleSave(false)} disabled={saving} className="px-6 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-2">
                <Save size={14} /> Draft
              </button>
              <button onClick={() => handleSave(true)} disabled={saving} className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm">
                <Send size={14} /> Publish
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="flex gap-4">
        {[
          { icon: Settings, label: 'Settings' },
          { icon: List, label: 'Questions' },
          { icon: Eye, label: 'Review' }
        ].map((s, i) => {
          const targetStep = i + 1;
          const isCurrent = step === targetStep;
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (targetStep > step) {
                  if (step === 1 && !validateStep1()) return;
                  if (step === 2 && !validateStep2()) return;
                  if (targetStep === 3 && step === 1) {
                    if (!validateStep2()) return;
                  }
                }
                setStep(targetStep);
              }}
              className={`flex-1 flex items-center gap-3 p-4 rounded-xl border text-left transition ${isCurrent ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
            >
              <s.icon size={18} />
              <span className="text-xs font-semibold uppercase tracking-wider">Step {i + 1}: {s.label}</span>
            </button>
          );
        })}
      </div>

      {/* STEP 1: Settings */}
      {step === 1 && (
        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm space-y-6">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Title <span className="text-red-500">*</span></label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-gray-50 text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all" placeholder="e.g. Senior Frontend Developer Assessment" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-gray-50 text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all min-h-[100px]" placeholder="Brief description of the assessment..." />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label data-tooltip="Controls the kinds of questions allowed in this assessment" className="block text-xs font-medium text-gray-600 mb-2">Assessment Type</label>
              <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-gray-50 text-gray-900 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all">
                <option value="Mixed">Mixed</option>
                <option value="MCQ">Multiple Choice Only</option>
                <option value="Coding">Coding Only</option>
                <option value="Written">Written Only</option>
              </select>
            </div>
            <div>
              <label data-tooltip="Maximum time a candidate has to complete the assessment" className="block text-xs font-medium text-gray-600 mb-2">Time Limit (Minutes)</label>
              <input type="number" value={timeLimit} onChange={e => setTimeLimit(parseInt(e.target.value) || 0)} className="w-full bg-gray-50 text-gray-900 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all" />
            </div>
            <div>
              <label data-tooltip="Minimum percentage required to pass" className="block text-xs font-medium text-gray-600 mb-2">Pass Score (%)</label>
              <input type="number" value={passScore} onChange={e => setPassScore(parseInt(e.target.value) || 0)} className="w-full bg-gray-50 text-gray-900 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all" />
            </div>
          </div>
          <div className="flex gap-6 pt-4 border-t border-gray-200">
            <label data-tooltip="Randomizes question order for each candidate" className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={shuffleQuestions} onChange={e => setShuffleQuestions(e.target.checked)} className="hidden" />
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${shuffleQuestions ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300 bg-white group-hover:border-purple-400'}`}>
                <CheckCircle size={12} />
              </div>
              <span className="text-xs font-medium text-gray-700">Shuffle Questions</span>
            </label>
            <label data-tooltip="Shows the candidate's result as soon as they submit" className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={showResultImmediately} onChange={e => setShowResultImmediately(e.target.checked)} className="hidden" />
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${showResultImmediately ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300 bg-white group-hover:border-purple-400'}`}>
                <CheckCircle size={12} />
              </div>
              <span className="text-xs font-medium text-gray-700">Show Result Immediately</span>
            </label>
          </div>
        </div>
      )}

      {/* STEP 2: Questions */}
      {step === 2 && (
        <div className="space-y-6">

          {/* ── Sections Panel ──────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Assessment Sections</h3>
                <p className="text-xs text-gray-400 mt-0.5">Optional — divide the assessment into named sections, each with its own time limit</p>
              </div>
              <button onClick={addSection} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold hover:bg-purple-100 transition-colors">
                <Plus size={12} /> Add Section
              </button>
            </div>
            {sections.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No sections — all questions are in a single flat list.</p>
            ) : (
              <div className="space-y-3">
                {sections.map((sec, si) => (
                  <div key={sec.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center mt-1">{si + 1}</div>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        value={sec.title}
                        onChange={e => updateSection(sec.id, 'title', e.target.value)}
                        placeholder="Section title (e.g. Aptitude, Coding)"
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-purple-300 outline-none text-gray-900 placeholder:text-gray-400 bg-white"
                      />
                      <input
                        value={sec.instructions || ''}
                        onChange={e => updateSection(sec.id, 'instructions', e.target.value)}
                        placeholder="Instructions (optional)"
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-purple-300 outline-none text-gray-900 placeholder:text-gray-400 bg-white"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={sec.time_limit_minutes || ''}
                          onChange={e => updateSection(sec.id, 'time_limit_minutes', e.target.value ? Number(e.target.value) : null)}
                          placeholder="Time (mins)"
                          min={1}
                          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-purple-300 outline-none text-gray-900 placeholder:text-gray-400 bg-white"
                        />
                        <button onClick={() => removeSection(sec.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors flex-shrink-0" title="Delete section">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Total Section Time Summary */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                  <div>
                    <span>Total Sections Time: </span>
                    <strong className="text-purple-700 font-bold">
                      {sections.reduce((acc, s) => acc + (Number(s.time_limit_minutes) || 0), 0)} mins
                    </strong>
                    <span className="text-gray-400 ml-1.5">(Overall Assessment setting: {timeLimit} mins)</span>
                  </div>
                  {sections.reduce((acc, s) => acc + (Number(s.time_limit_minutes) || 0), 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const totalMins = sections.reduce((acc, s) => acc + (Number(s.time_limit_minutes) || 0), 0);
                        if (totalMins > 0) {
                          setTimeLimit(totalMins);
                          toast.success(`Set assessment time limit to ${totalMins} mins`);
                        }
                      }}
                      className="text-purple-600 hover:text-purple-800 text-[11px] font-medium underline"
                    >
                      Sync Overall Time Limit
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Toolbar ─────────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3">
            <button onClick={addQuestion} className="px-4 py-3 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold hover:bg-purple-100 transition-colors flex items-center gap-2">
              <Plus size={14} /> Add Question
            </button>
            <button onClick={() => setShowBankImport(true)} className="px-4 py-3 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold hover:bg-indigo-100 transition-colors flex items-center gap-2">
              <List size={14} /> Import from Bank
            </button>
            <button onClick={() => setShowImportUrl(true)} className="px-4 py-3 rounded-xl bg-gray-50 text-gray-600 border border-gray-200 text-xs font-medium hover:bg-gray-100 transition-colors flex items-center gap-2">
              <LinkIcon size={14} /> Import from URL
            </button>
            {/* File Upload */}
            <label className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors ${importingFile ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}>
              {importingFile ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {importingFile ? 'Extracting…' : 'Upload File (AI)'}
              <input type="file" className="hidden" accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.json" onChange={handleFileUpload} disabled={importingFile} />
            </label>
          </div>

          {questions.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-400 font-medium">No questions added yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {questions.map((q, i) => (
                <div key={q.id || i} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm border-l-4 border-l-purple-600 relative group">
                  {/* Section assignment — only shown when sections exist */}
                  {sections.length > 0 && (
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Section</span>
                      <select
                        value={q.section_id || ''}
                        onChange={e => updateQuestion(i, 'section_id', e.target.value || null)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-purple-300 outline-none"
                      >
                        <option value="">— Unassigned —</option>
                        {sections.map(sec => <option key={sec.id} value={sec.id}>{sec.title}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="absolute right-4 top-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveQuestion(i, 'up')} disabled={i === 0} aria-label="Move question up" className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 disabled:opacity-30"><ArrowUp size={14}/></button>
                    <button onClick={() => moveQuestion(i, 'down')} disabled={i === questions.length - 1} aria-label="Move question down" className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 disabled:opacity-30"><ArrowDown size={14}/></button>
                    <button onClick={() => removeQuestion(i)} aria-label="Delete question" className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600"><Trash2 size={14}/></button>
                  </div>

                  <div className="flex gap-4 mb-4 pr-32">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-lg text-gray-600 shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 space-y-4">
                      <div className="flex gap-4 flex-wrap">
                        <select aria-label="Question type" value={q.question_type} onChange={e => updateQuestion(i, 'question_type', e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-purple-400">
                          {QUESTION_TYPES.map(qt => <option key={qt.id} value={qt.id}>{qt.label}</option>)}
                        </select>
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                          <span className="text-xs font-medium text-gray-500">Marks:</span>
                          <input aria-label="Marks awarded for this question" type="number" value={q.marks || 1} onChange={e => updateQuestion(i, 'marks', parseFloat(e.target.value) || 0)} className="bg-transparent w-12 text-sm text-gray-700 outline-none text-right" />
                        </div>
                      </div>

                      <label className="block text-xs font-medium text-gray-600">Question Text <span className="text-red-500">*</span></label>
                      <textarea
                        value={q.question_text}
                        onChange={e => updateQuestion(i, 'question_text', e.target.value)}
                        placeholder="Enter question text..."
                        className="w-full bg-transparent border-b border-gray-200 focus:border-purple-400 outline-none py-2 text-sm text-gray-700 resize-y min-h-[120px]"
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

                      {/* Type-specific UI */}
                      {(q.question_type === 'mcq' || q.question_type === 'mcq_multi') && (
                        <div className="space-y-2 mt-4 pl-4 border-l border-gray-200">
                          {(q.options || []).map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-3">
                              <input
                                type={q.question_type === 'mcq' ? 'radio' : 'checkbox'}
                                name={`correct_${i}`}
                                checked={q.question_type === 'mcq' ? (q.correct_answer === opt && opt !== '') : ((q.correct_answer || '').includes(opt) && opt !== '')}
                                onChange={(e) => {
                                  if (q.question_type === 'mcq') {
                                    updateQuestion(i, 'correct_answer', opt);
                                  } else {
                                    let curr = q.correct_answer ? q.correct_answer.split('|||') : [];
                                    if (e.target.checked) curr.push(opt);
                                    else curr = curr.filter(c => c !== opt);
                                    updateQuestion(i, 'correct_answer', curr.join('|||'));
                                  }
                                }}
                                className={`w-4 h-4 accent-purple-600 ${q.question_type === 'mcq_multi' ? 'rounded' : ''}`}
                              />
                              <input
                                type="text"
                                value={opt}
                                onChange={e => {
                                  const newOpts = [...(q.options || [])];
                                  newOpts[oIdx] = e.target.value;
                                  updateQuestion(i, 'options', newOpts);
                                  // Simplified correct answer updates on option text change for demo
                                  if (q.question_type === 'mcq' && q.correct_answer === opt) updateQuestion(i, 'correct_answer', e.target.value);
                                }}
                                placeholder={`Option ${oIdx + 1}`}
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-purple-400"
                              />
                              <button onClick={() => updateQuestion(i, 'options', q.options.filter((_, idx) => idx !== oIdx))} className="text-gray-400 hover:text-rose-600"><X size={14}/></button>
                            </div>
                          ))}
                          <button onClick={() => updateQuestion(i, 'options', [...(q.options || []), ''])} className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors mt-2">
                            + Add Option
                          </button>
                        </div>
                      )}

                      {q.question_type === 'coding' && (
                        <div className="space-y-4 mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <div className="flex gap-4 items-center flex-wrap">
                            <select value={q.programming_language || 'python'} onChange={e => updateQuestion(i, 'programming_language', e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-purple-400">
                              <option value="python">Python</option>
                              <option value="javascript">JavaScript</option>
                              <option value="java">Java</option>
                              <option value="cpp">C++</option>
                            </select>
                            <button onClick={() => handleAutoGenerate(i)} disabled={generatingFor === i} className="flex items-center gap-2 text-xs font-medium text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-100 disabled:opacity-50">
                              {generatingFor === i ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Generate Template
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-2">Starter Code</label>
                            <textarea
                              value={q.starter_code || ''}
                              onChange={e => updateQuestion(i, 'starter_code', e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm font-mono text-gray-700 outline-none focus:border-purple-400 min-h-[120px]"
                              placeholder="def solve(x):\n    pass"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-2 flex justify-between">
                              <span>Test Cases</span>
                              <button onClick={() => updateQuestion(i, 'test_cases', [...(q.test_cases || []), {input: '', expected_output: ''}])} className="text-purple-600 hover:text-purple-800 text-xs font-medium">+ Add Test</button>
                            </label>
                            <div className="space-y-2">
                              {(q.test_cases || []).map((tc, tIdx) => (
                                <div key={tIdx} className="flex gap-2 items-start bg-white p-2 rounded-lg border border-gray-200">
                                  <textarea aria-label="Test case input" value={tc.input} onChange={e => {
                                    const tcs = [...q.test_cases]; tcs[tIdx].input = e.target.value; updateQuestion(i, 'test_cases', tcs);
                                  }} placeholder="Input" className="flex-1 bg-gray-50 border border-gray-200 rounded p-2 text-sm font-mono text-gray-700 outline-none focus:border-purple-400 h-16 resize-none" />
                                  <textarea aria-label="Expected output for this test case" value={tc.expected_output} onChange={e => {
                                    const tcs = [...q.test_cases]; tcs[tIdx].expected_output = e.target.value; updateQuestion(i, 'test_cases', tcs);
                                  }} placeholder="Expected Output" className="flex-1 bg-gray-50 border border-gray-200 rounded p-2 text-sm font-mono text-gray-700 outline-none focus:border-purple-400 h-16 resize-none" />
                                  <button onClick={() => updateQuestion(i, 'test_cases', q.test_cases.filter((_, idx) => idx !== tIdx))} aria-label="Delete test case" className="p-2 text-gray-400 hover:text-rose-600"><Trash2 size={14}/></button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {q.question_type === 'written' && (
                        <div className="mt-4">
                          <label className="block text-xs font-medium text-gray-600 mb-2">Model Answer (for AI Grading)</label>
                          <textarea
                            value={q.model_answer || ''}
                            onChange={e => updateQuestion(i, 'model_answer', e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all min-h-[80px]"
                            placeholder="Expected points to cover..."
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Review */}
      {step === 3 && (
        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
            <p className="text-sm text-gray-500 mt-2">{description}</p>
            <div className="flex justify-center gap-4 mt-6">
              <span className="px-3 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-600">{type}</span>
              <span className="px-3 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-600">{timeLimit} Mins</span>
              <span className="px-3 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-600">{questions.length} Questions</span>
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Question Summary</h3>
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-4">
                    <span className="w-6 h-6 rounded-lg bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">{i+1}</span>
                    <span className="text-sm text-gray-700 line-clamp-1">{q.question_text || '(Empty Question)'}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-xs font-medium text-purple-600">{q.question_type}</span>
                    <span className="text-xs font-medium text-gray-400">{q.marks} pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportUrl && createPortal(
        
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" {...importUrlOverlayHandlers}>
          <div className="bg-white text-gray-900 rounded-2xl w-full max-w-lg p-6 sm:p-8 relative shadow-2xl border border-gray-200 my-8 light-theme-override" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowImportUrl(false)} className="absolute top-5 right-5 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X size={18} />
            </button>
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
              <LinkIcon className="text-purple-600"/> Import from URL
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Supports <span className="font-semibold text-purple-600">LeetCode</span> and <span className="font-semibold text-orange-500">HackerRank</span> problem URLs (auto-extracts coding questions with starter code), or any generic webpage with question content.
            </p>
            <form onSubmit={handleImportUrl}>
              <div className="mb-6">
                <label className="block text-xs font-medium text-gray-600 mb-2">URL</label>
                <input
                  type="url"
                  required
                  value={importUrl}
                  onChange={e => setImportUrl(e.target.value)}
                  placeholder="https://leetcode.com/problems/two-sum/ or any page with questions"
                  className="w-full bg-gray-50 text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                />
              </div>
              <button type="submit" disabled={importingUrl} className="w-full py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50">
                {importingUrl ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Import Questions'}
              </button>
            </form>
          </div>
        </div>
      ,
        document.body
      )}

      {/* Bank Import Modal */}
      {showBankImport && createPortal(
        
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" {...bankImportOverlayHandlers}>
          <div className="bg-white text-gray-900 rounded-2xl w-full max-w-4xl p-6 sm:p-8 relative shadow-2xl border border-gray-200 max-h-[85vh] flex flex-col light-theme-override" onClick={e => e.stopPropagation()}>
            
            {/* Top Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2.5">
                  <List className="text-purple-600" size={22} /> Import from Question Bank
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Browse by folders, search questions, and add them to your assessment without duplicates.
                </p>
              </div>
              <button onClick={() => setShowBankImport(false)} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                <X size={18} />
              </button>
            </div>

            {/* Search & Bulk Action Toolbar */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Search size={15} />
                </span>
                <input
                  type="text"
                  placeholder="Search bank questions by keyword, topic, or #tag..."
                  value={bankSearch}
                  onChange={e => setBankSearch(e.target.value)}
                  className="w-full bg-gray-50 text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleAddAllFromCurrentFolder}
                  disabled={unaddedInCurrentView.length === 0}
                  className="px-3.5 py-2 bg-purple-600 text-white rounded-xl text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5 shadow-sm"
                  title={`Add all unadded questions in ${selectedBankFolder === 'All' ? 'all folders' : selectedBankFolder}`}
                >
                  <Plus size={14} />
                  {selectedBankFolder === 'All' ? `Add All (${unaddedInCurrentView.length})` : `Add Folder (${unaddedInCurrentView.length})`}
                </button>
                
                {selectedBankFolder !== 'All' && (
                  <button
                    type="button"
                    onClick={handleAddAllFromEntireBank}
                    disabled={bankQuestions.filter(bq => !isQuestionAdded(bq)).length === 0}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5"
                  >
                    Add All Bank ({bankQuestions.filter(bq => !isQuestionAdded(bq)).length})
                  </button>
                )}
              </div>
            </div>

            {/* Main Body: Folders Sidebar + Question List */}
            <div className="flex-1 min-h-[380px] overflow-hidden flex gap-4">
              
              {/* Folders Sidebar */}
              <div className="w-56 border-r border-gray-200 pr-3 overflow-y-auto flex-shrink-0 flex flex-col gap-1">
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1 mb-1">
                  Folders / Topics
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedBankFolder('All')}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition text-left ${selectedBankFolder === 'All' ? 'bg-purple-100 text-purple-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <FolderOpen size={15} className={selectedBankFolder === 'All' ? 'text-purple-600' : 'text-gray-400'} />
                  <span className="truncate flex-1">All Folders</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${selectedBankFolder === 'All' ? 'bg-white border-purple-200 text-purple-700' : 'bg-gray-100 border-gray-200 text-gray-500'}`}>
                    {bankQuestions.length}
                  </span>
                </button>

                {uniqueBankTopics.map(topic => {
                  const count = topic === 'Uncategorized'
                    ? bankQuestions.filter(q => !q.topic || !q.topic.trim()).length
                    : bankQuestions.filter(q => (q.topic || '').trim() === topic).length;
                  const isSelected = selectedBankFolder === topic;

                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => setSelectedBankFolder(topic)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition text-left ${isSelected ? 'bg-purple-100 text-purple-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                      <Folder size={15} className={isSelected ? 'text-purple-600' : 'text-gray-400'} />
                      <span className="truncate flex-1">{topic}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${isSelected ? 'bg-white border-purple-200 text-purple-700' : 'bg-gray-100 border-gray-200 text-gray-500'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Questions List */}
              <div className="flex-1 overflow-y-auto pr-1">
                {loadingBank ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Loader2 className="animate-spin text-purple-600 mb-2" size={24} />
                    <span className="text-xs">Loading question bank...</span>
                  </div>
                ) : filteredBankQuestions.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 text-sm">
                    No questions found in this folder.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredBankQuestions.map(bq => {
                      const added = isQuestionAdded(bq);
                      const bqTags = (Array.isArray(bq.tags) ? bq.tags : (typeof bq.tags === 'string' ? (() => { try { return JSON.parse(bq.tags); } catch { return []; } })() : [])).filter(t => t && String(t).toLowerCase() !== 'extracted' && String(t).toLowerCase() !== 'extracted_tag');

                      return (
                        <div key={bq.id} className={`flex items-start justify-between p-3.5 rounded-xl border transition ${added ? 'bg-gray-50/70 border-gray-200 opacity-90' : 'bg-white border-gray-200 hover:border-purple-200 hover:shadow-sm'}`}>
                          <div className="flex-1 pr-3">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              {bq.topic && <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md flex items-center gap-1"><Folder size={10} /> {bq.topic}</span>}
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md uppercase">{bq.question_type}</span>
                              <span className="text-[10px] text-gray-400">{bq.marks} pt{bq.marks !== 1 ? 's' : ''}</span>
                            </div>
                            <p className="text-xs font-medium text-gray-800 line-clamp-2">{bq.question_text}</p>
                            {bqTags.length > 0 && (
                              <div className="flex gap-1 mt-1.5 flex-wrap">
                                {bqTags.map((t, ti) => (
                                  <span key={ti} className="text-[9px] font-semibold text-purple-600 bg-purple-50/60 border border-purple-100 px-1.5 py-0.5 rounded-full">#{t}</span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="shrink-0 mt-0.5">
                            {added ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check size={13} /> Added
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddBankQuestion(bq)}
                                className="px-3.5 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition shadow-sm flex items-center gap-1"
                              >
                                <Plus size={13} /> Add
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-3 text-xs text-gray-500">
              <div>
                <span>Assessment currently has <strong className="text-gray-800">{questions.length}</strong> question{questions.length !== 1 ? 's' : ''}</span>
                {totalAddedFromBank > 0 && <span className="ml-2 text-purple-600 font-medium">({totalAddedFromBank} from bank)</span>}
              </div>
              <button
                type="button"
                onClick={() => setShowBankImport(false)}
                className="px-5 py-2 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      ,
        document.body
      )}
    </div>
  );
}
