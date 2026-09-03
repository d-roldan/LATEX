import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './app/router/AppRouter';
import { AppProviders } from './app/providers/AppProviders';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import './shared/styles/theme.css';
import './shared/styles/global.css';
import './shared/styles/design-system.css';
import './shared/styles/plant.css';
import { installNotificationSoundUnlock } from './shared/utils/notificationSound';

const savedTheme = localStorage.getItem('disal.ui.theme');
const initialTheme = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark';
document.documentElement.setAttribute('data-theme', initialTheme);
localStorage.setItem('disal.ui.theme', initialTheme);
installNotificationSoundUnlock();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AppProviders>
  </React.StrictMode>
);

registerServiceWorker();
