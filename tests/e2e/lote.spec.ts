import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Lote a partir de CSV.
 *
 * Prova o que os unitários não alcançam: o Worker de lote sobe no export
 * estático, o CSV é lido do disco sem passar por rede, o ZIP é montado no
 * navegador e chega como download.
 */

const CSV = [
  'url;nome;chamada',
  'https://arquivo.gov.br/registro/1;peca-um;ESCANEIE-ME',
  'https://arquivo.gov.br/registro/2;peca-dois;',
  'endereço com espaço;peca-tres;',
].join('\n');

async function enviarCsv(page: Page, conteudo = CSV): Promise<void> {
  await page.locator('#lote-arquivo').setInputFiles({
    name: 'lote.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(conteudo, 'utf8'),
  });
}

test.describe('lote', () => {
  test('lê a planilha, empacota o ZIP e relata a linha que não passou', async ({ page }) => {
    const externas: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.origin !== 'http://localhost:4173' && url.protocol !== 'data:' && url.protocol !== 'blob:') {
        externas.push(req.url());
      }
    });

    await page.goto('/qr-code-em-lote/');
    await enviarCsv(page);

    // Três linhas de dado; o cabeçalho é reconhecido e não vira peça.
    await expect(page.getByText('linhas prontas')).toBeVisible();
    await expect(
      page.getByText(/linha 2 · https:\/\/arquivo\.gov\.br\/registro\/1 · ESCANEIE-ME/),
    ).toBeVisible();

    const download = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: /Gerar 3 códigos/ }).click();

    const arquivo = await download;
    expect(arquivo.suggestedFilename()).toBe('qr-lote-2-pecas.zip');

    await expect(page.getByText('Lote concluído')).toBeVisible();
    await expect(page.getByText('2 de 3 peças no ZIP.')).toBeVisible();
    // A linha ruim aparece com o número que o usuário vê na planilha.
    await expect(page.getByText(/linha 4: .*espaços/)).toBeVisible();

    expect(externas, 'o CSV é lido do disco e nada sai do navegador').toEqual([]);
  });

  test('permite corrigir a leitura quando a primeira linha não é cabeçalho', async ({ page }) => {
    await page.goto('/qr-code-em-lote/');
    await enviarCsv(page, 'https://arquivo.gov.br/a\nhttps://arquivo.gov.br/b');

    // Sem nome de coluna conhecido, nada é tratado como cabeçalho.
    await expect(page.getByText('sem cabeçalho')).toBeVisible();
    await expect(page.getByRole('button', { name: /Gerar 2 códigos/ })).toBeVisible();

    await page.getByRole('button', { name: 'A primeira linha é cabeçalho' }).click();
    await expect(page.getByRole('button', { name: /Gerar 1 código/ })).toBeVisible();
  });

  test('o modelo de planilha é baixado do próprio navegador', async ({ page }) => {
    await page.goto('/qr-code-em-lote/');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar modelo' }).click();

    expect((await download).suggestedFilename()).toBe('modelo-lote.csv');
  });
});
