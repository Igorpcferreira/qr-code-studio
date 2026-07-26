/**
 * Tipos de conteúdo.
 *
 * Um QR Code carrega uma string e nada mais. O que faz a câmera abrir a rede
 * Wi-Fi em vez de mostrar texto é a convenção de formato dentro dessa string —
 * `WIFI:`, `mailto:`, `BEGIN:VCARD`, o payload EMV do Pix. Este módulo é
 * inteiramente sobre montar essas strings corretamente.
 *
 * Todos os formulários são de `string`, mesmo os numéricos: eles espelham
 * campos de texto que o usuário está digitando, e um estado intermediário como
 * `-23,` precisa existir sem virar `NaN`. A conversão acontece na montagem, que
 * é o único lugar que sabe se o valor está pronto.
 */

export type TipoConteudo = 'url' | 'texto' | 'wifi' | 'email' | 'sms' | 'telefone' | 'geo' | 'vcard' | 'pix';

export interface DadosUrl {
  readonly valor: string;
}

export interface DadosTexto {
  readonly valor: string;
}

export type SegurancaWifi = 'WPA' | 'WEP' | 'aberta';

export interface DadosWifi {
  readonly ssid: string;
  readonly senha: string;
  readonly seguranca: SegurancaWifi;
  readonly oculta: boolean;
}

export interface DadosEmail {
  readonly para: string;
  readonly assunto: string;
  readonly corpo: string;
}

export interface DadosSms {
  readonly numero: string;
  readonly mensagem: string;
}

export interface DadosTelefone {
  readonly numero: string;
}

export interface DadosGeo {
  readonly latitude: string;
  readonly longitude: string;
}

export interface DadosVcard {
  readonly nome: string;
  readonly sobrenome: string;
  readonly organizacao: string;
  readonly cargo: string;
  readonly telefone: string;
  readonly celular: string;
  readonly email: string;
  readonly site: string;
  readonly endereco: string;
  readonly cidade: string;
  readonly estado: string;
  readonly cep: string;
  readonly pais: string;
  readonly nota: string;
}

export interface DadosPix {
  readonly chave: string;
  readonly nome: string;
  readonly cidade: string;
  /** Em reais, como digitado. Vazio significa valor livre — quem paga escolhe. */
  readonly valor: string;
  /** `txid`. Vazio vira `***`, que a especificação define como "não informado". */
  readonly identificador: string;
  readonly descricao: string;
}

/**
 * Um formulário por tipo, todos vivos ao mesmo tempo.
 *
 * Guardar só o tipo corrente faria o usuário perder o que digitou ao espiar
 * outro tipo. São nove objetos minúsculos de string — o custo de manter todos
 * é irrelevante perto do atrito de digitar um vCard duas vezes.
 */
export interface Formularios {
  readonly url: DadosUrl;
  readonly texto: DadosTexto;
  readonly wifi: DadosWifi;
  readonly email: DadosEmail;
  readonly sms: DadosSms;
  readonly telefone: DadosTelefone;
  readonly geo: DadosGeo;
  readonly vcard: DadosVcard;
  readonly pix: DadosPix;
}

export const FORMULARIOS_INICIAIS: Formularios = {
  url: { valor: '' },
  texto: { valor: '' },
  wifi: { ssid: '', senha: '', seguranca: 'WPA', oculta: false },
  email: { para: '', assunto: '', corpo: '' },
  sms: { numero: '', mensagem: '' },
  telefone: { numero: '' },
  geo: { latitude: '', longitude: '' },
  vcard: {
    nome: '',
    sobrenome: '',
    organizacao: '',
    cargo: '',
    telefone: '',
    celular: '',
    email: '',
    site: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    pais: 'Brasil',
    nota: '',
  },
  pix: { chave: '', nome: '', cidade: '', valor: '', identificador: '', descricao: '' },
};

/**
 * Resultado da montagem.
 *
 * `Result` de novo, como em `criarArtefato`, e pela mesma razão: um formulário
 * pela metade é estado normal de quem está digitando, não exceção.
 *
 * `problema` bloqueia a codificação. `observacao` não — é o canal para dizer
 * "completamos com https://" ou "sem valor definido, quem paga escolhe".
 */
export interface ResultadoConteudo {
  /** String efetivamente codificada. Vazia quando ainda não há o suficiente. */
  readonly payload: string;
  readonly problema: string | null;
  readonly observacao: string | null;
}

export interface DefinicaoConteudo {
  readonly id: TipoConteudo;
  readonly rotulo: string;
  /** Uma linha, para o chip e para o leitor de tela. */
  readonly descricao: string;
}

export const DEFINICOES_CONTEUDO: readonly DefinicaoConteudo[] = [
  { id: 'url', rotulo: 'URL', descricao: 'Endereço de site' },
  { id: 'texto', rotulo: 'Texto', descricao: 'Texto livre' },
  { id: 'pix', rotulo: 'Pix', descricao: 'BR Code estático do Banco Central' },
  { id: 'wifi', rotulo: 'Wi-Fi', descricao: 'Conecta à rede sem digitar a senha' },
  { id: 'vcard', rotulo: 'Contato', descricao: 'Cartão de contato vCard' },
  { id: 'email', rotulo: 'E-mail', descricao: 'Abre o e-mail já preenchido' },
  { id: 'sms', rotulo: 'SMS', descricao: 'Abre o SMS já preenchido' },
  { id: 'telefone', rotulo: 'Telefone', descricao: 'Disca o número' },
  { id: 'geo', rotulo: 'Local', descricao: 'Coordenada geográfica' },
];

/** Tipos na ordem em que a interface os apresenta. */
export const TIPOS_CONTEUDO: readonly TipoConteudo[] = DEFINICOES_CONTEUDO.map((d) => d.id);
