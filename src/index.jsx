import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppV1 from './AppV1.jsx';
import AppV2 from './AppV2.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* <AppV1 /> */}
    <AppV2 />
  </StrictMode>
);
