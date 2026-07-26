import type {
  DadosEmail,
  DadosGeo,
  DadosSms,
  DadosTelefone,
  DadosVcard,
  DadosWifi,
  ResultadoConteudo,
} from './tipos';

/**
 * Os seis formatos padronizados que não são o Pix.
 *
 * Cada um é serialização de formulário para string — trabalho direto, sem risco
 * técnico. O que exige cuidado é escapar: um SSID com ponto e vírgula, um nome
 * de contato com vírgula ou uma senha com dois-pontos quebram o payload de
 * formas que só aparecem no aparelho de quem escaneia, nunca na tela de quem
 * gerou. Por isso cada escape tem teste de ida e volta.
 */

const vazio = { payload: '', observacao: null };

// ---------------------------------------------------------------------------
// Wi-Fi
// ---------------------------------------------------------------------------

/**
 * Escape do formato `WIFI:` — os quatro caracteres reservados recebem barra
 * invertida.
 */
function escaparWifi(valor: string): string {
  return valor.replace(/([\\;,:"])/g, '\\$1');
}

/**
 * Um SSID formado só por dígitos hexadecimais precisa sair entre aspas.
 *
 * Sem elas, a especificação manda o aparelho interpretar o valor como a
 * representação hexadecimal do nome da rede: um SSID chamado `2024` viraria
 * dois bytes binários e a conexão falharia sem explicação.
 */
function protegerHex(valor: string): string {
  return /^[0-9A-Fa-f]+$/.test(valor) && valor.length % 2 === 0 ? `"${valor}"` : valor;
}

export function montarWifi(dados: DadosWifi): ResultadoConteudo {
  const ssid = dados.ssid.trim();
  if (ssid.length === 0) return { ...vazio, problema: 'Informe o nome da rede (SSID).' };

  const aberta = dados.seguranca === 'aberta';
  if (!aberta && dados.senha.length === 0) {
    return { ...vazio, problema: `Informe a senha da rede, ou escolha "aberta".` };
  }

  const partes = [`T:${aberta ? 'nopass' : dados.seguranca}`, `S:${protegerHex(escaparWifi(ssid))}`];
  if (!aberta) partes.push(`P:${escaparWifi(dados.senha)}`);
  if (dados.oculta) partes.push('H:true');

  return {
    // O terminador é `;;`: um ponto e vírgula fecha o último campo, o outro o registro.
    payload: `WIFI:${partes.join(';')};;`,
    problema: null,
    observacao: aberta
      ? 'Rede aberta: o código não carrega senha.'
      : 'A senha fica legível para quem escanear — e para quem decodificar a imagem.',
  };
}

// ---------------------------------------------------------------------------
// E-mail, SMS e telefone
// ---------------------------------------------------------------------------

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function montarEmail(dados: DadosEmail): ResultadoConteudo {
  const para = dados.para.trim();
  if (para.length === 0) return { ...vazio, problema: 'Informe o destinatário.' };
  if (!EMAIL.test(para)) return { ...vazio, problema: 'Endereço de e-mail inválido.' };

  const consulta: string[] = [];
  if (dados.assunto.trim().length > 0) {
    consulta.push(`subject=${encodeURIComponent(dados.assunto.trim())}`);
  }
  if (dados.corpo.trim().length > 0) consulta.push(`body=${encodeURIComponent(dados.corpo.trim())}`);

  return {
    payload: `mailto:${para}${consulta.length === 0 ? '' : `?${consulta.join('&')}`}`,
    problema: null,
    observacao:
      consulta.length === 0 ? null : 'Assunto e mensagem vêm preenchidos; quem escaneia ainda pode editar.',
  };
}

/**
 * Normaliza um telefone para E.164 quando possível.
 *
 * Sem país explícito, assume +55: o produto é para público brasileiro, e um
 * `tel:` sem código de país funciona no aparelho local mas quebra para quem
 * escaneia de fora.
 */
export function normalizarTelefone(bruto: string): string | null {
  const texto = bruto.trim();
  if (texto.length === 0) return null;

  const internacional = texto.startsWith('+');
  const digitos = texto.replace(/\D/g, '');
  if (digitos.length === 0) return null;

  if (internacional) return digitos.length >= 8 && digitos.length <= 15 ? `+${digitos}` : null;
  // 10 dígitos = fixo com DDD, 11 = celular com DDD.
  if (digitos.length === 10 || digitos.length === 11) return `+55${digitos}`;
  // Já veio com o 55 na frente, sem o sinal.
  if (digitos.length === 12 || digitos.length === 13) return `+${digitos}`;

  return null;
}

export function montarTelefone(dados: DadosTelefone): ResultadoConteudo {
  const numero = normalizarTelefone(dados.numero);
  if (dados.numero.trim().length === 0) return { ...vazio, problema: 'Informe o número.' };
  if (numero === null) {
    return { ...vazio, problema: 'Número inválido. Use DDD + número, ou o formato +55DDNÚMERO.' };
  }

  return {
    payload: `tel:${numero}`,
    problema: null,
    observacao: dados.numero.trim().startsWith('+') ? null : `Codificado como ${numero}.`,
  };
}

export function montarSms(dados: DadosSms): ResultadoConteudo {
  const numero = normalizarTelefone(dados.numero);
  if (dados.numero.trim().length === 0) return { ...vazio, problema: 'Informe o número.' };
  if (numero === null) {
    return { ...vazio, problema: 'Número inválido. Use DDD + número, ou o formato +55DDNÚMERO.' };
  }

  /*
   * `SMSTO:` e não o `sms:` da RFC 5724. O esquema padrão existe, mas os dois
   * sistemas operacionais discordam de como anexar a mensagem — `?body=` num,
   * `&body=` no outro — enquanto `SMSTO:numero:mensagem` é entendido por
   * praticamente todo leitor de QR em circulação. Aqui compatibilidade de campo
   * vale mais que a letra da especificação.
   */
  const mensagem = dados.mensagem.trim();
  return {
    payload: mensagem.length === 0 ? `SMSTO:${numero}` : `SMSTO:${numero}:${mensagem}`,
    problema: null,
    observacao: null,
  };
}

// ---------------------------------------------------------------------------
// Geolocalização
// ---------------------------------------------------------------------------

function coordenada(bruto: string, limite: number): number | null {
  const texto = bruto.trim().replace(',', '.');
  if (texto.length === 0) return null;

  const numero = Number(texto);
  return Number.isFinite(numero) && Math.abs(numero) <= limite ? numero : null;
}

export function montarGeo(dados: DadosGeo): ResultadoConteudo {
  if (dados.latitude.trim().length === 0 || dados.longitude.trim().length === 0) {
    return { ...vazio, problema: 'Informe latitude e longitude.' };
  }

  const lat = coordenada(dados.latitude, 90);
  const lon = coordenada(dados.longitude, 180);
  if (lat === null) return { ...vazio, problema: 'Latitude inválida. Use um número entre −90 e 90.' };
  if (lon === null) return { ...vazio, problema: 'Longitude inválida. Use um número entre −180 e 180.' };

  /*
   * `geo:` da RFC 5870, sem parâmetro de zoom. O `?z=` que os geradores
   * costumam anexar é extensão de um app específico: fora dele, o parâmetro é
   * ignorado no melhor caso e invalida a URI no pior.
   */
  return { payload: `geo:${lat},${lon}`, problema: null, observacao: null };
}

// ---------------------------------------------------------------------------
// vCard
// ---------------------------------------------------------------------------

/** Escape do vCard: barra invertida, ponto e vírgula, vírgula e quebra de linha. */
function escaparVcard(valor: string): string {
  return valor.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

export function montarVcard(dados: DadosVcard): ResultadoConteudo {
  const nome = dados.nome.trim();
  const sobrenome = dados.sobrenome.trim();
  if (nome.length === 0 && sobrenome.length === 0) {
    return { ...vazio, problema: 'Informe pelo menos o nome.' };
  }

  const completo = [nome, sobrenome].filter((p) => p.length > 0).join(' ');

  /*
   * vCard 3.0 e não 4.0. A 4.0 é mais nova e mais limpa, mas o aplicativo de
   * contatos de um dos dois sistemas móveis ainda importa 3.0 de forma
   * consistente e 4.0 não — e este arquivo existe para ser importado, não para
   * estar em dia com a especificação.
   */
  const linhas: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];
  linhas.push(`N:${escaparVcard(sobrenome)};${escaparVcard(nome)};;;`);
  linhas.push(`FN:${escaparVcard(completo)}`);

  if (dados.organizacao.trim().length > 0) linhas.push(`ORG:${escaparVcard(dados.organizacao.trim())}`);
  if (dados.cargo.trim().length > 0) linhas.push(`TITLE:${escaparVcard(dados.cargo.trim())}`);

  const fixo = normalizarTelefone(dados.telefone);
  if (fixo !== null) linhas.push(`TEL;TYPE=WORK,VOICE:${fixo}`);
  const celular = normalizarTelefone(dados.celular);
  if (celular !== null) linhas.push(`TEL;TYPE=CELL:${celular}`);

  if (EMAIL.test(dados.email.trim())) linhas.push(`EMAIL;TYPE=INTERNET:${dados.email.trim()}`);
  if (dados.site.trim().length > 0) {
    const site = dados.site.trim();
    linhas.push(`URL:${/^[a-z][a-z0-9+.-]*:/i.test(site) ? site : `https://${site}`}`);
  }

  const endereco = [dados.endereco, dados.cidade, dados.estado, dados.cep, dados.pais].map((p) => p.trim());
  /*
   * O país vem preenchido com "Brasil" desde o início do formulário, então ele
   * não conta como sinal de endereço — senão todo contato sairia com um `ADR`
   * de campos vazios e um país solto.
   */
  if (endereco.slice(0, 4).some((p) => p.length > 0)) {
    const [rua, cidade, estado, cep, pais] = endereco.map(escaparVcard);
    // ADR tem sete componentes; os dois primeiros (caixa postal e complemento) ficam vazios.
    linhas.push(`ADR;TYPE=WORK:;;${rua};${cidade};${estado};${cep};${pais}`);
  }

  if (dados.nota.trim().length > 0) linhas.push(`NOTE:${escaparVcard(dados.nota.trim())}`);
  linhas.push('END:VCARD');

  /*
   * Sem dobra de linha em 75 octetos, que a especificação recomenda. A dobra
   * insere CRLF seguido de espaço no meio do valor, e leitores de QR que
   * normalizam quebras de linha remontam o campo errado. Um vCard de contato
   * raramente passa de poucas centenas de bytes, então a recomendação custa
   * mais do que resolve aqui.
   */
  const payload = `${linhas.join('\r\n')}\r\n`;

  return {
    payload,
    problema: null,
    observacao:
      payload.length > 400
        ? 'Contato longo: cada campo empurra a versão do QR para cima e exige código maior no papel.'
        : null,
  };
}
