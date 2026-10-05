import React from 'react';
import './ParticlesOverlay.css';

export default function ParticlesOverlay() {
    // Generate an array of random positions and animation delays for pure CSS particles
    const particles = Array.from({ length: 40 }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 5}s`,
        animationDuration: `${3 + Math.random() * 4}s`,
        opacity: 0.1 + Math.random() * 0.4,
        size: `${Math.random() * 3 + 1}px`
    }));

    return (
        <div className="particles-container">
            {particles.map(p => (
                <div
                    key={p.id}
                    className="particle"
                    style={{
                        left: p.left,
                        top: p.top,
                        width: p.size,
                        height: p.size,
                        animationDelay: p.animationDelay,
                        animationDuration: p.animationDuration,
                        opacity: p.opacity
                    }}
                />
            ))}
        </div>
    );
}
