import React, { useState } from 'react';
import { api } from '../api';
import { ArrowLeft, UploadCloud, CheckCircle, X, FileText, FolderTree } from 'lucide-react';
import FolderManager from './FolderManager';
import GrammarTextarea from './GrammarTextarea';

export default function IntakeForm({ onBack, onComplete }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [files, setFiles] = useState([]);
    const [urls, setUrls] = useState('');

    // Form state matching the backend Intake model exactly
    const [formData, setFormData] = useState({
        course_title: '',
        business_unit: 'Sales', // default
        course_type: 'Regulatory / Compliance', // default
        target_audience: '',
        experience_level: 'Fresher', // default
        geographic_spread: 'Global',
        language_preference: 'American English',
        style_guide: 'Plain language, active voice, consistent terminology, correct spelling and grammar',
        guidelines: '',
        knowledge_check_types: 'Multiple Choice, True/False, Fill in the Blank, Scenario-Based',
        knowledge_check_count: 3,
        knowledge_check_difficulty: 'Mixed',
        objective_1: '',
        objective_2: '',
        objective_3: '',
        interactivity_level: 'Level 1 - Informational (content + graphics + knowledge checks)', // default
        output_required: 'Design Document', // default
        num_modules: 5 // default
    });

    const handleChange = (e) => {
        const { name, value, type, selectedOptions } = e.target;
        if (type === 'select-multiple') {
            const values = Array.from(selectedOptions, option => option.value);
            setFormData(prev => ({ ...prev, [name]: values.join(', ') }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const [showFolderPicker, setShowFolderPicker] = useState(false);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newFiles.map(f => ({ file: f, name: f.name, type: 'local' }))]);
        }
        e.target.value = '';
    };

    const handleSelectFromFolders = (selectedItems) => {
        const newFiles = selectedItems.map(item => ({
            id: item.id,
            name: item.name,
            type: 'remote',
            file_path: item.file_path
        }));
        setFiles(prev => [...prev, ...newFiles]);
        setShowFolderPicker(false);
    };

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const urlList = urls.split('\n').map(u => u.trim()).filter(u => u);

        if (files.length === 0 && urlList.length === 0) {
            setError('Please provide at least one source file or URL link.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // 1. Create Project and Save Intake Data via /intake/ (JSON payload)
            const projectResponse = await api.request('/intake/', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            const projectId = projectResponse.id;

            // 2. Upload/Process Files sequentially
            for (let i = 0; i < files.length; i++) {
                const f = files[i];
                if (f.type === 'local') {
                    const formDataFile = new FormData();
                    formDataFile.append('file', f.file);
                    await api.request(`/extraction/${projectId}/upload`, {
                        method: 'POST',
                        body: formDataFile
                    });
                } else if (f.type === 'remote') {
                    const remoteData = new URLSearchParams();
                    remoteData.append('file_id', f.id);
                    await api.request(`/extraction/${projectId}/remote`, {
                        method: 'POST',
                        body: remoteData.toString(),
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                    });
                }
            }

            // 3. Process URLs sequentially
            for (let i = 0; i < urlList.length; i++) {
                const urlData = new URLSearchParams();
                urlData.append('url', urlList[i]);
                await api.request(`/extraction/${projectId}/url`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: urlData.toString()
                });
            }

            // 4. Proceed to design phase
            onComplete(projectId);
        } catch (err) {
            setError(err.message || 'Error processing content. Please check API connection.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in w-full max-w-4xl mx-auto p-4" style={{ marginTop: '2rem', marginBottom: '4rem' }}>
            <div className="flex items-center gap-4" style={{ marginBottom: '2rem' }}>
                <button className="btn btn-outline" onClick={onBack} title="Back to Dashboard">
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl gradient-text m-0 font-bold">Create New Project</h2>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">

                {error && <div className="text-danger p-3 rounded font-semibold" style={{ backgroundColor: 'var(--danger-light)' }}>{error}</div>}

                {/* Section 1: Basic Info */}
                <div className="card">
                    <h3 className="text-lg font-semibold mb-4 border-b pb-2">1. Project Information</h3>
                    <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="form-group mb-0">
                            <label className="form-label">Course Title *</label>
                            <GrammarTextarea singleLine={true} className="form-control" name="course_title" required value={formData.course_title} onChange={handleChange} />
                        </div>
                        <div className="form-group mb-0">
                            <label className="form-label">Business Unit / Function *</label>
                            <select className="form-control" name="business_unit" value={formData.business_unit} onChange={handleChange}>
                                <option>Sales</option>
                                <option>Operations</option>
                                <option>Claims</option>
                                <option>HR</option>
                                <option>IT</option>
                                <option>Compliance</option>
                                <option>Finance</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div className="form-group mb-0">
                            <label className="form-label">Course Type *</label>
                            <select className="form-control" name="course_type" value={formData.course_type} onChange={handleChange}>
                                <option>Regulatory / Compliance</option>
                                <option>Product Training</option>
                                <option>Process Training</option>
                                <option>Soft Skills</option>
                                <option>Systems Training</option>
                                <option>Technical Training</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div className="form-group mb-0 flex gap-4">
                            <div className="flex-1">
                                <label className="form-label">Experience Level *</label>
                                <div className="flex flex-col gap-2 p-2 form-control" style={{ height: 'auto', minHeight: '40px' }}>
                                    {['Fresher', '1-2 years', '2-5 years', '5+ years'].map(opt => {
                                        const isChecked = (formData.experience_level || '').split(', ').includes(opt);
                                        return (
                                            <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded" style={{ margin: 0 }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        let current = (formData.experience_level || '').split(', ').filter(Boolean);
                                                        if (e.target.checked) current.push(opt);
                                                        else current = current.filter(item => item !== opt);
                                                        setFormData(prev => ({ ...prev, experience_level: current.join(', ') }));
                                                    }}
                                                    style={{ accentColor: 'var(--primary)', width: '16px', height: '16px', margin: 0, cursor: 'pointer' }}
                                                />
                                                {opt}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="form-label" title="Select the number of modules to generate (excluding Intro/Summary)">Number of Learning Modules: {formData.num_modules}</label>
                                <input type="range" className="w-full" name="num_modules" min="3" max="12" value={formData.num_modules} onChange={handleChange} style={{ accentColor: 'var(--primary)' }} />
                                <div className="flex justify-between text-xs text-muted mt-1"><span>3</span><span>12</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 2: Audience */}
                <div className="card">
                    <h3 className="text-lg font-semibold mb-4 border-b pb-2">2. Audience Details</h3>
                    <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="form-group mb-0">
                            <label className="form-label">Primary Audience Role *</label>
                            <GrammarTextarea singleLine={true} className="form-control" name="target_audience" required placeholder="e.g., IT Security Professionals" value={formData.target_audience} onChange={handleChange} />
                        </div>
                        <div className="form-group mb-0">
                            <label className="form-label">Geographic Spread</label>
                            <select className="form-control" name="geographic_spread" value={formData.geographic_spread} onChange={handleChange}>
                                <option>Global</option>
                                <option>North America</option>
                                <option>United States</option>
                                <option>United Kingdom</option>
                                <option>Europe</option>
                                <option>Asia Pacific</option>
                                <option>Middle East and Africa</option>
                                <option>Latin America</option>
                                <option>Diverse / Multi-region</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Section 3: Learning Objectives */}
                <div className="card">
                    <h3 className="text-lg font-semibold mb-4 border-b pb-2">3. Primary Learning Objectives</h3>
                    <div className="flex flex-col gap-3">
                        <div className="form-group mb-0">
                            <GrammarTextarea singleLine={true} className="form-control" name="objective_1" required placeholder="Learners will be able to... *" value={formData.objective_1} onChange={handleChange} />
                        </div>
                        <div className="form-group mb-0">
                            <GrammarTextarea singleLine={true} className="form-control" name="objective_2" placeholder="Learners will be able to... (Optional)" value={formData.objective_2} onChange={handleChange} />
                        </div>
                        <div className="form-group mb-0">
                            <GrammarTextarea singleLine={true} className="form-control" name="objective_3" placeholder="Learners will be able to... (Optional)" value={formData.objective_3} onChange={handleChange} />
                        </div>
                    </div>
                </div>

                {/* Section 4: Specifications */}
                <div className="card">
                    <h3 className="text-lg font-semibold mb-4 border-b pb-2">4. Instructional Strategy</h3>
                    <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="form-group mb-0">
                            <label className="form-label">Level of Interactivity *</label>
                            <select className="form-control" name="interactivity_level" value={formData.interactivity_level} onChange={handleChange}>
                                <option>Level 1 - Informational (content + graphics + knowledge checks)</option>
                                <option>Level 2 - Medium Interactivity (Level 1 + animations + interactions)</option>
                                <option>Level 3 - High Interactivity (scenarios, simulations)</option>
                                <option>Level 4 - Gamification</option>
                            </select>
                        </div>
                        <div className="form-group mb-0">
                            <label className="form-label">Output Required *</label>
                            <select className="form-control" name="output_required" value={formData.output_required} onChange={handleChange}>
                                <option>Design Document</option>
                                <option>Storyboard</option>
                                <option>Both Design Document and Storyboard</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <h3 className="text-lg font-semibold mb-4 border-b pb-2">5. Knowledge Checks and Language</h3>
                    <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="form-group mb-0">
                            <label className="form-label">Language Preference</label>
                            <select className="form-control" name="language_preference" value={formData.language_preference} onChange={handleChange}>
                                <option>American English</option>
                                <option>British English</option>
                            </select>
                        </div>
                        <div className="form-group mb-0">
                            <label className="form-label">Knowledge Check Difficulty</label>
                            <select className="form-control" name="knowledge_check_difficulty" value={formData.knowledge_check_difficulty} onChange={handleChange}>
                                <option>Mixed</option>
                                <option>Easy</option>
                                <option>Medium</option>
                                <option>Hard</option>
                            </select>
                        </div>
                        <div className="form-group mb-0">
                            <label className="form-label">Knowledge Check Questions Per Module: {formData.knowledge_check_count}</label>
                            <input type="range" className="w-full" name="knowledge_check_count" min="1" max="8" value={formData.knowledge_check_count} onChange={handleChange} style={{ accentColor: 'var(--primary)' }} />
                            <div className="flex justify-between text-xs text-muted mt-1"><span>1</span><span>8</span></div>
                        </div>
                        <div className="form-group mb-0">
                            <label className="form-label">Knowledge Check Types</label>
                            <input type="text" className="form-control" name="knowledge_check_types" value={formData.knowledge_check_types} onChange={handleChange} />
                        </div>
                    </div>
                </div>

                {/* Section 6: Guidelines */}
                <div className="card">
                    <h3 className="text-lg font-semibold mb-4 border-b pb-2">6. Guidelines and Style</h3>
                    <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="form-group mb-0">
                            <label className="form-label">Style Guide</label>
                            <GrammarTextarea className="form-control" name="style_guide" value={formData.style_guide} onChange={handleChange} style={{ minHeight: '100px' }} />
                        </div>
                        <div className="form-group mb-0">
                            <label className="form-label">Guidelines / Spelling Check Notes</label>
                            <GrammarTextarea className="form-control" name="guidelines" placeholder="Add client-specific terminology, tone, words to avoid, or spelling rules." value={formData.guidelines} onChange={handleChange} style={{ minHeight: '100px' }} />
                        </div>
                    </div>
                </div>

                {/* Section 7: File Upload & URLs */}
                <div className="card">
                    <h3 className="text-lg font-semibold mb-2 border-b pb-2">7. Source Material</h3>
                    <p className="text-muted text-sm mb-4">Upload documents (PDF, Word, Excel, TXT, PPTX) AND/OR provide external links (YouTube/Websites) to extract source content.</p>

                    <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        {/* File Uploader */}
                        <div className="form-group mb-0 flex flex-col items-center justify-center p-6 rounded" style={{ backgroundColor: 'var(--bg-color)', borderRadius: '12px', borderStyle: 'dashed', borderWidth: '2px', borderColor: files.length > 0 ? 'var(--primary)' : 'var(--border)', minHeight: '180px' }}>
                            <input
                                type="file"
                                id="source-file"
                                accept=".pdf,.docx,.xlsx,.txt,.pptx,.ppt"
                                multiple
                                onChange={handleFileChange}
                                style={{ position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: '0', pointerEvents: 'none' }}
                            />
                            <div className="flex gap-2">
                                <label htmlFor="source-file" className="btn btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.8rem 1.6rem' }}>
                                    <UploadCloud size={20} /> {files.length > 0 ? 'Add Local Files' : 'Select Local Files'}
                                </label>
                                <button type="button" className="btn btn-outline" onClick={() => setShowFolderPicker(true)}>
                                    <FolderTree size={20} /> Select from folders
                                </button>
                            </div>
                            <p className="text-xs text-muted mt-3">Max 50MB per file</p>
                            {files.length > 0 && (
                                <div className="mt-5 w-full">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>
                                            <CheckCircle size={14} className="inline mr-1" /> {files.length} Item(s) Selected
                                        </span>
                                        <button type="button" onClick={() => setFiles([])} className="text-xs text-danger hover:underline">Clear All</button>
                                    </div>
                                    <div className="flex flex-col gap-2" style={{ maxHeight: '160px', overflowY: 'auto', padding: '4px' }}>
                                        {files.map((f, i) => (
                                            <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-light animate-fade-in" style={{ background: 'white', boxShadow: 'var(--shadow-sm)' }}>
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    {f.type === 'remote' ? <FolderTree size={14} className="text-primary flex-shrink-0" /> : <FileText size={14} className="text-muted flex-shrink-0" />}
                                                    <span className="text-sm truncate" title={f.name}>{f.name}</span>
                                                </div>
                                                <button type="button" onClick={() => removeFile(i)} className="p-1 hover:bg-danger-light rounded text-danger transition-colors">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* URL Text Area */}
                        <div className="form-group mb-0 flex flex-col">
                            <label className="form-label" style={{ fontWeight: '600' }}>🔗 External Links (YouTube or Websites)</label>
                            <textarea
                                className="form-control flex-1"
                                placeholder={"Paste links here (one per line)...\nhttps://www.youtube.com/watch?v=...\nhttps://en.wikipedia.org/wiki/..."}
                                value={urls}
                                onChange={(e) => setUrls(e.target.value)}
                                style={{ minHeight: '120px', resize: 'vertical' }}
                            ></textarea>
                        </div>
                    </div>
                </div>

                {/* Folder Picker Modal */}
                {showFolderPicker && (
                    <div className="modal-overlay" style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem'
                    }}>
                        <div className="card w-full max-w-4xl" style={{ maxHeight: '90vh', overflow: 'hidden', padding: 0, background: 'var(--bg-color)' }}>
                            <div className="flex justify-between items-center p-4 border-b bg-white">
                                <h3 className="m-0">Select Files</h3>
                                <button className="btn btn-outline p-2" onClick={() => setShowFolderPicker(false)}><X size={18} /></button>
                            </div>
                            <div style={{ height: '500px', overflowY: 'auto' }}>
                                <FolderManager mode="select" onSelectFiles={handleSelectFromFolders} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Submit Button */}
                <div className="flex justify-end gap-4 mt-2 mb-8">
                    <button type="button" className="btn btn-outline" onClick={onBack} disabled={loading}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: '200px' }}>
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <span className="spinner" style={{ width: '16px', height: '16px', display: 'inline-block' }}></span>
                                Creating...
                            </div>
                        ) : 'Create & Proceed'}
                    </button>
                </div>
            </form>
        </div>
    );
}


