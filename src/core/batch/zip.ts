/**
 * Escritor de ZIP.
 *
 * Escrito à mão, sem dependência, e não por gosto: empacotar mil arquivos é a
 * última etapa de um fluxo cuja promessa é que nada sai do navegador, e uma
 * biblioteca de ZIP a mais no bundle seria peso e superfície de auditoria para
 * resolver um formato que cabe em cem linhas. O que o produto precisa é o
 * subconjunto mínimo: entradas sem pasta, sem criptografia, sem ZIP64.
 *
 * A compressão vem de `CompressionStream('deflate-raw')`, que é da plataforma —
 * o navegador já tem um deflate, e embutir um segundo seria desperdício.
 *
 * **Saída determinística:** a data de modificação é fixa. Um ZIP cujo conteúdo
 * muda a cada segundo não é comparável entre execuções, e a mesma decisão já
 * vale para o identificador da ficha técnica, que sai do conteúdo e não do
 * relógio.
 */

import { crc32 } from '@/lib/checksum';

export interface EntradaZip {
  readonly nome: string;
  readonly dados: Uint8Array;
}

/** 1º de janeiro de 1980, o menor instante representável no formato MS-DOS. */
const HORA_DOS = 0;
const DATA_DOS = 0x0021;

/** `deflate-raw` é o método 8 do ZIP; sem ele, guardamos sem comprimir. */
const METODO_DEFLATE = 8;
const METODO_ARMAZENADO = 0;

async function comprimir(dados: Uint8Array): Promise<{ bytes: Uint8Array; metodo: number }> {
  if (typeof CompressionStream === 'undefined' || dados.length === 0) {
    return { bytes: dados, metodo: METODO_ARMAZENADO };
  }

  const fluxo = new Blob([dados as unknown as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  const comprimido = new Uint8Array(await new Response(fluxo).arrayBuffer());

  /*
   * Um arquivo minúsculo pode crescer depois do deflate, porque o bloco tem
   * cabeçalho. Nesse caso guardar cru é menor e igualmente válido.
   */
  return comprimido.length < dados.length
    ? { bytes: comprimido, metodo: METODO_DEFLATE }
    : { bytes: dados, metodo: METODO_ARMAZENADO };
}

class Buffer {
  private partes: Uint8Array[] = [];
  private tamanho = 0;

  get comprimento(): number {
    return this.tamanho;
  }

  bytes(valor: Uint8Array): void {
    this.partes.push(valor);
    this.tamanho += valor.length;
  }

  u16(valor: number): void {
    this.bytes(new Uint8Array([valor & 0xff, (valor >>> 8) & 0xff]));
  }

  u32(valor: number): void {
    this.bytes(
      new Uint8Array([valor & 0xff, (valor >>> 8) & 0xff, (valor >>> 16) & 0xff, (valor >>> 24) & 0xff]),
    );
  }

  concatenar(): Uint8Array {
    const saida = new Uint8Array(this.tamanho);
    let posicao = 0;
    for (const parte of this.partes) {
      saida.set(parte, posicao);
      posicao += parte.length;
    }
    return saida;
  }
}

const codificador = new TextEncoder();

/** Empacota as entradas num ZIP. Nomes repetidos recebem sufixo numérico. */
export async function criarZip(entradas: readonly EntradaZip[]): Promise<Uint8Array> {
  const arquivo = new Buffer();
  const central = new Buffer();

  const usados = new Map<string, number>();

  for (const entrada of entradas) {
    const repeticoes = usados.get(entrada.nome) ?? 0;
    usados.set(entrada.nome, repeticoes + 1);

    const nome =
      repeticoes === 0 ? entrada.nome : entrada.nome.replace(/(\.[^.]+)?$/, `-${repeticoes + 1}$1`);

    const nomeBytes = codificador.encode(nome);
    const { bytes, metodo } = await comprimir(entrada.dados);
    const crc = crc32(entrada.dados);
    const deslocamento = arquivo.comprimento;

    // Cabeçalho local.
    arquivo.u32(0x04034b50);
    arquivo.u16(20);
    // Bit 11: o nome está em UTF-8. Sem ele, acentos viram mojibake no Windows.
    arquivo.u16(0x0800);
    arquivo.u16(metodo);
    arquivo.u16(HORA_DOS);
    arquivo.u16(DATA_DOS);
    arquivo.u32(crc);
    arquivo.u32(bytes.length);
    arquivo.u32(entrada.dados.length);
    arquivo.u16(nomeBytes.length);
    arquivo.u16(0);
    arquivo.bytes(nomeBytes);
    arquivo.bytes(bytes);

    // Entrada correspondente no diretório central.
    central.u32(0x02014b50);
    central.u16(20);
    central.u16(20);
    central.u16(0x0800);
    central.u16(metodo);
    central.u16(HORA_DOS);
    central.u16(DATA_DOS);
    central.u32(crc);
    central.u32(bytes.length);
    central.u32(entrada.dados.length);
    central.u16(nomeBytes.length);
    central.u16(0);
    central.u16(0);
    central.u16(0);
    central.u16(0);
    central.u32(0);
    central.u32(deslocamento);
    central.bytes(nomeBytes);
  }

  const inicioCentral = arquivo.comprimento;
  const diretorio = central.concatenar();
  arquivo.bytes(diretorio);

  // Fim do diretório central.
  arquivo.u32(0x06054b50);
  arquivo.u16(0);
  arquivo.u16(0);
  arquivo.u16(entradas.length);
  arquivo.u16(entradas.length);
  arquivo.u32(diretorio.length);
  arquivo.u32(inicioCentral);
  arquivo.u16(0);

  return arquivo.concatenar();
}
