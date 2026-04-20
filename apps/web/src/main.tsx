import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter-tight';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource/instrument-serif';
import 'pretendard/dist/web/variable/pretendardvariable.css';
import './styles/globals.css';
import { App } from './app';
import './stores/theme-store';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
