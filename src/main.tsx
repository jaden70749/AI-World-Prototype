import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress pointer lock errors that spam the console
const originalRequestPointerLock = Element.prototype.requestPointerLock;
Element.prototype.requestPointerLock = function(options?: PointerLockOptions) {
  try {
    const result = originalRequestPointerLock.call(this, options);
    if (result instanceof Promise) {
      return result.catch(err => {
        // Suppress pointer lock errors
        if (err.message && err.message.includes('Pointer lock cannot be acquired')) {
          return;
        }
        throw err;
      });
    }
    return result;
  } catch (err: any) {
    if (err.message && err.message.includes('Pointer lock cannot be acquired')) {
      return;
    }
    throw err;
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
