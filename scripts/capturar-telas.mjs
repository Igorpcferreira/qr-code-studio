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
 * As telas de celular saem emolduradas num aparelho desenhado em HTML, com a
 * barra de endereco do navegador: o que elas mostram e o site como ele chega
 * para quem abre o link, antes de qualquer interacao.
 *
 *   node scripts/capturar-telas.mjs [http://localhost:4173]
 */
import { chromium, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const DESTINO = 'docs/imagens';

const URL_EXEMPLO = 'https://arquivo.gov.br/registro/8841';

/** Uma captura por esquema de cor: o board manda a interface inverter, o codigo nao. */
const TEMAS = [
  { nome: 'tela-dark', esquema: 'dark', opcao: 'Escuro' },
  { nome: 'tela-light', esquema: 'light', opcao: 'Claro' },
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
 * Aparelho emulado das capturas de celular.
 *
 * O modelo maior nao e vaidade: com 393 de largura a manchete quebra em mais
 * uma linha e a captura da home corta o subtitulo no meio.
 */
const APARELHO = devices['iPhone 14 Pro Max'];

/**
 * Tela do aparelho em CSS px — 430 x 932, que nao e o viewport do descritor.
 *
 * O `devices` do Playwright ja desconta o cromo do navegador (da 430 x 739), e
 * essa e a area util da pagina, nao a tela. Aqui a moldura desenha a tela
 * inteira e o viewport de cada captura sai por subtracao, entao o que a pagina
 * mostra e exatamente o que caberia no aparelho.
 */
const ECRA = { largura: 430, altura: 932 };

/** Alturas das barras desenhadas na moldura, em CSS px. */
const BARRA = 44;
const NAVEGADOR = 56;

/** Viewport de captura: a tela menos as duas barras que a moldura desenha. */
const VIEWPORT = { width: ECRA.largura, height: ECRA.altura - BARRA - NAVEGADOR };

/**
 * Endereco mostrado na barra do navegador.
 *
 * A captura roda contra o export local, mas o que a imagem afirma e onde o
 * site esta publicado — dai ler a mesma variavel que o `sitemap` e as canonicas
 * usam, em vez de fixar um host aqui.
 */
const HOST_PUBLICO = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://qr-code-studio-free.vercel.app').replace(
  /^https?:\/\//,
  '',
);

/**
 * Cromo do navegador por tema, em valores do board.
 *
 * A barra de endereco nao pode sair da paleta so por imitar um navegador: ela
 * fica ao lado da captura do outro tema, na mesma linha do README.
 */
const CROMO = {
  dark: { fundo: '#1c1e26', pilula: '#0e0f14', borda: 'rgb(255 255 255 / 0.08)', texto: '#f3f4f7' },
  light: { fundo: '#e7e9ef', pilula: '#ffffff', borda: '#d5d8e1', texto: '#0e0f14' },
};

/**
 * Envolve uma captura de celular numa moldura de aparelho.
 *
 * A moldura e desenhada em HTML e fotografada de novo, em vez de composta por
 * uma biblioteca de imagem: o projeto nao tem dependencia de manipulacao de
 * bitmap e nao vale adicionar uma para um enfeite de README.
 *
 * A barra de status usa as cores lidas da propria pagina, entao ela acompanha o
 * tema em vez de fixar um preto que brigaria com o modo claro. O fundo sai
 * transparente para a imagem funcionar no GitHub claro e no escuro.
 *
 * As barras entram no fluxo e empurram a captura para baixo, em vez de ficarem
 * por cima: sobrepor esconderia justamente o inicio da pagina na captura que
 * existe para mostrar o inicio da pagina.
 *
 * O aparelho e fotografado a 1,5x sobre uma captura de 3x — a tela e reduzida,
 * nunca esticada, que e o lado certo de errar quando o alvo e um PNG.
 */
async function emoldurar(navegador, captura, cores, destino) {
  const contexto = await navegador.newContext({
    viewport: { width: 700, height: 1200 },
    deviceScaleFactor: 1.5,
  });
  const pagina = await contexto.newPage();
  const cromo = CROMO[cores.esquema];

  await pagina.setContent(`<!doctype html>
    <meta charset="utf-8">
    <style>
      html, body { margin: 0; background: transparent; }
      /* A folga existe para a sombra caber dentro do recorte do elemento. */
      .palco { width: fit-content; padding: 40px 44px 56px; }

      .aparelho {
        position: relative;
        padding: 12px;
        border-radius: 60px;
        background: linear-gradient(150deg, #56565c, #1e1e22 26%, #101013 62%, #3c3c44);
        box-shadow:
          0 0 0 1px rgb(0 0 0 / 0.55),
          0 34px 56px -26px rgb(0 0 0 / 0.55);
      }
      /* O fio claro por dentro da borda: sem ele a moldura preta some no README escuro. */
      .aparelho::after {
        content: '';
        position: absolute;
        inset: 5px;
        border-radius: 55px;
        box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.16);
      }

      .vidro {
        width: ${ECRA.largura}px;
        overflow: hidden;
        border-radius: 48px;
        background: ${cores.fundo};
      }
      .tela { display: block; width: ${ECRA.largura}px; }

      .status {
        display: flex; align-items: center; justify-content: space-between;
        height: ${BARRA}px; padding: 0 32px 0 34px;
        background: ${cromo.fundo}; color: ${cores.texto};
        font: 600 15px/1 -apple-system, 'Segoe UI', Roboto, sans-serif;
      }
      .status .sinais { display: flex; align-items: center; gap: 7px; }

      .navegador {
        height: ${NAVEGADOR}px; display: flex; align-items: center;
        padding: 0 14px 10px; background: ${cromo.fundo};
      }
      .endereco {
        display: flex; align-items: center; gap: 9px; width: 100%; height: 40px;
        padding: 0 16px; border-radius: 20px;
        background: ${cromo.pilula}; border: 1px solid ${cromo.borda};
        color: ${cromo.texto};
        font: 13px/1 ui-monospace, 'IBM Plex Mono', Consolas, monospace;
      }

      .botao {
        position: absolute; width: 3px; border-radius: 0 3px 3px 0;
        background: linear-gradient(90deg, #0c0c0f, #4a4a52);
      }
      .botao[data-lado='direito'] {
        border-radius: 3px 0 0 3px;
        background: linear-gradient(270deg, #0c0c0f, #4a4a52);
      }
    </style>
    <div class="palco">
      <div class="aparelho">
        <span class="botao" style="left: -3px; top: 128px; height: 30px"></span>
        <span class="botao" style="left: -3px; top: 190px; height: 60px"></span>
        <span class="botao" style="left: -3px; top: 268px; height: 60px"></span>
        <span class="botao" data-lado="direito" style="right: -3px; top: 218px; height: 100px"></span>

        <div class="vidro">
          <div class="status">
            <span>9:41</span>
            <span class="sinais">
              <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor" aria-hidden>
                <rect x="0" y="8" width="3" height="4"></rect>
                <rect x="4.6" y="5.6" width="3" height="6.4"></rect>
                <rect x="9.2" y="3.2" width="3" height="8.8"></rect>
                <rect x="13.8" y="0" width="3" height="12"></rect>
              </svg>
              <svg width="15" height="11" viewBox="0 0 15 11" fill="none" aria-hidden>
                <path d="M1 3.4a9.4 9.4 0 0 1 13 0M3.6 6a5.9 5.9 0 0 1 7.8 0" stroke="currentColor"
                      stroke-width="1.6" stroke-linecap="round"></path>
                <circle cx="7.5" cy="9" r="1.4" fill="currentColor"></circle>
              </svg>
              <svg width="24" height="12" viewBox="0 0 24 12" fill="none" aria-hidden>
                <rect x=".7" y=".7" width="20" height="10.6" rx="3.2" stroke="currentColor"
                      stroke-opacity=".45" stroke-width="1.2"></rect>
                <rect x="2.4" y="2.4" width="14" height="7.2" rx="1.9" fill="currentColor"></rect>
                <path d="M22.4 4.3v3.4a1.9 1.9 0 0 0 0-3.4Z" fill="currentColor"
                      fill-opacity=".45"></path>
              </svg>
            </span>
          </div>
          <div class="navegador">
            <div class="endereco">
              <svg width="11" height="14" viewBox="0 0 11 14" fill="currentColor" aria-hidden>
                <path d="M5.5 0a3 3 0 0 0-3 3v2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V6a1 1
                         0 0 0-1-1h-.5V3a3 3 0 0 0-3-3Zm2 5h-4V3a2 2 0 1 1 4 0v2Z"></path>
              </svg>
              <span>${HOST_PUBLICO}</span>
            </div>
          </div>
          <img class="tela" src="data:image/png;base64,${captura.toString('base64')}" alt="">
        </div>
      </div>
    </div>
  `);

  // A moldura so pode ser fotografada depois que a captura de dentro decodificou.
  await pagina.locator('.tela').evaluate((img) => img.decode());
  await pagina.locator('.palco').screenshot({ path: destino, omitBackground: true });
  await contexto.close();

  console.log(destino);
}

/** As cores da barra de status saem da pagina capturada, nao de uma constante. */
async function lerCores(pagina, esquema) {
  const lidas = await pagina.evaluate(() => {
    const estilo = getComputedStyle(document.body);
    return { fundo: estilo.backgroundColor, texto: estilo.color };
  });
  return { ...lidas, esquema };
}

/**
 * A home no celular, nos dois temas, como ela chega para quem abre o endereco.
 *
 * O tema e trocado pelo proprio seletor da pagina, e nao so pelo `colorScheme`
 * do contexto: assim a opcao marcada na imagem e a que produziu aquela tela, em
 * vez de a interface aparecer em claro com "Sistema" aceso.
 */
async function capturarCelular(navegador, tema) {
  const contexto = await navegador.newContext({
    ...APARELHO,
    viewport: VIEWPORT,
    colorScheme: tema.esquema,
    reducedMotion: 'reduce',
  });

  const pagina = await contexto.newPage();
  await pagina.goto(BASE, { waitUntil: 'networkidle' });

  await pagina
    .getByRole('radiogroup', { name: 'Tema' })
    .getByRole('radio', { name: new RegExp(`^${tema.opcao}`) })
    .click();
  await pagina.waitForTimeout(400);

  const cores = await lerCores(pagina, tema.esquema);
  const captura = await pagina.screenshot();
  await contexto.close();

  await emoldurar(navegador, captura, cores, `${DESTINO}/${tema.nome}-celular.png`);
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
for (const tema of TEMAS) await capturarCelular(navegador, tema);
await capturarPix(navegador);
await capturarLote(navegador);
await navegador.close();
