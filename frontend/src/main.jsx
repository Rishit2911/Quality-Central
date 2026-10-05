import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'   // ✅ ADD THIS
import './index.css'
import App from './App.jsx'
import './styles/layout.css';
import { initFaviconThemeSync } from './utils/favicon.js';

initFaviconThemeSync();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>   {/* ✅ WRAP APP */}
      <App />
    </BrowserRouter>
  </StrictMode>,
)
