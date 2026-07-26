import { describe, expect, it } from 'vitest';
import { criarArtefato } from '@/core/qr/create';
import { ladoDaMatrizMm } from '@/core/qr/logo';
import type { ErrorCorrection, QrArtifact } from '@/core/qr/types';
import { NIVEIS_CORRECAO } from '@/core/qr/types';
import type { Bitmap } from '@/core/render/raster';
import { rasterizarCena } from '@/core/render/raster';
import { MODULO_CLARO_PADRAO, MODULO_ESCURO_PADRAO, construirCenaBasica } from '@/core/scene/build';
import type { Scene } from '@/core/scene/types';
import { paint } from '@/core/scene/types';
import { decodificadorJsQr, escalaParaVerificacao } from '@/core/verify/decode';
import { verificarLeitura } from '@/core/verify/verify';

function artefato(conteudo: string, nivel: ErrorCorrection): QrArtifact {
  const r = criarArtefato(conteudo, nivel);
  if (!r.ok) throw new Error(`esperava sucesso: ${JSON.stringify(r.erro)}`);
  return r.artefato;
}

const LADO_MM = 40;
const HREF_LOGO = 'data:image/png;base64,logo-de-teste';

/** Quadrado opaco de uma cor, no papel de logo. */
function bitmapSolido(lado: number, cor: [number, number, number]): Bitmap {
  const data = new Uint8ClampedArray(lado * lado * 4);
  for (let i = 0; i < lado * lado; i++) {
    data[i * 4] = cor[0];
    data[i * 4 + 1] = cor[1];
    data[i * 4 + 2] = cor[2];
    data[i * 4 + 3] = 255;
  }
  return { data, width: lado, height: lado };
}

/**
 * Cena com logo central cobrindo `fracaoDeArea` da area **da matriz**.
 *
 * Relativo a matriz, nao ao lado total: a quiet zone acrescenta 8 modulos que
 * nao carregam dado, e media-la junto daria um logo maior do que o que foi
 * testado na investigacao — foi exatamente o erro que este teste pegou.
 */
function cenaComLogo(a: QrArtifact, fracaoDeArea: number): Scene {
  const base = construirCenaBasica(a, LADO_MM);
  const ladoLogo = Math.sqrt(fracaoDeArea) * ladoDaMatrizMm(a, LADO_MM);
  const canto = (LADO_MM - ladoLogo) / 2;

  return {
    ...base,
    nodes: [...base.nodes, { kind: 'image', x: canto, y: canto, w: ladoLogo, h: ladoLogo, href: HREF_LOGO }],
  };
}

const IMAGENS = new Map([[HREF_LOGO, bitmapSolido(64, [255, 255, 255])]]);

const CONTEUDOS = [
  'https://arquivo.gov.br/registro/8841',
  'https://loja.exemplo.com.br/colecao/streetwear/drop-07?ref=etiqueta&sku=TS-0042',
  'Texto livre com acentuação: ação, coração, ÍNDICE.',
  'a',
];

describe('ida e volta', () => {
  /**
   * O teste que sustenta o produto inteiro: gerar -> compor -> rasterizar ->
   * decodificar -> comparar com a entrada.
   *
   * Ele tambem e a unica prova de ponta a ponta de que a matriz nao esta
   * espelhada, de que a quiet zone sobreviveu a composicao e de que o merge de
   * runs nao alterou o desenho. Se qualquer uma dessas tres coisas quebrar, e
   * aqui que aparece.
   */
  it('todo conteudo volta identico, nos quatro niveis de correcao', () => {
    const falhas: string[] = [];

    for (const conteudo of CONTEUDOS) {
      for (const nivel of NIVEIS_CORRECAO) {
        const a = artefato(conteudo, nivel);
        const veredicto = verificarLeitura(construirCenaBasica(a, LADO_MM));
        if (!veredicto.ok) {
          falhas.push(`${nivel} v${a.version} "${conteudo.slice(0, 30)}": ${veredicto.causa?.tipo}`);
        }
      }
    }

    expect(falhas).toEqual([]);
  });

  it('acusa quando o conteudo lido diverge do esperado', () => {
    const a = artefato('conteudo-a', 'H');
    const cena = construirCenaBasica(a, LADO_MM);
    // Uma cena que anuncia um payload diferente do que o codigo realmente traz.
    const mentirosa: Scene = { ...cena, meta: { ...cena.meta, payload: 'conteudo-b' } };

    const veredicto = verificarLeitura(mentirosa);
    expect(veredicto.ok).toBe(false);
    expect(veredicto.conteudoLido).toBe('conteudo-a');
    expect(veredicto.causa?.mensagem).toContain('conteúdo diferente');
  });

  it('recusa cena sem codigo', () => {
    const base = construirCenaBasica(artefato('a', 'H'), LADO_MM);
    expect(() => verificarLeitura({ ...base, nodes: [] })).toThrow(/nenhum codigo/i);
  });
});

describe('logo central', () => {
  /**
   * Confirma na propria suite o numero que derrubou o folclore de mercado: com
   * correcao H o logo passa em 16% da area e falha em 25%, e nos niveis
   * inferiores nem 16% sobrevive.
   */
  it('reproduz o limite medido por nivel e por area', () => {
    const conteudo = 'https://arquivo.gov.br/registro/8841';
    const resultados: Record<string, boolean> = {};

    for (const nivel of NIVEIS_CORRECAO) {
      for (const fracao of [0.16, 0.25]) {
        const a = artefato(conteudo, nivel);
        const veredicto = verificarLeitura(cenaComLogo(a, fracao), { imagens: IMAGENS });
        resultados[`${nivel}-${fracao}`] = veredicto.ok;
      }
    }

    expect(resultados['H-0.16'], 'H com 16% deve ler').toBe(true);
    expect(resultados['H-0.25'], 'H com 25% nao le — o "25%" do mercado e falso').toBe(false);
    expect(resultados['L-0.16']).toBe(false);
    expect(resultados['M-0.16']).toBe(false);
    expect(resultados['Q-0.16']).toBe(false);
  });

  /**
   * O diagnostico por experimento controlado: em vez de deduzir "provavelmente
   * o logo", removemos o logo e confirmamos que o codigo volta a ler.
   */
  it('isola o logo como causa, sem heuristica', () => {
    const a = artefato('https://arquivo.gov.br/registro/8841', 'H');
    const veredicto = verificarLeitura(cenaComLogo(a, 0.35), { imagens: IMAGENS });

    expect(veredicto.ok).toBe(false);
    expect(veredicto.causa?.tipo).toBe('logo');
    expect(veredicto.causa?.confirmada).toBe(true);
    expect(veredicto.causa?.sugestao).toContain('Reduza o logo');
  });

  it('num nivel baixo, a sugestao manda subir para H', () => {
    const a = artefato('https://arquivo.gov.br/registro/8841', 'M');
    const veredicto = verificarLeitura(cenaComLogo(a, 0.16), { imagens: IMAGENS });

    expect(veredicto.causa?.tipo).toBe('logo');
    expect(veredicto.causa?.sugestao).toContain('correção H');
  });
});

describe('diagnostico de cor', () => {
  function cenaColorida(escuro: string, claro: string): Scene {
    const a = artefato('https://arquivo.gov.br/registro/8841', 'H');
    const base = construirCenaBasica(a, LADO_MM, { dark: paint(escuro), light: paint(claro) });
    return { ...base, background: paint(claro) };
  }

  it('aprova contraste alto', () => {
    expect(verificarLeitura(cenaColorida('#141c99', '#ffffff')).ok).toBe(true);
  });

  it('isola a cor como causa quando o contraste derruba a leitura', () => {
    const veredicto = verificarLeitura(cenaColorida('#c8c8c8', '#ffffff'));

    expect(veredicto.ok).toBe(false);
    expect(veredicto.causa?.tipo).toBe('contraste');
    expect(veredicto.causa?.confirmada).toBe(true);
    expect(veredicto.causa?.mensagem).toContain('cores padrão');
  });

  /**
   * Polaridade invertida mantem a razao de contraste intacta, entao nenhum
   * experimento de cor a distinguiria — por isso ela e diagnosticada antes de
   * tudo, e o decodificador roda com `dontInvert` para que o caso chegue aqui.
   */
  it('reconhece polaridade invertida mesmo com contraste otimo', () => {
    const veredicto = verificarLeitura(cenaColorida('#ffffff', '#0e0f14'));

    expect(veredicto.ok).toBe(false);
    expect(veredicto.causa?.tipo).toBe('polaridade');
    expect(veredicto.causa?.confirmada).toBe(true);
    expect(veredicto.causa?.sugestao).toContain('Troque as duas cores');
  });
});

describe('densidade', () => {
  it('isola a densidade quando ha pixel de menos por modulo', () => {
    const a = artefato('x'.repeat(900), 'H'); // versao alta, matriz densa
    const veredicto = verificarLeitura(construirCenaBasica(a, LADO_MM), { pxPorModulo: 0.75 });

    expect(veredicto.ok).toBe(false);
    expect(veredicto.causa?.tipo).toBe('densidade');
    expect(veredicto.causa?.confirmada).toBe(true);
  });

  it('a escala padrao da folga suficiente ate a versao 40', () => {
    const a = artefato('x'.repeat(1273), 'H');
    expect(a.version).toBe(40);
    expect(verificarLeitura(construirCenaBasica(a, LADO_MM)).ok).toBe(true);
  });
});

describe('escalaParaVerificacao', () => {
  it('entrega os pixels por modulo pedidos', () => {
    const a = artefato('https://arquivo.gov.br/registro/8841', 'H');
    const escala = escalaParaVerificacao(LADO_MM, a.sizeComQuietZone, 6);
    const bitmap = rasterizarCena(construirCenaBasica(a, LADO_MM), escala);

    expect(bitmap.width / a.sizeComQuietZone).toBeCloseTo(6, 1);
  });
});

describe('decodificador', () => {
  it('devolve null quando nao ha codigo na imagem', () => {
    const branco: Bitmap = {
      data: new Uint8ClampedArray(100 * 100 * 4).fill(255),
      width: 100,
      height: 100,
    };
    expect(decodificadorJsQr.decodificar(branco)).toBeNull();
  });

  it('nao aceita codigo invertido', () => {
    const a = artefato('https://arquivo.gov.br/registro/8841', 'H');
    const invertida = construirCenaBasica(a, LADO_MM, {
      dark: MODULO_CLARO_PADRAO,
      light: MODULO_ESCURO_PADRAO,
    });
    const escala = escalaParaVerificacao(LADO_MM, a.sizeComQuietZone);

    expect(decodificadorJsQr.decodificar(rasterizarCena(invertida, escala))).toBeNull();
  });
});
