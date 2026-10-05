import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { api } from '../api';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { ArrowLeft, Save, Download, FileText, Send, Loader, Layout, Edit3, CheckCircle, RefreshCw, ShieldCheck, MessageSquare, X, Eye, EyeOff, Paperclip, BookOpen } from 'lucide-react';
import * as Diff from 'diff';
import { Mic, Square } from 'lucide-react';
import GrammarTextarea from './GrammarTextarea';

marked.use({ gfm: true });

// Turndown: HTML → Markdown (preserves tables, bold, headers)
const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', emDelimiter: '*' });
turndown.use(gfm);

// Rule to preserve <br> tags, otherwise they become \n and break Markdown tables!
turndown.addRule('br', {
    filter: 'br',
    replacement: function () {
        return '<br>';
    }
});

// Diff Utility Component (Table-Safe Rendering)
const DiffViewer = ({ oldText, newText, cleanMarkdown }) => {
    // Switch to more granular diff for better "Track Changes" feel
    const diff = Diff.diffWords(oldText || '', newText || '');

    const diffMarkup = diff.map(part => {
        if (!part.added && !part.removed) return part.value;

        const tag = part.added ? 'ins' : 'del';
        // MS Word style colors
        const bgColor = part.added ? '#e6ffec' : '#ffebe9';
        const textColor = part.added ? '#1a7f37' : '#cf222e';
        const decoration = part.removed ? 'line-through' : 'none';

        const style = `background-color: ${bgColor}; color: ${textColor}; text-decoration: ${decoration}; font-weight: 600; padding: 0 2px; border-radius: 2px;`;

        // TABLE SAFE REGEX: 
        // We split the changed chunk into segments. 
        // We DO NOT wrap pipes (|), newlines (\n), or the table separator rows (e.g. |---|) in tags.
        // This keeps the Markdown table syntax valid for the 'marked' parser.
        const segments = part.value.split(/([|\n]|\|[\s\-:|]+\|)/);

        return segments.map(seg => {
            if (!seg) return '';
            // If it's a pipe, a newline, or a table divider line, RETURN IT RAW (no tags)
            if (/^([|\n]|\|[\s\-:|]+\|)$/.test(seg)) return seg;

            // Otherwise, wrap it in the highlight tag
            return `<${tag} style="${style}">${seg}</${tag}>`;
        }).join('');
    }).join('');

    const cleaner = typeof cleanMarkdown === 'function' ? cleanMarkdown : (t) => t;

    return (
        <div className="markdown-preview" style={{ padding: 0, background: '#FAFBFF', position: 'relative', border: '1px solid var(--border)', borderRadius: '0 0 var(--radius-sm) var(--radius-sm)' }}>
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 p-4 bg-blue-50 border-b border-blue-100 text-blue-700 text-sm font-medium shadow-sm flex items-center gap-2">
                <ShieldCheck size={18} />
                <div className="flex-1">
                    <strong className="mr-3">Track Changes Active:</strong>
                    <span className="px-2 py-0.5 rounded bg-green-100 text-green-100 border border-green-200" style={{ color: '#1a7f37', background: '#e6ffec', fontWeight: 'bold' }}>New Content</span>
                    <span className="ml-2 px-2 py-0.5 rounded bg-red-100 text-red-100 border border-red-200" style={{ color: '#cf222e', background: '#ffebe9', textDecoration: 'line-through', fontWeight: 'bold' }}>Deleted Content</span>
                </div>
                <div className="text-xs font-bold text-blue-400 bg-white px-2 py-1 rounded border border-blue-100">Review Mode</div>
            </div>

            <div className="p-8">
                <div
                    className="rendered-diff-content"
                    dangerouslySetInnerHTML={{ __html: marked.parse(cleaner(diffMarkup)) }}
                    style={{ lineHeight: '1.8' }}
                />
            </div>
            <style>{`
                .rendered-diff-content ins { 
                    background-color: #e6ffec !important; 
                    color: #1a7f37 !important; 
                    text-decoration: none !important; 
                    font-weight: 700 !important; 
                    border-bottom: 2px solid #1a7f37;
                }
                .rendered-diff-content del { 
                    background-color: #ffebe9 !important; 
                    color: #cf222e !important; 
                    text-decoration: line-through !important; 
                    font-weight: 700 !important;
                    opacity: 0.9;
                }
            `}</style>
        </div>
    );
};

export default function ProjectView({ projectId, onBack }) {
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [activeTab, setActiveTab] = useState('intake');

    // Intake
    const [isEditingIntake, setIsEditingIntake] = useState(false);
    const [intakeForm, setIntakeForm] = useState({});
    const [intakeSaving, setIntakeSaving] = useState(false);

    // Design Doc
    const [ddContent, setDdContent] = useState('');
    const [ddDisplayHtml, setDdDisplayHtml] = useState('');
    const [isDdEditing, setIsDdEditing] = useState(false);
    const [ddGenerateLoading, setDdGenerateLoading] = useState(false);
    const [ddSaveStatus, setDdSaveStatus] = useState('');
    const [ddApproved, setDdApproved] = useState(false);

    // Storyboard
    const [sbContent, setSbContent] = useState('');
    const [sbDisplayHtml, setSbDisplayHtml] = useState('');
    const [isSbEditing, setIsSbEditing] = useState(false);
    const [sbGenerateLoading, setSbGenerateLoading] = useState(false);
    const [sbType, setSbType] = useState('Type 1');
    const [sbSaveStatus, setSbSaveStatus] = useState('');
    const [sbProgress, setSbProgress] = useState(null);


    // AI Copilot
    const [copilotOpen, setCopilotOpen] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [pendingEdit, setPendingEdit] = useState(null); // { newContent, originalContent, docType, assistantReply }
    const [selectionContext, setSelectionContext] = useState(null); // { text, screenNum, colIndex, rect }
    const [fileContext, setFileContext] = useState(null);
    const [fileUploading, setFileUploading] = useState(false);
    const ddEditorRef = useRef(null);
    const sbEditorRef = useRef(null);
    const chatRef = useRef(null);
    const selectionTooltipRef = useRef(null);
    const copilotPanelRef = useRef(null);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorder = useRef(null);
    const audioChunks = useRef([]);


    useEffect(() => { fetchProject(); }, [projectId]);
    useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [chatMessages]);

    // Automatically detect Storyboard Type based on content
    useEffect(() => {
        if (!sbContent) return;
        // Check for 7-column tabular pattern (Type 2)
        const lines = sbContent.slice(0, 5000).split('\n');
        const hasType2Structure = lines.some(line => {
            const pipeCount = (line.match(/\|/g) || []).length;
            // Type 2 has 7 columns = 8 pipes. Standard Type 1 header has 4 pipes.
            // Using 7 as a threshold was too sensitive to smaller tables or lines with pipes.
            return pipeCount >= 8;
        });

        if (hasType2Structure) {
            setSbType('Type 2');
        } else {
            setSbType('Type 1');
        }
    }, [sbContent]);

    // Track selection for AI Copilot
    useEffect(() => {
        const handleSelection = () => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) {
                // DON'T clear it immediately, maybe the user is about to click "Ask to edit"
                // setSelectionContext(null); 
                return;
            }
            const text = selection.toString().trim();
            if (!text) return;

            // Find the closest table cell
            let node = selection.anchorNode;
            while (node && node.nodeName !== 'TD' && node.nodeName !== 'BODY') {
                node = node.parentNode;
            }

            if (node && node.nodeName === 'TD') {
                const colIndex = Array.from(node.parentNode.children).indexOf(node);
                const rect = selection.getRangeAt(0).getBoundingClientRect();

                // Find target ID (Combined: Header | Row label)
                let headerLabel = null;
                let titleLabel = null;
                let rowLabel = node.parentNode.children[0].textContent.trim();

                // Look back for the nearest Screen or Module header
                const tableObj = node.closest('table');
                let prev = tableObj ? tableObj.previousElementSibling : null;
                while (prev) {
                    const match = prev.textContent.match(/(Screen\s+\d+\.\d+|Module\s+(\d+|[A-Z]))/i);
                    if (match) {
                        headerLabel = match[1];
                        titleLabel = prev.textContent.trim().replace(headerLabel, '').replace(/^[:\-\s\|]+/, '').trim();
                        break;
                    }
                    prev = prev.previousElementSibling;
                }

                let targetID = headerLabel;
                if (headerLabel) {
                    const numRows = tableObj ? tableObj.querySelectorAll('tbody tr').length : 0;
                    if (numRows === 1 && titleLabel) {
                        targetID = `${headerLabel} | ${titleLabel}`;
                    } else if (rowLabel) {
                        const cleanLabel = rowLabel.length > 100 ? titleLabel || rowLabel.substring(0, 50) : rowLabel;
                        targetID = `${headerLabel} | ${cleanLabel}`;
                    }
                } else if (rowLabel) {
                    targetID = rowLabel.length > 100 ? rowLabel.substring(0, 50) : rowLabel;
                }

                if (targetID) {
                    // Extract column name from header
                    const table = node.closest('table');
                    const ths = table.querySelectorAll('thead th');
                    const colName = ths[colIndex]?.textContent.trim() || '';

                    setSelectionContext({ text, screenNum: targetID, colIndex, colName, rect });
                }
            }
        };

        const handleClickOutside = (e) => {
            // Don't clear if clicking the tooltip itself
            if (selectionTooltipRef.current && selectionTooltipRef.current.contains(e.target)) return;

            // Don't clear if clicking inside the Copilot chat panel
            if (copilotPanelRef.current && copilotPanelRef.current.contains(e.target)) return;

            // Fallback for some floating elements or buttons that might be outside the ref
            if (e.target.closest('button') || e.target.closest('textarea')) return;

            setSelectionContext(null);
        };

        document.addEventListener('mouseup', handleSelection);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mouseup', handleSelection);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const fetchProject = async () => {
        try {
            setLoading(true);
            const data = await api.request(`/history/${projectId}`);
            setProject(data);

            let targetTab = 'intake';
            if (data.design_doc) {
                setDdContent(data.design_doc);
                setDdDisplayHtml('');
                targetTab = 'design';
            }
            if (data.storyboard) {
                setSbContent(data.storyboard);
                setSbDisplayHtml('');
                setDdApproved(true);
                if (!data.design_doc || data.design_doc.trim() === '') {
                    targetTab = 'storyboard';
                }
            }
            setActiveTab(targetTab);
        } catch { setError('Failed to load project details.'); }
        finally { setLoading(false); }
    };

    const intakeObj = useMemo(() => {
        if (!project) return {};
        try { return project.intake_data ? JSON.parse(project.intake_data) : {}; } catch { return {}; }
    }, [project]);

    // Clean markdown
    const cleanMarkdown = useCallback((text) => {
        return (text || '')
            .replace(/&lt;br\s*\/?&gt;/gi, '<br/>')
            .replace(/\\<br>/gi, '<br/>')
            .replace(/<br>/gi, '<br/>')
            .replace(/^[=]{5,}$/gm, '')
            .replace(/^[-]{5,}$/gm, '')
            .replace(/---\s*START OF DOCUMENT\s*---/gi, '')
            .replace(/---\s*END OF DOCUMENT\s*---/gi, '')
            .replace(/\s*\[START CONTENT\]\s*/gi, '')
            .replace(/\s*\[END CONTENT\]\s*/gi, '')
            .replace(/\n{5,}/g, '\n\n\n');
    }, []);

    const startEditingIntake = () => { setIntakeForm({ ...intakeObj }); setIsEditingIntake(true); };
    const handleIntakeChange = (field, value) => setIntakeForm(prev => ({ ...prev, [field]: value }));
    const saveIntake = async () => {
        setIntakeSaving(true);
        try {
            await api.request(`/edit/save-inline?doc_type=intake_data&project_id=${projectId}`, {
                method: 'POST', body: JSON.stringify({ content: JSON.stringify(intakeForm) })
            });
            setProject(prev => ({ ...prev, intake_data: JSON.stringify(intakeForm) }));
            setIsEditingIntake(false);
        } catch { alert('Failed to save intake data.'); }
        finally { setIntakeSaving(false); }
    };

    const handleGenerateDd = async () => {
        try {
            setDdGenerateLoading(true); setDdApproved(false);
            const res = await api.request(`/design/${projectId}/generate`, { method: 'POST' });
            setDdContent(res.design_doc);
            setDdDisplayHtml('');
            setProject(prev => ({ ...prev, design_doc: res.design_doc }));
            setActiveTab('design');
        } catch (err) { alert("Failed to generate: " + err.message); }
        finally { setDdGenerateLoading(false); }
    };
    const handleRegenerateDd = async () => { if (!confirm('Replace the current Design Document?')) return; handleGenerateDd(); };

    const handleSaveDd = async (content) => {
        setDdSaveStatus('Saving...');
        try {
            await api.request(`/edit/save-inline?doc_type=design_doc&project_id=${projectId}`, { method: 'POST', body: JSON.stringify({ content }) });
            setDdSaveStatus('✓ Saved'); setTimeout(() => setDdSaveStatus(''), 2000);
        } catch { setDdSaveStatus('Save failed'); }
    };

    const enterDdEdit = () => {
        setIsDdEditing(true);
        setTimeout(() => {
            if (ddEditorRef.current) {
                ddEditorRef.current.innerHTML = marked.parse(cleanMarkdown(ddContent));
            }
        }, 0);
    };

    const saveDdEdit = () => {
        if (ddEditorRef.current) {
            const html = ddEditorRef.current.innerHTML;
            setDdDisplayHtml(html);
            const md = turndown.turndown(html);
            setDdContent(md);
            handleSaveDd(md);
        }
        setIsDdEditing(false);
    };

    const downloadDd = async () => { await api.request(`/export/${projectId}/design-doc`, { method: 'GET' }); };
    const handleApproveDd = () => { setDdApproved(true); setActiveTab('storyboard'); };

    const handleGenerateSb = async () => {
        setSbGenerateLoading(true);
        setSbProgress({ current: 0, total: 0, status: 'Starting generation...' });
        try {
            const token = localStorage.getItem('token');
            const BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000/api' : '/api';
            const response = await fetch(`${BASE_URL}/storyboard/${projectId}/generate?storyboard_type=${encodeURIComponent(sbType)}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'text/event-stream' }
            });
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const event = JSON.parse(line.slice(6));
                        if (event.type === 'progress' || event.type === 'module_done') {
                            setSbProgress({ current: event.current, total: event.total, status: event.status });
                        } else if (event.type === 'complete') {
                            setSbContent(event.storyboard);
                            setSbDisplayHtml('');
                            setProject(prev => ({ ...prev, storyboard: event.storyboard }));
                        } else if (event.type === 'error') {
                            alert(event.message);
                        }
                    } catch (e) {
                        console.error("Error parsing SSE event:", e);
                    }
                }
            }
        } catch (err) { alert('Failed to generate storyboard: ' + err.message); }
        finally { setSbGenerateLoading(false); setSbProgress(null); }
    };
    const handleRegenerateSb = async () => { if (!confirm('Replace the current Storyboard?')) return; handleGenerateSb(); };

    const handleSaveSb = async (content) => {
        setSbSaveStatus('Saving...');
        try {
            await api.request(`/edit/save-inline?doc_type=storyboard&project_id=${projectId}`, { method: 'POST', body: JSON.stringify({ content }) });
            setSbSaveStatus('✓ Saved'); setTimeout(() => setSbSaveStatus(''), 2000);
        } catch { setSbSaveStatus('Save failed'); }
    };

    const enterSbEdit = () => {
        setIsSbEditing(true);
        setTimeout(() => {
            if (sbEditorRef.current) {
                sbEditorRef.current.innerHTML = marked.parse(cleanMarkdown(sbContent));
            }
        }, 0);
    };

    const saveSbEdit = () => {
        if (sbEditorRef.current) {
            const html = sbEditorRef.current.innerHTML;
            setSbDisplayHtml(html);
            const md = turndown.turndown(html);
            setSbContent(md);
            handleSaveSb(md);
        }
        setIsSbEditing(false);
    };

    const downloadSb = async () => { await api.request(`/export/${projectId}/storyboard`, { method: 'GET' }); };



    // --- COPILOT ---
    const copilotDocType = activeTab === 'storyboard' ? (sbType === 'Type 2' ? 'Storyboard Type 2' : 'storyboard') : 'design_doc';
    const copilotLabel = activeTab === 'storyboard' ? (sbType === 'Type 2' ? 'Storyboard Type 2' : 'Storyboard') : 'Design Document';

    const openCopilot = () => {
        setCopilotOpen(true);
        if (chatMessages.length === 0) {
            setChatMessages([{ role: 'ai', text: `Hi! I can help you refine the ${copilotLabel}. What would you like to change?` }]);
        }
    };

    const handleChat = async () => {
        if (!chatInput.trim()) return;
        const userInput = chatInput.trim();
        setChatMessages(prev => [...prev, { role: 'user', text: userInput }]);
        setChatInput(''); setChatLoading(true);
        try {
            const currentContent = copilotDocType === 'design_doc' ? ddContent : sbContent;
            // TRUNCATE: Prevent the PDF from crashing the AI
            const maxContextLength = 1500;
            const safeFileContext = fileContext && fileContext.length > maxContextLength
                ? fileContext.substring(0, maxContextLength) + "\n\n[...TRUNCATED DUE TO LENGTH...]"
                : fileContext;

            const payload = {
                doc_type: copilotDocType,
                user_prompt: userInput,
                current_content: currentContent,
                selected_text: selectionContext?.text,
                selected_screen_num: selectionContext?.screenNum,
                selected_col_index: selectionContext?.colIndex,
                selected_col_name: selectionContext?.colName,
                file_context: safeFileContext
            };

            const res = await api.request(`/edit/chat?project_id=${projectId}`, {
                method: 'POST', body: JSON.stringify(payload)
            });

            let updatedDoc = (res.updated_document || '').trim();
            // Safety fallback: strip any hallucinated markers that might break the diff
            updatedDoc = updatedDoc
                .replace(/\[?BEGIN CURRENT DOCUMENT CONTENT\]?/gi, '')
                .replace(/\[?END CURRENT DOCUMENT CONTENT\]?/gi, '')
                .replace(/<current_document>|<\/current_document>/gi, '') // Strip XML tags
                .replace(/---START OF DOCUMENT---/gi, '')
                .replace(/---END OF DOCUMENT---/gi, '')
                .trim();

            const clean = (t) => (t || '').replace(/\s/g, '');
            const hasChange = updatedDoc && clean(updatedDoc) !== clean(currentContent);

            if (hasChange) {
                // Ensure we close editing mode so the DiffViewer can render
                setIsDdEditing(false);
                setIsSbEditing(false);

                setPendingEdit({
                    newContent: updatedDoc,
                    originalContent: currentContent,
                    docType: copilotDocType,
                    assistantReply: res.assistant_reply
                });
                setChatMessages(prev => [...prev, {
                    role: 'ai',
                    text: res.assistant_reply,
                    isProposal: true
                }]);
            } else {
                setChatMessages(prev => [...prev, {
                    role: 'ai',
                    text: res.assistant_reply
                }]);

                // Only show system feedback if the user's input looks like an intended edit
                // If they're just saying "Hi", don't annoy them with "No changes made"
                const lowerInput = userInput.toLowerCase();
                const isEditRequest = lowerInput.includes('change') || lowerInput.includes('update') || lowerInput.includes('edit') || lowerInput.includes('revise') || lowerInput.includes('fix');

                if (isEditRequest) {
                    setChatMessages(prev => [...prev, {
                        role: 'system',
                        text: '💡 The AI suggested no document changes for this specific prompt. Your document is already up to date.'
                    }]);
                }
            }
        } catch (e) {
            setChatMessages(prev => [...prev, { role: 'system', text: 'Error: ' + e.message }]);
        } finally {
            setChatLoading(false);
            // Clear the pinned selection context after sending to avoid confusion
            setSelectionContext(null);
            // DO NOT clear fileContext so the user can continue editing with the same PDF!
        }
    };

    const handleAcceptEdit = async () => {
        if (!pendingEdit) return;
        const { newContent, docType } = pendingEdit;
        try {
            if (docType === 'design_doc') {
                setDdContent(newContent);
                setDdDisplayHtml('');
                await handleSaveDd(newContent);
            } else {
                setSbContent(newContent);
                setSbDisplayHtml('');
                await handleSaveSb(newContent);
            }
            setChatMessages(prev => [...prev, { role: 'system', text: '✓ Changes accepted and saved.' }]);
            setPendingEdit(null);
        } catch (e) {
            alert("Failed to save accepted changes: " + e.message);
        }
    };

    const handleRejectEdit = () => {
        setChatMessages(prev => [...prev, { role: 'system', text: '✕ Changes rejected.' }]);
        setPendingEdit(null);
    };

    if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader size={32} className="spinner" style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} /></div>;
    if (error) return <div className="w-full max-w-7xl mx-auto p-4 flex flex-col items-center justify-center mt-10"><div className="card p-6 text-center w-full max-w-md"><h3 className="text-xl font-bold mb-2" style={{ color: 'var(--danger)' }}>Error</h3><p className="text-muted mb-4">{error}</p><button className="btn btn-outline" onClick={onBack}><ArrowLeft size={16} /> Go back</button></div></div>;
    if (!project) return null;

    const IntakeField = ({ label, field, type = 'text', options, multiple = false }) => {
        if (!isEditingIntake) return <div><span className="text-muted text-sm block">{label}</span><div className="font-semibold">{intakeObj[field] || 'N/A'}</div></div>;
        if (options) {
            if (multiple) {
                return (
                    <div>
                        <label className="form-label">{label}</label>
                        <div className="flex flex-col gap-2 p-2 form-control" style={{ height: 'auto', minHeight: '40px' }}>
                            {options.map(opt => {
                                const isChecked = (intakeForm[field] || '').split(', ').includes(opt);
                                return (
                                    <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded m-0">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => {
                                                let current = (intakeForm[field] || '').split(', ').filter(Boolean);
                                                if (e.target.checked) current.push(opt);
                                                else current = current.filter(item => item !== opt);
                                                handleIntakeChange(field, current.join(', '));
                                            }}
                                            style={{ accentColor: 'var(--primary)', width: '16px', height: '16px', margin: 0, cursor: 'pointer' }}
                                        />
                                        {opt}
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                );
            }
            return (
                <div>
                    <label className="form-label">{label}</label>
                    <select className="form-control" value={intakeForm[field] || ''} onChange={e => handleIntakeChange(field, e.target.value)}>
                        {options.map(o => <option key={o}>{o}</option>)}
                    </select>
                </div>
            );
        }
        if (type === 'range') return <div><label className="form-label">{label}: {intakeForm[field] || 3}</label><input type="range" className="w-full" min="3" max="12" value={intakeForm[field] || 3} onChange={e => handleIntakeChange(field, e.target.value)} style={{ accentColor: 'var(--primary)' }} /></div>;
        if (type === 'smallRange') return <div><label className="form-label">{label}: {intakeForm[field] || 3}</label><input type="range" className="w-full" min="1" max="8" value={intakeForm[field] || 3} onChange={e => handleIntakeChange(field, e.target.value)} style={{ accentColor: 'var(--primary)' }} /></div>;
        return <div><label className="form-label">{label}</label><input type="text" className="form-control" value={intakeForm[field] || ''} onChange={e => handleIntakeChange(field, e.target.value)} /></div>;
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setFileUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000/api' : '/api';
            const response = await fetch(`${BASE_URL}/extraction/extract-text-only`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
            });
            const data = await response.json();
            if (data.text) {
                setFileContext(data.text);
                setChatMessages(prev => [...prev, { role: 'system', text: `📎 Attached file: ${file.name}` }]);
            }
        } catch (err) {
            alert('Failed to upload file');
        } finally {
            setFileUploading(false);
            e.target.value = null; // reset input
        }
    };
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream);
            audioChunks.current = [];

            mediaRecorder.current.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunks.current.push(event.data);
            };

            mediaRecorder.current.onstop = async () => {
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });

                const formData = new FormData();
                formData.append("audio", audioBlob, "recording.webm");

                try {
                    const BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000/api' : '/api';
                    const res = await fetch(`${BASE_URL}/speech-to-text/`, {
                        method: "POST",
                        body: formData,
                    });
                    const data = await res.json();

                    if (data.text) {
                        setChatInput(prev => prev ? prev + " " + data.text : data.text);
                    }
                } catch (err) {
                    console.error("Transcription failed", err);
                }

                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.current.start();
            setIsRecording(true);
        } catch (err) {
            alert("Please allow microphone access to use Voice Typing!");
        }
    };

    const stopRecording = () => {
        if (mediaRecorder.current && isRecording) {
            mediaRecorder.current.stop();
            setIsRecording(false);
        }
    };

    const tabs = [
        { id: 'intake', label: 'Project Info', icon: <Edit3 size={16} /> },
        { id: 'design', label: 'Design Document', icon: <FileText size={16} />, disabled: !ddContent && !ddGenerateLoading },
        { id: 'storyboard', label: 'Storyboard', icon: <Layout size={16} />, disabled: !ddApproved && !sbContent && !sbGenerateLoading },
    ];

    return (
        <div className="animate-fade-in w-full max-w-7xl mx-auto p-4 flex flex-col gap-4" style={{ marginTop: '0.5rem', paddingBottom: '4rem' }}>
            <div className="flex justify-between items-center p-4 rounded-lg" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
                <div className="flex items-center gap-4">
                    <button className="btn btn-outline" onClick={onBack}><ArrowLeft size={18} /></button>
                    <div>
                        <h2 className="text-xl font-bold m-0">{project.title}</h2>
                        <span className="text-xs text-muted block mt-1">{project.business_unit || 'Project'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-lg" style={{ background: ddContent ? 'var(--primary-light)' : 'var(--bg-color)', color: ddContent ? 'var(--primary)' : 'var(--text-muted)' }}>Design {ddContent ? '✓' : '○'}</span>
                    <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-lg" style={{ background: ddApproved ? 'var(--primary-light)' : 'var(--bg-color)', color: ddApproved ? 'var(--primary)' : 'var(--text-muted)' }}>Approved {ddApproved ? '✓' : '○'}</span>
                    <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-lg" style={{ background: sbContent ? 'var(--secondary-light)' : 'var(--bg-color)', color: sbContent ? 'var(--secondary)' : 'var(--text-muted)' }}>Storyboard {sbContent ? '✓' : '○'}</span>
                </div>
            </div>

            <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => !tab.disabled && setActiveTab(tab.id)} disabled={tab.disabled}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                        style={{
                            flex: 1, border: 'none', cursor: tab.disabled ? 'not-allowed' : 'pointer', transition: 'all 0.25s',
                            background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                            color: activeTab === tab.id ? 'white' : tab.disabled ? 'var(--text-muted)' : 'var(--text-main)',
                            opacity: tab.disabled ? 0.4 : 1, justifyContent: 'center'
                        }}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'intake' && (
                <div className="card w-full animate-fade-in">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b">
                        <h3 className="text-xl font-bold">Project Information & Logistics</h3>
                        <div className="flex gap-2">
                            {isEditingIntake ? (<>
                                <button className="btn btn-outline" onClick={() => setIsEditingIntake(false)}>Cancel</button>
                                <button className="btn btn-primary" onClick={saveIntake} disabled={intakeSaving}>{intakeSaving ? <><Loader size={14} className="spinner" /> Saving...</> : <><Save size={14} /> Save</>}</button>
                            </>) : <button className="btn btn-outline" onClick={startEditingIntake}><Edit3 size={14} /> Edit</button>}
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                        <IntakeField label="Course Title" field="course_title" />
                        <IntakeField label="Business Unit" field="business_unit" options={['Sales', 'Operations', 'Claims', 'HR', 'IT', 'Compliance', 'Finance', 'Other']} />
                        <IntakeField label="Course Type" field="course_type" options={['Regulatory / Compliance', 'Product Training', 'Process Training', 'Soft Skills', 'Systems Training', 'Technical Training', 'Other']} />
                        <IntakeField label="Target Audience" field="target_audience" />
                        <IntakeField label="Experience Level" field="experience_level" multiple={true} options={['Fresher', '1-2 years', '2-5 years', '5+ years']} />
                        <IntakeField label="Geographic Spread" field="geographic_spread" options={['Global', 'North America', 'United States', 'United Kingdom', 'Europe', 'Asia Pacific', 'Middle East and Africa', 'Latin America', 'Diverse / Multi-region']} />
                        <IntakeField label="Interactivity Level" field="interactivity_level" options={['Level 1 - Basic Click-through', 'Level 2 - Moderate Interaction', 'Level 3 - High Interactivity', 'Level 4 - Simulation / Game-based']} />
                        <IntakeField label="Number of Modules" field="num_modules" type="range" />
                        <IntakeField label="Language Preference" field="language_preference" options={['American English', 'British English']} />
                        <IntakeField label="Knowledge Check Difficulty" field="knowledge_check_difficulty" options={['Mixed', 'Easy', 'Medium', 'Hard']} />
                        <IntakeField label="Knowledge Check Questions" field="knowledge_check_count" type="smallRange" />
                        <IntakeField label="Knowledge Check Types" field="knowledge_check_types" />
                        <div>
                            <span className="text-muted text-sm block">Objectives</span>
                            {isEditingIntake ? (
                                <div className="flex flex-col gap-2" style={{ marginTop: '0.5rem' }}>
                                    <input className="form-control" placeholder="Objective 1" value={intakeForm.objective_1 || ''} onChange={e => handleIntakeChange('objective_1', e.target.value)} />
                                    <input className="form-control" placeholder="Objective 2" value={intakeForm.objective_2 || ''} onChange={e => handleIntakeChange('objective_2', e.target.value)} />
                                    <input className="form-control" placeholder="Objective 3" value={intakeForm.objective_3 || ''} onChange={e => handleIntakeChange('objective_3', e.target.value)} />
                                </div>
                            ) : (
                                <div className="font-semibold text-sm">
                                    {intakeObj.objective_1 && <div>• {intakeObj.objective_1}</div>}
                                    {intakeObj.objective_2 && <div>• {intakeObj.objective_2}</div>}
                                    {intakeObj.objective_3 && <div>• {intakeObj.objective_3}</div>}
                                </div>
                            )}
                        </div>
                        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <IntakeField label="Style Guide" field="style_guide" />
                            <IntakeField label="Guidelines / Spelling Check Notes" field="guidelines" />
                        </div>
                    </div>
                    {pendingEdit && (
                        <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-200 text-center animate-fade-in">
                            <h4 className="font-bold text-blue-700 flex items-center justify-center gap-2 mb-1"><Eye size={18} /> Review Required</h4>
                            <p className="text-sm text-blue-600 mb-3">The AI has proposed edits for the <strong>{pendingEdit.docType === 'design_doc' ? 'Design Document' : 'Storyboard'}</strong>.</p>
                            <button className="btn btn-primary px-6" onClick={() => setActiveTab(pendingEdit.docType === 'design_doc' ? 'design' : 'storyboard')}>Switch Tab to Review →</button>
                        </div>
                    )}
                    <div className="text-center" style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                        {ddContent ? (
                            <div className="flex justify-center gap-3">
                                <button className="btn btn-primary" onClick={() => setActiveTab('design')}>View Design Document →</button>
                                <button className="btn btn-outline" onClick={handleRegenerateDd} disabled={ddGenerateLoading}>
                                    {ddGenerateLoading ? <><Loader size={14} className="spinner" /> Regenerating...</> : <><RefreshCw size={14} /> Regenerate Design Doc</>}
                                </button>
                            </div>
                        ) : (
                            <button className="btn btn-primary px-6 py-2" onClick={handleGenerateDd} disabled={ddGenerateLoading}>
                                {ddGenerateLoading ? <span className="flex items-center gap-2"><Loader className="spinner" size={16} /> Analyzing source & drafting...</span> : '🚀 Generate Design Document'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'design' && (
                <div className="card w-full animate-fade-in" style={{ padding: 0, overflow: 'visible' }}>
                    <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                        <h3 className="text-lg font-bold flex items-center gap-2"><FileText style={{ color: 'var(--primary)' }} size={20} /> Design Document</h3>
                        <div className="flex gap-2 items-center flex-wrap justify-end">
                            <span className="text-xs font-medium" style={{ color: 'var(--secondary)' }}>{ddSaveStatus}</span>
                            {ddGenerateLoading && <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--primary)' }}><Loader size={14} className="spinner" /> Regenerating...</span>}
                            <button className="btn btn-outline" onClick={handleRegenerateDd} disabled={ddGenerateLoading}><RefreshCw size={14} /> Regenerate</button>
                            {isDdEditing
                                ? <button className="btn btn-primary" onClick={saveDdEdit}><Save size={14} /> Save</button>
                                : <button className="btn btn-outline" onClick={enterDdEdit}><Edit3 size={14} /> Edit</button>
                            }
                            <button className="btn btn-outline" onClick={openCopilot}><MessageSquare size={14} /> AI Assistant</button>
                            <button className="btn btn-primary" onClick={downloadDd}><Download size={16} /> Export</button>
                        </div>
                    </div>
                    {isDdEditing && (
                        <div className="p-2 flex items-center gap-2 text-sm" style={{ background: 'var(--primary-light)', color: 'var(--primary)', borderBottom: '1px solid var(--primary)' }}>
                            <Edit3 size={14} /> <strong>Editing mode</strong> — Click any text to edit it directly.
                        </div>
                    )}
                    {isDdEditing ? (
                        <div ref={ddEditorRef} className="markdown-preview" contentEditable={true} suppressContentEditableWarning={true} style={{ padding: '2rem', minHeight: '600px', outline: 'none', background: '#FAFBFF', cursor: 'text', border: '2px solid var(--primary)', borderTop: 'none' }} />
                    ) : (
                        pendingEdit && pendingEdit.docType === 'design_doc' ? (
                            <DiffViewer oldText={pendingEdit.originalContent} newText={pendingEdit.newContent} cleanMarkdown={cleanMarkdown} />
                        ) : (
                            <div className="markdown-preview" style={{ padding: '2rem' }} dangerouslySetInnerHTML={{ __html: ddDisplayHtml || marked.parse(cleanMarkdown(ddContent)) }} />
                        )
                    )}

                    {!ddApproved && (
                        <div className="text-center p-6" style={{ background: 'linear-gradient(135deg, var(--primary-light), var(--secondary-light))', borderTop: '2px solid var(--primary)' }}>
                            <ShieldCheck size={32} style={{ color: 'var(--primary)', margin: '0 auto 0.5rem' }} />
                            <h4 className="font-bold mb-1" style={{ color: 'var(--primary)' }}>Approve & Proceed to Storyboard</h4>
                            <p className="text-muted text-sm mb-4">Review the document above. Once approved, the Storyboard tab unlocks.</p>
                            <button className="btn btn-primary px-6 py-2" onClick={handleApproveDd}><CheckCircle size={16} /> Approve & Continue</button>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'storyboard' && ddApproved && (
                <div className="card w-full animate-fade-in" style={{ padding: 0, overflow: 'visible' }}>
                    {sbGenerateLoading && (
                        <div style={{ background: 'linear-gradient(135deg, var(--primary-light), var(--secondary-light))', padding: '2rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }} className="animate-pulse">
                            <Loader size={32} className="spinner" style={{ color: 'var(--primary)', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem', display: 'block' }} />
                            <h4 className="font-bold text-xl mb-3" style={{ color: 'var(--primary)' }}>{sbProgress?.status || 'Preparing Storyboard...'}</h4>

                            {sbProgress && sbProgress.total > 0 && (
                                <div className="w-full max-w-md mx-auto mt-4">
                                    <div className="flex justify-between text-xs font-bold mb-1 uppercase tracking-wider" style={{ color: 'var(--primary)' }}>
                                        <span>Progress</span>
                                        <span>{Math.round((sbProgress.current / sbProgress.total) * 100)}%</span>
                                    </div>
                                    <div style={{ height: '10px', width: '100%', background: 'rgba(37, 99, 235, 0.1)', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${(sbProgress.current / sbProgress.total) * 100}%`,
                                            background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
                                            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                            boxShadow: '0 0 10px rgba(37, 99, 235, 0.5)'
                                        }} />
                                    </div>
                                    <p className="text-xs text-muted mt-3 italic">Generating course materials module-by-module for maximum precision...</p>
                                </div>
                            )}
                        </div>
                    )}

                    {sbContent ? (
                        <>
                            <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                                <h3 className="text-lg font-bold flex items-center gap-2"><Layout style={{ color: 'var(--secondary)' }} size={20} /> Storyboard</h3>
                                <div className="flex gap-2 items-center flex-wrap justify-end">
                                    <span className="text-xs font-medium" style={{ color: 'var(--secondary)' }}>{sbSaveStatus}</span>
                                    <select className="form-control py-1 px-2 w-auto text-sm" value={sbType} onChange={e => setSbType(e.target.value)} style={{ maxWidth: '180px' }}>
                                        <option value="Type 1">Type 1 (Block)</option>
                                        <option value="Type 2">Type 2 (Tabular)</option>
                                    </select>
                                    <button className="btn btn-outline" onClick={handleRegenerateSb} disabled={sbGenerateLoading}><RefreshCw size={14} /> Regenerate</button>
                                    {isSbEditing
                                        ? <button className="btn btn-primary" onClick={saveSbEdit}><Save size={14} /> Save</button>
                                        : <button className="btn btn-outline" onClick={enterSbEdit}><Edit3 size={14} /> Edit</button>
                                    }
                                    <button className="btn btn-outline" onClick={openCopilot}><MessageSquare size={14} /> AI Assistant</button>
                                    <button className="btn btn-primary" onClick={downloadSb} style={{ background: 'linear-gradient(135deg, #0EA5E9, #2563EB)' }}><Download size={16} /> Export</button>

                                </div>
                            </div>
                            {isSbEditing && (
                                <div className="p-2 flex items-center gap-2 text-sm" style={{ background: 'var(--secondary-light)', color: 'var(--secondary)', borderBottom: '1px solid var(--secondary)' }}>
                                    <Edit3 size={14} /> <strong>Editing mode</strong> — Click any text to edit it directly.
                                </div>
                            )}
                            {isSbEditing ? (
                                <div ref={sbEditorRef} className="markdown-preview" contentEditable={true} suppressContentEditableWarning={true} style={{ padding: '2rem', minHeight: '700px', outline: 'none', background: '#FAFEFF', cursor: 'text', border: '2px solid var(--secondary)', borderTop: 'none' }} />
                            ) : (
                                pendingEdit && (pendingEdit.docType === 'storyboard' || pendingEdit.docType === 'Storyboard Type 2') ? (
                                    <DiffViewer oldText={pendingEdit.originalContent} newText={pendingEdit.newContent} cleanMarkdown={cleanMarkdown} />
                                ) : (
                                    <div className="markdown-preview" style={{ padding: '2rem' }} dangerouslySetInnerHTML={{ __html: sbDisplayHtml || marked.parse(cleanMarkdown(sbContent)) }} />
                                )
                            )}
                        </>
                    ) : (
                        !sbGenerateLoading && (
                            <div className="text-center p-10">
                                <Layout size={48} style={{ color: 'var(--secondary)', margin: '0 auto 1rem', opacity: 0.5 }} />
                                <h4 className="font-bold text-lg mb-2">Generate Storyboard</h4>
                                <button className="btn btn-secondary px-6 py-2" onClick={handleGenerateSb} disabled={sbGenerateLoading}>
                                    🚀 Generate Storyboard
                                </button>
                            </div>
                        )
                    )}
                </div>
            )}

            {copilotOpen && (
                <div ref={copilotPanelRef} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', zIndex: 1000, background: 'var(--surface)', borderLeft: '1px solid var(--border)', boxShadow: '-8px 0 32px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.3s ease-out' }}>
                    <div className="flex justify-between items-center p-4 border-b" style={{ background: 'var(--gradient-hero, var(--primary))', color: 'white', borderColor: 'transparent' }}>
                        <span className="font-bold flex items-center gap-2"><MessageSquare size={18} /> AI Assistant</span>
                        <button onClick={() => setCopilotOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
                    </div>
                    <div className="chat-messages flex-1" ref={chatRef} style={{ overflowY: 'auto' }}>
                        {chatMessages.map((m, i) => (
                            <div key={i} className={`msg ${m.role}`}>
                                <div dangerouslySetInnerHTML={{ __html: m.text.replace(/\n/g, '<br>') }} />
                                {m.isProposal && pendingEdit && (
                                    <div className="mt-4 p-4 rounded-xl bg-white border border-blue-200 shadow-md animate-fade-in">
                                        <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">
                                            <ShieldCheck size={14} /> Review Required
                                        </div>
                                        <div className="text-sm text-slate-600 mb-4 leading-relaxed">
                                            Prepared a draft with changes. Review the **highlighted document** to your left.
                                        </div>
                                        <div className="flex gap-2">
                                            <button className="btn btn-primary flex-1 py-2 text-sm font-bold" onClick={handleAcceptEdit}><CheckCircle size={16} /> Accept</button>
                                            <button className="btn btn-outline flex-1 py-2 text-sm font-bold" onClick={handleRejectEdit}><X size={16} /> Reject</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {chatLoading && <div className="msg system">Thinking...</div>}
                    </div>

                    {selectionContext && (
                        <div className="px-4 py-2 text-xs border-t" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderLeft: '3px solid var(--primary)' }}>
                            <div className="flex justify-between items-center font-bold mb-1">
                                <span className="flex items-center gap-1">📍 Selection Active</span>
                                <button className="p-0 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer" onClick={() => setSelectionContext(null)}>✕</button>
                            </div>
                            <div className="truncate opacity-80 italic">"{selectionContext.text}"</div>
                            <div className="mt-1 opacity-60">Target: {selectionContext.screenNum}</div>
                        </div>
                    )}

                    <div className="p-3 border-t flex gap-2 items-end" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-color)' }}>
                        <label className="btn btn-outline flex items-center justify-center p-2 cursor-pointer m-0" style={{ height: '40px' }}>
                            {fileUploading ? <Loader size={18} className="spinner" /> : <Paperclip size={18} />}
                            <input type="file" style={{ display: 'none' }} accept=".pdf,.docx,.txt" onChange={handleFileUpload} disabled={fileUploading} />
                        </label>

                        <div className="flex gap-2 w-full items-end">
                            <GrammarTextarea className="form-control m-0 w-full" style={{ minHeight: '40px', resize: 'none' }} rows={2} placeholder="Ask to edit... (or use voice)" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat(); } }} />
                            <button className={`btn ${isRecording ? 'btn-danger' : 'btn-outline'} flex-shrink-0 items-center justify-center p-2`} style={{ height: '40px' }} onClick={isRecording ? stopRecording : startRecording} title="Voice Typing">
                                {isRecording ? <Square size={18} /> : <Mic size={18} />}
                            </button>
                        </div>

                        <button className="btn btn-primary items-center justify-center p-2" style={{ height: '40px' }} onClick={handleChat} disabled={chatLoading}><Send size={18} /></button>
                    </div>


                </div>
            )}

            {!copilotOpen && (ddContent || sbContent) && (
                <button onClick={openCopilot} style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 999, width: '56px', height: '56px', borderRadius: '50%', background: 'var(--gradient-hero, var(--primary))', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(37, 99, 235, 0.35)', transition: 'transform 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}><MessageSquare size={24} /></button>
            )}

            {selectionContext && selectionContext.rect && (
                <>
                    <div
                        ref={selectionTooltipRef}
                        className="animate-fade-in shadow-xl rounded-lg overflow-hidden flex"
                        style={{
                            position: 'fixed',
                            top: selectionContext.rect.top - 45,
                            left: selectionContext.rect.left + (selectionContext.rect.width / 2) - 80,
                            zIndex: 2000,
                            background: '#1E293B',
                            color: 'white',
                            padding: '4px',
                            fontSize: '13px',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}
                    >
                        <button
                            className="px-3 py-1 flex items-center gap-2 bg-transparent border-none text-white cursor-pointer hover:bg-slate-700 transition"
                            onClick={() => openCopilot()}
                        >
                            <Edit3 size={14} /> Selected Text
                        </button>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                        <button
                            className="px-2 py-1 bg-transparent border-none text-slate-400 cursor-pointer hover:text-white"
                            onClick={() => setSelectionContext(null)}
                        >
                            ✕
                        </button>
                        <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', borderTop: '6px solid #1E293B', borderLeft: '6px solid transparent', borderRight: '6px solid transparent' }} />
                    </div>
                    {/* Persistent Selection Highlight Overlay */}
                    <div
                        style={{
                            position: 'fixed',
                            top: selectionContext.rect.top,
                            left: selectionContext.rect.left,
                            width: selectionContext.rect.width,
                            height: selectionContext.rect.height,
                            backgroundColor: 'rgba(37, 99, 235, 0.18)',
                            border: '1px solid rgba(37, 99, 235, 0.3)',
                            borderRadius: '2px',
                            pointerEvents: 'none',
                            zIndex: 1500
                        }}
                    />
                </>
            )}
        </div>
    );
}
