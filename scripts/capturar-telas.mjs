/**
 * Captura as telas do README.
 *
 * Roda contra o export estatico servido por `npm run preview`, e nao contra o
 * servidor de desenvolvimento: a imagem do README precisa mostrar o artefato
 * que vai para producao, com as fontes auto-hospedadas ja aplicadas.
 *
 * O conteudo e preenchido pela propria interface e a captura so acontece depois
 * de "Leitura confirmada" aparecer — assim a tela do README mostra o produto no
 * estado que o diferencia, com a verificacao de leitura concluida.
 *
 *   node scripts/capturar-telas.mjs [http://localhost:4173]
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const DESTINO = 'docs/imagens';

const URL_EXEMPLO = 'https://arquivo.gov.br/registro/8841';

/** Uma captura por esquema de cor: o board manda a interface inverter, o codigo nao. */
const TEMAS = [
  { nome: 'tela-dark', esquema: 'dark' },
  { nome: 'tela-light', esquema: 'light' },
];

async function capturar(navegador, tema) {
  const contexto = await navegador.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
    colorScheme: tema.esquema,
    reducedMotion: 'reduce',
  });

  const pagina = await contexto.newPage();
  await pagina.goto(BASE, { waitUntil: 'networkidle' });

  await pagina.getByLabel('Endereço a codificar').fill(URL_EXEMPLO);
  await pagina.getByRole('button', { name: 'Rótulo inferior' }).click();
  await pagina.getByLabel('Chamada de ação').fill('ESCANEIE-ME');

  await pagina.getByText('Leitura confirmada').waitFor({ timeout: 30_000 });
  // A margem de dano chega depois do veredicto e faz parte do que a tela mostra.
  await pagina.getByText(/Lê com até \d+% da área danificada/).waitFor({ timeout: 30_000 });

  // O cursor piscando no campo deixaria duas capturas diferentes do mesmo estado.
  await pagina.locator('h1').click();

  await pagina.screenshot({ path: `${DESTINO}/${tema.nome}.png` });
  await contexto.close();

  console.log(`${DESTINO}/${tema.nome}.png`);
}

/**
 * O Pix, com o segundo nivel de verificacao visivel: decodificado de volta e
 * com o CRC-16 conferido. E o que a captura precisa mostrar, porque e o que
 * separa este gerador dos outros.
 */
async function capturarPix(navegador) {
  const contexto = await navegador.newContext({
    viewport: { width: 1440, height: 940 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });

  const pagina = await contexto.newPage();
  await pagina.goto(`${BASE}/qr-code-pix/`, { waitUntil: 'networkidle' });

  await pagina
    .getByRole('radiogroup', { name: 'Tipo de conteúdo' })
    .getByRole('radio', { name: 'Pix' })
    .click();

  await pagina.getByLabel('Chave Pix').fill('11144477735');
  await pagina.getByLabel('Nome do recebedor').fill('Padaria São João');
  await pagina.getByLabel('Cidade').fill('São Paulo');
  await pagina.getByLabel('Valor (opcional)').fill('49,90');
  await pagina.getByLabel('Identificador (opcional)').fill('PEDIDO7788');

  await pagina.getByText(/CRC-16 confere/).waitFor({ timeout: 30_000 });
  await pagina.locator('h1').click();
  await pagina.mouse.wheel(0, 320);
  await pagina.waitForTimeout(300);

  await pagina.screenshot({ path: `${DESTINO}/tela-pix.png` });
  await contexto.close();

  console.log(`${DESTINO}/tela-pix.png`);
}

const CSV_EXEMPLO = [
  'url;nome;chamada',
  'https://arquivo.gov.br/registro/8841;registro-8841;VER REGISTRO',
  'https://arquivo.gov.br/registro/8842;registro-8842;VER REGISTRO',
  'https://arquivo.gov.br/registro/8843;registro-8843;VER REGISTRO',
  'endereço com espaço;linha-quebrada;',
].join('\n');

/**
 * O lote, ja concluido: a captura mostra o relatorio com a linha reprovada e
 * o numero dela na planilha, que e o comportamento que justifica a verificacao
 * por linha.
 */
async function capturarLote(navegador) {
  const contexto = await navegador.newContext({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    acceptDownloads: true,
  });

  const pagina = await contexto.newPage();
  await pagina.goto(`${BASE}/qr-code-em-lote/`, { waitUntil: 'networkidle' });

  await pagina.locator('#lote-arquivo').setInputFiles({
    name: 'registros.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(CSV_EXEMPLO, 'utf8'),
  });

  const baixando = pagina.waitForEvent('download', { timeout: 60_000 });
  await pagina.getByRole('button', { name: /Gerar 4 códigos/ }).click();
  await baixando;

  await pagina.getByText('Lote concluído').waitFor({ timeout: 60_000 });

  const secao = pagina.getByRole('region', { name: 'Gerar em lote' });
  await secao.scrollIntoViewIfNeeded();
  await pagina.waitForTimeout(300);

  await secao.screenshot({ path: `${DESTINO}/tela-lote.png` });
  await contexto.close();

  console.log(`${DESTINO}/tela-lote.png`);
}

await mkdir(DESTINO, { recursive: true });

const navegador = await chromium.launch();
for (const tema of TEMAS) await capturar(navegador, tema);
await capturarPix(navegador);
await capturarLote(navegador);
await navegador.close();
