import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, Users, Loader2, Play } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function LiveMonitor() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const initialAsmId = params.get('asm_id');
  
  const [assessmentsList, setAssessmentsList] = useState([]);
  const [selectedId, setSelectedId] = useState(initialAsmId || null);

  const [events, setEvents] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch assessments for dropdown
  useEffect(() => {
    fetch('/api/verify/builder/assessments', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setAssessmentsList(d.data); });
  }, []);

  // Fetch initial assigned candidates when an assessment is selected
  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setCandidates([]);
    setEvents([]);
    setError('');

    fetch(`/api/verify/assignments/${selectedId}/candidates`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) setCandidates(d.data);
      })
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [selectedId]);

  // Connect to WebSocket
  useEffect(() => {
    if (!selectedId) return;
    
    // Use proper ws/wss protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/verify/live-monitor/${selectedId}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('Connected to Live Monitor WebSocket');
    };
    
    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data);
        setEvents(prev => [event, ...prev].slice(0, 50)); // keep last 50 events
        
        // Update candidate status based on event
        if (event.event_type === 'session_started') {
          setCandidates(prev => prev.map(c => 
            c.user_id === event.user_id ? { ...c, status: 'in_progress', started_at: new Date().toISOString() } : c
          ));
        } else if (event.event_type === 'strike_recorded') {
          setCandidates(prev => prev.map(c => 
            c.user_id === event.user_id ? { 
              ...c, 
              strike_count: event.details.strike_count, 
              status: event.details.terminated_by_proctor ? 'terminated' : c.status 
            } : c
          ));
        }
      } catch(e) { console.error('WebSocket msg error', e); }
    };
    
    ws.onerror = (e) => {
      setError('Live connection error. Ensure the websocket server is running.');
    };
    
    return () => ws.close();
  }, [selectedId]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Activity className="text-rose-500 animate-pulse" /> Live Monitor
          </h2>
          <p className="text-sm text-gray-500 mt-1">Real-time proctoring alerts and candidate status.</p>
        </div>
        
        <div className="w-full sm:w-64">
          <select 
            value={selectedId || ''}
            onChange={e => setSelectedId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl shadow-sm focus:border-rose-500 focus:ring-rose-500 outline-none"
          >
            <option value="">-- Select Active Assessment --</option>
            {assessmentsList.map(a => (
              <option key={a.id} value={a.id}>{a.title} ({a.status})</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="text-sm text-rose-600 font-medium bg-rose-50 px-4 py-3 rounded-xl border border-rose-100">{error}</div>}

      {!selectedId ? (
        <div className="flex flex-col items-center justify-center p-20 text-center border border-dashed border-gray-300 rounded-2xl bg-gray-50">
          <Activity size={48} className="text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-700">Live Monitor Idle</h3>
          <p className="text-gray-500 max-w-sm mt-2 text-sm">Select an assessment from the dropdown above to connect to the real-time websocket and monitor active test sessions.</p>
        </div>
      ) : loading ? (
        <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-rose-500" size={32} /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Users size={16}/> Candidate Status</h3>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[560px]">
                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Candidate</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Strikes</th>
                    <th className="px-4 py-3">Time Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {candidates.map(c => (
                    <tr key={c.assignment_id || c.user_id}>
                      <td className="px-4 py-3 font-medium text-gray-800">{c.name || c.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider ${
                          c.status === 'in_progress' ? 'bg-amber-50 text-amber-600' :
                          c.status === 'terminated' ? 'bg-rose-50 text-rose-600' :
                          c.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {c.strike_count > 0 ? (
                          <span className="flex items-center gap-1 text-rose-600 font-bold"><AlertTriangle size={14}/> {c.strike_count}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {c.started_at ? new Date(c.started_at).toLocaleTimeString() : '—'}
                      </td>
                    </tr>
                  ))}
                  {candidates.length === 0 && (
                    <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-400">No candidates assigned.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Activity size={16}/> Live Activity Log</h3>
            <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-sm p-4 h-[500px] overflow-y-auto font-mono text-xs flex flex-col gap-2">
              {events.length === 0 ? (
                <div className="text-gray-600 text-center py-10 italic">Awaiting events...</div>
              ) : (
                events.map((ev, i) => {
                  const isStrike = ev.event_type === 'strike_recorded';
                  const cName = candidates.find(c => c.user_id === ev.user_id)?.name || `User ${ev.user_id}`;
                  return (
                    <div key={i} className={`p-2 rounded border ${isStrike ? 'bg-rose-950/30 border-rose-900/50 text-rose-400' : 'bg-gray-800/50 border-gray-700/50 text-emerald-400'}`}>
                      <div className="flex justify-between mb-1 opacity-70">
                        <span>{new Date().toLocaleTimeString()}</span>
                        <span>{ev.event_type}</span>
                      </div>
                      <div>
                        {isStrike ? (
                          <span><AlertTriangle size={12} className="inline mr-1"/> {cName} triggered a strike. Total: {ev.details?.strike_count}</span>
                        ) : (
                          <span><Play size={12} className="inline mr-1"/> {cName} started the assessment.</span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
