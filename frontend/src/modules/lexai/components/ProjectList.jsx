import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Plus, Trash2, FolderOpen, UploadCloud } from 'lucide-react';

export default function ProjectList({ onUploadProject, onNewProject, onOpenProject }) {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchProjects = async () => {
        try {
            setLoading(true);
            const data = await api.request('/history/');
            setProjects(data);
        } catch (err) {
            setError('Failed to load projects.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this project?')) {
            try {
                await api.request(`/history/${id}`, { method: 'DELETE' });
                fetchProjects();
            } catch (err) {
                alert('Error deleting project');
            }
        }
    };

    return (
        <div className="animate-fade-in w-full max-w-6xl mx-auto p-4" style={{ marginTop: '2rem' }}>
            <div className="flex justify-between items-center stagger-enter stagger-1" style={{ marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                <h2 className="text-2xl font-bold flex items-center gap-2 m-0">📚 My Project's History</h2>
                <div className="flex gap-3">
                    <button className="btn btn-outline" onClick={onUploadProject}>
                        <UploadCloud size={18} /> Upload Project
                    </button>
                    <button className="btn btn-primary animate-shiny" onClick={onNewProject}>
                        <Plus size={18} /> New Project
                    </button>
                </div>
            </div>

            {error && <div className="text-danger mb-4 p-3 rounded font-semibold" style={{ backgroundColor: 'var(--danger-light)' }}>{error}</div>}

            {loading ? (
                <div className="text-center text-muted" style={{ padding: '4rem 0' }}>
                    <div className="spinner mx-auto mb-3" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent', width: '30px', height: '30px' }}></div>
                    <p>Loading your amazing projects...</p>
                </div>
            ) : projects.length === 0 ? (
                <div className="card text-center text-muted mx-auto animate-slide-up" style={{ maxWidth: '500px', marginTop: '3rem', padding: '4rem 2rem' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem', opacity: 0.8 }}>📝</div>
                    <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-main)' }}>No projects yet</h3>
                    <p style={{ marginBottom: '2rem' }}>Ready to create your first instructional design project?</p>
                    <button className="btn btn-primary mx-auto px-6 py-3" onClick={onNewProject}>
                        <Plus size={18} /> Start Your First Project
                    </button>
                </div>
            ) : (
                <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    {projects.map((p, index) => (
                        <div key={p.id} className={`card hover-effect stagger-enter stagger-${Math.min((index % 5) + 2, 5)}`}
                            style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer', borderLeft: '4px solid var(--primary)', transition: 'all 0.2s', padding: '1.75rem' }}
                            onClick={() => onOpenProject(p.id)}>
                            <div style={{ flex: 1, marginBottom: '1rem' }}>
                                <h3 className="font-semibold text-lg" style={{ marginBottom: '0.75rem', lineHeight: '1.3' }}>{p.title}</h3>
                                <div className="flex flex-col gap-2">
                                    <p className="text-muted text-sm" style={{ marginBottom: '0.5rem' }}>
                                        <span style={{ fontWeight: 600 }}>Business Unit:</span> {p.business_unit || 'N/A'}
                                    </p>
                                    <p className="text-muted text-sm flex gap-1 items-center" style={{ fontSize: '0.8rem' }}>
                                        <span>🕒</span> {new Date(p.updated_at || p.created_at).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                                <button className="btn btn-primary flex-1" onClick={(e) => { e.stopPropagation(); onOpenProject(p.id); }}>
                                    <FolderOpen size={16} /> Open
                                </button>
                                <button className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--border)' }} onClick={(e) => handleDelete(e, p.id)} title="Delete Project">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
