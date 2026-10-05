import React, { useState } from 'react';
import { api } from '../api';
import { UploadCloud, FileText, CheckCircle, ArrowLeft, X } from 'lucide-react';

export default function ProjectUpload({ onBack, onComplete }) {
    const [file, setFile] = useState(null);
    const [uploadType, setUploadType] = useState('design_doc'); // design_doc, storyboard
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            setError('Please select a file to upload.');
            return;
        }

        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', uploadType);
        formData.append('title', file.name.split('.')[0]);

        try {
            const res = await api.request('/intake/upload', {
                method: 'POST',
                body: formData
            });
            onComplete(res.id);
        } catch (err) {
            setError(err.message || 'Failed to upload project.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in w-full max-w-2xl mx-auto p-8">
            <header className="flex items-center gap-4 mb-8">
                <button className="btn btn-outline p-2" onClick={onBack}>
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl gradient-text m-0 font-bold">Upload Existing Project</h2>
            </header>

            <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                <div className="card">
                    <h3 className="text-lg font-semibold mb-4">Select Upload Type</h3>
                    <div className="flex gap-4">
                        <button
                            type="button"
                            className={`btn flex-1 ${uploadType === 'design_doc' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setUploadType('design_doc')}
                        >
                            Design Document
                        </button>
                        <button
                            type="button"
                            className={`btn flex-1 ${uploadType === 'storyboard' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setUploadType('storyboard')}
                        >
                            Storyboard
                        </button>
                    </div>
                    <p className="text-muted text-sm mt-4">
                        Tell us what kind of document you are uploading so we can set up the editor correctly.
                    </p>
                </div>

                <div className="card" style={{
                    borderStyle: 'dashed',
                    borderWidth: '2px',
                    borderColor: file ? 'var(--primary)' : 'var(--border)',
                    textAlign: 'center',
                    padding: '3rem'
                }}>
                    <input
                        type="file"
                        id="upload-project-file"
                        className="hidden"
                        onChange={handleFileChange}
                        accept=".pdf,.docx,.txt,.pptx,.xlsx"
                    />

                    {!file ? (
                        <label htmlFor="upload-project-file" style={{ cursor: 'pointer' }}>
                            <div style={{ padding: '1rem', borderRadius: '50%', background: 'var(--primary-light)', width: 'fit-content', margin: '0 auto 1.5rem' }}>
                                <UploadCloud size={40} className="text-primary" />
                            </div>
                            <h4 className="text-xl mb-2">Click to upload file</h4>
                            <p className="text-muted">Supports PDF, Word, TXT, PPTX and Excel</p>
                        </label>
                    ) : (
                        <div>
                            <div className="flex items-center justify-center gap-3 p-4 bg-white rounded-lg border mb-4">
                                <FileText className="text-primary" />
                                <span className="font-medium">{file.name}</span>
                                <button type="button" onClick={() => setFile(null)} className="text-danger">
                                    <X size={18} />
                                </button>
                            </div>
                            <p className="text-success flex items-center justify-center gap-2">
                                <CheckCircle size={16} /> Ready to import
                            </p>
                        </div>
                    )}
                </div>

                {error && <div className="text-danger p-3 rounded bg-danger-light text-center font-semibold">{error}</div>}

                <button type="submit" className="btn btn-primary btn-lg" disabled={loading || !file}>
                    {loading ? "Processing..." : "Import & Start Editing"}
                </button>
            </form>
        </div>
    );
}
