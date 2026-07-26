import type { QrArtifact } from '../qr/types';

/**
 * Caminho SVG dos modulos escuros, em unidades de modulo, com a quiet zone ja
 * somada ao deslocamento.
 *
 * Modulos horizontalmente adjacentes viram um retangulo so. Medido num QR
 * versao 8 (49x49, 1.256 modulos escuros, 615 runs): o SVG cai de 69,6 KB para
 * 8,6 KB, uma reducao de 8,1x.
 *
 * Depois do gzip a diferenca encolhe muito (3,1 KB contra 2,0 KB), e por isso o
 * argumento de peso nao e o tamanho do arquivo — e que o designer abre no
 * Illustrator **1 objeto em vez de 1.256**. E a diferenca entre um arquivo
 * editavel e um que trava a prancheta.
 *
 * Todas as coordenadas saem inteiras: quem consome aplica a escala por
 * transform, o que mantem o caminho curto e sem ruido de ponto flutuante.
 */
export function caminhoDosModulos(artefato: QrArtifact): string {
  const { size, quietZone } = artefato;
  const partes: string[] = [];

  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (!artefato.isDark(x, y)) {
        x++;
        continue;
      }
      let largura = 0;
      while (x + largura < size && artefato.isDark(x + largura, y)) largura++;

      partes.push(`M${x + quietZone} ${y + quietZone}h${largura}v1h-${largura}z`);
      x += largura;
    }
  }

  return partes.join('');
}

/** Quantos runs horizontais o caminho contem. Usado em teste e em diagnostico. */
export function contarRuns(artefato: QrArtifact): number {
  const { size } = artefato;
  let runs = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (artefato.isDark(x, y) && !artefato.isDark(x - 1, y)) runs++;
    }
  }
  return runs;
}
