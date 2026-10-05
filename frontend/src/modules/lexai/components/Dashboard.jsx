import React from 'react';
import { PlusCircle, UploadCloud, ArrowRight, Sparkles } from 'lucide-react';

export default function Dashboard({ onNewProject, onUploadProject }) {
    const cards = [
        {
            title: "Start New Project",
            description: "Guided process to create a fresh instructional design project from scratch.",
            icon: <PlusCircle size={48} className="text-white" />,
            action: onNewProject,
            color: "var(--primary)",
            gradient: "linear-gradient(135deg, #0EA5E9, #2563EB)"
        },
        {
            title: "Upload Project",
            description: "Upload your design doc or storyboard to quickly generate or edit content.",
            icon: <UploadCloud size={48} className="text-white" />,
            action: onUploadProject,
            color: "var(--secondary)",
            gradient: "linear-gradient(135deg, #8B5CF6, #D946EF)"
        }
    ];

    return (
        <div className="animate-fade-in w-full max-w-6xl mx-auto p-4" style={{ paddingTop: '6rem', paddingBottom: '6rem' }}>
            <header className="stagger-enter stagger-1" style={{ marginBottom: '4rem', textAlign: 'center' }}>
                <h2 className="text-4xl font-bold" style={{ marginBottom: '1rem' }}>
                    Welcome back!
                </h2>
                <p className="text-muted text-lg">What would you like to build today?</p>
            </header>

            <div className="grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 16fr))',
                gap: '2.5rem',
                padding: '0 1rem'
            }}>
                {cards.map((card, index) => (
                    <div
                        key={index}
                        className={`card stagger-enter stagger-${index + 2}`}
                        style={{
                            padding: '2.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            cursor: 'pointer',
                            animationDelay: `${index * 0.1}s`,
                            background: 'var(--surface)',
                        }}
                        onClick={card.action}
                    >
                        <div style={{
                            marginBottom: '1.5rem',
                            padding: '1rem',
                            borderRadius: '12px',
                            background: card.color,
                            color: 'white'
                        }}>
                            {card.icon}
                        </div>
                        <h3 className="text-2xl font-bold" style={{ marginBottom: '1rem' }}>{card.title}</h3>
                        <p className="text-muted" style={{ marginBottom: '2rem', flex: 1 }}>
                            {card.description}
                        </p>
                        <button className="btn btn-primary w-full animate-shiny">
                            Get Started <ArrowRight size={18} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
