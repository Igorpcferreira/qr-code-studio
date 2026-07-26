# Handoff — continuação da refatoração

> Documento vivo. Atualizado ao fim de cada incremento.
> **Última atualização:** incremento 7 concluído.
>
> Se você é uma nova sessão retomando este trabalho: leia este arquivo inteiro, depois
> [PLANO.md](PLANO.md). O brand board em `docs/brand/` é autoritativo para qualquer decisão visual.

---

## 1. Onde estamos

|                             |                                           |
| --------------------------- | ----------------------------------------- |
| Branch                      | `refactor/fase-1` (publicada em `origin`) |
| Tag do estado anterior      | `v1.0.0` → commit `9f06e6b`               |
| Último incremento concluído | **7 — exportação em PDF**                 |
| Próximo                     | **8 — rotas, PWA e acabamento**           |
| `npm run check`             | passando                                  |
| Testes unitários            | 247 passando                              |
| `npm run test:e2e`          | 15 testes passando                        |

Deploy previsto na Vercel. Sem domínio próprio ainda — `src/lib/site.ts` resolve a URL a
partir de `NEXT_PUBLIC_SITE_URL`, depois `VERCEL_PROJECT_PRODUCTION_URL`, depois localhost.

---

## 2. Regras inegociáveis

Estas vêm do brief e do brand board. Violá-las é quebrar o produto, não apenas o estilo.

1. **Autorização de commit concedida em 26/07/2026.** O brief original exigia validação a cada
   incremento; o Igor dispensou depois do incremento 3 ("não precisa mais da minha validação,
   pode continuar"). Continua valendo: `npm run check` verde **antes** de cada commit, um
   commit por incremento, mensagens convencionais. Decisões que mudem escopo ou contrariem o
   brief ainda devem ser levantadas — a dispensa é de validação de rotina, não de julgamento.
2. **Só QR estático.** Nada de redirecionamento, encurtador, rastreamento de scan ou qualquer
   dependência de servidor. Isso destruiria a tese da marca.
3. **Nada sai do navegador.** Sem analytics, sem CDN, sem rota de API. Já existe teste E2E que
   falha se qualquer requisição sair da origem.
4. **`border-radius: 0` em tudo.** Já garantido por construção: os namespaces `--radius-*`,
   `--shadow-*` e `--blur-*` do Tailwind foram zerados em `app/globals.css`, então as classes
   `rounded-*`, `shadow-*` e `blur-*` **não existem**. Há teste E2E varrendo o DOM computado.
5. **Zona de silêncio = 4 módulos, sempre.** É tipo literal em `QrArtifact`, sem parâmetro.
6. **Um acento só** (Ultramarine `#2C36F0`). Nenhuma cor secundária decorativa.
7. **No modo escuro, só a interface inverte.** O QR continua escuro sobre claro. As variáveis
   `--qr-dark` / `--qr-light` estão deliberadamente fora do `light-dark()`.
8. **Selo de permanência:** o texto vive em `SELO_PERMANENCIA` (`src/lib/site.ts`) e **nunca é
   reescrito**. Há teste unitário travando o literal.
9. **A chamada de ação é impressa, nunca codificada.** Máx. 24 caracteres, sempre caixa alta.
   O payload do QR jamais a contém.
10. **Logo central:** teto de **16% de área**, exclusivo do nível `H`. Se a verificação de
    leitura falhar, **bloquear a exportação** com o motivo exato.

---

## 3. Achados que custaram tempo — não redescubra

### `QRCode.create()` devolve coisas diferentes do que a documentação sugere

```
errorCorrectionLevel  →  { bit: number }   e NÃO a letra 'H'   (L=1, M=0, Q=3, H=2)
modules.get(row, col) →  number (0|1)      e NÃO boolean, e LINHA PRIMEIRO
```

O mapeamento de bits **não segue ordem alfabética nem de robustez**. Confirmar sempre por
teste, nunca de memória.

### O `get()` da matriz é `(linha, coluna)` — a armadilha mais perigosa do projeto

Escrever `get(x, y)` produz a matriz **transposta**, ou seja um QR espelhado. É traiçoeiro
porque a transposição mantém os três padrões de localização nos cantos certos, então o código
continua parecendo um QR válido, e **jsQR e ZXing leem espelhado sem reclamar** — só parte dos
leitores de celular falha. Eu mesmo cometi esse erro nos experimentos da investigação.

Por isso `create.ts` copia `modules.data` e indexa explicitamente por `y * size + x`, sem
nunca chamar `get()`. A convenção está confirmada contra o renderizador da própria biblioteca
(`lib/renderer/svg-tag.js`: `col = i % size`, `row = floor(i / size)`).

O teste decisivo está em `tests/unit/core/qr/create.test.ts`: o **módulo escuro** do padrão
ISO/IEC 18004 fica sempre em `(coluna 8, linha size - 8)`, e a posição transposta pertence à
informação de formato e varia. Há um segundo teste provando que a posição transposta de fato
varia — sem ele, o primeiro poderia passar por coincidência.

### A tabela de capacidade não é API pública

Só existe em `qrcode/lib/core/version.js`. O deep import funciona (o pacote não tem `exports`
map), mas é privado. Por isso `src/core/qr/capacity.ts` tem tabela própria, guardada por dois
testes: cross-check contra a lib e verificação comportamental de fronteira.

### O board tem números impossíveis na ficha técnica

`CAPACIDADE 1.782 / 2.303 bytes` para v6/H não existe — o teto do formato em H é 1.273 bytes,
e em v6/H são 58. **O desenho da ficha é fiel ao board; os valores são calculados de verdade.**

O board também erra o contraste: anuncia `18,4 : 1` para Carbon sobre branco, quando a fórmula
WCAG 2.x dá **19,14**. Ambos os números estão ancorados em teste.

### Correção a um número que eu mesmo publiquei na investigação

Na Etapa 1 afirmei que `#6E7280` sobre branco dava "≈3,5:1" e mesmo assim decodificava, o que
sugeriria um limiar conservador demais. Calculado de verdade, esse par dá **4,79:1** e portanto
**passa** no limiar de 4:1; o par que falhou dá **2,07:1**. Os dados medidos são **coerentes com
o limiar**, não evidência contra ele. Não repita a afirmação antiga em README ou copy.

### O limite de logo de 25% é folclore

Medido com jsQR e ZXing, que concordaram em 24/24 casos:

| Nível | 10% | 16%   | 20% | 25%   |
| ----- | --- | ----- | --- | ----- |
| L     | ✗   | ✗     | ✗   | ✗     |
| M     | ✓   | ✗     | ✗   | ✗     |
| Q     | ✓   | ✗     | ✗   | ✗     |
| H     | ✓   | **✓** | ✓   | **✗** |

### `Archivo Expanded` não existe no Google Fonts

O `<link>` do próprio board retorna HTTP 400. A largura expandida é o eixo `wdth` (62–125) da
variável Archivo — já configurado em `app/layout.tsx` via `axes: ['wdth']`.

### ESLint 10 quebra com o `eslint-plugin-react` embutido no `eslint-config-next`

`context.getFilename()` foi removida na v10. Resolvido declarando `settings.react.version`
explicitamente em `eslint.config.mjs` — não remova essa linha.

### O `.npmrc` do projeto é essencial

Sem ele o npm cai num registry corporativo que devolve 404 em `jsqr` e `pdf-lib`.

### Cuidado com servidor órfão na porta 4173

O `reuseExistingServer` do Playwright adota qualquer coisa que já esteja escutando. Um
`vite preview` esquecido fez os E2E rodarem contra o build antigo. Se um teste E2E falhar de
forma inexplicável, **confira primeiro quem está na 4173**:

```powershell
Get-NetTCPConnection -LocalPort 4173 -State Listen | ForEach-Object { Get-Process -Id $_.OwningProcess }
```

### Vitest não faz typecheck — testes verdes não garantem tipos corretos

No incremento 2 os renderers comparavam `align` com valores em português enquanto o tipo
declarava inglês. Os 100 testes passavam, porque nenhum conferia o `text-anchor` de saída;
só `tsc` pegou. Lição prática: **teste comportamento, não só ausência de exceção**, e nunca
trate `npm run test` verde como sinal de que os tipos batem. `npm run check` roda o typecheck
primeiro justamente por isso.

### Editar arquivo com script Python no Windows quebra o `format:check`

`open(p, 'w')` em modo texto no Windows escreve CRLF, e o Prettier está em `endOfLine: lf`.
O `.gitattributes` normaliza no commit, então o conteúdo versionado sai certo — mas o
`npm run check` reprova na árvore de trabalho e o erro parece vir do lugar errado. Use
`open(p, 'w', encoding='utf-8', newline='')` ou rode `prettier --write` no arquivo depois.

### `npm audit` reporta 9 high, 3 em produção

Todas transitivas e sem correção upstream: `postcss` e `sharp`/libvips via `next`,
`brace-expansion`→`minimatch` na cadeia do ESLint. Não exploráveis aqui (`sharp` não roda com
`images.unoptimized` + export estático). Conhecido e aceito — não "conserte" com `--force`.

---

## 4. O que falta, em ordem

Detalhamento completo em [PLANO.md](PLANO.md) §8. Resumo executável:

### ~~Incremento 1 — `/core/qr` e `/lib`~~ CONCLUÍDO

Entregue: `QrArtifact` (`core/qr/types.ts`, `create.ts`) com `Result` em vez de exceção,
porque conteúdo grande demais é estado normal da interface, não erro. Tabela de capacidade
com os dois guardas. `lib/contrast.ts` com **detecção de polaridade invertida** — inverter as
duas cores mantém a razão idêntica, então só o número jamais detectaria o problema.
`lib/units.ts` (inclui `ajustarParaModuloInteiro`, que evita costura no PNG) e
`lib/scan-distance.ts`. Tipos de `qrcode` escritos à mão em `src/types/qrcode.d.ts`.

**A API que o resto do projeto consome:**

```ts
criarArtefato(conteudo, nivel): ResultadoCriacao   // { ok: true, artefato } | { ok: false, erro }
artefato.isDark(x, y)                              // x = coluna, y = linha
artefato.sizeComQuietZone                          // size + 8, o que vai para o papel
avaliarContraste(moduloEscuro, moduloClaro)        // razão, nível, polaridadeInvertida, mensagem
avaliarImpressao({ ladoMm, modulosComQuietZone, dpi })
```

### ~~Incremento 2 — `/core/scene` e renderers SVG/PNG~~ CONCLUÍDO

Entregue: `core/scene/types.ts` (a display list), `core/scene/build.ts`,
`core/render/modules-path.ts`, `svg.ts`, `raster.ts` e `canvas.ts`.

**Mudança em relação ao plano:** o nó do código é `{ kind: 'qr', artifact }`, não
`{ kind: 'path', d }`. Com o caminho já resolvido, o rasterizador precisaria de um
interpretador de SVG path completo para poder verificar a leitura. Guardando o artefato, cada
renderer resolve como lhe convém e nenhum precisa entender a sintaxe do outro.

**Duas rotas de rasterização, de propósito:**

| Função                           | Onde roda     | Para quê                        |
| -------------------------------- | ------------- | ------------------------------- |
| `rasterizarCena` (puro, sem DOM) | Node e Worker | verificação de leitura e testes |
| `desenharCena` (Canvas2D)        | navegador     | prévia na tela e PNG            |

Só podem divergir em texto e imagem, que por construção ficam fora da área do código —
invariante checada por `nosSobrepondoOCodigo()`, que também protege a regra "a chamada de ação
é impressa ao lado, nunca por cima". **O incremento 3 precisa fechar esse circuito
decodificando as duas saídas.**

**Números reais medidos** (v8, 49×49, 1.256 módulos escuros, **615 runs**): SVG de 69,6 KB
com um rect por módulo cai para **8,6 KB** com path único — 8,1×. Depois do gzip a diferença
encolhe (3,1 KB contra 2,0 KB), então o argumento de peso não é o tamanho: é **1 objeto em vez
de 1.256** ao abrir no Illustrator. _(A investigação dizia 599 runs; aquela contagem foi feita
sobre a matriz transposta.)_

**Pendência anotada para os incrementos 6 e 7:** texto no SVG vai como `<text>` com a família
apenas referenciada. Uma gráfica sem Archivo instalado substitui a fonte. Converter para
contornos exige um motor de fonte — o `@pdf-lib/fontkit` já estará carregado no caminho de PDF
e pode servir aqui. Decidir quando as molduras existirem.

### ~~Incremento 3 — `/core/verify`~~ CONCLUÍDO

Entregue: `decode.ts` (jsQR atrás da interface `Decodificador`), `verify.ts`, `damage.ts`,
`logo.ts`, `protocol.ts`, `worker.ts` e `client.ts`.

**O diagnóstico vai além do brief.** Em vez de apontar uma "causa provável" por heurística,
quando a leitura falha rodamos **experimentos controlados**: remove o logo e tenta de novo;
devolve as cores ao padrão e tenta de novo; aumenta a escala e tenta de novo. O primeiro que
faz o código voltar a ler não é palpite — é a causa isolada por eliminação, e o veredito traz
`confirmada: true`. Polaridade invertida é diagnosticada antes de tudo, porque inverter as
duas cores mantém a razão de contraste intacta e nenhum experimento a distinguiria.

**API que a UI vai consumir:**

```ts
verificarLeitura(cena, { imagens }): Veredicto      // { ok, conteudoLido, causa, escala }
avaliarLogo(artefato, ladoCodigoMm, ladoLogoMm)     // { permitido } | { motivo, sugestao }
criarClienteVerificacao({ debounceMs })             // Worker + debounce + último-vence
medirMargemDeDano(bitmap, esperado, decodificador)  // margem por eixo
```

**Decisões e achados:**

- **Área do logo é relativa à matriz, não ao artefato com quiet zone.** A quiet zone
  acrescenta 8 módulos sem dado; medi-la junto liberaria um logo maior que o testado. Um teste
  pegou isso.
- **Escala fracionária quebra a decodificação.** Um v40 lê a 1 px/módulo e **falha a
  1,5 px/módulo** — a fração distorce a borda dos módulos. Por isso o experimento de densidade
  usa escala fixa de 12 px/módulo em vez de multiplicar a atual, e por isso
  `ajustarParaModuloInteiro` importa no PNG.
- **`rotacao` saiu do relatório padrão.** Satura em 45° nos quatro níveis — os três padrões de
  localização tornam o QR invariante a rotação. Número igual para toda configuração não
  informa nada. O eixo continua disponível sob demanda. Padrão: `oclusao`, `ruido`, `borrao`.
- **Margens medidas** (URL de exemplo, 8 px/módulo): oclusão L=0%, M=5%, Q=5%, **H=10%**.
  Relatório completo custa ~200 ms.
- **`serialize.ts` existe porque `postMessage` descarta funções**, e `QrArtifact` carrega
  `isDark`. A `Scene` inteira viaja ao worker; só o artefato é desidratado e reidratado. Assim
  o worker verificará também as molduras do incremento 6 sem saber como foram compostas.

**Ainda em aberto:** o circuito entre `rasterizarCena` (puro) e `desenharCena` (Canvas2D) não
foi fechado — falta um teste que decodifique as duas saídas e confirme que concordam. Precisa
de ambiente com canvas, então cabe melhor no E2E do incremento 5.

### ~~Incremento 4 — Design system~~ CONCLUÍDO

`components/brand/`: `Logo` (geometria 7:5:3, **troca automática para o ícone cheio abaixo de
16 px**), `Icone` (os 8 do board, união de string fechada), `SeloPermanencia` (sem prop de
texto — se expusesse, alguém acabaria passando outro literal).

`components/ui/`: `Botao` (4 tipos), `Campo` (3 estados), `ControleSegmentado`, `Chip`,
`Caixa`, `Aviso`.

**Acessibilidade decidida no componente, não deixada para depois:** o segmentado é
`radiogroup` com navegação por setas e roving tabindex, não fileira de botões; a `Caixa` usa
`<input type="checkbox">` real apenas escondido visualmente; `Campo` liga ajuda por
`aria-describedby` e só vira `role="alert"` no erro — anunciar a ajuda neutra a cada tecla
seria ruído. Nenhum componente declara foco próprio: o `:focus-visible` global já aplica o
anel de 2 px do board, e duplicar abriria espaço para divergência.

**Testes com `renderToStaticMarkup`**, sem biblioteca de teste de componente. Verificam
geometria, contagem de elementos e atributos ARIA — o que importa neste nível. Interação fica
com o E2E.

### ~~Incremento 5 — Interface do gerador~~ CONCLUÍDO

`state/reducer.ts` + `state/derivar.ts` (cadeia derivada como função pura, testável sem
React), `components/generator/*`, e o app montado em `app/page.tsx`.

**O circuito fechou.** O E2E prova que o Web Worker sobe no export estático e que a
verificação roda no navegador de verdade, não só no Node: digitar uma URL leva a "Leitura
confirmada" com a margem de dano medida. Era o item que ficou em aberto no incremento 3.

**Decisões:**

- **Contexto dispensado.** `useReducer` local no `Gerador` bastou; não há consumidor fora da
  subárvore. Um Context existiria só para satisfazer o plano.
- **A prévia mostra o SVG exportado**, mesma função de renderização — não um desenho de tela
  que poderia divergir do arquivo. `dangerouslySetInnerHTML` é seguro aqui porque a string é
  nossa e o texto do usuário passa por `escaparXml`.
- **Exportação bloqueada quando a verificação falha.** Entregar arquivo que não lê é pior que
  não entregar: o usuário só descobriria depois de mandar imprimir.
- **Baixar o nível de correção descarta o logo**, em vez de manter um logo que quebraria o
  código. Perda explícita é melhor que arquivo quebrado silencioso.
- **Trocar unidade preserva o tamanho físico**; trocar DPI em px reconverte o lado, para o
  tamanho impresso não mudar sem o usuário pedir.
- **O identificador da ficha sai do conteúdo, não do relógio** — dois artefatos iguais têm o
  mesmo código, e nada vaza sobre quando foi gerado.

### ~~Incremento 6 — As 14 molduras~~ CONCLUÍDO

`core/frames/` em três arquivos (`tipos`, `comum`, `molduras`), não catorze — um por moldura
duplicaria os mesmos cinco auxiliares de layout, e o que separa uma da outra cabe em vinte
linhas. Painel ligado à interface.

**Toda cena passa por uma moldura**, inclusive "sem moldura", que é a primeira das catorze e
não um caso especial. Existe um caminho só para compor; `construirCenaBasica` ficou para os
testes de núcleo.

**Dois bugs reais que os testes de moldura revelaram:**

1. **A verificação rasterizava a peça inteira.** Grade recortável e display de mesa têm vários
   conjuntos de padrões de localização na mesma imagem, e o decodificador não sabe qual
   seguir — molduras perfeitamente legíveis eram reprovadas. Agora `verificarLeitura` recorta
   para a região de um código, que é o que um scanner de fato enxerga. Nada se perde:
   `nosSobrepondoOCodigo` continua garantindo que a moldura não invade, e o logo é transladado
   junto.
2. **`nosSobrepondoOCodigo` ignorava a ordem de pintura.** A placa de fundo de qualquer
   moldura cobre a peça inteira e era acusada de invadir o código, mesmo estando por baixo.
   Agora só conta o que é desenhado depois.

O cartão de visita também descartava o logo silenciosamente — corrigido.

**Testado por decodificação, não por inspeção:** cada uma das 14 molduras é composta,
rasterizada e decodificada de volta, com cor Carbon e Ultramarine. O critério de aceite "as
molduras renderizam corretamente" virou asserção.

### ~~Incremento 7 — PDF~~ CONCLUÍDO

`core/render/pdf.ts` + `pdf-fontes.ts` (gerado por `scripts/subset-fontes.py`).

**Fontes embutidas, não servidas de `/public`.** Um `fetch`, mesmo da própria origem, abriria
um caminho de rede num produto cuja tese é que nada sai do navegador. O E2E confirma: exportar
PDF não dispara requisição alguma. Custo: 441 KB de TTF viraram **66 KB** — o Archivo é
variável e precisa ser instanciado em wght=800/wdth=125 antes de subsetar, porque o Google
Fonts não publica mais o estático.

**Divisão de bundle medida:** first-load **206 KB gzip**; o chunk de PDF (pdf-lib + fontkit +
fontes) tem **532 KB gzip** e fica de fora, carregado só no clique.

**O código sai como retângulos, não como `<path>`.** Um path único teria um objeto só, mas a
geometria do PDF viraria caixa-preta. Com retângulos o fluxo de conteúdo é lido de volta e a
matriz reconstruída — é assim que `pdf.test.ts` prova que o PDF desenha o código certo **sem
rasterizador de PDF**. Detalhe descoberto na marra: `drawRectangle` do pdf-lib não emite o
operador `re`; emite `m`/`l`/`h`/`f` com a posição numa matriz `cm`.

**Bug de tamanho físico corrigido.** O renderizador encolhia a peça para abrir espaço ao selo:
um pedido de 40 mm virava 34 mm em silêncio. Agora a página cresce e a escala é 1; em papel
fixo a peça reduz para caber, mas nunca amplia. Há teste dedicado, porque num produto para
impressão essa é a propriedade que mais importa.

**Fora de escopo, anotado:** o logo não entra no PDF. Embutir imagem exigiria decodificar
PNG/JPEG/SVG dentro do chunk, e um logo rasterizado num arquivo vendido como vetorial seria
contraditório. SVG e PNG seguem levando o logo.

### Incremento 8 — Rotas, PWA e acabamento ← PRÓXIMO

`/`, `/qr-code-url`, `/qr-code-texto`, `/qr-estatico-vs-dinamico`. Sitemap, robots, OG.
Service worker escrito à mão (~60 linhas, sem `next-pwa`). Acessibilidade completa,
Lighthouse >95, **README novo em português como peça de portfólio**, `ROADMAP.md` com as
Fases 2 e 3, `ARQUITETURA.md`.

---

## 5. Comandos

```bash
npm run dev          # desenvolvimento
npm run check        # typecheck + lint + format + testes + build  ← o portão
npm run test:watch   # unitários em watch
npm run test:e2e     # E2E contra o export estático (roda build antes)
npm run preview      # serve out/ na 4173
```

`npm run check` precisa passar limpo antes de qualquer commit.

---

## 6. Fases futuras (fora deste escopo)

**Fase 2 — tipos de conteúdo:** Wi-Fi, e-mail, SMS, telefone, geo, vCard e **Pix (BR Code)**.
O Pix é payload EMV-MPM em TLV com CRC16-CCITT, e o Pix estático é estático por natureza —
encaixe perfeito na tese da marca e o diferencial mais forte para público brasileiro.

**Fase 3 — lote e histórico:** CSV → muitos QRs → ZIP. Histórico local em IndexedDB.
