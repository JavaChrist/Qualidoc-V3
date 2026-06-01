import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

// Opt-in dès maintenant aux comportements React Router v7 (startTransition
// pour les transitions et résolution relative des routes splat). Ça
// supprime les deux warnings « React Router Future Flag Warning » et
// prépare la future migration vers v7.
const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter future={routerFutureFlags}>
      <App />
    </HashRouter>
  </React.StrictMode>
);
