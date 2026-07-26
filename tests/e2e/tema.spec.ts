import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Seletor de tema.
 *
 * O CSS já resolvia claro e escuro por `light-dark()`; o que faltava era poder
 * escolher. Estes testes cobram as três coisas que podem quebrar: a escolha
 * valer, a escolha sobreviver ao recarregamento, e — a mais importante — o
 * código **não** inverter junto com a interface.
 */

const URL_EXEMPLO = 'https://arquivo.gov.br/registro/8841';

function seletor(page: Page) {
  return page.getByRole('radiogroup', { name: 'Tema' });
}

async function fundoDoCorpo(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

test.describe('tema', () => {
  test.use({ colorScheme: 'dark' });

  test('a escolha manual vence a preferência do sistema', async ({ page }) => {
    await page.goto('/');

    // O sistema está em escuro: sem escolha manual, o fundo é escuro.
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
    const escuroDoSistema = await fundoDoCorpo(page);

    await seletor(page).getByRole('radio', { name: 'Claro' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    const claro = await fundoDoCorpo(page);
    expect(claro).not.toBe(escuroDoSistema);

    await seletor(page).getByRole('radio', { name: 'Sistema' }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
    expect(await fundoDoCorpo(page)).toBe(escuroDoSistema);
  });

  /**
   * O script inline aplica o tema antes da primeira pintura. Sem ele a página
   * abriria no tema do sistema e piscaria para o escolhido depois da
   * hidratação.
   */
  test('sobrevive ao recarregamento, sem piscar', async ({ page }) => {
    await page.goto('/');
    await seletor(page).getByRole('radio', { name: 'Claro' }).click();

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(seletor(page).getByRole('radio', { name: 'Claro' })).toHaveAttribute('aria-checked', 'true');

    // Vale em qualquer rota, porque o script está no layout.
    await page.goto('/qr-estatico-vs-dinamico/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  /**
   * A regra do board, em teste: "no modo escuro invertemos apenas a interface;
   * o código continua escuro sobre claro para não falhar em scanners". Um QR
   * claro sobre fundo escuro é o erro que um seletor de tema convida a cometer.
   */
  test('o código não inverte junto com a interface', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Endereço a codificar').fill(URL_EXEMPLO);
    await expect(page.getByText('Leitura confirmada')).toBeVisible({ timeout: 15_000 });

    const corDosModulos = async (): Promise<string | null> =>
      page
        .getByRole('img', { name: /QR Code que codifica/ })
        .locator('path')
        .first()
        .getAttribute('fill');

    const noEscuro = await corDosModulos();

    await seletor(page).getByRole('radio', { name: 'Claro' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    expect(await corDosModulos()).toBe(noEscuro);
    // E continua sendo o escuro do board, não o claro.
    expect(noEscuro).toBe('#0e0f14');
  });

  test('o seletor é um radiogroup navegável pelo teclado', async ({ page }) => {
    await page.goto('/');

    await seletor(page).getByRole('radio', { name: 'Sistema' }).focus();
    await page.keyboard.press('ArrowRight');

    // Circular: de Sistema volta para Claro.
    await expect(seletor(page).getByRole('radio', { name: 'Claro' })).toHaveAttribute('aria-checked', 'true');
  });
});
