import { validarUrl } from '@/lib/url';
import { montarEmail, montarGeo, montarSms, montarTelefone, montarVcard, montarWifi } from './formatos';
import { montarPix } from './pix';
import type { Formularios, ResultadoConteudo, TipoConteudo } from './tipos';

/**
 * Porta única entre formulário e payload.
 *
 * Todo o resto do sistema — matriz, cena, renderers, verificação — continua
 * vendo apenas uma string. Os nove tipos existem só aqui; nenhum deles vaza
 * para dentro de `/core/qr` ou `/core/render`, e é por isso que acrescentar o
 * décimo não toca em nada além deste diretório e do painel que o desenha.
 */

export function montarConteudo(tipo: TipoConteudo, formularios: Formularios): ResultadoConteudo {
  switch (tipo) {
    case 'url': {
      const bruto = formularios.url.valor.trim();
      if (bruto.length === 0) return { payload: '', problema: null, observacao: null };

      const resultado = validarUrl(bruto);
      if (!resultado.valida) return { payload: '', problema: resultado.mensagem, observacao: null };

      return {
        payload: resultado.url,
        problema: null,
        observacao: resultado.completou
          ? 'Completamos com https:// — o endereço codificado é o completo.'
          : null,
      };
    }

    case 'texto':
      return { payload: formularios.texto.valor, problema: null, observacao: null };

    case 'wifi':
      return montarWifi(formularios.wifi);
    case 'email':
      return montarEmail(formularios.email);
    case 'sms':
      return montarSms(formularios.sms);
    case 'telefone':
      return montarTelefone(formularios.telefone);
    case 'geo':
      return montarGeo(formularios.geo);
    case 'vcard':
      return montarVcard(formularios.vcard);
    case 'pix':
      return montarPix(formularios.pix);
  }
}

/** O formulário do tipo tem algum campo preenchido? */
export function formularioVazio(tipo: TipoConteudo, formularios: Formularios): boolean {
  return Object.entries(formularios[tipo]).every(([campo, valor]: [string, unknown]) => {
    if (typeof valor === 'boolean') return valor === false;
    if (typeof valor !== 'string') return true;
    // `pais` já vem com "Brasil" e `seguranca` com "WPA": nenhum dos dois é sinal de uso.
    if (campo === 'pais' || campo === 'seguranca') return true;
    return valor.trim().length === 0;
  });
}

export * from './tipos';
export { conferirBrCode } from './pix';
