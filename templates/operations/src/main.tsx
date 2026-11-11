import { createRoot } from 'react-dom/client';
import '@tampiloka/ui-core/styles.css';
import './styles/tokens.css';
import './styles/workspace.css';
import '@tampiloka/ui-core/demo.css';
import App from './App';
createRoot(document.getElementById('root')!).render(<App/>);
