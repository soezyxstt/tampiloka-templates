import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionProvider } from '@tampiloka/ui-core';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import './styles/shadcn.css';
import '@tampiloka/ui-core/styles.css';
import './styles/base.css';
import './styles/storefront.css';
import './styles/transactions.css';
import './styles/workspace.css';
import './styles/shadcn-commerce.css';
import '@tampiloka/ui-core/demo.css';
import { App } from './App';
import { CommerceProvider } from './lib/store';
import { LanguageProvider, LanguageToggle } from './lib/language';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><LanguageProvider><MotionProvider><CommerceProvider><App /><LanguageToggle /></CommerceProvider></MotionProvider></LanguageProvider></React.StrictMode>);

