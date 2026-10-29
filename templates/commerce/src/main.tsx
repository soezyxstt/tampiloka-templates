import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionProvider } from '@tampiloka/ui-core';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import '@tampiloka/ui-core/styles.css';
import './styles/base.css';
import './styles/storefront.css';
import './styles/transactions.css';
import './styles/workspace.css';
import { App } from './App';
import { CommerceProvider } from './lib/store';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><MotionProvider><CommerceProvider><App /></CommerceProvider></MotionProvider></React.StrictMode>);
