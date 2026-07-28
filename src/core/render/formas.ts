/**
 * Forma dos módulos.
 *
 * O problema que este arquivo resolve: são cinco formas por quatro saídas (SVG,
 * Canvas, PDF e o rasterizador puro da verificação). Vinte implementações que
 * precisariam concordar pixel a pixel — e a que discordasse seria justamente a
 * da verificação, que é quem diz ao usuário se o código lê.
 *
 * A saída é uma lista de **primitivas em unidades de módulo**, com a quiet zone
 * já somada. Cada renderizador consome a mesma lista:
 *
 *   - SVG e PDF  -> `caminhoDasPrimitivas`, um `<path>` por tinta
 *   - Canvas     -> o mesmo caminho, via `Path2D`
 *   - Rasterizador -> `contemPonto`, teste analítico por pixel
 *
 * Três primitivas bastam para as cinco formas: retângulo com raio por canto,
 * círculo e polígono. Nenhuma delas precisa de interpretador de caminho SVG,
 * que é o que permite o rasterizador continuar puro e rodando no Node.
 *
 * REGRA QUE NENHUMA FORMA PODE QUEBRAR: o centro de um módulo escuro fica
 * escuro e o centro de um módulo claro fica claro. É onde o decodificador
 * amostra. As formas encolhem e arredondam a tinta dentro da célula, nunca
 * deslocam o centro — e `formas.test.ts` verifica isso módulo a módulo.
 */

export type FormaModulo = 'quadrado' | 'arredondado' | 'ponto' | 'losango' | 'circuito';

export const FORMA_PADRAO: FormaModulo = 'quadrado';

export interface DefinicaoForma {
  readonly id: FormaModulo;
  readonly nome: string;
  readonly descricao: string;
}

export const FORMAS: readonly DefinicaoForma[] = [
  { id: 'quadrado', nome: 'Clássico', descricao: 'Módulo cheio · a forma do padrão ISO' },
  { id: 'arredondado', nome: 'Arredondado', descricao: 'Cantos soltos onde não há vizinho' },
  { id: 'ponto', nome: 'Pontos', descricao: 'Círculos soltos · leve' },
  { id: 'losango', nome: 'Losango', descricao: 'Diagonal · sinalização' },
  { id: 'circuito', nome: 'Circuito', descricao: 'Trilhas, pads e vias de placa eletrônica' },
];

const POR_ID = new Map(FORMAS.map((f) => [f.id, f]));

export function formaModulo(id: FormaModulo): DefinicaoForma {
  const achada = POR_ID.get(id);
  if (achada === undefined) throw new RangeError(`Forma desconhecida: ${id}`);
  return achada;
}

/**
 * Qual cor pinta a primitiva.
 *
 * `claro` existe porque o miolo do marcador de localização é vazado: a peça é
 * desenhada como um retângulo cheio e um retângulo claro por dentro. Vazar de
 * verdade exigiria regra de preenchimento par-ímpar, que o PDF e o rasterizador
 * tratariam de formas diferentes.
 */
export type Tinta = 'escuro' | 'claro' | 'olhos';

export interface PrimitivaRect {
  readonly tipo: 'rect';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Raio de cada canto, em módulos: superior-esq, superior-dir, inferior-dir, inferior-esq. */
  readonly raios?: readonly [number, number, number, number];
  readonly tinta: Tinta;
}

export interface PrimitivaCirculo {
  readonly tipo: 'circulo';
  readonly cx: number;
  readonly cy: number;
  readonly raio: number;
  readonly tinta: Tinta;
}

export interface PrimitivaPoligono {
  readonly tipo: 'poligono';
  readonly pontos: readonly (readonly [number, number])[];
  readonly tinta: Tinta;
}

export type Primitiva = PrimitivaRect | PrimitivaCirculo | PrimitivaPoligono;

/** O mínimo que este módulo precisa de uma matriz. `QrArtifact` já atende. */
export interface MatrizModulos {
  readonly size: number;
  readonly quietZone: number;
  isDark(x: number, y: number): boolean;
}

export interface OpcoesFormas {
  /**
   * Estiliza os três marcadores de localização como peça única.
   *
   * Desligado nos ícones de amostra da interface, que são recortes pequenos
   * demais para conter um marcador.
   */
  readonly marcadores?: boolean;
}

/* --------------------------------------------------------------- geometria */

/** Constante de Bézier que aproxima um quarto de círculo. */
const K = 0.5522847498307936;

/** Lado do círculo de `ponto`, em módulos. Menor que 0,5 para os pontos soltarem. */
const RAIO_PONTO = 0.46;

/** Meia-diagonal do losango. Acima de 0,5 os losangos vizinhos se tocam. */
const MEIA_DIAGONAL = 0.54;

/*
 * Circuito. Os números saíram de medir a leitura, não de gosto: com trilha
 * abaixo de 0,5 módulo o jsQR começa a errar em versões altas, porque a média
 * local do binarizador escorrega para o claro. 0,56 passou em v1 a v40 nos
 * quatro níveis de correção — e é a menor largura testada que passou.
 */
const TRILHA = 0.56;
const PAD_TERMINAL = 0.86;
const RAIO_PAD_TERMINAL = 0.22;
const RAIO_VIA = 0.46;
const RAIO_JUNCAO = 0.36;
const RAIO_COTOVELO = 0.32;

/**
 * Raios das três peças do marcador: anel externo, vazado interno e miolo.
 *
 * O teto não é estético. Um canto de raio r deixa de cobrir o centro do módulo
 * de canto quando (r − 0,5)·√2 > r — acima de 1,707 módulo — e um centro de
 * módulo que troca de cor é um bit trocado. Exigindo que o arco cubra o centro
 * com 0,15 módulo de folga em cada eixo, o teto cai para 1,19; daí o 1,05
 * daqui. `formas.test.ts` cobra a folga módulo a módulo, em todas as formas.
 */
const RAIOS_MARCADOR: Readonly<Record<FormaModulo, readonly [number, number, number]>> = {
  quadrado: [0, 0, 0],
  arredondado: [1.05, 0.8, 0.7],
  ponto: [1.05, 0.9, 0],
  losango: [0.35, 0.25, 0.2],
  circuito: [0.9, 0.7, 0.5],
};

/**
 * Raio do miolo circular do marcador na forma de pontos.
 *
 * Espremido entre dois limites: abaixo de 1,63 descobre o centro dos módulos
 * de canto do próprio miolo; acima de 1,85 invade o centro dos módulos claros
 * do anel. 1,72 fica no meio da faixa.
 */
const RAIO_MIOLO_PONTO = 1.72;

function iguais(raio: number): readonly [number, number, number, number] {
  return [raio, raio, raio, raio];
}

/** O módulo pertence a um dos três marcadores de localização? */
function ehMarcador(size: number, x: number, y: number): boolean {
  const alto = y < 7;
  const baixo = y >= size - 7;
  const esquerda = x < 7;
  const direita = x >= size - 7;
  return (alto && esquerda) || (alto && direita) || (baixo && esquerda);
}

/**
 * Uma das três peças de um marcador de localização, na ordem de pintura:
 * anel cheio, vazado claro por cima e miolo por cima do vazado.
 *
 * Nenhuma forma transforma o marcador em pontos ou losangos soltos, e isso é
 * decisão de leitura, não de estética: o detector procura a razão 1:1:3:1:1
 * varrendo linhas retas sobre o marcador. Arredondar o contorno mantém a
 * razão; trocá-lo por círculos separados a destrói, e o código deixa de ser
 * encontrado antes mesmo de a correção de erro entrar em jogo.
 */
function pecaDoMarcador(forma: FormaModulo, x: number, y: number, camada: 0 | 1 | 2): Primitiva {
  const [externo, vazado, miolo] = RAIOS_MARCADOR[forma];

  if (camada === 0) return { tipo: 'rect', x, y, w: 7, h: 7, raios: iguais(externo), tinta: 'olhos' };
  if (camada === 1)
    return { tipo: 'rect', x: x + 1, y: y + 1, w: 5, h: 5, raios: iguais(vazado), tinta: 'claro' };

  return forma === 'ponto'
    ? { tipo: 'circulo', cx: x + 3.5, cy: y + 3.5, raio: RAIO_MIOLO_PONTO, tinta: 'olhos' }
    : { tipo: 'rect', x: x + 2, y: y + 2, w: 3, h: 3, raios: iguais(miolo), tinta: 'olhos' };
}

interface Vizinhanca {
  readonly norte: boolean;
  readonly sul: boolean;
  readonly leste: boolean;
  readonly oeste: boolean;
}

function primitivasDoModulo(forma: FormaModulo, x: number, y: number, v: Vizinhanca): Primitiva[] {
  switch (forma) {
    case 'quadrado':
      // Tratado por varredura de runs em `primitivasDoCodigo`; aqui só para completude.
      return [{ tipo: 'rect', x, y, w: 1, h: 1, tinta: 'escuro' }];

    case 'arredondado': {
      /*
       * Só arredonda o canto cujos dois lados estão livres. Assim uma corrida
       * de módulos vizinhos vira uma barra de pontas redondas e cantos vivos no
       * meio, em vez de uma fileira de quadradinhos arredondados com entalhes.
       */
      const r = 0.5;
      const raios: readonly [number, number, number, number] = [
        !v.norte && !v.oeste ? r : 0,
        !v.norte && !v.leste ? r : 0,
        !v.sul && !v.leste ? r : 0,
        !v.sul && !v.oeste ? r : 0,
      ];
      return [{ tipo: 'rect', x, y, w: 1, h: 1, raios, tinta: 'escuro' }];
    }

    case 'ponto':
      return [{ tipo: 'circulo', cx: x + 0.5, cy: y + 0.5, raio: RAIO_PONTO, tinta: 'escuro' }];

    case 'losango': {
      const cx = x + 0.5;
      const cy = y + 0.5;
      const d = MEIA_DIAGONAL;
      return [
        {
          tipo: 'poligono',
          pontos: [
            [cx, cy - d],
            [cx + d, cy],
            [cx, cy + d],
            [cx - d, cy],
          ],
          tinta: 'escuro',
        },
      ];
    }

    case 'circuito':
      return primitivasDeCircuito(x, y, v);
  }
}

/**
 * Um módulo de placa eletrônica.
 *
 * A leitura da vizinhança é o que faz a forma parecer uma placa e não um
 * chuvisco de bolinhas: módulos em fila viram trilha contínua, a ponta da fila
 * ganha pad retangular de solda, o cotovelo é arredondado, o cruzamento vira
 * nó e o módulo isolado vira via. As trilhas saem só para leste e para o sul
 * porque o vizinho do outro lado desenha a metade dele — cada trilha é escrita
 * uma vez.
 */
function primitivasDeCircuito(x: number, y: number, v: Vizinhanca): Primitiva[] {
  const cx = x + 0.5;
  const cy = y + 0.5;
  const meia = TRILHA / 2;
  const pecas: Primitiva[] = [];

  if (v.leste) {
    pecas.push({ tipo: 'rect', x: cx, y: cy - meia, w: 1, h: TRILHA, tinta: 'escuro' });
  }
  if (v.sul) {
    pecas.push({ tipo: 'rect', x: cx - meia, y: cy, w: TRILHA, h: 1, tinta: 'escuro' });
  }

  const grau = Number(v.norte) + Number(v.sul) + Number(v.leste) + Number(v.oeste);
  const reto = (v.norte && v.sul && grau === 2) || (v.leste && v.oeste && grau === 2);

  if (grau === 0) {
    pecas.push({ tipo: 'circulo', cx, cy, raio: RAIO_VIA, tinta: 'escuro' });
  } else if (grau === 1) {
    const lado = PAD_TERMINAL;
    pecas.push({
      tipo: 'rect',
      x: cx - lado / 2,
      y: cy - lado / 2,
      w: lado,
      h: lado,
      raios: iguais(RAIO_PAD_TERMINAL),
      tinta: 'escuro',
    });
  } else if (grau >= 3) {
    pecas.push({ tipo: 'circulo', cx, cy, raio: RAIO_JUNCAO, tinta: 'escuro' });
  } else if (!reto) {
    pecas.push({ tipo: 'circulo', cx, cy, raio: RAIO_COTOVELO, tinta: 'escuro' });
  }

  return pecas;
}

/**
 * As primitivas do código inteiro, em unidades de módulo e com a quiet zone
 * já somada ao deslocamento.
 */
export function primitivasDoCodigo(
  matriz: MatrizModulos,
  forma: FormaModulo,
  opcoes: OpcoesFormas = {},
): Primitiva[] {
  const { size, quietZone: q } = matriz;
  const marcadores = (opcoes.marcadores ?? true) && size >= 21;

  /** Módulo escuro que a varredura comum desenha — o marcador é peça à parte. */
  const solto = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= size || y >= size) return false;
    if (!matriz.isDark(x, y)) return false;
    return !(marcadores && ehMarcador(size, x, y));
  };

  const primitivas: Primitiva[] = [];

  if (marcadores) {
    const cantos = [
      [0, 0],
      [size - 7, 0],
      [0, size - 7],
    ] as const;

    /*
     * Camada por camada, e não marcador por marcador: assim as primitivas de
     * uma mesma tinta ficam contíguas e `camadasDasPrimitivas` fecha o desenho
     * em quatro caminhos em vez de dez, sem que a ordem de pintura mude.
     */
    for (const camada of [0, 1, 2] as const) {
      for (const [x, y] of cantos) primitivas.push(pecaDoMarcador(forma, x + q, y + q, camada));
    }
  }

  if (forma === 'quadrado') {
    // Mesma fusão de runs de `caminhoDosModulos`: um retângulo por corrida.
    for (let y = 0; y < size; y++) {
      let x = 0;
      while (x < size) {
        if (!solto(x, y)) {
          x++;
          continue;
        }
        let largura = 0;
        while (solto(x + largura, y)) largura++;
        primitivas.push({ tipo: 'rect', x: x + q, y: y + q, w: largura, h: 1, tinta: 'escuro' });
        x += largura;
      }
    }
    return primitivas;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!solto(x, y)) continue;
      primitivas.push(
        ...primitivasDoModulo(forma, x + q, y + q, {
          norte: solto(x, y - 1),
          sul: solto(x, y + 1),
          leste: solto(x + 1, y),
          oeste: solto(x - 1, y),
        }),
      );
    }
  }

  return primitivas;
}

/* ------------------------------------------------------------- caminho SVG */

function n(valor: number): string {
  if (Number.isInteger(valor)) return String(valor);
  return Number(valor.toFixed(4)).toString();
}

/** Raios com o teto de metade do menor lado, que é onde o canto vira semicírculo. */
function raiosDoRect(p: PrimitivaRect): readonly [number, number, number, number] {
  const [tl = 0, tr = 0, br = 0, bl = 0] = p.raios ?? [];
  const limite = Math.min(p.w, p.h) / 2;
  return [Math.min(tl, limite), Math.min(tr, limite), Math.min(br, limite), Math.min(bl, limite)];
}

function caminhoRect(p: PrimitivaRect): string {
  const { x, y, w, h } = p;
  const [tl, tr, br, bl] = raiosDoRect(p);

  if (tl === 0 && tr === 0 && br === 0 && bl === 0) {
    return `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}z`;
  }

  const arco = (x1: number, y1: number, x2: number, y2: number, xf: number, yf: number, r: number): string =>
    r === 0 ? `L${n(xf)} ${n(yf)}` : `C${n(x1)} ${n(y1)} ${n(x2)} ${n(y2)} ${n(xf)} ${n(yf)}`;

  const d = x + w;
  const b = y + h;

  return (
    `M${n(x + tl)} ${n(y)}` +
    `L${n(d - tr)} ${n(y)}` +
    arco(d - tr + K * tr, y, d, y + tr - K * tr, d, y + tr, tr) +
    `L${n(d)} ${n(b - br)}` +
    arco(d, b - br + K * br, d - br + K * br, b, d - br, b, br) +
    `L${n(x + bl)} ${n(b)}` +
    arco(x + bl - K * bl, b, x, b - bl + K * bl, x, b - bl, bl) +
    `L${n(x)} ${n(y + tl)}` +
    arco(x, y + tl - K * tl, x + tl - K * tl, y, x + tl, y, tl) +
    'z'
  );
}

function caminhoCirculo(p: PrimitivaCirculo): string {
  const { cx, cy, raio: r } = p;
  const k = K * r;
  return (
    `M${n(cx - r)} ${n(cy)}` +
    `C${n(cx - r)} ${n(cy - k)} ${n(cx - k)} ${n(cy - r)} ${n(cx)} ${n(cy - r)}` +
    `C${n(cx + k)} ${n(cy - r)} ${n(cx + r)} ${n(cy - k)} ${n(cx + r)} ${n(cy)}` +
    `C${n(cx + r)} ${n(cy + k)} ${n(cx + k)} ${n(cy + r)} ${n(cx)} ${n(cy + r)}` +
    `C${n(cx - k)} ${n(cy + r)} ${n(cx - r)} ${n(cy + k)} ${n(cx - r)} ${n(cy)}z`
  );
}

function caminhoPoligono(p: PrimitivaPoligono): string {
  return (
    p.pontos.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${n(x)} ${n(y)}`).join('') +
    (p.pontos.length > 0 ? 'z' : '')
  );
}

function caminhoDaPrimitiva(p: Primitiva): string {
  return p.tipo === 'rect' ? caminhoRect(p) : p.tipo === 'circulo' ? caminhoCirculo(p) : caminhoPoligono(p);
}

/**
 * Caminho SVG de todas as primitivas de uma tinta.
 *
 * Só curvas cúbicas e retas — nada de `A`. O arco elíptico é onde os
 * interpretadores divergem, e este mesmo caminho é entregue ao `drawSvgPath` do
 * pdf-lib e ao `Path2D` do navegador.
 */
export function caminhoDasPrimitivas(primitivas: readonly Primitiva[], tinta: Tinta): string {
  return primitivas
    .filter((p) => p.tinta === tinta)
    .map(caminhoDaPrimitiva)
    .join('');
}

export interface Camada {
  readonly tinta: Tinta;
  readonly caminho: string;
}

/**
 * As primitivas fatiadas em caminhos, **na ordem de pintura**.
 *
 * Agrupar por tinta seria mais curto e estaria errado: o miolo do marcador é
 * pintado depois do vazado claro, e uma ordenação por cor devolveria o anel
 * cheio por cima do vazado — os três marcadores viriam sólidos e o código não
 * seria localizado por scanner nenhum.
 */
export function camadasDasPrimitivas(primitivas: readonly Primitiva[]): Camada[] {
  const camadas: Camada[] = [];
  let tinta: Tinta | null = null;
  let partes: string[] = [];

  const fechar = (): void => {
    if (tinta !== null && partes.length > 0) camadas.push({ tinta, caminho: partes.join('') });
  };

  for (const p of primitivas) {
    if (p.tinta !== tinta) {
      fechar();
      tinta = p.tinta;
      partes = [];
    }
    partes.push(caminhoDaPrimitiva(p));
  }
  fechar();

  return camadas;
}

/* --------------------------------------------------- teste ponto a ponto */

/** Caixa da primitiva, em módulos. O rasterizador usa para limitar a varredura. */
export function limitesDaPrimitiva(p: Primitiva): {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
} {
  switch (p.tipo) {
    case 'rect':
      return { x0: p.x, y0: p.y, x1: p.x + p.w, y1: p.y + p.h };
    case 'circulo':
      return { x0: p.cx - p.raio, y0: p.cy - p.raio, x1: p.cx + p.raio, y1: p.cy + p.raio };
    case 'poligono': {
      const xs = p.pontos.map(([x]) => x);
      const ys = p.pontos.map(([, y]) => y);
      return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
    }
  }
}

/** O ponto (em módulos) está dentro da primitiva? */
export function contemPonto(p: Primitiva, px: number, py: number): boolean {
  switch (p.tipo) {
    case 'rect': {
      if (px < p.x || px >= p.x + p.w || py < p.y || py >= p.y + p.h) return false;

      const [tl, tr, br, bl] = raiosDoRect(p);
      const direita = p.x + p.w;
      const base = p.y + p.h;

      /*
       * Só o quadrante do próprio canto responde pelo raio: fora dele o ponto
       * já está no corpo do retângulo e nenhum arco o alcança.
       */
      const foraDoArco = (cx: number, cy: number, r: number): boolean =>
        (px - cx) ** 2 + (py - cy) ** 2 > r * r;

      if (tl > 0 && px < p.x + tl && py < p.y + tl && foraDoArco(p.x + tl, p.y + tl, tl)) return false;
      if (tr > 0 && px > direita - tr && py < p.y + tr && foraDoArco(direita - tr, p.y + tr, tr))
        return false;
      if (br > 0 && px > direita - br && py > base - br && foraDoArco(direita - br, base - br, br))
        return false;
      if (bl > 0 && px < p.x + bl && py > base - bl && foraDoArco(p.x + bl, base - bl, bl)) return false;

      return true;
    }

    case 'circulo': {
      const dx = px - p.cx;
      const dy = py - p.cy;
      return dx * dx + dy * dy <= p.raio * p.raio;
    }

    case 'poligono': {
      let dentro = false;
      const pontos = p.pontos;
      for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
        const a = pontos[i];
        const b = pontos[j];
        if (a === undefined || b === undefined) continue;
        const [xi, yi] = a;
        const [xj, yj] = b;
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro;
      }
      return dentro;
    }
  }
}
