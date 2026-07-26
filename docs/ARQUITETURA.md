# Arquitetura

Como o código está organizado e por quê. Para o que ainda falta, veja
[ROADMAP.md](ROADMAP.md); para retomar o trabalho, [HANDOFF.md](HANDOFF.md).

---

## O fluxo

```
formulário ──▶ /core/content ──▶ payload ──▶ /core/qr ──▶ QrArtifact ──┐
 (9 tipos)     (Pix, Wi-Fi, vCard…)                                     │
                                                                        ├──▶ /core/frames ──▶ Scene
                                    estilo, moldura, chamada ───────────┘   (14 funções puras)
                                                                                    │
                            ┌───────────────────────────────────────────────────────┤
                            ▼                    ▼               ▼                  ▼
                      render/svg        render/canvas → PNG   render/pdf      render/raster (puro)
                            │                                                       │
                            │                                        /core/verify ◀─┘
                            ▼                                        decodifica de volta
                      /core/batch  (CSV → N peças → ZIP)
```

Seis camadas, cada uma ignorando a seguinte:

| Camada          | Responsabilidade                 | Não sabe                    |
| --------------- | -------------------------------- | --------------------------- |
| `/core/content` | formulário → payload             | que existe QR               |
| `/core/qr`      | payload → matriz + metadados     | que existe desenho          |
| `/core/frames`  | matriz + estilo → cena           | que existe SVG ou PDF       |
| `/core/render`  | cena → arquivo                   | como a cena foi montada     |
| `/core/verify`  | cena → veredito                  | que existe interface        |
| `/core/batch`   | configuração + planilha → um ZIP | como uma peça é desenhada   |
| `/core/history` | configuração → registro local    | o que a configuração produz |

A propriedade que sustenta o resto: **entre `/core/content` e `/core/qr` passa uma string e nada
mais**. Um QR Code carrega texto; o que faz a câmera abrir a rede Wi-Fi em vez de mostrar caracteres
é a convenção de formato dentro dessa string. Por isso os nove tipos existem num diretório só, e
acrescentar o décimo não toca em nenhum renderer, na verificação nem no lote.

---

## A decisão central: uma display list

14 molduras × 3 formatos de saída dariam 42 implementações que precisariam concordar pixel a
pixel. Se cada renderer desenhasse as molduras por conta própria, o critério "as molduras
renderizam corretamente em SVG e em PDF" seria impossível de sustentar.

A `Scene` (`core/scene/types.ts`) é um grafo plano de primitivas, em milímetros, sem nenhum
conhecimento de QR nem de formato:

```ts
type SceneNode =
  | { kind: 'rect'; x; y; w; h; fill?; stroke?; strokeWidth? }
  | { kind: 'qr'; x; y; side; artifact; dark; light }
  | { kind: 'text'; x; y; text; font; size; weight; tracking; align; fill; rotate? }
  | { kind: 'image'; x; y; w; h; href };
```

Consequências:

- **Cada moldura é escrita uma vez**, como função pura `(OpcoesMoldura) => Scene`. Testável sem
  DOM, sem canvas, sem PDF.
- Os renderers viram um `switch` sobre `kind`, sem regra de negócio.
- O `Paint` carrega **RGB e CMYK juntos**, e é isso que viabiliza o preto 100% K sem duplicar
  nenhuma moldura: SVG e PNG leem `rgb`, o PDF lê `cmyk` quando o usuário pede.
- A verificação roda sobre a cena **já composta**, que é o artefato que vai para o papel.

### Por que `{ kind: 'qr' }` e não `{ kind: 'path', d }`

O plano original guardava o caminho já resolvido. Com ele pronto, o rasterizador precisaria de um
interpretador completo de SVG path para poder verificar a leitura — justamente a feature que
sustenta o produto. Guardando o artefato, cada renderer resolve como lhe convém: o SVG emite um
`<path>` único, o rasterizador percorre módulos, o PDF desenha retângulos.

### Milímetro, não pixel

O produto existe para impressão. "1024 px" só significa alguma coisa depois de escolhido o DPI,
então pixel é uma conversão de saída (`px = mm / 25.4 × dpi`), nunca a fonte da verdade.

---

## As duas rotas de rasterização

De propósito, com papéis distintos:

| Função                           | Onde roda         | Para quê                        |
| -------------------------------- | ----------------- | ------------------------------- |
| `rasterizarCena` (puro, sem DOM) | Node e Web Worker | verificação de leitura e testes |
| `desenharCena` (Canvas2D)        | navegador         | prévia na tela e exportação PNG |

Só podem divergir em texto e imagem, que por construção ficam fora da área do código —
invariante checada por `nosSobrepondoOCodigo()`, que também protege a regra de que a chamada de
ação é impressa ao lado, nunca por cima.

O rasterizador puro existe para que a suíte de ida e volta rode no Node. Um rasterizador
dependente de canvas tornaria esse teste impossível fora do navegador, e ele é o argumento
central do produto.

---

## Armadilhas da biblioteca `qrcode`

Normalizadas na fronteira, em `core/qr/create.ts`, e documentadas porque custaram tempo:

```
errorCorrectionLevel  →  { bit: number }, não a letra   (L=1, M=0, Q=3, H=2)
modules.get(row, col) →  number, e LINHA PRIMEIRO
```

A segunda é a mais perigosa do projeto. Escrever `get(x, y)` produz a matriz **transposta** — um
QR espelhado. O erro é traiçoeiro porque a transposição mantém os três padrões de localização nos
cantos certos, e jsQR e ZXing leem espelhado sem reclamar: só parte dos leitores de celular
falha. Por isso `create.ts` copia `modules.data` e indexa explicitamente por `y * size + x`, e há
teste ancorado no **módulo escuro** do ISO/IEC 18004, que fica sempre em `(coluna 8, linha
size − 8)`.

A tabela de capacidade também não é API pública — só existe em `qrcode/lib/core/version.js`. Por
isso `core/qr/capacity.ts` tem tabela própria, guardada por dois testes: cross-check das 160
células contra a biblioteca, e verificação comportamental de fronteira independente da origem.

### Duas capacidades, e confundi-las produz um número impossível

`capacityBytes` é quanto **texto em modo Byte** cabe. Não serve para medir ocupação, porque o
codificador **não usa um modo só**: ele quebra o conteúdo em segmentos e escolhe Numérico,
Alfanumérico ou Byte para cada um. Um Pix de 132 caracteres cabe numa versão cuja capacidade em modo
Byte é 98, porque dígito custa 3,33 bits em vez de 8.

Por isso existe a segunda tabela, `CODEWORDS_DE_DADOS` — o tamanho do contêiner — e o artefato
carrega `usedBits` e `dataBits`. A ficha técnica compara os dois, e é essa comparação que impede
"132 / 98 bytes", que é exatamente o tipo de número impossível que o projeto corrige no material de
origem.

`usedBits` soma, por segmento, os 4 bits do indicador de modo, o indicador de contagem de caracteres
(Tabela 3 do ISO/IEC 18004) e os bits de dados. Duas guardas: nunca passa da capacidade da versão, e
nunca caberia na versão anterior — a segunda é o que pega uma tabela de indicadores subestimada.

---

## Verificação de leitura

`verificarLeitura(cena)` recorta a cena para a região do código, rasteriza, decodifica e compara
com o payload. O recorte é o que um scanner de fato enxerga, e resolve um problema concreto:
molduras que repetem o código — grade recortável e display de mesa — apresentam vários conjuntos
de padrões de localização na mesma imagem, e o decodificador não sabe qual seguir.

Quando falha, o diagnóstico vem de **experimentos controlados**, não de heurística: remove o
logo, devolve as cores ao padrão, aumenta a escala. O primeiro que faz o código voltar a ler é a
causa isolada por eliminação, e o veredito carrega `confirmada: true`.

Polaridade invertida é checada antes de tudo, sem experimento: inverter as duas cores mantém a
razão de contraste idêntica, então nenhum teste de cor a distinguiria. O decodificador roda com
`dontInvert` justamente para que esse caso falhe aqui, e não no celular do usuário.

A medição de margem de dano usa **o mesmo recorte**, e não a peça inteira. Sem isso o quadrado de
oclusão ficaria centrado no papel em vez do código, e a mesma matriz reportaria tolerâncias
diferentes só por trocar a moldura — um número que muda sem o código mudar não informa nada.

Tudo isso vive num Web Worker (`core/verify/worker.ts`) com debounce e política de
último-pedido-vence. A `Scene` inteira viaja para lá; só o `QrArtifact` precisa ser desidratado e
reidratado, porque `postMessage` descarta funções.

---

## Tipos de conteúdo e o Pix

`core/content/` é uma porta só: `montarConteudo(tipo, formularios) → { payload, problema,
observacao }`. Devolve `Result` em vez de lançar, pela mesma razão de `criarArtefato`: formulário
pela metade é estado normal de quem está digitando, não exceção.

O **Pix (BR Code)** é o caso que justifica o módulo. O payload é EMV-MPM: blocos TLV
(identificador de 2 dígitos, tamanho de 2 dígitos, valor), fechados por um CRC-16 de quatro
dígitos hexadecimais. Três detalhes que derrubam implementações de primeira viagem, todos com
teste próprio:

- **CRC-16/CCITT-FALSE**, não outro dos cinco CRCs que atendem por "CCITT". O vetor canônico
  `crc16('123456789') === 0x29B1` separa a variante certa das outras quatro.
- O checksum **inclui o cabeçalho `6304` do próprio campo de CRC**.
- O **ponto de iniciação (campo 01) fica de fora**: ele só é obrigatório quando vale `12`, "use
  uma vez", que é a marca de um código dinâmico. Um estático não pode carregá-lo.

`conferirBrCode()` é o **segundo nível da verificação**: decodificar o QR prova que a string
sobreviveu ao desenho; remontar o TLV e conferir o CRC prova que a string é um Pix válido. São
dois defeitos diferentes e nenhum cobre o outro.

Os dígitos verificadores de CPF e CNPJ também são conferidos — inclusive pela regra alfanumérica
de julho de 2026, que degrada para a conta antiga no caso numérico. Uma chave com um dígito
trocado gera um QR perfeitamente legível para um destino que não existe, e o erro só apareceria na
hora de pagar.

Nos demais formatos o risco não é o algoritmo, é o escape: um SSID com ponto e vírgula, um nome de
contato com vírgula, uma senha com dois-pontos. Cada escape tem teste de ida e volta por
decodificação, não por inspeção da string.

---

## Lote

`core/batch/` cobra a fatura da tese arquitetural: como a composição é função pura, gerar mil peças
é um laço. O módulo **reaproveita `derivar`**, a mesma cadeia que alimenta a prévia — e isso é o
ponto, não um atalho. É o que garante que a peça do lote seja idêntica à que o usuário viu antes de
mandar processar; uma segunda implementação da composição, ainda que fiel hoje, poderia divergir
amanhã, e a divergência só apareceria depois de mil etiquetas impressas.

Três formatos escritos à mão, sem dependência nova:

| Arquivo         | O quê                    | Por que próprio                                                             |
| --------------- | ------------------------ | --------------------------------------------------------------------------- |
| `batch/csv.ts`  | leitor de CSV (RFC 4180) | o arquivo vem do disco do usuário; auditar uma dependência custaria mais    |
| `batch/zip.ts`  | escritor de ZIP          | o formato mínimo cabe em cem linhas, e o deflate vem de `CompressionStream` |
| `render/png.ts` | codificador de PNG       | `OffscreenCanvas` sairia do alcance dos testes em Node                      |

O CSV detecta ponto e vírgula (o que o Excel em pt-BR grava, porque a vírgula é decimal) e remove o
BOM. Cabeçalho só é reconhecido por nome de coluna conhecido: chutar por heurística descartaria em
silêncio a primeira linha de um arquivo sem cabeçalho — o erro mais caro possível aqui, porque some
um QR e ninguém percebe.

O ZIP tem **data de modificação fixa**, então a mesma entrada produz o mesmo arquivo. É a mesma
decisão do identificador da ficha técnica, que sai do conteúdo e não do relógio.

Tudo roda num Web Worker e **sem DOM**: SVG é string, PNG passa pelo codificador próprio, e a
verificação usa o rasterizador puro. Cada linha é decodificada de volta antes de entrar no pacote —
o código que não lê fica de fora do ZIP e aparece no relatório com o número da linha na planilha.

---

## Histórico

`core/history/` é dividido por testabilidade, não por camada:

- `registro.ts` — identidade, rótulo e poda. Funções puras, cobertas no Node. São as três decisões
  que podem estar erradas.
- `db.ts` — IndexedDB. O único arquivo do módulo que depende do navegador, coberto por E2E que
  recarrega a página.

IndexedDB e não `localStorage`: uma configuração com logo embutido é um `data:` URI de centenas de
KB, e o teto de 5 MB estoura em poucas entradas.

O identificador do registro sai da **configuração inteira** (FNV-1a sobre o estado serializado),
então duas configurações idênticas colapsam num registro só — sem isso, cada tecla digitada depois
de um código pronto viraria uma entrada nova. Só grava depois que a verificação confirma a leitura:
guardar configuração quebrada encheria a lista do que ninguém quer de volta.

---

## Estado

`useReducer` local, sem Context e sem biblioteca. O estado é um único objeto de configuração e
ninguém escreve nele de fora da subárvore do `Gerador`. O custo real de performance está na
cadeia derivada (matriz → cena → verificação), resolvida com `useMemo` e o Worker.

`state/derivar.ts` é função pura fora dos componentes: a interface só chama e memoiza. Isso
mantém a lógica testável sem React e evita que um `useMemo` mal colocado recalcule a matriz a
cada tecla.

Os **nove formulários ficam vivos ao mesmo tempo**. Guardar só o do tipo corrente faria quem
espiasse outro tipo perder o que digitou, e um vCard leva doze campos. São nove objetos minúsculos
de string — o custo é irrelevante perto do atrito.

A ação de escrita é uma união **distribuída sobre o tipo de conteúdo**:

```ts
type AcaoFormulario = {
  [K in TipoConteudo]: { tipo: 'formulario'; conteudo: K; patch: Partial<Formularios[K]> };
}[TipoConteudo];
```

Sem a distribuição, `patch` seria a união de todos os formulários e qualquer campo passaria em
qualquer tipo. Com ela, `{ conteudo: 'pix', patch: { ssid: 'x' } }` não compila.

Regras de coerência moram no reducer, e existem para impedir arquivo quebrado:

- **Baixar o nível de correção descarta o logo**, porque logo central só é viável em H. Perda
  explícita é melhor que arquivo que não lê.
- **Trocar de unidade preserva o tamanho físico**; trocar o DPI em pixels reconverte o lado, para
  o tamanho impresso não mudar sem o usuário pedir.
- **Restaurar do histórico substitui o estado inteiro**, sem merge: um registro é uma configuração
  que já funcionou, e misturá-la com a atual produziria uma terceira que ninguém verificou.

---

## Divisão de bundle

|                                             | gzip                           |
| ------------------------------------------- | ------------------------------ |
| First-load                                  | **220 KB**                     |
| Chunk de PDF (pdf-lib + fontkit + fontes)   | 532 KB, `import()` no clique   |
| Chunk de lote (Worker + ZIP + PNG + verify) | carregado ao clicar em "Gerar" |

As fontes do PDF são **embutidas**, não servidas de `/public`: um `fetch`, mesmo da própria
origem, abriria um caminho de rede num produto cuja tese é que nada sai do navegador. As 441 KB
de TTF viram 66 KB depois de instanciar o Archivo variável em `wght=800/wdth=125` e subsetar para
Latin-1 e Latin Extended-A (`scripts/subset-fontes.py`).

---

## O que é garantido por construção

Regras que não dependem de disciplina humana:

| Regra                            | Como é garantida                                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `border-radius: 0`               | os namespaces `--radius-*`, `--shadow-*` e `--blur-*` do Tailwind foram zerados: as classes **não existem**. Mais teste E2E varrendo o DOM computado |
| Zona de silêncio de 4 módulos    | tipo literal em `QrArtifact`, sem parâmetro que permita mudar                                                                                        |
| Nada sai do navegador            | `output: 'export'`, `fetch` proibido no ESLint, fontes auto-hospedadas, teste E2E que falha se qualquer requisição escapar                           |
| Chamada de ação nunca codificada | teste sobre as 14 molduras conferindo `meta.payload`                                                                                                 |
| Chamada nunca sobre os módulos   | `nosSobrepondoOCodigo()` sobre as 14 molduras                                                                                                        |
| Selo de permanência literal      | constante única, sem prop de texto no componente, com teste travando o literal                                                                       |
| Ficha técnica com números reais  | tabela ISO/IEC 18004 com dois testes de guarda                                                                                                       |
| Patch no formulário errado       | união distribuída sobre `TipoConteudo`: erro de compilação, não de execução                                                                          |
| Peça de lote igual à da prévia   | o lote chama `derivar`, a mesma função da tela — não existe segunda composição                                                                       |
| ZIP reproduzível                 | data de modificação fixa, com teste comparando duas execuções byte a byte                                                                            |
