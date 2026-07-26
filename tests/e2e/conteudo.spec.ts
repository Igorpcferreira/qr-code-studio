import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Os tipos de conteúdo da Fase 2.
 *
 * O que estes testes provam, e os unitários não podem provar: o payload que a
 * interface monta é o mesmo que chega ao desenho, e o desenho continua sendo
 * decodificado de volta pelo Worker no navegador de verdade. O rótulo acessível
 * da prévia carrega o conteúdo codificado, então dá para inspecionar o payload
 * sem abrir o arquivo.
 */

function previa(pagina: Page) {
  return pagina.getByRole('img', { name: /QR Code que codifica/ });
}

/**
 * Escopado ao seletor de tipo. Sem isso, "Pix" também casa com o rótulo
 * acessível do seletor de unidade ("px, Pixels") — os dois são `radio`.
 */
function escolherTipo(pagina: Page, nome: string) {
  return pagina
    .getByRole('radiogroup', { name: 'Tipo de conteúdo' })
    .getByRole('radio', { name: nome })
    .click();
}

test.describe('Pix', () => {
  test('monta o BR Code, confirma a leitura e mostra o CRC conferido', async ({ page }) => {
    await page.goto('/');
    await escolherTipo(page, 'Pix');

    await page.getByLabel('Chave Pix').fill('11144477735');
    await page.getByLabel('Nome do recebedor').fill('Padaria São João');
    await page.getByLabel('Cidade').fill('São Paulo');
    await page.getByLabel('Valor (opcional)').fill('49,90');

    const rotulo = await previa(page).getAttribute('aria-label');
    expect(rotulo).toContain('br.gov.bcb.pix');
    // Formato EMV: começa pelo indicador de payload e termina no campo de CRC.
    expect(rotulo).toMatch(/000201.*6304[0-9A-F]{4}$/);
    // Acento não existe no conjunto de caracteres do BR Code.
    expect(rotulo).toContain('Padaria Sao Joao');
    // Valor fixo no campo 54, com ponto decimal.
    expect(rotulo).toContain('540549.90');

    await expect(page.getByText('Leitura confirmada')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/CRC-16 confere/)).toBeVisible();
  });

  test('chave com dígito verificador errado impede a codificação', async ({ page }) => {
    await page.goto('/');
    await escolherTipo(page, 'Pix');

    await page.getByLabel('Chave Pix').fill('11144477736');
    await expect(page.getByText(/dígitos verificadores/)).toBeVisible();
    await expect(page.getByText('Nenhum código ainda')).toBeVisible();
  });

  test('sem valor, o código serve para qualquer quantia', async ({ page }) => {
    await page.goto('/');
    await escolherTipo(page, 'Pix');

    await page.getByLabel('Chave Pix').fill('contato@exemplo.com');
    await page.getByLabel('Nome do recebedor').fill('Estudio');
    await page.getByLabel('Cidade').fill('Recife');

    await expect(page.getByText(/quem paga digita o quanto quiser/)).toBeVisible();
    expect(await previa(page).getAttribute('aria-label')).not.toContain('5405');
  });
});

test.describe('demais tipos', () => {
  test('Wi-Fi escapa o ponto e vírgula do SSID', async ({ page }) => {
    await page.goto('/');
    await escolherTipo(page, 'Wi-Fi');

    await page.getByLabel('Nome da rede (SSID)').fill('Rede;Cafe');
    await page.getByLabel('Senha', { exact: true }).fill('segredo');

    expect(await previa(page).getAttribute('aria-label')).toContain('WIFI:T:WPA;S:Rede\\;Cafe;P:segredo;;');
    await expect(page.getByText('Leitura confirmada')).toBeVisible({ timeout: 15_000 });
  });

  test('rede aberta esconde o campo de senha', async ({ page }) => {
    await page.goto('/');
    await escolherTipo(page, 'Wi-Fi');
    await page.getByLabel('Nome da rede (SSID)').fill('Convidados');

    await page.getByRole('radio', { name: /Aberta/ }).click();
    await expect(page.getByLabel('Senha', { exact: true })).toBeHidden();
    expect(await previa(page).getAttribute('aria-label')).toContain('WIFI:T:nopass;S:Convidados;;');
  });

  test('contato vira vCard 3.0 e continua legível', async ({ page }) => {
    await page.goto('/');
    await escolherTipo(page, 'Contato');

    await page.getByLabel('Nome', { exact: true }).fill('Igor');
    await page.getByLabel('Sobrenome').fill('Ferreira');
    await page.getByLabel('Celular').fill('11987654321');

    const rotulo = await previa(page).getAttribute('aria-label');
    expect(rotulo).toContain('BEGIN:VCARD');
    expect(rotulo).toContain('TEL;TYPE=CELL:+5511987654321');

    await expect(page.getByText('Leitura confirmada')).toBeVisible({ timeout: 15_000 });
  });

  test('telefone sem código de país é completado com +55', async ({ page }) => {
    await page.goto('/');
    await escolherTipo(page, 'Telefone');
    await page.getByLabel('Número').fill('(11) 98765-4321');

    await expect(page.getByText('Codificado como +5511987654321.')).toBeVisible();
    expect(await previa(page).getAttribute('aria-label')).toContain('tel:+5511987654321');
  });

  /**
   * Trocar de tipo não pode apagar o que já foi digitado: são nove formulários
   * vivos ao mesmo tempo, e um vCard leva doze campos.
   */
  test('trocar de tipo preserva o que já foi preenchido', async ({ page }) => {
    await page.goto('/');
    await escolherTipo(page, 'Wi-Fi');
    await page.getByLabel('Nome da rede (SSID)').fill('Estudio');

    await escolherTipo(page, 'Local');
    await page.getByLabel('Latitude').fill('-23,5505');
    await page.getByLabel('Longitude').fill('-46,6333');
    expect(await previa(page).getAttribute('aria-label')).toContain('geo:-23.5505,-46.6333');

    await escolherTipo(page, 'Wi-Fi');
    await expect(page.getByLabel('Nome da rede (SSID)')).toHaveValue('Estudio');
  });

  test('o seletor de tipo é um radiogroup navegável pelo teclado', async ({ page }) => {
    await page.goto('/');
    const grupo = page.getByRole('radiogroup', { name: 'Tipo de conteúdo' });

    await grupo.getByRole('radio', { name: 'URL' }).focus();
    await page.keyboard.press('ArrowRight');

    await expect(grupo.getByRole('radio', { name: 'Texto' })).toHaveAttribute('aria-checked', 'true');
  });
});
