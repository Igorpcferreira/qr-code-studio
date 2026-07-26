'use client';

import type { Dispatch } from 'react';
import type { Formularios, SegurancaWifi, TipoConteudo } from '@/core/content/tipos';
import { DEFINICOES_CONTEUDO } from '@/core/content/tipos';
import { Area } from '@/components/ui/Area';
import { Aviso } from '@/components/ui/Aviso';
import { Caixa } from '@/components/ui/Caixa';
import { Campo } from '@/components/ui/Campo';
import { ControleSegmentado } from '@/components/ui/ControleSegmentado';
import * as fmt from '@/lib/format';
import type { AcaoGerador } from '@/state/reducer';

/**
 * Seleção do tipo de conteúdo e o formulário correspondente.
 *
 * Recebe o `despachar` em vez de trinta callbacks. Os outros painéis expõem uma
 * função por campo porque têm três ou quatro; aqui são nove formulários e
 * dezenas de campos, e a fileira de props viraria ruído sem ganhar nenhuma
 * garantia — a ação já é tipada por tipo de conteúdo em `AcaoFormulario`.
 */

const OPCOES_TIPO = DEFINICOES_CONTEUDO.map((d) => ({
  valor: d.id,
  rotulo: d.rotulo,
  descricao: d.descricao,
}));

const SEGURANCAS = [
  { valor: 'WPA', rotulo: 'WPA/WPA2', descricao: 'O padrão das redes atuais' },
  { valor: 'WEP', rotulo: 'WEP', descricao: 'Antigo, só para equipamento legado' },
  { valor: 'aberta', rotulo: 'Aberta', descricao: 'Rede sem senha' },
] as const satisfies readonly { valor: SegurancaWifi; rotulo: string; descricao: string }[];

export interface PainelConteudoProps {
  tipo: TipoConteudo;
  formularios: Formularios;
  despachar: Dispatch<AcaoGerador>;
  /** Impede a codificação: campo faltando ou valor inválido. */
  problema: string | null;
  /** Não bloqueia: explica o que o produto fez ou o que o formato implica. */
  observacao: string | null;
  /** Bytes do payload montado, quando já existe artefato. */
  bytes: number | null;
}

export function PainelConteudo({
  tipo,
  formularios,
  despachar,
  problema,
  observacao,
  bytes,
}: PainelConteudoProps) {
  const medida = bytes === null ? undefined : `${fmt.numero(bytes)} bytes`;

  return (
    <div className="flex flex-col gap-6">
      <ControleSegmentado
        legenda="Tipo de conteúdo"
        layout="grade"
        opcoes={OPCOES_TIPO}
        valor={tipo}
        onChange={(valor) => despachar({ tipo: 'tipo-conteudo', valor })}
      />

      <div className="flex flex-col gap-5">
        {tipo === 'url' ? (
          <Campo
            rotulo="Endereço a codificar"
            placeholder="loja.exemplo.com.br/drop-07"
            value={formularios.url.valor}
            estado={
              problema === null ? (formularios.url.valor.trim() === '' ? 'neutro' : 'valido') : 'invalido'
            }
            ajuda={
              problema ??
              observacao ??
              (formularios.url.valor.trim() === ''
                ? 'Nada é enviado. A codificação acontece no seu navegador.'
                : 'Conteúdo válido.')
            }
            medida={medida}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) =>
              despachar({ tipo: 'formulario', conteudo: 'url', patch: { valor: e.target.value } })
            }
          />
        ) : null}

        {tipo === 'texto' ? (
          <Area
            rotulo="Texto a codificar"
            placeholder="Qualquer texto"
            rows={4}
            value={formularios.texto.valor}
            ajuda="Vai literalmente para dentro do desenho — inclusive acentos e quebras de linha."
            onChange={(e) =>
              despachar({ tipo: 'formulario', conteudo: 'texto', patch: { valor: e.target.value } })
            }
          />
        ) : null}

        {tipo === 'wifi' ? (
          <>
            <Campo
              rotulo="Nome da rede (SSID)"
              placeholder="Estudio-Visitantes"
              value={formularios.wifi.ssid}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) =>
                despachar({ tipo: 'formulario', conteudo: 'wifi', patch: { ssid: e.target.value } })
              }
            />
            <ControleSegmentado
              legenda="Segurança"
              opcoes={SEGURANCAS}
              valor={formularios.wifi.seguranca}
              onChange={(seguranca) =>
                despachar({ tipo: 'formulario', conteudo: 'wifi', patch: { seguranca } })
              }
            />
            {formularios.wifi.seguranca === 'aberta' ? null : (
              <Campo
                rotulo="Senha"
                value={formularios.wifi.senha}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) =>
                  despachar({ tipo: 'formulario', conteudo: 'wifi', patch: { senha: e.target.value } })
                }
              />
            )}
            <div className="border-hairline border">
              <Caixa
                rotulo="Rede oculta"
                descricao="Marque se o roteador não anuncia o nome da rede."
                marcada={formularios.wifi.oculta}
                onChange={(oculta) => despachar({ tipo: 'formulario', conteudo: 'wifi', patch: { oculta } })}
              />
            </div>
          </>
        ) : null}

        {tipo === 'email' ? (
          <>
            <Campo
              rotulo="Destinatário"
              type="email"
              placeholder="contato@exemplo.com"
              value={formularios.email.para}
              autoComplete="off"
              onChange={(e) =>
                despachar({ tipo: 'formulario', conteudo: 'email', patch: { para: e.target.value } })
              }
            />
            <Campo
              rotulo="Assunto"
              value={formularios.email.assunto}
              onChange={(e) =>
                despachar({ tipo: 'formulario', conteudo: 'email', patch: { assunto: e.target.value } })
              }
            />
            <Area
              rotulo="Mensagem"
              value={formularios.email.corpo}
              ajuda="Vem preenchida; quem escaneia ainda pode editar antes de enviar."
              onChange={(e) =>
                despachar({ tipo: 'formulario', conteudo: 'email', patch: { corpo: e.target.value } })
              }
            />
          </>
        ) : null}

        {tipo === 'sms' ? (
          <>
            <Campo
              rotulo="Número"
              type="tel"
              placeholder="(11) 98765-4321"
              value={formularios.sms.numero}
              onChange={(e) =>
                despachar({ tipo: 'formulario', conteudo: 'sms', patch: { numero: e.target.value } })
              }
            />
            <Area
              rotulo="Mensagem"
              value={formularios.sms.mensagem}
              onChange={(e) =>
                despachar({ tipo: 'formulario', conteudo: 'sms', patch: { mensagem: e.target.value } })
              }
            />
          </>
        ) : null}

        {tipo === 'telefone' ? (
          <Campo
            rotulo="Número"
            type="tel"
            placeholder="(11) 98765-4321"
            value={formularios.telefone.numero}
            ajuda={problema ?? observacao ?? 'Sem código de país, completamos com +55.'}
            estado={problema === null ? 'neutro' : 'invalido'}
            onChange={(e) =>
              despachar({ tipo: 'formulario', conteudo: 'telefone', patch: { numero: e.target.value } })
            }
          />
        ) : null}

        {tipo === 'geo' ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Campo
              rotulo="Latitude"
              placeholder="-23,5505"
              value={formularios.geo.latitude}
              onChange={(e) =>
                despachar({ tipo: 'formulario', conteudo: 'geo', patch: { latitude: e.target.value } })
              }
            />
            <Campo
              rotulo="Longitude"
              placeholder="-46,6333"
              value={formularios.geo.longitude}
              onChange={(e) =>
                despachar({ tipo: 'formulario', conteudo: 'geo', patch: { longitude: e.target.value } })
              }
            />
          </div>
        ) : null}

        {tipo === 'vcard' ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo
                rotulo="Nome"
                value={formularios.vcard.nome}
                onChange={(e) =>
                  despachar({ tipo: 'formulario', conteudo: 'vcard', patch: { nome: e.target.value } })
                }
              />
              <Campo
                rotulo="Sobrenome"
                value={formularios.vcard.sobrenome}
                onChange={(e) =>
                  despachar({ tipo: 'formulario', conteudo: 'vcard', patch: { sobrenome: e.target.value } })
                }
              />
              <Campo
                rotulo="Organização"
                value={formularios.vcard.organizacao}
                onChange={(e) =>
                  despachar({ tipo: 'formulario', conteudo: 'vcard', patch: { organizacao: e.target.value } })
                }
              />
              <Campo
                rotulo="Cargo"
                value={formularios.vcard.cargo}
                onChange={(e) =>
                  despachar({ tipo: 'formulario', conteudo: 'vcard', patch: { cargo: e.target.value } })
                }
              />
              <Campo
                rotulo="Celular"
                type="tel"
                value={formularios.vcard.celular}
                onChange={(e) =>
                  despachar({ tipo: 'formulario', conteudo: 'vcard', patch: { celular: e.target.value } })
                }
              />
              <Campo
                rotulo="Telefone"
                type="tel"
                value={formularios.vcard.telefone}
                onChange={(e) =>
                  despachar({ tipo: 'formulario', conteudo: 'vcard', patch: { telefone: e.target.value } })
                }
              />
              <Campo
                rotulo="E-mail"
                type="email"
                value={formularios.vcard.email}
                onChange={(e) =>
                  despachar({ tipo: 'formulario', conteudo: 'vcard', patch: { email: e.target.value } })
                }
              />
              <Campo
                rotulo="Site"
                value={formularios.vcard.site}
                onChange={(e) =>
                  despachar({ tipo: 'formulario', conteudo: 'vcard', patch: { site: e.target.value } })
                }
              />
              <Campo
                rotulo="Endereço"
                value={formularios.vcard.endereco}
                onChange={(e) =>
                  despachar({ tipo: 'formulario', conteudo: 'vcard', patch: { endereco: e.target.value } })
                }
              />
              <Campo
                rotulo="Cidade"
                value={formularios.vcard.cidade}
                onChange={(e) =>
                  despachar({ tipo: 'formulario', conteudo: 'vcard', patch: { cidade: e.target.value } })
                }
              />
              <Campo
                rotulo="Estado"
                value={formularios.vcard.estado}
                onChange={(e) =>
                  despachar({ tipo: 'formulario', conteudo: 'vcard', patch: { estado: e.target.value } })
                }
              />
              <Campo
                rotulo="CEP"
                value={formularios.vcard.cep}
                onChange={(e) =>
                  despachar({ tipo: 'formulario', conteudo: 'vcard', patch: { cep: e.target.value } })
                }
              />
            </div>
            <Area
              rotulo="Observação"
              value={formularios.vcard.nota}
              ajuda="Cada campo preenchido empurra a versão do QR para cima."
              onChange={(e) =>
                despachar({ tipo: 'formulario', conteudo: 'vcard', patch: { nota: e.target.value } })
              }
            />
          </>
        ) : null}

        {tipo === 'pix' ? (
          <>
            <Campo
              rotulo="Chave Pix"
              placeholder="CPF, CNPJ, e-mail, +55… ou chave aleatória"
              value={formularios.pix.chave}
              estado={
                problema === null ? (formularios.pix.chave.trim() === '' ? 'neutro' : 'valido') : 'invalido'
              }
              ajuda={problema ?? 'Conferimos os dígitos verificadores de CPF e CNPJ.'}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) =>
                despachar({ tipo: 'formulario', conteudo: 'pix', patch: { chave: e.target.value } })
              }
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo
                rotulo="Nome do recebedor"
                value={formularios.pix.nome}
                maxLength={40}
                ajuda="Máx. 25 caracteres no padrão; acentos viram letra simples."
                onChange={(e) =>
                  despachar({ tipo: 'formulario', conteudo: 'pix', patch: { nome: e.target.value } })
                }
              />
              <Campo
                rotulo="Cidade"
                value={formularios.pix.cidade}
                maxLength={30}
                ajuda="Máx. 15 caracteres no padrão."
                onChange={(e) =>
                  despachar({ tipo: 'formulario', conteudo: 'pix', patch: { cidade: e.target.value } })
                }
              />
              <Campo
                rotulo="Valor (opcional)"
                placeholder="49,90"
                value={formularios.pix.valor}
                ajuda={observacao ?? 'Em branco, quem paga escolhe o valor.'}
                onChange={(e) =>
                  despachar({ tipo: 'formulario', conteudo: 'pix', patch: { valor: e.target.value } })
                }
              />
              <Campo
                rotulo="Identificador (opcional)"
                placeholder="PEDIDO123"
                value={formularios.pix.identificador}
                ajuda="Volta no extrato. Sem ele, o campo sai como ***."
                onChange={(e) =>
                  despachar({ tipo: 'formulario', conteudo: 'pix', patch: { identificador: e.target.value } })
                }
              />
            </div>
            <Campo
              rotulo="Descrição (opcional)"
              value={formularios.pix.descricao}
              ajuda="Cortada no que couber: o bloco do Pix tem teto de 99 caracteres."
              onChange={(e) =>
                despachar({ tipo: 'formulario', conteudo: 'pix', patch: { descricao: e.target.value } })
              }
            />
          </>
        ) : null}
      </div>

      {/*
       * O problema aparece uma vez só. Os formulários que já mostram a
       * mensagem no próprio campo (URL, telefone, Pix) não a repetem aqui —
       * dizer duas vezes a mesma coisa faz o leitor de tela anunciar duas.
       */}
      {problema !== null && tipo !== 'url' && tipo !== 'telefone' && tipo !== 'pix' ? (
        <Aviso tom="atencao">{problema}</Aviso>
      ) : null}

      {problema === null && observacao !== null && tipo !== 'url' && tipo !== 'telefone' && tipo !== 'pix' ? (
        <Aviso tom="sucesso">{observacao}</Aviso>
      ) : null}
    </div>
  );
}
