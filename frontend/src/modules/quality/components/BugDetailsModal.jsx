import React, { useState, useEffect } from 'react';
import { 
  X, ExternalLink, Calendar, User, Shield, AlertTriangle, 
  Layers, Tag, CheckCircle2, Lock, Eye, Download, Play, 
  ZoomIn, ZoomOut, RotateCcw, Image as ImageIcon, Video as VideoIcon,
  Maximize2
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// Demo Error Screenshot provided by user
import demoErrorScreenshot from '../../../assets/demo_error_screenshot.png';

export default function BugDetailsModal({ bug, onClose, onEdit, onStatusChange, onTriggerSubmitDebug, currentUser = 'Rishit' }) {
  const [currentStatus, setCurrentStatus] = useState(bug?.status || 'Open');
  const [activeMedia, setActiveMedia] = useState(null); // { id, name, type, url, size, isVideo }
  const [zoomLevel, setZoomLevel] = useState(1);

  // Close media lightbox on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (activeMedia) {
          setActiveMedia(null);
        } else {
          onClose?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMedia, onClose]);

  if (!bug) return null;

  // Resolve media file URLs with fallback to demo screenshot / sample repro video
  const resolveMediaUrl = (att) => {
    if (att?.url) return att.url;
    if (att?.previewUrl) return att.previewUrl;
    if (att?.thumb) return att.thumb;
    if (att?.type === 'video' || (att?.name && att.name.toLowerCase().endsWith('.mp4'))) {
      return 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
    }
    return demoErrorScreenshot;
  };

  // Ownership permission check: only the assigned owner can edit progress or ticket content
  const canUserEdit = () => {
    if (!bug || !bug.assignee) return false;
    const bugAssignee = String(bug.assignee).toLowerCase().trim();
    const myName = (typeof currentUser === 'string' ? currentUser : currentUser?.name || currentUser?.username || 'Rishit').toLowerCase().trim();
    const myShort = myName.includes('@') ? myName.split('@')[0] : myName;
    if (myShort.includes('rishit') && bugAssignee.includes('rishit')) return true;
    return bugAssignee.includes(myShort) || myShort.includes(bugAssignee);
  };

  const isOwner = canUserEdit();

  const getSeverityBadge = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'bg-red-50 text-red-600 border-red-200';
      case 'high':
        return 'bg-orange-50 text-orange-600 border-orange-200';
      case 'medium':
        return 'bg-amber-50 text-amber-600 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical':
      case 'urgent':
        return 'bg-red-50 text-red-600 border-red-200';
      case 'high':
        return 'bg-orange-50 text-orange-600 border-orange-200';
      case 'medium':
      case 'normal':
        return 'bg-amber-50 text-amber-600 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'open':
        return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'in progress':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'resolved':
        return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const isResolved = ['resolved', 'closed'].includes((currentStatus || bug.status || '').toLowerCase()) || Boolean(bug.resolved_by);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
        <div 
          className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 text-xs font-mono font-bold bg-violet-100 text-violet-700 rounded-md border border-violet-200">
                {bug.id}
              </span>
              <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getStatusBadge(currentStatus)}`}>
                {currentStatus}
              </span>
              <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getSeverityBadge(bug.severity)}`}>
                {bug.severity} Severity
              </span>
              {!isResolved && !isOwner && (
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                  <Lock size={12} className="text-slate-500" />
                  View-Only (Assigned to {bug.assignee})
                </span>
              )}
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-6">
            {/* Resolution Highlight Banner if bug is Resolved or Closed */}
            {isResolved ? (
              <div className="p-5 bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50/50 border-2 border-emerald-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shrink-0">
                    <CheckCircle2 size={32} strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 mb-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Bug Resolved & Closed By</span>
                    </div>

                    {/* Resolver Name in BIG font */}
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                      {bug.resolved_by || bug.assignee || 'Rishit'}
                    </div>

                    {/* Date and Time below it in simple size */}
                    <div className="text-xs text-slate-600 font-medium flex items-center gap-1.5 mt-1">
                      <Calendar size={13} className="text-emerald-600 shrink-0" />
                      <span>Resolved on: <strong className="text-slate-800">{bug.resolved_at || '14 Mar 2026, 02:45 PM'}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
                  <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-emerald-600 text-white shadow-xs flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    <span>Status: {currentStatus}</span>
                  </span>
                  {bug.tester && (
                    <span className="text-[11px] text-slate-600 font-medium">
                      Verified by QA: <strong className="text-slate-800">{bug.tester}</strong>
                    </span>
                  )}
                </div>
              </div>
            ) : (
              !isOwner && (
                <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center gap-3 text-xs text-amber-900 font-semibold animate-fade-in">
                  <Lock size={18} className="text-amber-600 shrink-0" />
                  <span>
                    <strong>View-Only Notice:</strong> This bug ticket is assigned to <strong>{bug.assignee}</strong>. As per team quality permissions, only <strong>{bug.assignee}</strong> is authorized to edit details or update this bug's progress.
                  </span>
                </div>
              )
            )}

            {/* Title */}
            <div>
              <h2 className="text-xl font-bold text-slate-900 leading-snug">{bug.title}</h2>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-400" />
                  Reported {bug.created_on || '12 Mar 2026'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <User size={14} className="text-slate-400" />
                  Reported by <strong className="text-slate-700">{bug.reported_by || 'Vidhi'}</strong>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Layers size={14} className="text-slate-400" />
                  Project: <strong className="text-slate-700">{bug.project}</strong> ({bug.module})
                </span>
              </div>
            </div>

            {/* Quick Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider m-0">Assignee</p>
                <p className="text-xs font-bold text-slate-800 mt-1 m-0 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] flex items-center justify-center font-bold">
                    {bug.assignee ? bug.assignee.substring(0, 2).toUpperCase() : 'NA'}
                  </span>
                  {bug.assignee || 'Unassigned'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider m-0">Priority</p>
                <p className="text-xs font-bold text-slate-800 mt-1 m-0">
                  <span className={`px-2 py-0.5 rounded text-[11px] border font-bold ${getPriorityBadge(bug.priority)}`}>
                    {bug.priority}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider m-0">Environment</p>
                <p className="text-xs font-bold text-slate-800 mt-1 m-0">
                  {bug.environment || 'Production'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider m-0">Bug Type</p>
                <p className="text-xs font-bold text-slate-800 mt-1 m-0">
                  {bug.bug_type || 'Functional'}
                </p>
              </div>
            </div>

            {/* Steps to Reproduce */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Steps to Reproduce
              </h4>
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 whitespace-pre-line leading-relaxed font-sans">
                {bug.steps_to_reproduce || '1. Open the application.\n2. Navigate to the module.\n3. Observe the unexpected behavior.'}
              </div>
            </div>

            {/* Results Comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  Expected Result
                </h4>
                <p className="text-xs text-slate-700 m-0">
                  {bug.expected_result || 'Expected behavior should execute cleanly without error.'}
                </p>
              </div>

              <div className="p-4 bg-red-50/50 border border-red-100 rounded-xl">
                <h4 className="text-xs font-bold text-red-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-red-600" />
                  Actual Result
                </h4>
                <p className="text-xs text-slate-700 m-0">
                  {bug.actual_result || 'Error occurs preventing normal execution.'}
                </p>
              </div>
            </div>

            {/* Debugging Notes & QA Verification Details */}
            {(bug.debugging_notes || bug.verification_steps) && (
              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5 m-0">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  Resolution & Debugging Evidence
                </h4>
                {bug.debugging_notes && (
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Developer Debugging Notes</p>
                    <p className="text-xs text-slate-800 whitespace-pre-line bg-white p-3 rounded-lg border border-emerald-100 font-mono m-0 leading-relaxed shadow-2xs">
                      {bug.debugging_notes}
                    </p>
                  </div>
                )}
                {bug.verification_steps && (
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">QA Verification Steps</p>
                    <p className="text-xs text-slate-800 whitespace-pre-line bg-white p-3 rounded-lg border border-emerald-100 m-0 leading-relaxed shadow-2xs">
                      {bug.verification_steps}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Attachments Section - Accessible Photos and Videos */}
            {bug.attachments && bug.attachments.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 m-0">
                    <span>Attached Media & Evidence</span>
                    <span className="px-2 py-0.2 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold">
                      {bug.attachments.length}
                    </span>
                  </h4>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Click any item to view full image or play video
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {bug.attachments.map((att, i) => {
                    const mediaUrl = resolveMediaUrl(att);
                    const isVid = att.type === 'video' || (att.name && att.name.toLowerCase().endsWith('.mp4'));

                    return (
                      <div 
                        key={att.id || i}
                        onClick={() => {
                          setActiveMedia({ ...att, resolvedUrl: mediaUrl, isVideo: isVid });
                          setZoomLevel(1);
                        }}
                        className="group flex items-center justify-between p-3 bg-white hover:bg-violet-50/40 border border-slate-200 hover:border-violet-300 rounded-2xl shadow-xs hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
                      >
                        {/* Left: Thumbnail & Details */}
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Media Thumbnail */}
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-900 border border-slate-200/80 shrink-0 relative flex items-center justify-center shadow-xs">
                            {isVid ? (
                              <>
                                <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-800 to-indigo-950 flex items-center justify-center">
                                  <div className="w-7 h-7 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:bg-violet-500 transition-all">
                                    <Play size={13} fill="white" className="ml-0.5 text-white" />
                                  </div>
                                </div>
                                <span className="absolute bottom-1 right-1 px-1 py-0.2 bg-black/80 text-[8px] font-mono text-violet-200 rounded font-bold">
                                  MP4
                                </span>
                              </>
                            ) : (
                              <>
                                <img 
                                  src={mediaUrl} 
                                  alt={att.name}
                                  className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-300"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = demoErrorScreenshot;
                                  }}
                                />
                                <div className="absolute inset-0 bg-slate-950/15 group-hover:bg-transparent transition-colors" />
                              </>
                            )}
                          </div>

                          {/* Title and Size */}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 group-hover:text-violet-700 transition-colors truncate m-0">
                              {att.name}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-mono text-slate-400 font-semibold">
                                {att.size || 'Attachment'}
                              </span>
                              <span className="text-[10px] text-slate-300">•</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                isVid ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                              }`}>
                                {isVid ? '🎬 Video Repro' : '🖼️ Screenshot'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Quick Action Buttons */}
                        <div className="flex items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMedia({ ...att, resolvedUrl: mediaUrl, isVideo: isVid });
                              setZoomLevel(1);
                            }}
                            className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-100/60 rounded-lg transition-colors cursor-pointer"
                            title={isVid ? "Play Video" : "View Full Image"}
                          >
                            {isVid ? <Play size={14} /> : <Eye size={14} />}
                          </button>
                          <a
                            href={mediaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Open in new window"
                          >
                            <ExternalLink size={14} />
                          </a>
                          <a
                            href={mediaUrl}
                            download={att.name || 'error_attachment'}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Download attachment"
                          >
                            <Download size={14} />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOwner ? (
                <>
                  <span className="text-xs font-semibold text-slate-500">Quick Status:</span>
                  <select
                    value={currentStatus}
                    onChange={(e) => {
                      const nextVal = e.target.value;
                      setCurrentStatus(nextVal);
                      onStatusChange?.(bug.id, nextVal);
                    }}
                    className="text-xs font-bold py-1.5 px-3 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                </>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                  <Lock size={12} className="text-slate-400" />
                  <span>Status: {currentStatus} (Locked)</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
              >
                Close
              </button>
              {isOwner ? (
                <>
                  {onTriggerSubmitDebug && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onTriggerSubmitDebug([bug]);
                      }}
                      className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Mark as Done and submit debugging info to tester"
                    >
                      <CheckCircle2 size={14} strokeWidth={2.5} />
                      <span>Done (Submit to Tester)</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onEdit?.(bug);
                      onClose();
                    }}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors cursor-pointer"
                  >
                    Edit Bug
                  </button>
                </>
              ) : (
                <button
                  disabled
                  onClick={() => toast.error(`Only ${bug.assignee} can edit this ticket.`)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 bg-slate-100 border border-slate-200 rounded-xl cursor-not-allowed flex items-center gap-1.5 opacity-80"
                  title={`Only ${bug.assignee} can edit this ticket`}
                >
                  <Lock size={13} />
                  <span>Edit Locked</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          MEDIA LIGHTBOX / VIDEO VIEWER MODAL
      ======================================================== */}
      {activeMedia && (
        <div 
          className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 animate-fade-in"
          onClick={() => setActiveMedia(null)}
        >
          <div 
            className="w-full max-w-4xl max-h-[92vh] bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header Bar */}
            <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="p-1.5 rounded-lg bg-violet-900/60 text-violet-300">
                  {activeMedia.isVideo ? <VideoIcon size={16} /> : <ImageIcon size={16} />}
                </span>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-100 truncate m-0">
                    {activeMedia.name}
                  </h3>
                  <p className="text-[10px] text-slate-400 m-0">
                    {activeMedia.size || 'Attachment'} • {activeMedia.isVideo ? 'Video Reproduction' : 'Error Screenshot'}
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                {!activeMedia.isVideo && (
                  <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 mr-2">
                    <button
                      onClick={() => setZoomLevel(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                      className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut size={14} />
                    </button>
                    <span className="text-[11px] font-mono font-bold text-slate-300 px-1.5 min-w-[42px] text-center">
                      {Math.round(zoomLevel * 100)}%
                    </span>
                    <button
                      onClick={() => setZoomLevel(z => Math.min(3, +(z + 0.25).toFixed(2)))}
                      className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn size={14} />
                    </button>
                    <button
                      onClick={() => setZoomLevel(1)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                      title="Reset Zoom"
                    >
                      <RotateCcw size={13} />
                    </button>
                  </div>
                )}

                <a
                  href={activeMedia.resolvedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="Open full size in new tab"
                >
                  <ExternalLink size={16} />
                </a>

                <a
                  href={activeMedia.resolvedUrl}
                  download={activeMedia.name || 'error_attachment'}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="Download file"
                >
                  <Download size={16} />
                </a>

                <button
                  onClick={() => setActiveMedia(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer ml-1"
                  title="Close preview (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Lightbox Media Body */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center min-h-[350px] max-h-[75vh] bg-slate-950/90 relative">
              {activeMedia.isVideo ? (
                <div className="w-full flex flex-col items-center">
                  <video 
                    src={activeMedia.resolvedUrl} 
                    controls 
                    autoPlay 
                    className="max-h-[65vh] w-auto max-w-full rounded-2xl shadow-2xl bg-black border border-slate-800"
                  >
                    Your browser does not support HTML5 video playback.
                  </video>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Reproduction recording for <strong>{bug.id}</strong> — {bug.title}
                  </p>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center overflow-auto">
                  <img
                    src={activeMedia.resolvedUrl}
                    alt={activeMedia.name}
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                    className="max-h-[68vh] w-auto max-w-full object-contain rounded-xl shadow-2xl transition-transform duration-150 border border-slate-800/80 cursor-zoom-in"
                    onClick={() => setZoomLevel(z => z === 1 ? 1.5 : 1)}
                  />
                  <p className="text-[11px] text-slate-400 mt-3 text-center">
                    Demo error screenshot attached to <strong>{bug.id}</strong>. Click image or use zoom controls to enlarge.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
