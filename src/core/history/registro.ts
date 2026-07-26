import type { TipoConteudo } from '@/core/content/tipos';
import { DEFINICOES_CONTEUDO } from '@/core/content/tipos';
import type { EstadoGerador } from '@/state/reducer';

/**
 * Histórico local — a parte pura.
 *
 * Identidade, rótulo e poda ficam aqui, fora do IndexedDB, porque são as três
 * decisões que podem estar erradas e as três que dá para testar sem navegador.
 * O adaptador de banco (`db.ts`) fica com o que só existe no navegador: abrir,
 * ler e gravar.
 */

export interface RegistroHistorico {
  /** Derivado da configuração inteira: configurações iguais são um registro só. */
  readonly id: string;
  readonly criadoEm: number;
  /** Linha que a lista mostra. */
  readonly rotulo: string;
  readonly tipo: TipoConteudo;
  /** Conteúdo codificado, para o usuário reconhecer o que era. */
  readonly payload: string;
  /** Configuração completa, com logo embutido. É o que a restauração aplica. */
  readonly estado: EstadoGerador;
}

/** Teto de registros guardados. */
export const MAX_REGISTROS = 50;

/**
 * Identificador do registro.
 *
 * FNV-1a sobre a configuração serializada — o mesmo algoritmo que já gera o
 * identificador da ficha técnica. Duas configurações idênticas colapsam num
 * registro só: sem isso, cada tecla digitada depois de um código pronto viraria
 * uma entrada nova e o histórico afogaria o que interessa.
 *
 * Não é criptográfico e não precisa ser: o pior caso de colisão é um registro
 * sobrescrever outro no banco local do próprio usuário.
 */
export function chaveDoEstado(estado: EstadoGerador): string {
  const texto = JSON.stringify(estado);

  let hash = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36).padStart(7, '0');
}

const ROTULO_POR_TIPO: Readonly<Record<TipoConteudo, string>> = Object.fromEntries(
  DEFINICOES_CONTEUDO.map((d) => [d.id, d.rotulo]),
) as Readonly<Record<TipoConteudo, string>>;

/**
 * Rótulo da lista.
 *
 * O payload cru serve para URL e texto, mas um vCard começa com
 * `BEGIN:VCARD\r\nVERSION:3.0` e um Pix com `00020126…` — os dois seriam
 * ilegíveis na lista. Nesses casos o rótulo vem do campo que o usuário
 * reconhece.
 */
export function rotuloDoRegistro(estado: EstadoGerador, payload: string): string {
  const prefixo = ROTULO_POR_TIPO[estado.tipoConteudo];
  const forms = estado.formularios;

  const detalhe =
    estado.tipoConteudo === 'pix'
      ? [forms.pix.nome, forms.pix.valor === '' ? 'valor livre' : `R$ ${forms.pix.valor}`]
          .filter((p) => p.length > 0)
          .join(' · ')
      : estado.tipoConteudo === 'vcard'
        ? [forms.vcard.nome, forms.vcard.sobrenome].filter((p) => p.trim().length > 0).join(' ')
        : estado.tipoConteudo === 'wifi'
          ? forms.wifi.ssid
          : payload;

  const limpo = detalhe.replace(/\s+/g, ' ').trim();
  const cortado = limpo.length > 60 ? `${limpo.slice(0, 60)}…` : limpo;

  return `${prefixo} · ${cortado}`;
}

export interface OpcoesRegistro {
  readonly estado: EstadoGerador;
  readonly payload: string;
  /** Injetado para que o teste não dependa do relógio. */
  readonly agora: number;
}

export function criarRegistro({ estado, payload, agora }: OpcoesRegistro): RegistroHistorico {
  return {
    id: chaveDoEstado(estado),
    criadoEm: agora,
    rotulo: rotuloDoRegistro(estado, payload),
    tipo: estado.tipoConteudo,
    payload,
    estado,
  };
}

/**
 * Insere o registro na lista, do mais novo para o mais velho, e poda o excesso.
 *
 * Reinserir um id existente move a entrada para o topo em vez de duplicá-la:
 * voltar a uma configuração antiga é sinal de que ela ainda interessa.
 */
export function inserir(
  registros: readonly RegistroHistorico[],
  novo: RegistroHistorico,
  max: number = MAX_REGISTROS,
): readonly RegistroHistorico[] {
  return [novo, ...registros.filter((r) => r.id !== novo.id)].slice(0, max);
}

/** Ordena do mais novo para o mais velho e corta no teto. */
export function podar(
  registros: readonly RegistroHistorico[],
  max: number = MAX_REGISTROS,
): readonly RegistroHistorico[] {
  return [...registros].sort((a, b) => b.criadoEm - a.criadoEm).slice(0, max);
}
