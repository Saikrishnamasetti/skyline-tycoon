import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { primeAudio } from './lib/audio';

// Browsers only allow audio after a gesture, so unlock on the first one.
const unlock = () => {
  primeAudio();
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
};
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

const container = document.getElementById('root');
if (!container) throw new Error('Root element is missing');

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
