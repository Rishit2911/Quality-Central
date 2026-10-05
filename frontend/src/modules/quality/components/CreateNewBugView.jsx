import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, ChevronUp, UploadCloud, X, Bold, Italic, 
  Underline, Strikethrough, List, ListOrdered, Code, Image, 
  Video, AlertTriangle, ArrowLeft, Check, FileText, Plus,
  Layers, Sparkles, CheckCircle2, ChevronRight, RotateCcw, Copy
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getDevelopersForProject, INITIAL_SAMPLE_PROJECTS } from '../constants/defaultProjects';

export default function CreateNewBugView({ 
  existingBugs = [], 
  onSubmitBug, 
  onCancel,
  initialData = null,
  projectsList = INITIAL_SAMPLE_PROJECTS
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isAccordionOpen, setIsAccordionOpen] = useState(true);

  // Batch Bug Reporting State (up to 6 bugs simultaneously)
  const [bugCount, setBugCount] = useState(1);
  const [activeBugIndex, setActiveBugIndex] = useState(0);

  // Template generator for creating a new bug record
  const createDefaultBug = (rightSideDefaults = null) => {
    const defaultProj = rightSideDefaults?.project || projectsList[0]?.name || 'Quality Central';
    const allowedDevs = getDevelopersForProject(defaultProj, projectsList);
    const defaultDev = rightSideDefaults?.assignee && allowedDevs.includes(rightSideDefaults.assignee)
      ? rightSideDefaults.assignee
      : (allowedDevs[0] || 'Rishit');

    return {
      id: `bug-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      // Left-hand fields (ALWAYS unique / blank per bug - never auto-filled)
      title: '',
      steps_to_reproduce: '1. Steps to reproduce List...\n2. Steps to progress result\n3. Steps to actual result',
      expected_result: '',
      actual_result: '',
      attachments: [],

      // Right-hand categories (AUTO-FILLED from Bug #1 by default, but independently editable)
      project: defaultProj,
      module: rightSideDefaults?.module || 'Authentication',
      environment: rightSideDefaults?.environment || 'Staging',
      severity: rightSideDefaults?.severity || 'Critical',
      priority: rightSideDefaults?.priority || 'P1 - Urgent',
      bug_type: rightSideDefaults?.bug_type || 'Functional',
      assignee: defaultDev,

      // Tracks if user explicitly modified any right-hand dropdown for this specific bug
      customOverrides: {
        project: false,
        module: false,
        environment: false,
        severity: false,
        priority: false,
        bug_type: false,
        assignee: false,
      }
    };
  };

  // State holding all bugs (from 1 up to 6)
  const [bugs, setBugs] = useState(() => {
    const initialProject = initialData?.project || projectsList[0]?.name || 'Quality Central';
    const initialDevs = getDevelopersForProject(initialProject, projectsList);
    const initialAssignee = initialData?.assignee && initialDevs.includes(initialData.assignee)
      ? initialData.assignee
      : (initialDevs[0] || 'Rishit');

    return [
      {
        ...createDefaultBug(),
        title: initialData?.title || '',
        steps_to_reproduce: initialData?.steps_to_reproduce || '1. Steps to reproduce List...\n2. Steps to progress result\n3. Steps to actual result',
        expected_result: initialData?.expected_result || '',
        actual_result: initialData?.actual_result || '',
        project: initialProject,
        module: initialData?.module || 'Authentication',
        environment: initialData?.environment || 'Staging',
        severity: initialData?.severity || 'Critical',
        priority: initialData?.priority || 'P1 - Urgent',
        bug_type: initialData?.bug_type || 'Functional',
        assignee: initialAssignee,
        attachments: initialData?.attachments || [],
      }
    ];
  });

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Active bug currently being edited
  const currentBug = bugs[activeBugIndex] || bugs[0];

  // Handle changing the number of bugs dropdown (1 to 6)
  const handleBugCountChange = (newCountVal) => {
    const targetCount = Math.max(1, Math.min(6, parseInt(newCountVal, 10) || 1));
    setBugCount(targetCount);

    setBugs(prev => {
      if (targetCount > prev.length) {
        // Source defaults from Bug #1 (Form 1)
        const form1Categories = {
          project: prev[0]?.project || projectsList[0]?.name || 'Quality Central',
          module: prev[0]?.module || 'Authentication',
          environment: prev[0]?.environment || 'Staging',
          severity: prev[0]?.severity || 'Critical',
          priority: prev[0]?.priority || 'P1 - Urgent',
          bug_type: prev[0]?.bug_type || 'Functional',
          assignee: prev[0]?.assignee,
        };

        const appended = [];
        for (let i = prev.length; i < targetCount; i++) {
          appended.push(createDefaultBug(form1Categories));
        }
        return [...prev, ...appended];
      } else if (targetCount < prev.length) {
        return prev.slice(0, targetCount);
      }
      return prev;
    });

    if (activeBugIndex >= targetCount) {
      setActiveBugIndex(targetCount - 1);
    }

    if (targetCount > 1) {
      toast.success(`Configured form for ${targetCount} bugs. Bug #1 categories will auto-populate remaining forms.`);
    }
  };

  // Update left-hand side fields (title, steps, expected, actual, attachments)
  // These are strictly isolated per bug — NO automatic propagation
  const updateLeftField = (field, value) => {
    setBugs(prev => {
      const next = [...prev];
      next[activeBugIndex] = {
        ...next[activeBugIndex],
        [field]: value
      };
      return next;
    });
  };

  // Update right-hand side categories (Project, Module, Environment, Severity, Priority, Bug Type, Assignee)
  // When edited on Bug #1 (index 0), automatically populates to all subsequent bugs that have not overridden that field
  // When project changes, the assignee is dynamically validated to ensure they belong to that project's developers
  const updateRightCategory = (field, value) => {
    setBugs(prev => {
      const next = [...prev];

      if (field === 'project') {
        const allowedDevs = getDevelopersForProject(value, projectsList);

        if (activeBugIndex === 0) {
          // Updating Bug #1: Propagate to Bug #2..#N unless explicitly customized
          const currentDev = next[0].assignee;
          const newDev = allowedDevs.includes(currentDev) ? currentDev : (allowedDevs[0] || 'Rishit');
          next[0] = { 
            ...next[0], 
            project: value,
            assignee: newDev 
          };

          for (let i = 1; i < next.length; i++) {
            if (!next[i].customOverrides?.project) {
              const bugDev = next[i].assignee;
              const autoDev = allowedDevs.includes(bugDev) ? bugDev : (allowedDevs[0] || 'Rishit');
              next[i] = { 
                ...next[i], 
                project: value,
                ...(!next[i].customOverrides?.assignee ? { assignee: autoDev } : {})
              };
            }
          }
        } else {
          // Updating Bug #2..#6: Update only this bug and mark field as custom overridden
          const currentDev = next[activeBugIndex].assignee;
          const newDev = allowedDevs.includes(currentDev) ? currentDev : (allowedDevs[0] || 'Rishit');
          next[activeBugIndex] = {
            ...next[activeBugIndex],
            project: value,
            assignee: newDev,
            customOverrides: {
              ...(next[activeBugIndex].customOverrides || {}),
              project: true,
              assignee: true
            }
          };
        }
      } else {
        if (activeBugIndex === 0) {
          // Updating Bug #1: Propagate to Bug #2..#N unless explicitly customized
          next[0] = { ...next[0], [field]: value };
          for (let i = 1; i < next.length; i++) {
            if (!next[i].customOverrides?.[field]) {
              next[i] = { ...next[i], [field]: value };
            }
          }
        } else {
          // Updating Bug #2..#6: Update only this bug and mark field as custom overridden
          next[activeBugIndex] = {
            ...next[activeBugIndex],
            [field]: value,
            customOverrides: {
              ...(next[activeBugIndex].customOverrides || {}),
              [field]: true
            }
          };
        }
      }
      return next;
    });
  };

  // Manually re-sync categories from Bug #1 for the active bug
  const handleResetToBug1Categories = () => {
    if (activeBugIndex === 0) return;
    const bug1 = bugs[0];
    setBugs(prev => {
      const next = [...prev];
      next[activeBugIndex] = {
        ...next[activeBugIndex],
        project: bug1.project,
        module: bug1.module,
        environment: bug1.environment,
        severity: bug1.severity,
        priority: bug1.priority,
        bug_type: bug1.bug_type,
        assignee: bug1.assignee,
        customOverrides: {
          project: false,
          module: false,
          environment: false,
          severity: false,
          priority: false,
          bug_type: false,
          assignee: false,
        }
      };
      return next;
    });
    toast.success(`Categories for Bug #${activeBugIndex + 1} re-synced from Bug #1`);
  };

  // Duplicate ticket detection logic for the active bug
  const duplicateMatch = currentBug.title.trim().length > 3
    ? existingBugs.find(b => {
        const t1 = b.title.toLowerCase();
        const t2 = currentBug.title.toLowerCase();
        return t1.includes(t2) || t2.includes(t1);
      })
    : null;

  // Rich text formatting handler for steps to reproduce
  const handleFormat = (type) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = currentBug.steps_to_reproduce || '';
    const selectedText = currentText.substring(start, end) || 'formatted text';
    let replacement = '';

    switch (type) {
      case 'bold':
        replacement = `**${selectedText}**`;
        break;
      case 'italic':
        replacement = `*${selectedText}*`;
        break;
      case 'underline':
        replacement = `<u>${selectedText}</u>`;
        break;
      case 'strike':
        replacement = `~~${selectedText}~~`;
        break;
      case 'code':
        replacement = `\`${selectedText}\``;
        break;
      case 'bullet':
        replacement = `\n• ${selectedText}`;
        break;
      case 'numbered':
        replacement = `\n1. ${selectedText}`;
        break;
      default:
        replacement = selectedText;
    }

    const updated = currentText.substring(0, start) + replacement + currentText.substring(end);
    updateLeftField('steps_to_reproduce', updated);
  };

  // File handling for attachments
  const handleFiles = (filesList) => {
    const files = Array.from(filesList || []);
    if (!files.length) return;

    const newItems = files.map((file, idx) => {
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');
      const sizeStr = file.size > 1024 * 1024 
        ? `${(file.size / (1024 * 1024)).toFixed(1)}MB` 
        : `${Math.round(file.size / 1024)}KB`;

      const blobUrl = isImg || isVid ? URL.createObjectURL(file) : null;

      return {
        id: `upload-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        name: file.name,
        size: sizeStr,
        type: isVid ? 'video' : isImg ? 'image' : 'file',
        url: blobUrl,
        previewUrl: blobUrl,
        thumb: blobUrl,
      };
    });

    updateLeftField('attachments', [...(currentBug.attachments || []), ...newItems]);
    toast.success(`Attached ${files.length} file(s) to Bug #${activeBugIndex + 1}`);
  };

  const removeAttachment = (attId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const currentAtts = currentBug.attachments || [];
    const toRemove = currentAtts.find(a => a.id === attId);
    if (toRemove?.previewUrl && toRemove.previewUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(toRemove.previewUrl);
      } catch {}
    }
    updateLeftField('attachments', currentAtts.filter(a => a.id !== attId));
    toast.success('Attachment removed');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer?.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Submission handler (supports single bug or batch submission of all configured bugs)
  const handleSubmit = (e) => {
    if (e) e.preventDefault();

    // Validate that all bugs have a title
    for (let i = 0; i < bugs.length; i++) {
      if (!bugs[i].title.trim()) {
        toast.error(`Please enter a title for Bug #${i + 1}`);
        setActiveBugIndex(i);
        setCurrentStep(1);
        return;
      }
    }

    const payloads = bugs.map(b => ({
      title: b.title.trim(),
      project: b.project,
      module: b.module,
      environment: b.environment,
      severity: b.severity,
      priority: b.priority,
      bug_type: b.bug_type,
      assignee: b.assignee,
      steps_to_reproduce: b.steps_to_reproduce,
      expected_result: b.expected_result,
      actual_result: b.actual_result,
      attachments: (b.attachments || []).map(a => ({
        ...a,
        url: a.previewUrl || a.url,
        thumb: a.previewUrl || a.thumb || a.url
      })),
    }));

    if (payloads.length === 1) {
      onSubmitBug(payloads[0]);
    } else {
      onSubmitBug(payloads);
    }
  };

  const handleSaveDraft = () => {
    if (!currentBug.title.trim()) {
      toast.error('Please enter at least a title to save a draft');
      return;
    }
    toast.success(`Saved draft for ${bugs.length} bug ticket(s).`);
    onCancel?.();
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto animate-fade-in-up pb-12">
      {/* Top Header / Breadcrumb */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Back to Bugs"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="text-slate-800 font-extrabold tracking-tight">Quality Central</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-700 tracking-wider text-xs uppercase font-extrabold">
              {bugCount > 1 ? `CREATE BATCH BUGS (${bugCount} TICKETS)` : 'CREATE NEW BUG'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Title & Stepper */}
      <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight m-0">
            Create New Bug
          </h1>
          <p className="text-xs text-slate-500 m-0 mt-0.5">
            Log quality defects, reproduction steps, and assign ownership to developers.
          </p>
        </div>

        {/* Top Progress Stepper */}
        <div className="flex items-center gap-2 sm:gap-4 text-xs font-semibold">
          <div 
            onClick={() => setCurrentStep(1)}
            className={`flex items-center gap-2 cursor-pointer ${
              currentStep === 1 ? 'text-blue-600 font-bold' : 'text-slate-500'
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              currentStep === 1 
                ? 'bg-blue-600 text-white shadow-sm' 
                : currentStep > 1 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-slate-200 text-slate-600'
            }`}>
              {currentStep > 1 ? <Check size={13} /> : '1'}
            </div>
            <span>1. Basic Details</span>
          </div>

          <div className="w-8 sm:w-12 h-[2px] bg-slate-200" />

          <div 
            onClick={() => setCurrentStep(2)}
            className={`flex items-center gap-2 cursor-pointer ${
              currentStep === 2 ? 'text-blue-600 font-bold' : 'text-slate-500'
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              currentStep === 2 
                ? 'bg-blue-600 text-white shadow-sm' 
                : currentStep > 2 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-slate-200 text-slate-600'
            }`}>
              {currentStep > 2 ? <Check size={13} /> : '2'}
            </div>
            <span>2. Additional Details</span>
          </div>

          <div className="w-8 sm:w-12 h-[2px] bg-slate-200" />

          <div 
            onClick={() => setCurrentStep(3)}
            className={`flex items-center gap-2 cursor-pointer ${
              currentStep === 3 ? 'text-blue-600 font-bold' : 'text-slate-500'
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              currentStep === 3 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'bg-slate-200 text-slate-600'
            }`}>
              3
            </div>
            <span>3. Review & Submit</span>
          </div>
        </div>
      </div>

      {/* ========================================================
          NEW FEATURE: NUMBER OF BUGS DROPDOWN (1 TO 6)
          Placed directly below "Create New Bug" as requested
      ======================================================== */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-100 shadow-2xs">
            <Layers size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-extrabold text-slate-900 tracking-tight m-0">
                Number of Bugs to Report:
              </h3>
              {bugCount > 1 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-mono font-bold">
                  Batch Mode: {bugCount} Bugs
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 m-0 mt-0.5">
              {bugCount > 1
                ? 'Right-hand categories in Bug #1 automatically populate Bugs #2–#6 as defaults. Left-hand fields (title, steps, media) remain unique.'
                : 'Select up to 6 bugs to report together with shared category auto-fill.'}
            </p>
          </div>
        </div>

        {/* Dropdown for Number of Bugs to Report (1 to 6) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <label htmlFor="bugCountSelect" className="text-xs font-bold text-slate-700 whitespace-nowrap">
            Report Count:
          </label>
          <select
            id="bugCountSelect"
            value={bugCount}
            onChange={(e) => handleBugCountChange(e.target.value)}
            className="text-xs font-bold py-2 px-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 shadow-2xs cursor-pointer hover:border-slate-400 transition-colors"
          >
            <option value={1}>1 Bug (Default)</option>
            <option value={2}>2 Bugs</option>
            <option value={3}>3 Bugs</option>
            <option value={4}>4 Bugs</option>
            <option value={5}>5 Bugs</option>
            <option value={6}>6 Bugs (Maximum)</option>
          </select>
        </div>
      </div>

      {/* ========================================================
          MULTI-BUG NAVIGATION TABS (Shown when bugCount > 1)
      ======================================================== */}
      {bugCount > 1 && (
        <div className="mb-6">
          <div className="flex items-center justify-between pb-2 mb-2">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <span>Switch Bug Form:</span>
              <span className="text-blue-600 font-extrabold">Bug #{activeBugIndex + 1} of {bugCount}</span>
            </span>
            <span className="text-[11px] text-slate-400">
              {activeBugIndex === 0 
                ? '⚡ Bug #1 is the Primary template for categories'
                : '✨ Categories auto-filled from Bug #1 (editable)'}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {bugs.map((b, idx) => {
              const isActive = idx === activeBugIndex;
              const isFilled = b.title.trim().length > 0;
              const isTemplate = idx === 0;

              return (
                <button
                  key={b.id || idx}
                  type="button"
                  onClick={() => setActiveBugIndex(idx)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-[1.01]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isActive ? 'bg-white text-blue-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {idx + 1}
                  </span>
                  <span>
                    Bug #{idx + 1} {isTemplate ? '(Primary)' : ''}
                  </span>
                  {isFilled ? (
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                      isActive ? 'bg-blue-700 text-blue-100' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      ✓ Ready
                    </span>
                  ) : (
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                      isActive ? 'bg-blue-700 text-blue-100' : 'bg-amber-100 text-amber-700'
                    }`}>
                      Draft
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          STEP 3: REVIEW & SUBMIT ALL CONFIGURED BUGS
      ======================================================== */}
      {currentStep === 3 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 m-0">
                Review & Confirm Bug Submission ({bugs.length} {bugs.length === 1 ? 'Bug' : 'Bugs'})
              </h2>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Ensure all required fields and attachments are accurate before dispatching to the team queue.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              ← Back to Details Form
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bugs.map((b, idx) => (
              <div 
                key={b.id || idx}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      Bug #{idx + 1} {idx === 0 ? '(Primary Form)' : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveBugIndex(idx);
                      setCurrentStep(1);
                    }}
                    className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Edit Bug #{idx + 1}
                  </button>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider m-0">Title</p>
                  <p className={`text-sm font-bold mt-0.5 m-0 ${b.title.trim() ? 'text-slate-900' : 'text-red-500 italic'}`}>
                    {b.title.trim() || '⚠️ Title missing — click Edit to enter title'}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 font-semibold block">Project</span>
                    <span className="font-bold text-slate-800">{b.project}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Module</span>
                    <span className="font-bold text-slate-800">{b.module}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Severity</span>
                    <span className="font-bold text-red-600">{b.severity}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Priority</span>
                    <span className="font-bold text-orange-600">{b.priority}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Environment</span>
                    <span className="font-bold text-slate-800">{b.environment}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block">Assignee</span>
                    <span className="font-bold text-violet-700">{b.assignee}</span>
                  </div>
                </div>

                {b.attachments && b.attachments.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="font-semibold">{b.attachments.length} Attachment(s):</span>
                    <span className="truncate max-w-xs">{b.attachments.map(a => a.name).join(', ')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="w-full sm:w-auto px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              Save as Draft
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <CheckCircle2 size={16} strokeWidth={2.5} />
                <span>
                  {bugs.length === 1 ? 'Submit Bug Ticket' : `Submit All ${bugs.length} Bugs`}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================
            STEPS 1 & 2: MAIN 2-COLUMN RESPONSIVE LAYOUT
            Left Panel (2/3) + Right Meta Sidebar (1/3)
        ======================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* =========================================
              LEFT PANEL (2/3 width -> lg:col-span-8)
              Contains: Title, Problem Description, Media
              STRICTLY UNIQUE PER BUG (No Auto-Fill)
          ========================================= */}
          <div className="lg:col-span-8 space-y-6">
            {/* Active Bug Header when multiple bugs */}
            {bugCount > 1 && (
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-950 font-bold">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                  <span>
                    Editing Bug #{activeBugIndex + 1} of {bugCount}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {activeBugIndex > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveBugIndex(i => i - 1)}
                      className="px-2.5 py-1 bg-white border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-100 text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      ← Previous Bug
                    </button>
                  )}
                  {activeBugIndex < bugCount - 1 && (
                    <button
                      type="button"
                      onClick={() => setActiveBugIndex(i => i + 1)}
                      className="px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      Next Bug →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Bug Title * */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Bug Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={currentBug.title}
                onChange={(e) => updateLeftField('title', e.target.value)}
                placeholder={`Enter a clear and concise title for Bug #${activeBugIndex + 1}...`}
                className="w-full text-sm font-medium px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400 transition-all shadow-inner"
              />

              {/* Duplicate Ticket Detection Alert */}
              {duplicateMatch && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-800 animate-fade-in">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                  <span>
                    <strong>Potential duplicate detected:</strong>{' '}
                    <span className="font-semibold text-blue-600 underline cursor-pointer">{duplicateMatch.id}</span>{' '}
                    — "{duplicateMatch.title}" ({duplicateMatch.status})
                  </span>
                </div>
              )}
            </div>

            {/* Problem Description Accordion */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div 
                onClick={() => setIsAccordionOpen(!isAccordionOpen)}
                className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/60 transition-colors border-b border-slate-100"
              >
                <h3 className="text-sm font-bold text-slate-800 tracking-tight m-0">
                  Problem Description
                </h3>
                <button 
                  type="button"
                  className="text-slate-400 hover:text-slate-600 p-1"
                  aria-label="Toggle accordion"
                >
                  {isAccordionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>

              {isAccordionOpen && (
                <div className="p-6 space-y-5">
                  {/* Steps to Reproduce */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider m-0">
                        Steps to Reproduce:
                      </label>
                      <span className="text-[11px] text-slate-400">Markdown enabled</span>
                    </div>

                    {/* Rich Text Editor Toolbar */}
                    <div className="border border-slate-200 rounded-t-xl bg-slate-50 px-3 py-2 flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleFormat('bold')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded text-xs font-bold transition-colors cursor-pointer"
                        title="Bold"
                      >
                        <Bold size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormat('italic')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded text-xs font-bold transition-colors cursor-pointer"
                        title="Italic"
                      >
                        <Italic size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormat('underline')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded text-xs font-bold transition-colors cursor-pointer"
                        title="Underline"
                      >
                        <Underline size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormat('strike')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded text-xs font-bold transition-colors cursor-pointer"
                        title="Strikethrough"
                      >
                        <Strikethrough size={14} />
                      </button>
                      <div className="w-[1px] h-4 bg-slate-300 mx-1" />
                      <button
                        type="button"
                        onClick={() => handleFormat('bullet')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded text-xs font-bold transition-colors cursor-pointer"
                        title="Bullet List"
                      >
                        <List size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormat('numbered')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded text-xs font-bold transition-colors cursor-pointer"
                        title="Numbered List"
                      >
                        <ListOrdered size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormat('code')}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded text-xs font-bold transition-colors cursor-pointer"
                        title="Inline Code"
                      >
                        <Code size={14} />
                      </button>
                    </div>

                    <textarea
                      ref={textareaRef}
                      rows={5}
                      value={currentBug.steps_to_reproduce}
                      onChange={(e) => updateLeftField('steps_to_reproduce', e.target.value)}
                      className="w-full text-xs font-mono p-4 bg-white border border-t-0 border-slate-200 rounded-b-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 leading-relaxed shadow-inner"
                      placeholder="Enter steps to reproduce..."
                    />
                  </div>

                  {/* Expected Result */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Expected Result:
                    </label>
                    <input
                      type="text"
                      value={currentBug.expected_result}
                      onChange={(e) => updateLeftField('expected_result', e.target.value)}
                      placeholder="What should have happened..."
                      className="w-full text-xs font-medium px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400 shadow-inner"
                    />
                  </div>

                  {/* Actual Result */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Actual Result:
                    </label>
                    <input
                      type="text"
                      value={currentBug.actual_result}
                      onChange={(e) => updateLeftField('actual_result', e.target.value)}
                      placeholder="What actually happened..."
                      className="w-full text-xs font-medium px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400 shadow-inner"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Media Drag-and-Drop / Upload Zone */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider m-0">
                  Media Attachments (Bug #{activeBugIndex + 1})
                </label>
                <span className="text-[11px] text-slate-400">Supports PNG, JPG, MP4, WebM (up to 100MB)</span>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = '';
                }}
                className="hidden"
              />

              {/* Dashed dropzone */}
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => {
                  if ((currentBug.attachments || []).length === 0) {
                    fileInputRef.current?.click();
                  }
                }}
                className={`border-2 border-dashed rounded-2xl p-6 transition-all ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/60 scale-[1.01]'
                    : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-400'
                } ${(currentBug.attachments || []).length === 0 ? 'cursor-pointer' : ''}`}
              >
                {(currentBug.attachments || []).length === 0 ? (
                  /* Empty state prompt */
                  <div className="py-8 flex flex-col items-center justify-center text-center">
                    <div className="flex items-center gap-2 text-blue-600 bg-blue-50 p-4 rounded-2xl mb-3 shadow-inner">
                      <Image size={28} />
                      <span className="text-sm font-bold text-slate-400">+</span>
                      <Video size={28} />
                    </div>
                    <p className="text-xs font-bold text-slate-800 m-0 mb-1">
                      Click to browse or drag and drop images and videos here
                    </p>
                    <p className="text-[11px] text-slate-400 m-0">
                      Supports PNG, JPG, GIF, MP4, WebM up to 100MB
                    </p>
                  </div>
                ) : (
                  /* Uploaded Thumbnails Grid with Working Remove (X) Tag */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                      <span className="text-xs font-bold text-slate-700">
                        Attached Media ({currentBug.attachments.length})
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        <Plus size={13} strokeWidth={2.5} />
                        <span>Add more files</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {currentBug.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="relative group bg-slate-900 rounded-xl overflow-hidden border border-slate-200 shadow-sm aspect-video flex items-center justify-center"
                        >
                          {att.type === 'image' && (att.previewUrl || att.thumb) ? (
                            <img
                              src={att.previewUrl || att.thumb}
                              alt={att.name}
                              className="w-full h-full object-cover rounded-xl"
                            />
                          ) : att.type === 'video' && att.previewUrl ? (
                            <video
                              src={att.previewUrl}
                              className="w-full h-full object-cover rounded-xl"
                              muted
                              playsInline
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center p-2 text-center text-slate-300">
                              {att.type === 'video' ? (
                                <Video size={26} className="text-blue-400 mb-1" />
                              ) : (
                                <Image size={26} className="text-violet-400 mb-1" />
                              )}
                              <span className="text-[10px] text-slate-300 font-bold truncate max-w-[90px]">
                                {att.size || 'Media'}
                              </span>
                            </div>
                          )}

                          {/* File Name Pill */}
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-left pointer-events-none">
                            <p className="text-[10px] font-bold text-white truncate m-0">
                              {att.name}
                            </p>
                            <span className="text-[9px] text-slate-300 font-mono">
                              {att.size}
                            </span>
                          </div>

                          {/* Working Red Circular Remove (X) Tag */}
                          <button
                            type="button"
                            onClick={(e) => removeAttachment(att.id, e)}
                            className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 hover:bg-red-600 active:scale-95 text-white rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 cursor-pointer z-20 border-2 border-white"
                            title="Remove attachment"
                            aria-label={`Remove ${att.name}`}
                          >
                            <X size={12} strokeWidth={3} />
                          </button>
                        </div>
                      ))}

                      {/* Add More Box */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 rounded-xl aspect-video flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-colors group"
                      >
                        <Plus size={20} className="text-slate-400 group-hover:text-blue-600 mb-1 transition-colors" />
                        <span className="text-[11px] font-bold text-slate-600 group-hover:text-blue-600 transition-colors">
                          Add More
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Multi-Bug Step Navigator */}
            {bugCount > 1 && (
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  disabled={activeBugIndex === 0}
                  onClick={() => setActiveBugIndex(i => i - 1)}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  ← Previous Bug
                </button>

                <span className="text-xs font-bold text-slate-500">
                  Bug {activeBugIndex + 1} of {bugCount}
                </span>

                {activeBugIndex < bugCount - 1 ? (
                  <button
                    type="button"
                    onClick={() => setActiveBugIndex(i => i + 1)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Next Bug (Bug #{activeBugIndex + 2}) →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={14} />
                    <span>Proceed to Review ({bugCount} Bugs)</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* =========================================
              RIGHT META SIDEBAR (1/3 width -> lg:col-span-4)
              CATEGORIES AUTO-POPULATED FROM FORM 1
          ========================================= */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 sticky top-6">
              {/* Category Auto-Fill Banner Indicator */}
              {bugCount > 1 && (
                <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                  activeBugIndex === 0 
                    ? 'bg-blue-50/80 border-blue-200 text-blue-900' 
                    : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles size={16} className={activeBugIndex === 0 ? 'text-blue-600 shrink-0' : 'text-emerald-600 shrink-0'} />
                    <span className="truncate">
                      {activeBugIndex === 0 
                        ? `Master Form: Categories sync to Bugs #2–#${bugCount}` 
                        : `Auto-filled from Bug #1 (editable)`}
                    </span>
                  </div>

                  {activeBugIndex > 0 && (
                    <button
                      type="button"
                      onClick={handleResetToBug1Categories}
                      className="p-1 hover:bg-emerald-100 rounded text-emerald-700 cursor-pointer"
                      title="Reset categories to Bug #1 values"
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              )}

              {/* Project * */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider m-0">
                    Project <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                    {projectsList.find(p => p.name === currentBug.project)?.prefix || 'Active'}
                  </span>
                </div>
                <select
                  value={currentBug.project}
                  onChange={(e) => updateRightCategory('project', e.target.value)}
                  className="w-full text-xs font-bold py-2.5 px-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                >
                  {projectsList.map((p) => (
                    <option key={p.id || p.name} value={p.name}>
                      {p.name} {p.prefix ? `(${p.prefix})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Module * */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Module <span className="text-red-500">*</span>
                </label>
                <select
                  value={currentBug.module}
                  onChange={(e) => updateRightCategory('module', e.target.value)}
                  className="w-full text-xs font-bold py-2.5 px-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                >
                  <option value="Authentication">Authentication</option>
                  <option value="Profile">Profile</option>
                  <option value="Dashboard">Dashboard</option>
                  <option value="Settings">Settings</option>
                  <option value="General">General</option>
                </select>
              </div>

              {/* Environment e.g. * */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Environment e.g. <span className="text-red-500">*</span>
                </label>
                <select
                  value={currentBug.environment}
                  onChange={(e) => updateRightCategory('environment', e.target.value)}
                  className="w-full text-xs font-bold py-2.5 px-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                >
                  <option value="Staging">E. Staging/Prod</option>
                  <option value="Production">Production</option>
                  <option value="Development">Development</option>
                </select>
              </div>

              {/* Severity * */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Severity <span className="text-red-500">*</span>
                </label>
                <select
                  value={currentBug.severity}
                  onChange={(e) => updateRightCategory('severity', e.target.value)}
                  className="w-full text-xs font-bold py-2.5 px-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              {/* Priority * */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Priority <span className="text-red-500">*</span>
                </label>
                <select
                  value={currentBug.priority}
                  onChange={(e) => updateRightCategory('priority', e.target.value)}
                  className="w-full text-xs font-bold py-2.5 px-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                >
                  <option value="P1 - Urgent">P1 - Urgent</option>
                  <option value="P2 - High">P2 - High</option>
                  <option value="P3 - Normal">P3 - Normal</option>
                  <option value="P4 - Low">P4 - Low</option>
                </select>
              </div>

              {/* Bug Type * */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Bug Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={currentBug.bug_type}
                  onChange={(e) => updateRightCategory('bug_type', e.target.value)}
                  className="w-full text-xs font-bold py-2.5 px-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                >
                  <option value="UI/UX">UI/UX</option>
                  <option value="Functional">Functional</option>
                  <option value="Performance">Performance</option>
                  <option value="Security">Security</option>
                </select>
              </div>

              {/* Assignee * dynamically restricted strictly to that project's developers */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider m-0">
                    Assignee <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Lead: <strong className="text-violet-700 font-bold">Bhupesh</strong>
                  </span>
                </div>
                <select
                  value={currentBug.assignee}
                  onChange={(e) => updateRightCategory('assignee', e.target.value)}
                  className="w-full text-xs font-bold py-2.5 px-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                >
                  {(() => {
                    const projectDevs = getDevelopersForProject(currentBug.project, projectsList);
                    const options = [...projectDevs];
                    if (currentBug.assignee && !options.includes(currentBug.assignee)) {
                      options.push(currentBug.assignee);
                    }
                    return options.map(dev => (
                      <option key={dev} value={dev}>
                        {dev} (Developer)
                      </option>
                    ));
                  })()}
                </select>
                <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  Showing developers assigned to <strong className="text-slate-700 font-bold">{currentBug.project}</strong>
                </p>
              </div>

              {/* Action Buttons matching Screenshot 2 */}
              <div className="pt-4 space-y-3">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <CheckCircle2 size={16} strokeWidth={2.5} />
                  <span>
                    {bugCount > 1 
                      ? `Submit All (${bugCount} Bugs)` 
                      : 'Review & Submit Bug'}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-xl transition-all cursor-pointer text-center"
                  >
                    Preview Summary
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] rounded-xl border border-slate-300 transition-all cursor-pointer shadow-xs text-center"
                  >
                    Save as Draft
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
