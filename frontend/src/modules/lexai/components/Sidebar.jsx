import React from 'react';
import { LayoutDashboard, FolderOpen, FolderTree, LogOut, PlusCircle, UploadCloud } from 'lucide-react';

export default function Sidebar({ currentView, setCurrentView, onLogout }) {
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
        { id: 'projects', label: 'Projects', icon: <FolderOpen size={20} /> },
        { id: 'folders', label: 'Folders', icon: <FolderTree size={20} /> },
    ];

    return (
        <aside className="sidebar" style={{
            width: '280px',
            height: '100vh',
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(20px)',
            borderRight: '1px solid rgba(147, 71, 255, 0.1)',
            boxShadow: '10px 0 30px rgba(0, 0, 0, 0.02)',
            display: 'flex',
            flexDirection: 'column',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            transition: 'all 0.3s ease'
        }}>
            <div className="sidebar-header" style={{
                padding: '2.5rem 1.5rem 1.5rem 1.5rem',
                borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '4px'
            }}>
                <img src="/logo.png" alt="EWANDZ" style={{ height: '26px', width: 'auto', marginBottom: '4px' }} />
                <h1 style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: 700, 
                    margin: 0, 
                    color: '#666', 
                    fontFamily: 'Inter, system-ui, sans-serif',
                    letterSpacing: '0.01em'
                }}>
                    e-Learning AI
                </h1>
            </div>

            <nav className="sidebar-nav" style={{ flex: 1, padding: '1.5rem 0' }}>
                {menuItems.map((item, index) => (
                    <button
                        key={item.id}
                        onClick={() => setCurrentView(item.id)}
                        className={`sidebar-item stagger-enter stagger-${index + 1} ${currentView === item.id ? 'active' : ''}`}
                        style={{
                            width: 'calc(100% - 32px)',
                            margin: '0 16px 8px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '14px 20px',
                            borderRadius: '12px',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            color: currentView === item.id ? 'var(--primary)' : 'var(--text-muted)',
                            fontWeight: currentView === item.id ? 700 : 500,
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        {item.icon}
                        <span style={{ fontSize: '1.05rem', letterSpacing: '0.01em' }}>{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="sidebar-footer stagger-enter stagger-4" style={{
                padding: '1.5rem',
                borderTop: '1px solid rgba(147, 71, 255, 0.1)',
                marginTop: 'auto'
            }}>
                <button
                    onClick={onLogout}
                    className="btn btn-outline w-full hover-effect"
                    style={{ justifyContent: 'flex-start', border: '1px solid rgba(147, 71, 255, 0.2)', background: 'rgba(255,255,255,0.5)', borderRadius: '12px', padding: '12px 20px', color: 'var(--text-main)', fontWeight: 600 }}
                >
                    <LogOut size={18} className="text-muted" /> Logout
                </button>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .sidebar-item {
                    transform: translateX(0);
                }
                .sidebar-item:hover {
                    background: rgba(147, 71, 255, 0.05);
                    color: var(--primary) !important;
                    transform: translateX(6px);
                }
                .sidebar-item.active {
                    background: linear-gradient(90deg, rgba(147, 71, 255, 0.15) 0%, rgba(147, 71, 255, 0.05) 100%);
                    color: var(--primary) !important;
                    box-shadow: inset 4px 0 0 var(--primary), 0 4px 15px rgba(147, 71, 255, 0.1);
                }
            `}} />
        </aside>
    );
}
