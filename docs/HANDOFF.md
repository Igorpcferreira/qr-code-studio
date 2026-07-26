# Handoff — continuação da refatoração

> Documento vivo. Atualizado ao fim de cada incremento.
> **Última atualização:** incremento 4 concluído.
>
> Se você é uma nova sessão retomando este trabalho: leia este arquivo inteiro, depois
> [PLANO.md](PLANO.md). O brand board em `docs/brand/` é autoritativo para qualquer decisão visual.

---

## 1. Onde estamos

|                             |                                           |
| --------------------------- | ----------------------------------------- |
| Branch                      | `refactor/fase-1` (publicada em `origin`) |
| Tag do estado anterior      | `v1.0.0` → commit `9f06e6b`               |
| Último incremento concluído | **4 — design system**                     |
| Próximo                     | **5 — interface do gerador**              |
| `npm run check`             | passando                                  |
| Testes unitários            | 176 passando                              |
| `npm run test:e2e`          | 3 testes passando                         |

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

### Incremento 5 — Interface do gerador ← PRÓXIMO

Campo, prévia com quiet zone visível, **ficha técnica com números reais**, seletor de
correção, tamanho/DPI, cor com indicador de contraste, logo, relatório de verificação.
Estado com `useReducer` + Context. Aqui `src/lib/url.ts` volta a ser usado.

### Incremento 6 — As 14 molduras

8 do board + hang tag de roupa, grade N-up, cartão de visita, display de mesa, cartaz,
faixa horizontal. Todas como funções puras `=> Scene`.

### Incremento 7 — PDF

`pdf-lib` + `@pdf-lib/fontkit` em chunk `import()` disparado no clique. Fontes pré-subsetadas
em build. Papéis A4/Carta/Etiqueta 50, marcas de corte, sangria 3 mm, ficha no rodapé,
**preto 100% K via `cmyk()`**, N-up.

### Incremento 8 — Rotas, PWA e acabamento

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
