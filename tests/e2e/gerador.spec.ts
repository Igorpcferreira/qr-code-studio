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

test.describe('molduras', () => {
  test('aplica moldura e a chamada não entra no conteúdo codificado', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Endereço a codificar').fill('https://arquivo.gov.br/registro/8841');
    await expect(page.getByText('Leitura confirmada')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Rótulo inferior' }).click();
    await page.getByLabel('Chamada de ação').fill('menu digital');

    // Normalizada para caixa alta na entrada.
    await expect(page.getByLabel('Chamada de ação')).toHaveValue('MENU DIGITAL');

    // A prévia passa a mostrar o texto, e o código continua lendo o mesmo.
    await expect(page.getByRole('img', { name: /QR Code que codifica/ }).locator('text')).toHaveText(
      'MENU DIGITAL',
    );
    await expect(page.getByRole('img', { name: /QR Code que codifica: https:\/\/arquivo/ })).toBeVisible();
    await expect(page.getByText('Leitura confirmada')).toBeVisible({ timeout: 15_000 });
  });

  test('a grade repete o código na folha e continua legível', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Endereço a codificar').fill('https://arquivo.gov.br/registro/8841');
    await page.getByRole('button', { name: 'Grade recortável' }).click();
    await page.getByRole('button', { name: '2 × 2 = 4' }).click();

    // Escopado à prévia: os ícones da interface também usam <path>.
    const previa = page.getByRole('img', { name: /QR Code que codifica/ });
    await expect(previa.locator('path')).toHaveCount(4);
    await expect(page.getByText('Leitura confirmada')).toBeVisible({ timeout: 15_000 });
  });

  test('a chamada é truncada em 24 caracteres', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Endereço a codificar').fill('https://exemplo.com');
    await page.getByRole('button', { name: 'Rótulo inferior' }).click();

    await page.getByLabel('Chamada de ação').fill('a'.repeat(60));
    const valor = await page.getByLabel('Chamada de ação').inputValue();
    expect(valor.length).toBeLessThanOrEqual(24);
  });
});

test.describe('forma e cor dos módulos', () => {
  /**
   * A forma é a personalização que pode quebrar a leitura sem estragar nada
   * que se veja. Por isso o teste não confere aparência: confere que o código
   * estilizado passa pela verificação **no navegador**, com o mesmo desenho que
   * vai para o arquivo.
   */
  test('a forma de circuito é aplicada e o código continua sendo lido', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Endereço a codificar').fill(URL_EXEMPLO);
    await expect(page.getByText('Leitura confirmada')).toBeVisible({ timeout: 15_000 });

    const previa = page.getByRole('img', { name: /QR Code que codifica/ });
    // Clássico: o código inteiro sai como um objeto só.
    await expect(previa.locator('path')).toHaveCount(1);

    await page.getByRole('button', { name: 'Circuito' }).click();

    // Estilizado: anel, vazado e miolo dos marcadores, mais os módulos.
    await expect(previa.locator('path')).toHaveCount(4);
    await expect(page.getByText('Leitura confirmada')).toBeVisible({ timeout: 15_000 });
  });

  test('a paleta troca o par de cores e os marcadores aceitam cor própria', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Endereço a codificar').fill(URL_EXEMPLO);
    await expect(page.getByText('Leitura confirmada')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Verde placa' }).click();
    await expect(page.getByLabel('Módulo escuro')).toHaveValue('#0a3d2e');
    await expect(page.getByLabel('Módulo claro')).toHaveValue('#e8f2ea');

    await page.getByRole('button', { name: 'Cor própria' }).click();
    await page.getByLabel('Marcadores de canto').fill('#2c36f0');

    await expect(page.getByText(/Contraste dos marcadores/)).toBeVisible();
    await expect(page.getByText('Leitura confirmada')).toBeVisible({ timeout: 15_000 });
  });

  /**
   * O caso que a verificação existe para pegar: marcador claro demais. Os
   * módulos continuam perfeitos, o contraste deles não muda, e o detector
   * simplesmente não acha o código.
   */
  test('marcador sem contraste é diagnosticado e bloqueia a exportação', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Endereço a codificar').fill(URL_EXEMPLO);
    await expect(page.getByText('Leitura confirmada')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Cor própria' }).click();
    await page.getByLabel('Marcadores de canto').fill('#eeeeee');

    await expect(page.getByText('Este código pode não ser lido')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Baixar SVG/ })).toBeDisabled();
  });
});

test.describe('exportação em PDF', () => {
  test('o PDF é gerado no navegador, sem nenhuma requisição de rede', async ({ page }) => {
    const externas: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.origin !== 'http://localhost:4173' && url.protocol !== 'data:' && url.protocol !== 'blob:') {
        externas.push(req.url());
      }
    });

    await page.goto('/');
    await page.getByLabel('Endereço a codificar').fill('https://arquivo.gov.br/registro/8841');
    await expect(page.getByText('Leitura confirmada')).toBeVisible({ timeout: 15_000 });

    const download = page.waitForEvent('download', { timeout: 30_000 });
    await page.getByRole('button', { name: /Baixar PDF/ }).click();
    const arquivo = await download;

    expect(arquivo.suggestedFilename()).toMatch(/\.pdf$/);
    // As fontes são embutidas no chunk: nem elas viajam pela rede.
    expect(externas, 'nada pode sair do navegador').toEqual([]);
  });

  test('as opções de gráfica ficam disponíveis', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Endereço a codificar').fill('https://exemplo.com');

    await expect(page.getByRole('button', { name: 'A4' })).toBeVisible();
    await expect(page.getByText('Preto 100% K')).toBeVisible();
    await expect(page.getByText('Sangria de 3 mm')).toBeVisible();
  });
});
