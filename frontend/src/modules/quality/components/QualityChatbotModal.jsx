import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, X, Send, Bot, User, RefreshCw, Copy, Check,
  Terminal, Users, Clock, BarChart3, Rocket, AlertTriangle,
  FileText, CornerDownLeft, ChevronDown, Maximize2, Minimize2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import ChatbotAvatar from './ChatbotAvatar';

export default function QualityChatbotModal({ currentUser = 'User', projects = [], bugs = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const initialBotGreeting = {
    sender: 'bot',
    text: `### 👋 Hello ${currentUser}! I'm your Quality AI Assistant.

I am the central AI feature of Quality Central, designed to assist engineers, reviewers, and managers across the defect lifecycle.

**What I can do for you right now:**
1. 📝 **Report Bugs Conversationally**: Type an issue symptom (e.g. *"The checkout page freezes after I click Pay"*). I'll ask clarifying follow-ups, prepare a structured report, and let you review and submit it.
2. 🔎 **Search Existing Bugs**: Ask *"Has anyone reported this issue before?"*, *"Show me open critical bugs on Android"*, or *"Are there any similar login failures?"*.
3. 🛠️ **Help Developers Investigate**: Ask *"Summarize this issue and tell me what I should investigate first"* — I provide issue context, reproduction checklist, and strictly separate **verified root causes** from **suggested hypotheses**.
4. 📈 **Help Reviewers & Managers**: Ask *"Summarize the changes made to this bug"*, *"Which high-severity bugs are still unresolved?"*, *"Recurring issues in the latest release"*, or 30-day velocity metrics comparison.

Pick a quick action below or ask me anything in plain English!`,
    suggestions: [
      'The checkout page freezes after I click Pay.',
      'Show me open critical bugs on Android.',
      'Are there any similar login failures?',
      'Summarize this issue and tell me what I should investigate first.',
      'Which high-severity bugs are still unresolved?',
      'How many Normal priority bugs did the Platform team solve in the last 30 days?'
    ],
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem('qc_chatbot_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [initialBotGreeting];
  });

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem('qc_chatbot_history', JSON.stringify(messages));
    } catch {}
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, isMinimized]);

  const handleSendMessage = async (textToSend = null) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg = {
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/quality/chatbot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: text,
          user_name: currentUser,
          bugs: bugs
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with HTTP ${response.status}`);
      }

      const data = await response.json();

      const botMsg = {
        sender: 'bot',
        text: data.text || 'I analyzed the quality data, but no detailed summary was returned.',
        intent: data.intent,
        data: data.data || data,
        bugDraft: data.bug_draft || data.data?.bug_draft,
        matches: data.matches || data.data?.matches,
        canSubmit: Boolean(data.can_submit || data.bug_draft || data.data?.bug_draft),
        suggestions: data.suggestions || [
          'The checkout page freezes after I click Pay.',
          'Show me open critical bugs on Android.',
          'Which high-severity bugs are still unresolved?'
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error('[QualityChatbot] Error:', err);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: `⚠️ **Unable to reach Quality Intelligence API**: ${err.message}. Please verify the backend is running.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitBugDraft = async (draft) => {
    if (!draft) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/quality/chatbot/submit-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          draft: draft,
          user_name: currentUser
        })
      });
      const res = await response.json();
      if (res.success) {
        toast.success(`Bug ticket [${res.bug_id}] created successfully!`);
        const confirmMsg = {
          sender: 'bot',
          text: `### 🎉 Bug Ticket Created Successfully!\n\n• **Ticket ID**: \`[${res.bug_id}]\`\n• **Title**: **${res.bug?.title || draft.title}**\n• **Project & Module**: \`${res.bug?.project || draft.project}\` → \`${res.bug?.module || draft.module}\`\n• **Environment**: \`${res.bug?.environment || draft.environment}\`\n• **Severity**: **${res.bug?.severity || draft.severity}** | **Status**: \`Open\`\n• **Assignee**: \`${res.bug?.assignee || draft.assignee}\`\n\n✅ *Ticket has been saved into PostgreSQL and logged in audit timeline.*`,
          suggestions: [
            `Summarize issue ${res.bug_id} and tell me what I should investigate first`,
            `Check if there are similar bugs to ${res.bug_id}`,
            'Which high-severity bugs are still unresolved?'
          ],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, confirmMsg]);
      } else {
        toast.error(res.message || 'Failed to submit bug draft');
      }
    } catch (err) {
      toast.error(`Error submitting ticket: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([initialBotGreeting]);
    sessionStorage.removeItem('qc_chatbot_history');
    toast.success('Chatbot history cleared');
  };

  const handleCopyText = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const QUICK_ACTIONS = [
    { label: '📝 Report Bug', prompt: 'The checkout page freezes after I click Pay.' },
    { label: '📱 Search Android', prompt: 'Show me open critical bugs on Android.' },
    { label: '🔑 Search Login Bugs', prompt: 'Are there any similar login failures?' },
    { label: '🛠️ Investigate First', prompt: 'Summarize this issue and tell me what I should investigate first.' },
    { label: '🚨 Unresolved High-Severity', prompt: 'Which high-severity bugs are still unresolved?' },
    { label: '📈 30-Day Solved Velocity', prompt: 'How many Normal priority bugs did the Platform team solve in the last 30 days? How does that compare to the previous 30 days?' },
    { label: '🔄 Recurring Issues', prompt: 'What are the recurring issues in the latest release?' },
    { label: '📜 Changes Summary', prompt: 'Summarize the changes made to this bug.' }
  ];

  // Helper to format bot markdown text into formatted HTML blocks
  const renderFormattedBotMessage = (content) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      // Horizontal divider
      if (line.trim() === '---') {
        return <hr key={idx} className="my-2 border-slate-200" />;
      }
      // Section header for Verified Root Causes
      if (line.includes('VERIFIED ROOT CAUSES')) {
        return (
          <div key={idx} className="mt-2.5 mb-1 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200/90 rounded-lg flex items-center gap-1.5">
            <span className="text-emerald-700 font-bold text-xs uppercase tracking-wide">
              🔒 VERIFIED ROOT CAUSES & CONFIRMED SYSTEM FACTS
            </span>
          </div>
        );
      }
      // Section header for Suggested Hypotheses
      if (line.includes('SUGGESTED TROUBLESHOOTING STEPS')) {
        return (
          <div key={idx} className="mt-2.5 mb-1 px-2.5 py-1.5 bg-violet-50 border border-violet-200/90 rounded-lg flex items-center gap-1.5">
            <span className="text-violet-700 font-bold text-xs uppercase tracking-wide">
              💡 SUGGESTED TROUBLESHOOTING STEPS & HYPOTHESES (Investigate First)
            </span>
          </div>
        );
      }
      // AI Analyst Card Header
      if (line.includes('AI Analyst — Defect Resolution Velocity')) {
        return (
          <div key={idx} className="mt-1 mb-1 px-2.5 py-1.5 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-lg flex items-center gap-2 text-white">
            <Sparkles size={13} className="text-amber-300" />
            <span className="font-extrabold text-xs tracking-wide">
              AI Analyst — Approved Analytics
            </span>
          </div>
        );
      }
      // Headers
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="text-sm font-extrabold text-slate-900 mt-2 mb-1 flex items-center gap-1.5">{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={idx} className="font-bold text-slate-800 my-1">{line.replace(/\*\*/g, '')}</p>;
      }
      // Code snippet block start
      if (line.startsWith('```')) {
        return null;
      }
      // Blockquotes
      if (line.startsWith('> ')) {
        return (
          <blockquote key={idx} className="my-1 pl-2.5 border-l-2 border-slate-300 text-slate-600 text-[11px] italic">
            {line.replace('> ', '')}
          </blockquote>
        );
      }
      // Bullet points
      if (line.startsWith('• ') || line.startsWith('- ')) {
        const itemText = line.substring(2);
        return (
          <li key={idx} className="ml-4 list-disc text-slate-700 text-xs leading-relaxed my-0.5">
            <span dangerouslySetInnerHTML={{ __html: itemText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-slate-100 text-violet-700 rounded font-mono text-[11px]">$1</code>') }} />
          </li>
        );
      }
      // Empty line
      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }
      // Standard line
      return (
        <p key={idx} className="text-xs text-slate-700 my-0.5 leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: line
              .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
              .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded font-mono font-medium text-[11px] border border-violet-100">$1</code>')
          }}
        />
      );
    });
  };

  return (
    <>
      {/* ========================================================
          FLOATING LAUNCHER BUTTON (Bottom-Right)
      ======================================================== */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-6 right-8 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-105 cursor-pointer group"
          style={{
            background: 'linear-gradient(135deg, #0052FF 0%, #0066FF 50%, #1E40AF 100%)',
            boxShadow: '0 10px 25px -5px rgba(0, 102, 255, 0.45), 0 8px 10px -6px rgba(30, 64, 175, 0.35)'
          }}
        >
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm p-0.5">
            <ChatbotAvatar size={24} className="rounded-full shadow-sm" glow={true} />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full" />
          </div>
          <div className="text-left pr-1">
            <div className="text-[12px] font-extrabold text-white tracking-wide uppercase leading-tight flex items-center gap-1.5">
              <span>Quality AI Assistant</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/25 text-white font-mono">v3.0</span>
            </div>
            <div className="text-[10px] text-blue-100 font-medium">Report bugs • Search • RCA • Analytics</div>
          </div>
        </button>
      )}

      {/* ========================================================
          CHATBOT DIALOG / MODAL WINDOW
      ======================================================== */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-300 flex flex-col bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden font-sans ${
            isExpanded
              ? 'inset-6 max-w-5xl mx-auto'
              : 'bottom-6 right-6 w-[430px] sm:w-[480px] h-[640px]'
          } ${isMinimized ? '!h-14 overflow-hidden' : ''}`}
          style={{
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(0, 102, 255, 0.12)'
          }}
        >
          {/* HEADER BAR */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b select-none"
            style={{
              background: 'linear-gradient(135deg, #0A192F 0%, #1E3A8A 50%, #0066FF 100%)'
            }}
          >
            <div className="flex items-center gap-3">
              <div className="relative w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center p-0.5 shadow-inner">
                <ChatbotAvatar size={24} />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-900 rounded-full" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-white tracking-wide m-0">
                    Quality AI Assistant
                  </h3>
                  <span className="px-1.5 py-0.5 text-[9px] font-mono bg-blue-500/30 text-blue-200 rounded border border-blue-400/20">
                    Gemini 3.8 Flash Active
                  </span>
                </div>
                <p className="text-[10px] text-blue-200/80 m-0">
                  Bug Reporting • Search • Developer RCA • Manager Analytics
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-slate-300">
              <button
                onClick={handleClearChat}
                title="Clear conversation"
                className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw size={13} />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Restore size' : 'Expand window'}
                className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? 'Expand' : 'Minimize'}
                className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronDown size={14} className={`transform transition-transform ${isMinimized ? 'rotate-180' : ''}`} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close Assistant"
                className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer ml-1"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* HORIZONTAL QUICK ACTION PILLS */}
              <div className="px-3 py-2 bg-slate-50/80 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
                {QUICK_ACTIONS.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(action.prompt)}
                    className="flex-shrink-0 px-2.5 py-1 text-[10.5px] font-medium text-slate-600 bg-white hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 border border-slate-200/80 rounded-full transition-all shadow-xs cursor-pointer whitespace-nowrap"
                  >
                    {action.label}
                  </button>
                ))}
              </div>

              {/* MESSAGES SCROLL CONTAINER */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/40">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      {msg.sender === 'user' ? (
                        <>
                          <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                          <span className="text-[11px] font-semibold text-slate-600">{currentUser}</span>
                        </>
                      ) : (
                        <>
                          <ChatbotAvatar size={18} className="rounded-xs shadow-xs" />
                          <span className="text-[11px] font-semibold text-blue-900">Quality AI Assistant</span>
                          <span className="text-[10px] text-slate-400">• {msg.timestamp}</span>
                        </>
                      )}
                    </div>

                    <div
                      className={`relative group rounded-2xl px-4 py-3 text-xs leading-relaxed max-w-[94%] shadow-xs ${
                        msg.sender === 'user'
                          ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-xs'
                          : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs'
                      }`}
                    >
                      {msg.sender === 'user' ? (
                        <p className="m-0 whitespace-pre-wrap">{msg.text}</p>
                      ) : (
                        <div>
                          {renderFormattedBotMessage(msg.text)}

                          {/* INTERACTIVE STRUCTURED BUG DRAFT CARD (Feature 1) */}
                          {msg.bugDraft && (
                            <div className="mt-3 p-3.5 bg-gradient-to-br from-slate-50 to-blue-50/50 border border-blue-200/90 rounded-xl shadow-xs text-xs">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                  📋 Structured Bug Ticket Draft
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                  {msg.bugDraft.severity || 'Critical'} Severity
                                </span>
                              </div>
                              <div className="space-y-1 text-slate-700 text-[11px] mb-3">
                                <div><span className="text-slate-500 font-medium">Title:</span> <span className="font-semibold text-slate-900">{msg.bugDraft.title}</span></div>
                                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-blue-100">
                                  <div><span className="text-slate-500 font-medium">Project:</span> <span className="font-mono text-blue-800 font-semibold">{msg.bugDraft.project}</span></div>
                                  <div><span className="text-slate-500 font-medium">Module:</span> <span className="font-semibold">{msg.bugDraft.module}</span></div>
                                  <div><span className="text-slate-500 font-medium">Environment:</span> <span className="font-semibold">{msg.bugDraft.environment}</span></div>
                                  <div><span className="text-slate-500 font-medium">Priority:</span> <span className="font-semibold">{msg.bugDraft.priority}</span></div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleSubmitBugDraft(msg.bugDraft)}
                                disabled={isLoading}
                                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-lg font-bold text-xs shadow-md shadow-blue-200 transition-all cursor-pointer transform hover:scale-[1.01]"
                              >
                                <Rocket size={13} className="animate-bounce" />
                                <span>Submit Bug Ticket to Quality Central</span>
                              </button>
                            </div>
                          )}

                          {/* INTERACTIVE CONVERSATIONAL SEARCH MATCHES CARDS (Feature 2) */}
                          {msg.matches && msg.matches.length > 0 && (
                            <div className="mt-3 space-y-1.5 pt-2 border-t border-slate-100">
                              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Matching Bug Records ({msg.matches.length})
                              </div>
                              {msg.matches.slice(0, 4).map((match, mIdx) => (
                                <div
                                  key={mIdx}
                                  className="p-2.5 bg-slate-50 hover:bg-blue-50/60 border border-slate-200/90 rounded-xl flex items-center justify-between text-xs transition-colors"
                                >
                                  <div className="min-w-0 pr-2">
                                    <div className="font-bold text-slate-800 truncate flex items-center gap-1.5">
                                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 font-mono text-[10px] rounded font-bold">{match.id}</span>
                                      <span className="truncate">{match.title}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                      {match.project} • {match.environment} • <span className="font-semibold text-slate-700">{match.status}</span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleSendMessage(`Summarize issue ${match.id} and tell me what I should investigate first`)}
                                    className="flex-shrink-0 px-2.5 py-1 bg-white hover:bg-violet-50 text-violet-700 border border-violet-200 rounded-lg text-[10.5px] font-semibold transition-colors cursor-pointer shadow-2xs"
                                  >
                                    Investigate
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Quick Copy Button */}
                          <button
                            onClick={() => handleCopyText(msg.text, idx)}
                            title="Copy reply"
                            className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
                          >
                            {copiedIndex === idx ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Bot Follow-Up Suggestions */}
                    {msg.sender === 'bot' && msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5 pl-1 max-w-[95%]">
                        {msg.suggestions.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => handleSendMessage(sug)}
                            className="text-[10.5px] px-2.5 py-1 text-violet-700 bg-violet-50/80 hover:bg-violet-100/90 border border-violet-200/60 rounded-full transition-colors cursor-pointer text-left"
                          >
                            ✨ {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex items-center gap-2 text-violet-700 bg-violet-50/80 border border-violet-100 px-3.5 py-2.5 rounded-2xl w-fit animate-pulse">
                    <Sparkles className="w-3.5 h-3.5 animate-spin text-violet-600" />
                    <span className="text-[11px] font-medium">Scanning logs, bug models & timeline...</span>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* INPUT BAR */}
              <div className="p-3 bg-white border-t border-slate-200/90">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-end gap-2"
                >
                  <div className="flex-1 relative bg-slate-50 border border-slate-200 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-200 rounded-xl transition-all">
                    <textarea
                      ref={inputRef}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Ask about RCA, developer workloads, bug age, SLA, or paste a crash traceback..."
                      rows={inputMessage.includes('\n') ? 3 : 1}
                      className="w-full px-3.5 py-2.5 text-xs text-slate-800 bg-transparent resize-none focus:outline-none max-h-28"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || isLoading}
                    className={`p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                      inputMessage.trim() && !isLoading
                        ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-md shadow-violet-200'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Send size={15} />
                  </button>
                </form>

                <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-slate-400 font-sans">
                  <span>Press <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-mono">Enter</kbd> to send</span>
                  <span className="flex items-center gap-1 font-medium text-slate-500">
                    <Sparkles className="w-2.5 h-2.5 text-violet-600" /> Phygitron Quality Intelligence
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
