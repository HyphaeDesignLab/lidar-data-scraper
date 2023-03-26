import React from 'react';
import ReactDOMClient from 'react-dom/client';
import App from './App';
import './style.css';

const appEl = document.querySelector('[data-app]');
// Create a root.
const root = ReactDOMClient.createRoot(appEl);

// Initial render: Render an element to the root.
root.render(<App tab="home" />);