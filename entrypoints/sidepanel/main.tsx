import { createRoot } from 'react-dom/client';
import App from '../../ui/sidepanel/App';
import '../../ui/sidepanel/styles/index.css';

const container = document.getElementById('root');

if (container) {
  createRoot(container).render(<App />);
}
