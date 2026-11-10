import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './portal/App';
import { StudyShortcut } from './StudyShortcut';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><HashRouter><StudyShortcut /><App /></HashRouter></React.StrictMode>,
);
