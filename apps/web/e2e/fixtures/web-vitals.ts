import { gzipSync } from 'node:zlib';

import type { Page } from '@playwright/test';

/** Métricas de rendimiento de una carga de página (RT-021). */
export interface PerformanceSample {
  readonly lcpMs: number;
  readonly cls: number;
  readonly inpMs: number;
  readonly initialJsGzipKb: number;
}

interface VitalsStore {
  lcp: number;
  cls: number;
  inp: number;
}

declare global {
  interface Window {
    __vitals?: VitalsStore;
  }
}

/** Observadores de LCP, CLS e INP, instalados antes de que cargue la página. */
function installObservers(): void {
  const store: VitalsStore = { lcp: 0, cls: 0, inp: 0 };
  window.__vitals = store;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      store.lcp = entry.startTime;
    }
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
      if (!entry.hadRecentInput) {
        store.cls += entry.value;
      }
    }
  }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as unknown as { duration: number; interactionId?: number }[]) {
      if (entry.interactionId) {
        store.inp = Math.max(store.inp, entry.duration);
      }
    }
  }).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
}

/** Registra los scripts que se descargan hasta el evento `load` y suma su tamaño comprimido con gzip. */
function trackInitialScripts(page: Page): () => Promise<number> {
  const pending: Promise<number>[] = [];
  page.on('response', (response) => {
    if (response.request().resourceType() === 'script') {
      pending.push(response.body().then((body) => gzipSync(body).byteLength));
    }
  });
  return async () => (await Promise.all(pending)).reduce((sum, bytes) => sum + bytes, 0);
}

/**
 * Carga `path`, ejecuta `interact` (para medir INP) y devuelve las métricas.
 * Equivale al perfil de Lighthouse sin limitación de red ni CPU: se anota así en el informe.
 */
export async function measurePerformance(
  page: Page,
  path: string,
  interact: () => Promise<void>,
): Promise<PerformanceSample> {
  await page.addInitScript(installObservers);
  const totalScriptBytes = trackInitialScripts(page);
  await page.goto(path, { waitUntil: 'load' });
  const initialBytes = await totalScriptBytes();
  await interact();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );
  const store = await page.evaluate(() => window.__vitals ?? { lcp: 0, cls: 0, inp: 0 });
  return {
    lcpMs: Math.round(store.lcp),
    cls: Number(store.cls.toFixed(4)),
    inpMs: Math.round(store.inp),
    initialJsGzipKb: Number((initialBytes / 1024).toFixed(1)),
  };
}
