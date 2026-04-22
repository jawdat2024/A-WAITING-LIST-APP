import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { FloorPlanProvider } from './context/FloorPlanContext';
import { AuthWrapper } from './components/AuthWrapper';
import { testConnection } from './lib/firebase';

const RootComponent = () => {
  useEffect(() => {
    testConnection();
  }, []);

  return (
    <AuthWrapper>
      <FloorPlanProvider>
        <App />
      </FloorPlanProvider>
    </AuthWrapper>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootComponent />
  </StrictMode>
);
