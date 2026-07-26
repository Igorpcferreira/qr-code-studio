import { expect, test } from '@playwright/test';

const URL_EXEMPLO = 'https://arquivo.gov.br/registro/8841';

test.describe('gerador', () => {
  test('gera o código e mostra a ficha técnica com números reais', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Nenhum código ainda')).toBeVisible();

    await page.getByLabel('Endereço a codificar').fill(URL_EXEMPLO);

    const previa = page.getByRole('img', { name: /QR Code que codifica/ });
    await expect(previa).toBeVisible();

    const ficha = page.getByRole('region', { name: 'Ficha técnica' });
    await expect(ficha).toBeVisible();

    // v5 para esta URL no nível H: 37 x 37 módulos, capacidade de 122 bytes.
    await expect(ficha.getByText('37 × 37')).toBeVisible();
    await expect(ficha.getByText('H · 30%')).toBeVisible();
    await expect(ficha.getByText('4 módulos')).toBeVisible();
    await expect(ficha.getByText('Estático')).toBeVisible();

    // O board exibe "1.782 / 2.303 bytes", que é impossível. Aqui é calculado.
    await expect(ficha.getByText(/\d+ \/ \d+ bytes/)).toBeVisible();
  });

  /**
   * O teste mais importante desta suíte: prova que o Web Worker sobe no export
   * estático e que o circuito de verificação fecha no navegador de verdade —
   * não só no Node dos testes unitários.
   */
  test('a verificação de leitura roda no navegador e confirma o código', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Endereço a codificar').fill(URL_EXEMPLO);

    await expect(page.getByText('Leitura confirmada')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/decodificado de volta/)).toBeVisible();
    await expect(page.getByText(/Lê com até \d+% da área danificada/)).toBeVisible();
  });

  test('o contraste insuficiente é diagnosticado e bloqueia a exportação', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Endereço a codificar').fill(URL_EXEMPLO);
    await expect(page.getByText('Leitura confirmada')).toBeVisible({ timeout: 15_000 });

    // Módulo escuro quase branco: contraste some.
    await page.getByLabel('Módulo escuro').fill('#dddddd');

    await expect(page.getByText('Este código pode não ser lido')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/experimento controlado/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Baixar SVG/ })).toBeDisabled();
  });

  test('completa o esquema de quem digita o domínio sem https', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Endereço a codificar').fill('loja.exemplo.com.br/drop-07');

    await expect(page.getByText(/Completamos com https/)).toBeVisible();
    await expect(page.getByLabel('Endereço a codificar')).toHaveValue('https://loja.exemplo.com.br/drop-07', {
      timeout: 5000,
    });
  });

  test('logo central exige correção H', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Endereço a codificar').fill(URL_EXEMPLO);

    await page.getByRole('radio', { name: /Correção M/ }).click();
    await expect(page.getByText('Logo central exige correção H')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Escolher imagem' })).toBeDisabled();

    await page.getByRole('radio', { name: /Correção H/ }).click();
    await expect(page.getByRole('button', { name: 'Escolher imagem' })).toBeEnabled();
  });

  test('baixa o SVG sem nenhuma requisição de rede', async ({ page }) => {
    const externas: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.origin !== 'http://localhost:4173' && url.protocol !== 'data:' && url.protocol !== 'blob:') {
        externas.push(req.url());
      }
    });

    await page.goto('/');
    await page.getByLabel('Endereço a codificar').fill(URL_EXEMPLO);
    await expect(page.getByText('Leitura confirmada')).toBeVisible({ timeout: 15_000 });

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Baixar SVG/ }).click();
    const arquivo = await download;

    expect(arquivo.suggestedFilename()).toMatch(/\.svg$/);
    expect(externas, 'nada pode sair do navegador').toEqual([]);
  });

  test('o teclado percorre o seletor de correção com as setas', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Endereço a codificar').fill(URL_EXEMPLO);

    await page.getByRole('radio', { name: /Correção H/ }).focus();
    await page.keyboard.press('ArrowRight');

    // Circular: de H volta para L.
    await expect(page.getByRole('radio', { name: /Correção L/ })).toHaveAttribute('aria-checked', 'true');
  });
});
