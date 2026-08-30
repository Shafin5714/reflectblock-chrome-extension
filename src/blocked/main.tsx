import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BlockedPage } from './BlockedPage';
import '../shared/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BlockedPage />
  </StrictMode>,
);
