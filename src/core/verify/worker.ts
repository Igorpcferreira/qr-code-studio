/// <reference lib="webworker" />

import { rasterizarCena } from '../render/raster';
import type { QrNode } from '../scene/types';
import { medirMargemDeDano } from './damage';
import { decodificadorJsQr, escalaParaVerificacao } from './decode';
import type { PedidoVerificacao, RespostaVerificacao } from './protocol';
import { reidratarCena } from './protocol';
import { recortarParaLeitura, verificarLeitura } from './verify';

/**
 * Worker de verificacao.
 *
 * Fica fora da thread principal porque a verificacao dispara a cada mudanca de
 * configuracao e, no pior caso, encadeia varias decodificacoes: a basica, ate
 * tres experimentos de diagnostico e — quando pedido — dezenas de passos de
 * dano simulado. Na thread principal isso travaria a digitacao.
 *
 * De proposito, o worker nao sabe nada sobre a interface. Ele recebe uma cena
 * pronta e devolve um veredicto.
 */

self.addEventListener('message', (evento: MessageEvent<PedidoVerificacao>) => {
  const pedido = evento.data;

  try {
    const cena = reidratarCena(pedido.cena);
    const imagens = pedido.imagens === undefined ? undefined : new Map(pedido.imagens);

    const veredicto = verificarLeitura(cena, { imagens });

    let margens = null;
    if (pedido.medirDano === true && veredicto.ok) {
      const codigo = cena.nodes.find((no): no is QrNode => no.kind === 'qr');
      if (codigo !== undefined) {
        /*
         * Sobre o recorte, e nao sobre a peca inteira. A margem de dano
         * descreve a robustez do codigo; medida na peca com moldura, o
         * quadrado de oclusao ficaria centrado no papel e a mesma matriz
         * reportaria numeros diferentes so por trocar a moldura.
         */
        const recorte = recortarParaLeitura(cena, codigo);
        const escala = escalaParaVerificacao(codigo.side, codigo.artifact.sizeComQuietZone, 8);
        const bitmap = rasterizarCena(recorte, escala, { imagens });
        margens = medirMargemDeDano(bitmap, cena.meta.payload, decodificadorJsQr);
      }
    }

    const resposta: RespostaVerificacao = { id: pedido.id, veredicto, margens, erro: null };
    self.postMessage(resposta);
  } catch (causa) {
    const resposta: RespostaVerificacao = {
      id: pedido.id,
      veredicto: null,
      margens: null,
      erro: causa instanceof Error ? causa.message : String(causa),
    };
    self.postMessage(resposta);
  }
});
