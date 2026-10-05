import React, { useState, useEffect, useRef } from 'react';

export default function GrammarTextarea({ 
  value = "", 
  onChange, 
  className = "", 
  style = {}, 
  singleLine = false,
  onSelect,
  onClick,
  onKeyUp,
  onKeyDown,
  onScroll,
  ...props 
}) {
  const [matches, setMatches] = useState([]);
  const [activeMatch, setActiveMatch] = useState(null);
  const textareaRef = useRef(null);
  const bgRef = useRef(null);
  
  // Debounced API call to LanguageTool
  useEffect(() => {
    if (!value || value.trim().length === 0) {
      setMatches([]);
      setActiveMatch(null);
      return;
    }

    let ignore = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('https://api.languagetool.org/v2/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            text: value,
            language: 'en-US'
          })
        });
        const data = await res.json();
        if (!ignore && data.matches) {
          setMatches(data.matches);
        }
      } catch (e) {
        if (!ignore) console.error("LanguageTool API error:", e);
      }
    }, 600);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [value]);

  // Check if cursor is over a match
  const handleSelection = (e) => {
    const cursor = e.target.selectionStart;
    const found = matches.find(m => cursor >= m.offset && cursor <= m.offset + m.length);
    setActiveMatch(found || null);
  };

  const handleScroll = (e) => {
    if (bgRef.current) {
      bgRef.current.scrollTop = e.target.scrollTop;
      bgRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  const renderTextWithHighlights = () => {
    if (matches.length === 0) return value;
    
    let result = [];
    let lastIndex = 0;
    
    const sortedMatches = [...matches].sort((a, b) => a.offset - b.offset);

    sortedMatches.forEach((match, i) => {
      if (match.offset >= lastIndex) {
        result.push(value.slice(lastIndex, match.offset));
        const matchedText = value.slice(match.offset, match.offset + match.length);
        result.push(
          <span 
            key={i} 
            style={{ 
              borderBottom: '2px dashed #ff4d4f', // Red squiggly for errors
              paddingBottom: '1px'
            }}
          >
            {matchedText}
          </span>
        );
        lastIndex = match.offset + match.length;
      }
    });
    result.push(value.slice(lastIndex));
    // Add trailing newline if text ends in newline to match textarea rendering perfectly
    if (value.endsWith('\n')) result.push('\n');
    return result;
  };

  const applyCorrection = (match, replacementText) => {
    const newVal = value.slice(0, match.offset) + replacementText + value.slice(match.offset + match.length);
    if (onChange) {
      onChange({ target: { name: props.name, value: newVal } });
    }
    setActiveMatch(null);
    setMatches([]); // Optimistically clear matches
  };

  return (
    <div style={{ position: 'relative', width: '100%', ...style }}>
      
      {/* Background layer for highlights */}
      <div 
        ref={bgRef}
        className={className}
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          whiteSpace: singleLine ? 'nowrap' : 'pre-wrap',
          wordWrap: singleLine ? 'normal' : 'break-word',
          pointerEvents: 'none',
          color: 'transparent', 
          overflow: 'hidden',
          zIndex: 1,
          margin: 0,
          background: 'var(--bg-color, white)'
        }}
      >
        {renderTextWithHighlights()}
      </div>

      {/* Foreground textarea */}
      <textarea
        {...props}
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onSelect={(e) => { handleSelection(e); if (onSelect) onSelect(e); }}
        onClick={(e) => { handleSelection(e); if (onClick) onClick(e); }}
        onKeyUp={(e) => { handleSelection(e); if (onKeyUp) onKeyUp(e); }}
        onKeyDown={(e) => { if (singleLine && e.key === 'Enter') e.preventDefault(); if (onKeyDown) onKeyDown(e); }}
        onScroll={(e) => { handleScroll(e); if (onScroll) onScroll(e); }}
        className={className}
        style={{
          position: 'relative',
          zIndex: 2,
          background: 'transparent',
          margin: 0,
          ...(singleLine ? { whiteSpace: 'nowrap', overflowX: 'auto', overflowY: 'hidden', resize: 'none' } : {})
        }}
      />

      {/* Tooltip for Correction */}
      {activeMatch && (
        <div 
          style={{
            position: 'absolute',
            zIndex: 1000,
            background: '#1E293B',
            border: '1px solid #334155',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            borderRadius: '8px',
            padding: '12px',
            bottom: '100%', 
            left: '10px',
            marginBottom: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            width: '280px',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div style={{ fontSize: '13px', color: '#E2E8F0', fontWeight: '500' }}>
            {activeMatch.message}
          </div>
          {activeMatch.replacements && activeMatch.replacements.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {activeMatch.replacements.slice(0, 4).map((rep, idx) => (
                <button 
                  key={idx}
                  onClick={(e) => { e.preventDefault(); applyCorrection(activeMatch, rep.value); }}
                  style={{
                    background: '#2563EB',
                    border: 'none',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  {rep.value || "(Delete)"}
                </button>
              ))}
            </div>
          )}
          <div style={{ position: 'absolute', bottom: -6, left: '20px', borderTop: '6px solid #1E293B', borderLeft: '6px solid transparent', borderRight: '6px solid transparent' }} />
        </div>
      )}
    </div>
  );
}
