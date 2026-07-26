import { expect, test } from '@playwright/test';

/**
 * Histórico local.
 *
 * A parte pura — identidade, rótulo e poda — está coberta nos unitários. O que
 * só o navegador prova é o resto: o IndexedDB abre no export estático, a
 * gravação acontece depois da verificação de leitura, a configuração volta
 * inteira ao restaurar e apagar apaga de verdade.
 */

const URL_A = 'https://arquivo.gov.br/registro/8841';
const URL_B = 'https://arquivo.gov.br/registro/9002';

test.describe('histórico', () => {
  test('guarda depois da verificação, restaura a configuração inteira e apaga', async ({ page }) => {
    await page.goto('/');

    const historico = page.getByRole('region', { name: 'Histórico' });
    await expect(historico.getByText('Nenhum código guardado ainda')).toBeVisible();

    await page.getByLabel('Endereço a codificar').fill(URL_A);
    await expect(page.getByText('Leitura confirmada')).toBeVisible({ timeout: 15_000 });

    // Muda a cor: a configuração guardada precisa carregar isso junto.
    await page.getByLabel('Módulo escuro').fill('#2c36f0');
    await expect(page.getByText('Leitura confirmada')).toBeVisible({ timeout: 15_000 });

    const primeiro = historico.getByRole('listitem').filter({ hasText: URL_A });
    await expect(primeiro).toBeVisible({ timeout: 15_000 });

    // Outro conteúdo, outro registro.
    await page.getByLabel('Endereço a codificar').fill(URL_B);
    await expect(historico.getByRole('listitem').filter({ hasText: URL_B })).toBeVisible({
      timeout: 15_000,
    });

    // Restaurar traz de volta o conteúdo e a cor do registro escolhido.
    await primeiro.getByRole('button', { name: 'Restaurar' }).click();
    await expect(page.getByLabel('Endereço a codificar')).toHaveValue(URL_A);
    await expect(page.getByLabel('Módulo escuro')).toHaveValue('#2c36f0');

    await historico.getByRole('button', { name: 'Apagar todo o histórico' }).click();
    await expect(historico.getByText('Nenhum código guardado ainda')).toBeVisible();
  });

  test('sobrevive a recarregar a página — é isso que o IndexedDB entrega', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Endereço a codificar').fill(URL_A);

    const historico = page.getByRole('region', { name: 'Histórico' });
    await expect(historico.getByRole('listitem').filter({ hasText: URL_A })).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await expect(historico.getByRole('listitem').filter({ hasText: URL_A })).toBeVisible({
      timeout: 15_000,
    });

    await historico.getByRole('button', { name: 'Apagar todo o histórico' }).click();
  });

  test('desligado, nada novo é gravado', async ({ page }) => {
    await page.goto('/');

    const historico = page.getByRole('region', { name: 'Histórico' });
    await historico.getByText('Guardar histórico neste navegador').click();

    await page.getByLabel('Endereço a codificar').fill(URL_B);
    await expect(page.getByText('Leitura confirmada')).toBeVisible({ timeout: 15_000 });

    await expect(historico.getByText('Nenhum código guardado ainda')).toBeVisible();
  });
});
