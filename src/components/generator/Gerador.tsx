'use client';

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { IdMoldura } from '@/core/frames/tipos';
import type { ErrorCorrection } from '@/core/qr/types';
import { NIVEIS_CORRECAO, RECUPERACAO_POR_NIVEL } from '@/core/qr/types';
import type { MargemDano } from '@/core/verify/damage';
import type { ClienteVerificacao } from '@/core/verify/client';
import { VerificacaoCancelada, criarClienteVerificacao } from '@/core/verify/client';
import type { Veredicto } from '@/core/verify/verify';
import { Aviso } from '@/components/ui/Aviso';
import { Botao } from '@/components/ui/Botao';
import { Campo } from '@/components/ui/Campo';
import { ControleSegmentado } from '@/components/ui/ControleSegmentado';
import type { Bitmap } from '@/core/render/raster';
import { bitmapDeDataUrl } from '@/lib/imagem';
import * as fmt from '@/lib/format';
import { converter } from '@/lib/units';
import { validarUrl } from '@/lib/url';
import { derivar } from '@/state/derivar';
import { ESTADO_INICIAL, reducer } from '@/state/reducer';
import { FichaTecnica } from './FichaTecnica';
import { PainelCor } from './PainelCor';
import { PainelExportacao } from './PainelExportacao';
import { PainelLogo } from './PainelLogo';
import { PainelMoldura } from './PainelMoldura';
import { PainelTamanho } from './PainelTamanho';
import { Previa } from './Previa';
import { RelatorioVerificacao } from './RelatorioVerificacao';

type TipoConteudo = 'url' | 'texto';

const TIPOS = [
  { valor: 'url', rotulo: 'URL', descricao: 'Endereço de site' },
  { valor: 'texto', rotulo: 'Texto', descricao: 'Texto livre' },
] as const satisfies readonly { valor: TipoConteudo; rotulo: string; descricao: string }[];

const NIVEIS = NIVEIS_CORRECAO.map((n) => ({
  valor: n,
  rotulo: n,
  descricao: `Correção ${n}, recupera ${Math.round(RECUPERACAO_POR_NIVEL[n] * 100)}%`,
}));

export function Gerador() {
  const [estado, despachar] = useReducer(reducer, ESTADO_INICIAL);
  const [tipo, setTipo] = useState<TipoConteudo>('url');

  const [veredicto, setVeredicto] = useState<Veredicto | null>(null);
  const [margens, setMargens] = useState<readonly MargemDano[] | null>(null);
  const [verificando, setVerificando] = useState(false);

  const derivado = useMemo(() => derivar(estado), [estado]);

  /*
   * O cliente do worker é criado uma vez e vive enquanto o componente viver.
   * Recriar a cada render subiria um worker novo por tecla digitada.
   */
  const cliente = useRef<ClienteVerificacao | null>(null);
  useEffect(() => {
    cliente.current = criarClienteVerificacao();
    return () => {
      cliente.current?.encerrar();
      cliente.current = null;
    };
  }, []);

  const { cena } = derivado;
  const logoDataUrl = estado.logo?.dataUrl ?? null;

  useEffect(() => {
    if (cena === null || cliente.current === null) {
      setVeredicto(null);
      setMargens(null);
      return;
    }

    const alvo = cena;
    const cliente_ = cliente.current;
    let vigente = true;
    setVerificando(true);

    async function verificar(): Promise<void> {
      const imagens = new Map<string, Bitmap>();
      if (logoDataUrl !== null) {
        try {
          imagens.set(logoDataUrl, await bitmapDeDataUrl(logoDataUrl));
        } catch {
          // Logo ilegível: a verificação segue sem ele e o resultado dirá.
        }
      }

      const r = await cliente_.verificar(alvo, { imagens, medirDano: true });
      if (!vigente) return;
      setVeredicto(r.veredicto);
      setMargens(r.margens);
      setVerificando(false);
    }

    verificar().catch((causa: unknown) => {
      // Cancelamento é o caminho normal quando o usuário continua digitando.
      if (causa instanceof VerificacaoCancelada || !vigente) return;
      setVerificando(false);
      setVeredicto(null);
    });

    return () => {
      vigente = false;
    };
  }, [cena, logoDataUrl]);

  const bruto = estado.conteudo;
  const validacao = tipo === 'url' && bruto.trim().length > 0 ? validarUrl(bruto) : null;

  // Separado do union para que o TypeScript estreite o tipo uma vez só.
  const urlValida = validacao !== null && validacao.valida ? validacao : null;
  const urlInvalida = validacao !== null && !validacao.valida ? validacao : null;

  const estadoCampo = bruto.trim().length === 0 ? 'neutro' : urlInvalida === null ? 'valido' : 'invalido';

  const ajuda =
    urlInvalida !== null
      ? urlInvalida.mensagem
      : bruto.trim().length === 0
        ? 'Nada é enviado. A codificação acontece no seu navegador.'
        : urlValida?.completou === true
          ? 'Completamos com https:// — o endereço codificado é o completo.'
          : 'Conteúdo válido.';

  /*
   * Grava o endereço já completado no estado, com folga para quem ainda está
   * digitando. Sem isso o QR codificaria `exemplo.com` enquanto a interface
   * afirma ter completado para `https://exemplo.com`.
   */
  const urlCompletada = urlValida?.completou === true ? urlValida.url : null;
  useEffect(() => {
    if (urlCompletada === null) return undefined;
    const t = setTimeout(() => despachar({ tipo: 'conteudo', valor: urlCompletada }), 800);
    return () => clearTimeout(t);
  }, [urlCompletada]);

  const artefato = derivado.artefato;
  const erro = derivado.resultado.ok ? null : derivado.resultado.erro;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ---------- Coluna de configuração ---------- */}
      <div className="flex flex-col gap-8">
        <ControleSegmentado
          legenda="Tipo de conteúdo"
          opcoes={TIPOS}
          valor={tipo}
          onChange={(v) => setTipo(v)}
        />

        <Campo
          rotulo={tipo === 'url' ? 'Endereço a codificar' : 'Texto a codificar'}
          placeholder={tipo === 'url' ? 'loja.exemplo.com.br/drop-07' : 'Qualquer texto'}
          value={bruto}
          estado={estadoCampo}
          ajuda={ajuda}
          medida={artefato === null ? undefined : `${fmt.numero(artefato.byteLength)} bytes`}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => despachar({ tipo: 'conteudo', valor: e.target.value })}
        />

        {erro?.tipo === 'excede-capacidade' ? (
          <Aviso tom="erro" titulo="Conteúdo grande demais">
            {fmt.numero(erro.bytes)} bytes não cabem no nível {erro.nivel}, que comporta{' '}
            {fmt.numero(erro.capacidade)}.
            {erro.sugestao === null
              ? ' Nem o nível mais permissivo comporta este conteúdo.'
              : ` Cabe no nível ${erro.sugestao}.`}
          </Aviso>
        ) : null}

        <ControleSegmentado
          legenda="Correção de erro"
          opcoes={NIVEIS}
          valor={estado.nivel}
          onChange={(v) => despachar({ tipo: 'nivel', valor: v as ErrorCorrection })}
          apoio={
            <span className="type-small text-fg-muted">
              mais correção, mais módulos e mais tolerância a dano
            </span>
          }
        />

        <PainelTamanho
          lado={estado.lado}
          unidade={estado.unidade}
          dpi={estado.dpi}
          impressao={derivado.impressao}
          ladoMm={derivado.ladoMm}
          onLado={(valor) => despachar({ tipo: 'lado', valor })}
          onUnidade={(valor) => despachar({ tipo: 'unidade', valor })}
          onDpi={(valor) => despachar({ tipo: 'dpi', valor })}
        />

        <PainelCor
          corEscura={estado.corEscura}
          corClara={estado.corClara}
          contraste={derivado.contraste}
          onCorEscura={(valor) => despachar({ tipo: 'cor-escura', valor })}
          onCorClara={(valor) => despachar({ tipo: 'cor-clara', valor })}
          onInverter={() => despachar({ tipo: 'inverter-cores' })}
        />

        <PainelLogo
          logo={estado.logo}
          nivel={estado.nivel}
          veredicto={derivado.logo}
          onLogo={(valor) => despachar({ tipo: 'logo', valor })}
          onTamanho={(valor) => despachar({ tipo: 'logo-tamanho', valor })}
        />

        <PainelMoldura
          moldura={estado.moldura}
          chamada={estado.chamada}
          corMoldura={estado.corMoldura}
          incluirFicha={estado.incluirFicha}
          gradeColunas={estado.gradeColunas}
          gradeLinhas={estado.gradeLinhas}
          onMoldura={(valor: IdMoldura) => despachar({ tipo: 'moldura', valor })}
          onChamada={(valor) => despachar({ tipo: 'chamada', valor })}
          onCorMoldura={(valor) => despachar({ tipo: 'cor-moldura', valor })}
          onIncluirFicha={(valor) => despachar({ tipo: 'incluir-ficha', valor })}
          onGrade={(colunas, linhas) => despachar({ tipo: 'grade', colunas, linhas })}
        />

        <Botao tipo="destrutivo" className="w-fit" onClick={() => despachar({ tipo: 'limpar' })}>
          Limpar campo
        </Botao>
      </div>

      {/* ---------- Coluna do artefato ---------- */}
      <div className="flex flex-col gap-6">
        {cena === null || artefato === null ? (
          <div className="border-hairline bg-surface-card flex min-h-[360px] flex-col items-center justify-center gap-3 border p-10 text-center">
            <p className="type-h3">Nenhum código ainda</p>
            <p className="type-small text-fg-muted max-w-[320px]">
              Digite um endereço ou um texto ao lado. O código aparece aqui e é gerado inteiramente no seu
              navegador.
            </p>
          </div>
        ) : (
          <>
            <Previa cena={cena} descricao={artefato.payload} />
            <RelatorioVerificacao veredicto={veredicto} margens={margens} verificando={verificando} />
            <FichaTecnica artefato={artefato} margens={margens} />
            <PainelExportacao
              cena={cena}
              ladoPx={converter(estado.lado, estado.unidade, 'px', estado.dpi)}
              modulosComQuietZone={artefato.sizeComQuietZone}
              payload={artefato.payload}
              veredicto={veredicto}
            />
          </>
        )}
      </div>
    </div>
  );
}
