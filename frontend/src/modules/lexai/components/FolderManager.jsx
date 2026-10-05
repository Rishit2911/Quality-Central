import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { Folder, File, ChevronRight, Plus, Upload, Trash2, ArrowLeft, MoreVertical, FolderOpen, Download, LayoutGrid, List } from 'lucide-react';

export default function FolderManager({ onSelectFiles, mode = 'manage' }) {
    const [currentFolder, setCurrentFolder] = useState(null);
    const [folders, setFolders] = useState([]);
    const [files, setFiles] = useState([]);
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);
    const [viewMode, setViewMode] = useState('list'); // list or grid

    const fetchData = useCallback(async (folderId = null) => {
        setLoading(true);
        setError('');
        try {
            const folderUrl = folderId ? `/folders/${folderId}` : '/folders/';
            // Important: we filter files by current folder_id
            const filesUrl = folderId ? `/files/?folder_id=${folderId}` : '/files/';

            // If folderId is null, we are at root. We fetch all root folders.
            // If folderId is set, we fetch details of that folder which includes its subfolders.
            const [folderData, filesData] = await Promise.all([
                api.request(folderUrl),
                api.request(filesUrl)
            ]);

            if (folderId) {
                setCurrentFolder(folderData);
                setFolders(folderData.subfolders || []);
            } else {
                setCurrentFolder(null);
                setFolders(folderData || []);
            }
            setFiles(filesData || []);
        } catch (err) {
            console.error('Fetch error:', err);
            setError('Failed to load content. Please verify your connection.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleNavigate = (folder) => {
        if (folder) {
            setBreadcrumbs(prev => {
                // Prevent duplicate breadcrumbs
                if (prev.find(b => b.id === folder.id)) return prev;
                return [...prev, folder];
            });
            fetchData(folder.id);
        } else {
            setBreadcrumbs([]);
            fetchData();
        }
    };

    const handleBreadcrumbClick = (folder, index) => {
        if (!folder) {
            setBreadcrumbs([]);
            fetchData(null);
        } else {
            const newB = breadcrumbs.slice(0, index + 1);
            setBreadcrumbs(newB);
            fetchData(folder.id);
        }
    };

    const handleCreateFolder = async () => {
        const name = prompt('Enter name for the new folder:');
        if (!name || !name.trim()) return;

        try {
            await api.request('/folders/', {
                method: 'POST',
                body: JSON.stringify({
                    name: name.trim(),
                    parent_id: currentFolder ? currentFolder.id : null
                })
            });
            fetchData(currentFolder ? currentFolder.id : null);
        } catch (err) {
            alert('Error creating folder: ' + err.message);
        }
    };

    const handleUpload = async (e, isFolder = false) => {
        const selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length === 0) return;

        setLoading(true);
        try {
            if (isFolder) {
                // Folder Upload Logic
                await uploadFolderRecursive(selectedFiles, currentFolder ? currentFolder.id : null);
            } else {
                // Bulk File Upload
                await Promise.all(selectedFiles.map(file => {
                    const formData = new FormData();
                    formData.append('file', file);
                    if (currentFolder) formData.append('folder_id', currentFolder.id);
                    return api.request('/files/upload', {
                        method: 'POST',
                        body: formData
                    });
                }));
            }
            fetchData(currentFolder ? currentFolder.id : null);
        } catch (err) {
            alert('Error during upload: ' + err.message);
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    const uploadFolderRecursive = async (files, parentId) => {
        // Map to keep track of created folder IDs: { "path/to/folder": id }
        const folderCache = { "": parentId };

        for (const file of files) {
            const pathParts = file.webkitRelativePath.split('/');
            const fileName = pathParts.pop(); // The last part is the file name
            const folderPathParts = pathParts; // Remaining are folders

            let currentPath = "";
            let currentParentId = parentId;

            // Ensure all folders in the path exist
            for (const folderName of folderPathParts) {
                const nextPath = currentPath ? `${currentPath}/${folderName}` : folderName;

                if (!folderCache[nextPath]) {
                    // Create folder if not in cache
                    const newFolder = await api.request('/folders/', {
                        method: 'POST',
                        body: JSON.stringify({
                            name: folderName,
                            parent_id: currentParentId
                        })
                    });
                    folderCache[nextPath] = newFolder.id;
                }

                currentParentId = folderCache[nextPath];
                currentPath = nextPath;
            }

            // Upload the file to the final folder
            const formData = new FormData();
            formData.append('file', file);
            if (currentParentId) formData.append('folder_id', currentParentId);

            await api.request('/files/upload', {
                method: 'POST',
                body: formData
            });
        }
    };

    const handleDownload = async (file) => {
        try {
            // Trigger browser download by following the direct URL
            const token = localStorage.getItem('token');
            const url = `${api.baseUrl}/files/${file.id}/download?token=${token}`;
            window.open(url, '_blank');
        } catch (err) {
            alert('Error downloading file: ' + err.message);
        }
    };

    const handleDeleteFolder = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this folder and all its contents?')) return;
        try {
            await api.request(`/folders/${id}`, { method: 'DELETE' });
            fetchData(currentFolder ? currentFolder.id : null);
        } catch (err) {
            alert('Error deleting folder: ' + err.message);
        }
    };

    const handleDeleteFile = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Delete this file?')) return;
        try {
            await api.request(`/files/${id}`, { method: 'DELETE' });
            fetchData(currentFolder ? currentFolder.id : null);
        } catch (err) {
            alert('Error deleting file: ' + err.message);
        }
    };

    const formatSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const toggleSelect = (item) => {
        if (mode !== 'select') return;
        setSelectedItems(prev => {
            const isSelected = prev.find(i => i.id === item.id && i.type === item.type);
            if (isSelected) {
                return prev.filter(i => !(i.id === item.id && i.type === item.type));
            } else {
                return [...prev, { ...item }];
            }
        });
    };

    return (
        <div className="folder-manager-container animate-fade-in">
            <header className="flex justify-between items-center mb-6 stagger-enter stagger-1" style={{ paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                <div className="breadcrumb-nav" style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                    <div
                        className={`breadcrumb-item ${breadcrumbs.length === 0 ? 'active' : ''}`}
                        onClick={() => handleBreadcrumbClick(null)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <FolderOpen size={20} className="text-primary" />
                        Workspace
                    </div>
                    {breadcrumbs.map((b, i) => (
                        <div key={b.id} className="flex items-center gap-1">
                            <ChevronRight size={18} className="text-muted" />
                            <div
                                className={`breadcrumb-item ${i === breadcrumbs.length - 1 ? 'active' : ''}`}
                                onClick={() => handleBreadcrumbClick(b, i)}
                                style={{ cursor: 'pointer' }}
                            >
                                {b.name}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-3">
                    <button className="btn btn-outline" onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')} title="Toggle View" style={{ background: 'white' }}>
                        {viewMode === 'list' ? <LayoutGrid size={18} /> : <List size={18} />}
                    </button>
                    <button className="btn btn-outline" onClick={handleCreateFolder} style={{ background: 'white' }}>
                        <Plus size={18} /> New Folder
                    </button>
                    <label className="btn btn-outline cursor-pointer animate-shiny" style={{ background: 'white', borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                        <FolderOpen size={18} /> Upload Folder
                        <input type="file" className="hidden" webkitdirectory="" directory="" onChange={(e) => handleUpload(e, true)} />
                    </label>
                    <label className="btn btn-primary cursor-pointer animate-shiny">
                        <Upload size={18} /> Upload Files
                        <input type="file" className="hidden" multiple onChange={(e) => handleUpload(e, false)} />
                    </label>
                    {mode === 'select' && selectedItems.length > 0 && (
                        <button className="btn btn-secondary animate-shiny" onClick={() => onSelectFiles(selectedItems)}>
                            Use Selected ({selectedItems.length})
                        </button>
                    )}
                </div>
            </header>

            {loading && folders.length === 0 && files.length === 0 ? (
                <div className="empty-state">
                    <div className="spinner mb-4" />
                    <p>Syncing files...</p>
                </div>
            ) : error ? (
                <div className="empty-state">
                    <div className="text-danger mb-4">{error}</div>
                    <button className="btn btn-outline" onClick={() => fetchData(currentFolder?.id)}>Retry</button>
                </div>
            ) : (
                <div className="flex-1 overflow-auto">
                    {(() => {
                        const allAvailableItems = [
                            ...folders.map(f => ({ ...f, type: 'folder' })),
                            ...files.map(f => ({ ...f, type: 'file' }))
                        ];

                        return viewMode === 'list' ? (
                            <table className="file-table">
                                <thead>
                                    <tr>
                                        {mode === 'select' && (
                                            <th className="p-4" style={{ width: '40px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={allAvailableItems.length > 0 && selectedItems.length === allAvailableItems.length}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedItems(allAvailableItems);
                                                        } else {
                                                            setSelectedItems([]);
                                                        }
                                                    }}
                                                />
                                            </th>
                                        )}
                                        <th style={{ width: '40%' }}>Name</th>
                                        <th style={{ width: '15%' }}>Size</th>
                                        <th style={{ width: '15%' }}>Type</th>
                                        <th style={{ width: '20%' }}>Modified</th>
                                        <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {folders.map((f, i) => (
                                        <tr key={`folder-${f.id}`} className={`file-row stagger-enter stagger-${Math.min((i % 5) + 2, 5)}`} onClick={() => handleNavigate(f)} style={{ cursor: 'pointer', transition: 'all 0.2s', background: '#fff' }}>
                                            {mode === 'select' && (
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedItems.some(item => item.id === f.id && item.type === 'folder')}
                                                        onChange={() => toggleSelect({ ...f, type: 'folder' })}
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                </td>
                                            )}
                                            <td>
                                                <div className="file-name-cell" style={{ fontWeight: 600 }}>
                                                    <Folder size={22} className="file-icon text-primary fill-primary" />
                                                    {f.name}
                                                </div>
                                            </td>
                                            <td className="text-muted">--</td>
                                            <td className="text-muted">Folder</td>
                                            <td className="text-muted">{new Date(f.created_at).toLocaleDateString()}</td>
                                            <td>
                                                <div className="flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                                                    <button className="action-btn delete" title="Delete Folder" onClick={(e) => handleDeleteFolder(e, f.id)} style={{ padding: '8px', border: '1px solid #fee2e2', borderRadius: '6px', background: '#fff' }}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {files.map((f, i) => (
                                        <tr
                                            key={`file-${f.id}`}
                                            className={`file-row stagger-enter stagger-${Math.min(((i + folders.length) % 5) + 2, 5)} ${selectedItems.find(item => item.id === f.id && item.type === 'file') ? 'selected' : ''}`}
                                            onClick={() => toggleSelect({ ...f, type: 'file' })}
                                            style={{ cursor: mode === 'select' ? 'pointer' : 'default', transition: 'all 0.2s', background: '#fff' }}
                                        >
                                            {mode === 'select' && (
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedItems.some(item => item.id === f.id && item.type === 'file')}
                                                        onChange={() => toggleSelect({ ...f, type: 'file' })}
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                </td>
                                            )}
                                            <td>
                                                <div className="file-name-cell" style={{ fontWeight: 500 }}>
                                                    <File size={22} className="file-icon text-secondary" style={{ color: '#64748b' }} />
                                                    {f.name}
                                                </div>
                                            </td>
                                            <td className="text-muted">{formatSize(f.file_size)}</td>
                                            <td className="text-muted" style={{ textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em' }}>{f.file_type?.split('/')[1] || 'FILE'}</td>
                                            <td className="text-muted">{new Date(f.created_at).toLocaleDateString()}</td>
                                            <td>
                                                <div className="flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                                                    <button className="action-btn" title="Download" onClick={() => handleDownload(f)} style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', background: '#fff' }}>
                                                        <Download size={16} />
                                                    </button>
                                                    <button className="action-btn delete" title="Delete" onClick={(e) => handleDeleteFile(e, f.id)} style={{ padding: '8px', border: '1px solid #fee2e2', borderRadius: '6px', background: '#fff' }}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '2rem', padding: '1rem' }}>
                                {folders.map((f, i) => (
                                    <div key={`grid-folder-${f.id}`} className={`card hover-effect flex flex-col items-center p-8 stagger-enter stagger-${Math.min((i % 5) + 2, 5)} animate-float`} onClick={() => handleNavigate(f)} style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(147,71,255,0.1)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                                        <div style={{ padding: '1.5rem', background: 'var(--primary-light)', borderRadius: '20px', marginBottom: '1.5rem' }}>
                                            <Folder size={48} className="text-primary fill-primary" />
                                        </div>
                                        <span className="font-bold truncate w-full text-center text-lg">{f.name}</span>
                                        <span className="text-sm text-muted mt-2 tracking-wide uppercase">Workspace</span>
                                        <div className="flex gap-2 mt-4 opacity-0 transition-opacity duration-200" style={{ ':hover': { opacity: 1 } }}>
                                             <button className="action-btn delete" onClick={(e) => handleDeleteFolder(e, f.id)} style={{ padding: '8px', border: '1px solid #fee2e2', borderRadius: '6px', background: '#fff' }}><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                ))}
                                {files.map((f, i) => (
                                    <div
                                        key={`grid-file-${f.id}`}
                                        className={`card hover-effect flex flex-col items-center p-8 stagger-enter stagger-${Math.min(((i + folders.length) % 5) + 2, 5)} ${selectedItems.find(item => item.id === f.id && item.type === 'file') ? 'active-selection' : ''}`}
                                        onClick={() => toggleSelect({ ...f, type: 'file' })}
                                        style={{ cursor: 'pointer', background: '#fff', border: '1px solid var(--border-light)', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}
                                    >
                                        <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '20px', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
                                            <File size={48} style={{ color: '#64748b' }} />
                                        </div>
                                        <span className="font-semibold truncate w-full text-center">{f.name}</span>
                                        <span className="text-sm text-muted mt-2 bg-slate-100 px-3 py-1 rounded-full">{formatSize(f.file_size)}</span>
                                        <div className="flex gap-2 mt-4">
                                            <button className="action-btn" onClick={() => handleDownload(f)} style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '6px' }}><Download size={16} /></button>
                                            <button className="action-btn delete" onClick={(e) => handleDeleteFile(e, f.id)} style={{ padding: '8px', border: '1px solid #fee2e2', borderRadius: '6px' }}><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}

                    {folders.length === 0 && files.length === 0 && !loading && (
                        <div className="empty-state">
                            <FolderOpen size={64} />
                            <h3 className="text-xl">This folder is empty</h3>
                            <p className="mt-2 text-muted">Upload a file or create a folder to get started.</p>
                        </div>
                    )}
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .file-row.selected td {
                    background: var(--primary-light) !important;
                }
                .active-selection {
                    border: 2px solid var(--primary) !important;
                    background: var(--primary-light) !important;
                }
            `}} />
        </div>
    );
}
