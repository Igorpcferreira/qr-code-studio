import { expect, test } from '@playwright/test';

/**
 * Dois criterios de aceite da Fase 1 sao verificados aqui, contra o export
 * estatico de verdade. Ambos sao regras que se perdem por descuido ao longo de
 * meses de UI, entao viram teste desde o primeiro incremento e crescem junto
 * com o produto.
 */

test('nenhum elemento tem canto arredondado', async ({ page }) => {
  await page.goto('/');

  const infratores = await page.evaluate(() => {
    const fora: string[] = [];
    for (const el of document.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      const cantos = [
        s.borderTopLeftRadius,
        s.borderTopRightRadius,
        s.borderBottomLeftRadius,
        s.borderBottomRightRadius,
      ];
      if (cantos.some((c) => c !== '0px')) {
        fora.push(`${el.tagName.toLowerCase()}.${el.className || '(sem classe)'} -> ${cantos.join(' ')}`);
      }
    }
    return fora;
  });

  expect(infratores, 'border-radius: 0 em toda a interface, sem excecao').toEqual([]);
});

test('nada sai do navegador', async ({ page, baseURL }) => {
  const externas: string[] = [];
  // Da fixture, nao de page.url(): antes do goto a pagina esta em about:blank,
  // cuja origem e "null" — e ai toda requisicao pareceria externa.
  const origem = new URL(baseURL ?? 'http://localhost:4173').origin;

  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.origin !== origem && url.protocol !== 'data:' && url.protocol !== 'blob:') {
      externas.push(req.url());
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(externas, 'o produto promete que nada sai do navegador').toEqual([]);
});

test('a pagina responde ao tema escuro', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const fundo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(fundo).toBe('rgb(14, 15, 20)'); // Carbon
});
