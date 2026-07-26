'use client';

import { useEffect } from 'react';

/**
 * Registra o service worker depois que a página fica pronta.
 *
 * Só em produção: em desenvolvimento um worker de cache serve arquivo velho e
 * transforma cada alteração numa caça ao fantasma.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    // Depois do load: registrar durante o carregamento disputa banda com o
    // que o usuário está esperando ver.
    const registrar = (): void => {
      void navigator.serviceWorker.register('/sw.js').catch(() => {
        // Sem service worker o app funciona igual, só não offline.
      });
    };

    if (document.readyState === 'complete') {
      registrar();
      return;
    }

    window.addEventListener('load', registrar);
    return () => window.removeEventListener('load', registrar);
  }, []);

  return null;
}
