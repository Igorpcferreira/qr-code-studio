/**
 * Gera favicon, ícone de aplicativo e imagem de Open Graph.
 *
 * Desenha a partir da mesma geometria 7:5:3 do componente `Logo`, em vez de
 * exportar imagens de um editor: assim os ícones não podem divergir do símbolo
 * usado na interface.
 *
 * O PNG sai pelo `pngjs`, que já vem como dependência do `qrcode` — não vale
 * acrescentar um codificador de imagem ao projeto para escrever três arquivos.
 *
 *     node scripts/gerar-icones.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

const CARBON = [14, 15, 20];
const BRANCO = [255, 255, 255];
const ULTRAMARINE = [44, 54, 240];

/** Grade do símbolo: três localizadores de 120 com vão de 40, num total de 280. */
const LOCALIZADOR = 120;
const ANEL = LOCALIZADOR / 7;
const ESPACO = 40;
const GRADE = LOCALIZADOR * 2 + ESPACO;

const POSICOES = [
  [0, 0],
  [LOCALIZADOR + ESPACO, 0],
  [0, LOCALIZADOR + ESPACO],
];

function tela(largura, altura, fundo) {
  const png = new PNG({ width: largura, height: altura });
  for (let i = 0; i < largura * altura; i++) {
    png.data[i * 4] = fundo[0];
    png.data[i * 4 + 1] = fundo[1];
    png.data[i * 4 + 2] = fundo[2];
    png.data[i * 4 + 3] = 255;
  }
  return png;
}

function retangulo(png, x, y, w, h, cor) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(png.width, Math.round(x + w));
  const y1 = Math.min(png.height, Math.round(y + h));

  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const i = (py * png.width + px) * 4;
      png.data[i] = cor[0];
      png.data[i + 1] = cor[1];
      png.data[i + 2] = cor[2];
      png.data[i + 3] = 255;
    }
  }
}

/** Desenha o símbolo num quadrado de `lado`, com as cores `a` (anel/núcleo) e `b` (vão). */
function simbolo(png, origemX, origemY, lado, a, b) {
  const k = lado / GRADE;
  for (const [lx, ly] of POSICOES) {
    const x = origemX + lx * k;
    const y = origemY + ly * k;
    retangulo(png, x, y, LOCALIZADOR * k, LOCALIZADOR * k, a);
    retangulo(png, x + ANEL * k, y + ANEL * k, (LOCALIZADOR - ANEL * 2) * k, (LOCALIZADOR - ANEL * 2) * k, b);
    retangulo(
      png,
      x + ANEL * 2 * k,
      y + ANEL * 2 * k,
      (LOCALIZADOR - ANEL * 4) * k,
      (LOCALIZADOR - ANEL * 4) * k,
      a,
    );
    // Canto inferior direito: vazio, intencionalmente.
  }
}

function escrever(caminho, png) {
  mkdirSync(dirname(caminho), { recursive: true });
  writeFileSync(caminho, PNG.sync.write(png));
  console.log(`${caminho.replace(RAIZ, '.')}  ${png.width}x${png.height}`);
  return PNG.sync.write(png);
}

/**
 * Empacota um PNG num contêiner ICO.
 *
 * O formato aceita entradas em PNG desde o Vista, então basta o cabeçalho de
 * 22 bytes — não é preciso converter para BMP.
 */
function ico(pngBytes, lado) {
  const cabecalho = Buffer.alloc(22);
  cabecalho.writeUInt16LE(0, 0); // reservado
  cabecalho.writeUInt16LE(1, 2); // tipo: ícone
  cabecalho.writeUInt16LE(1, 4); // uma imagem
  cabecalho.writeUInt8(lado >= 256 ? 0 : lado, 6);
  cabecalho.writeUInt8(lado >= 256 ? 0 : lado, 7);
  cabecalho.writeUInt8(0, 8); // paleta
  cabecalho.writeUInt8(0, 9); // reservado
  cabecalho.writeUInt16LE(1, 10); // planos
  cabecalho.writeUInt16LE(32, 12); // bits por pixel
  cabecalho.writeUInt32LE(pngBytes.length, 14);
  cabecalho.writeUInt32LE(22, 18); // deslocamento dos dados
  return Buffer.concat([cabecalho, pngBytes]);
}

// ---- ícone de aplicativo: fundo cheio, como o board manda abaixo de 16 px ----
function iconeApp(lado) {
  const png = tela(lado, lado, ULTRAMARINE);
  const margem = lado * 0.14;
  simbolo(png, margem, margem, lado - margem * 2, BRANCO, ULTRAMARINE);
  return png;
}

const png32 = iconeApp(32);
escrever(join(RAIZ, 'scripts', '.tmp-favicon.png'), png32);
writeFileSync(join(RAIZ, 'app', 'favicon.ico'), ico(PNG.sync.write(png32), 32));
console.log('./app/favicon.ico  32x32');

escrever(join(RAIZ, 'app', 'apple-icon.png'), iconeApp(180));

// ---- Open Graph: símbolo aberto sobre Quiet, com faixa Carbon embaixo ----
const og = tela(1200, 630, [243, 244, 247]);
simbolo(og, 96, 96, 300, CARBON, BRANCO);
retangulo(og, 0, 630 - 12, 1200, 12, ULTRAMARINE);
escrever(join(RAIZ, 'app', 'opengraph-image.png'), og);

// ---- icon.svg: mesma geometria, sem rasterizar ----
const anel = ANEL.toFixed(3);
const vao = (LOCALIZADOR - ANEL * 2).toFixed(3);
const nucleo = (LOCALIZADOR - ANEL * 4).toFixed(3);
const locais = POSICOES.map(([x, y]) =>
  [
    `<rect x="${x}" y="${y}" width="120" height="120" fill="#0E0F14"/>`,
    `<rect x="${(x + ANEL).toFixed(3)}" y="${(y + ANEL).toFixed(3)}" width="${vao}" height="${vao}" fill="#FFFFFF"/>`,
    `<rect x="${(x + ANEL * 2).toFixed(3)}" y="${(y + ANEL * 2).toFixed(3)}" width="${nucleo}" height="${nucleo}" fill="#0E0F14"/>`,
  ].join(''),
).join('');

writeFileSync(
  join(RAIZ, 'app', 'icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRADE} ${GRADE}" fill="none" shape-rendering="crispEdges">${locais}</svg>\n`,
);
console.log(`./app/icon.svg  anel ${anel}`);
