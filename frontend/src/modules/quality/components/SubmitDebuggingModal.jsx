import React, { useState } from 'react';
import { X, CheckCircle2, Send, ShieldCheck, UserCheck, AlertCircle, FileCode } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SubmitDebuggingModal({
  isOpen,
  selectedBugs = [],
  onClose,
  onSubmit,
  currentUserName = 'Rishit'
}) {
  if (!isOpen || selectedBugs.length === 0) return null;

  const firstBug = selectedBugs[0];
  const isMultiple = selectedBugs.length > 1;

  // Form State
  const [tester, setTester] = useState(() => {
    // If reported by someone else (like Vidhi), assign back to that tester by default
    if (firstBug?.reported_by && firstBug.reported_by !== currentUserName) {
      return firstBug.reported_by;
    }
    return 'Vidhi';
  });

  const [debuggingNotes, setDebuggingNotes] = useState(
    'Fixed event handler callback and resolved payload serialization issue. Code committed and deployed to test environment.'
  );

  const [verificationSteps, setVerificationSteps] = useState(
    '1. Open the login page.\n2. Enter valid user credentials.\n3. Click the Login button.\n4. Verify successful redirection without error.'
  );

  const [environment, setEnvironment] = useState(firstBug?.environment || 'Staging');
  const [removeFromMyList, setRemoveFromMyList] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Close modal on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!debuggingNotes.trim()) {
      toast.error('Please enter root cause and debugging information');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        bugIds: selectedBugs.map(b => b.id),
        tester,
        debuggingNotes: debuggingNotes.trim(),
        verificationSteps: verificationSteps.trim(),
        environment,
        removeFromMyList
      });
      onClose();
    } catch {
      toast.error('Failed to submit debugging info');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
              <CheckCircle2 size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight m-0">
                Submit Debugging Information
              </h3>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Hand off resolved bug to QA Tester for verification
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Target Bug Summary Card */}
          <div className="p-3.5 bg-violet-50/60 border border-violet-100 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wider">
                {isMultiple ? `${selectedBugs.length} Bugs Selected` : 'Target Bug Ticket'}
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                Current Assignee: <strong className="text-slate-800">{firstBug.assignee || currentUserName}</strong>
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {selectedBugs.slice(0, 3).map(b => (
                <span key={b.id} className="px-2 py-0.5 text-xs font-mono font-bold bg-white text-blue-600 border border-violet-200 rounded-md shadow-xs">
                  {b.id}
                </span>
              ))}
              {selectedBugs.length > 3 && (
                <span className="text-xs text-slate-500 font-semibold">
                  +{selectedBugs.length - 3} more
                </span>
              )}
              <span className="text-xs font-bold text-slate-800 truncate max-w-xs">
                — {firstBug.title}
              </span>
            </div>
          </div>

          {/* QA Tester Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Assign QA Tester <span className="text-red-500">*</span></span>
              <span className="text-[11px] text-slate-400 font-normal">Will receive ticket notification</span>
            </label>
            <div className="relative">
              <select
                value={tester}
                onChange={(e) => setTester(e.target.value)}
                className="w-full text-xs font-bold py-2.5 px-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 shadow-xs"
              >
                <option value="Vidhi">Vidhi (QA Lead)</option>
                <option value="Priyanshu">Priyanshu (QA Specialist)</option>
                <option value="Sriraj">Sriraj (Automation Tester)</option>
                <option value="Akshit">Akshit (QA Engineer)</option>
                <option value="Rishit">Rishit (Peer Reviewer)</option>
              </select>
            </div>
          </div>

          {/* Root Cause & Fix Summary */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Root Cause & Resolution Summary <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={debuggingNotes}
              onChange={(e) => setDebuggingNotes(e.target.value)}
              placeholder="Explain the root cause and the fix applied..."
              className="w-full text-xs font-sans p-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 leading-relaxed shadow-inner"
              required
            />
          </div>

          {/* Verification Steps for Tester */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Verification Steps for Tester
            </label>
            <textarea
              rows={3}
              value={verificationSteps}
              onChange={(e) => setVerificationSteps(e.target.value)}
              placeholder="Step-by-step instructions for testing..."
              className="w-full text-xs font-mono p-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 leading-relaxed shadow-inner"
            />
          </div>

          {/* Environment */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Resolved in Environment
            </label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="w-full text-xs font-bold py-2.5 px-3 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
            >
              <option value="Staging">Staging (QA Verified)</option>
              <option value="Development">Development (Local Pass)</option>
              <option value="Production">Production (Hotfix)</option>
            </select>
          </div>

          {/* Checkbox: Remove from active list for this person */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-2.5 cursor-pointer" onClick={() => setRemoveFromMyList(!removeFromMyList)}>
            <input
              type="checkbox"
              id="removeFromMyList"
              checked={removeFromMyList}
              onChange={(e) => setRemoveFromMyList(e.target.checked)}
              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="removeFromMyList" className="text-xs font-semibold text-emerald-900 cursor-pointer select-none">
              <strong>Remove from my active bug list</strong> upon handoff (marked as <em>Resolved</em> and assigned to tester <em>{tester}</em>).
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send size={14} />
              <span>{isSubmitting ? 'Submitting...' : 'Done & Submit to Tester'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
