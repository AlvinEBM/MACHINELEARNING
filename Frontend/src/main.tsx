// =================================================================
// Punto de entrada del frontend.
// Monta el componente App en el div #root del index.html
// =================================================================
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);