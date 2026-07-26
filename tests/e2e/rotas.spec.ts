import { expect, test } from '@playwright/test';

const ROTAS = ['/', '/qr-code-url/', '/qr-code-texto/', '/qr-estatico-vs-dinamico/'];

test.describe('rotas e acabamento', () => {
  test('toda rota responde com título e descrição próprios', async ({ page }) => {
    const titulos = new Set<string>();

    for (const rota of ROTAS) {
      const resposta = await page.goto(rota);
      expect(resposta?.status(), rota).toBe(200);

      const titulo = await page.title();
      expect(titulo, rota).toContain('QR Code Studio');
      titulos.add(titulo);

      const descricao = await page.locator('meta[name="description"]').getAttribute('content');
      expect(descricao?.length ?? 0, rota).toBeGreaterThan(60);
    }

    // Títulos repetidos entre landings canibalizam a própria busca.
    expect(titulos.size).toBe(ROTAS.length);
  });

  test('cada página tem exatamente um h1', async ({ page }) => {
    for (const rota of ROTAS) {
      await page.goto(rota);
      await expect(page.locator('h1'), rota).toHaveCount(1);
    }
  });

  test('o primeiro tab é o atalho para o gerador', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');

    const focado = page.locator(':focus');
    await expect(focado).toHaveText('Pular para o gerador');
    await expect(focado).toBeVisible();
  });

  test('sitemap e robots são publicados', async ({ page }) => {
    const sitemap = await page.goto('/sitemap.xml');
    expect(sitemap?.status()).toBe(200);
    const xml = (await sitemap?.text()) ?? '';
    for (const rota of ROTAS) expect(xml, rota).toContain(rota === '/' ? '/</loc>' : rota);

    const robots = await page.goto('/robots.txt');
    expect(robots?.status()).toBe(200);
    expect(await robots?.text()).toContain('Sitemap:');
  });

  test('o manifesto do PWA é válido', async ({ page }) => {
    const resposta = await page.goto('/manifest.webmanifest');
    expect(resposta?.status()).toBe(200);

    const manifesto = JSON.parse((await resposta?.text()) ?? '{}') as {
      name?: string;
      icons?: unknown[];
      lang?: string;
    };
    expect(manifesto.name).toContain('QR Code Studio');
    expect(manifesto.lang).toBe('pt-BR');
    expect(manifesto.icons?.length ?? 0).toBeGreaterThan(0);
  });

  test('o service worker é servido', async ({ page }) => {
    const resposta = await page.goto('/sw.js');
    expect(resposta?.status()).toBe(200);
    expect(await resposta?.text()).toContain('caches');
  });

  test('a página-tese explica estático e dinâmico', async ({ page }) => {
    await page.goto('/qr-estatico-vs-dinamico/');
    await expect(page.getByRole('heading', { name: 'O que é um QR estático' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'O que é um QR dinâmico' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Gerar um QR estático/ })).toBeVisible();
  });

  test('o idioma é português em toda rota', async ({ page }) => {
    for (const rota of ROTAS) {
      await page.goto(rota);
      await expect(page.locator('html'), rota).toHaveAttribute('lang', 'pt-BR');
    }
  });
});
