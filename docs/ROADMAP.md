# Roadmap

A Fase 1 está concluída. O que segue está fora do escopo entregue e listado aqui para não se
perder — e, no caso do Pix, porque é o item de maior valor que ainda falta.

---

## Fase 2 — Tipos de conteúdo

Hoje o gerador aceita URL e texto livre. A Fase 2 acrescenta os formatos padronizados que fazem
o QR ser útil fora do navegador.

### Pix (BR Code) — o destaque

Payload **EMV-MPM** em formato TLV com checksum **CRC16-CCITT**, conforme a especificação do
Banco Central. Vale mais que os outros seis juntos, por três motivos que se somam:

1. **O Pix estático é estático por natureza.** Um BR Code sem valor definido carrega chave,
   nome e cidade do recebedor no próprio payload. Encaixe exato na tese do produto — não há nem
   como fazer dinâmico sem um servidor.
2. **É o diferencial mais forte para público brasileiro.** Nenhum gerador gratuito nacional faz
   isso bem.
3. **É peça de portfólio de verdade.** Implementar uma especificação do Banco Central, com TLV
   aninhado e CRC, diz mais sobre engenharia do que mais uma tela de CRUD.

A verificação de leitura já existente ganha um segundo nível aqui: além de decodificar de volta,
dá para **validar o CRC** e reconferir que o TLV remonta aos campos originais.

### Os demais

Wi-Fi (`WIFI:`), e-mail (`mailto:`), SMS, telefone (`tel:`), geolocalização (`geo:`) e vCard.
Todos são serialização de formulário para string — trabalho direto, sem risco técnico. O único
cuidado real é de capacidade: um vCard completo passa fácil de 500 bytes e empurra a versão do
QR para cima, o que o painel de tamanho precisa comunicar.

---

## Fase 3 — Lote e histórico

**CSV em lote.** Muitas linhas viram muitos QRs, empacotados em ZIP. A arquitetura já ajuda: a
composição é função pura, então gerar mil peças é um laço. O que precisa de cuidado é não travar
a interface — o mesmo Web Worker da verificação serve, com relatório de progresso.

**Histórico local.** IndexedDB, não `localStorage`: guardar configurações com logo embutido
estoura o limite de 5 MB rápido. O histórico nunca pode sair do navegador, o que aliás o torna
mais simples — não há sincronização a resolver.

---

## Dívidas conhecidas da Fase 1

Registradas com o motivo, não como pendência esquecida.

### Logo não entra no PDF

Embutir imagem exigiria decodificar PNG/JPEG/SVG dentro do chunk de PDF, e um logo rasterizado
num arquivo vendido como vetorial seria contraditório. SVG e PNG seguem levando o logo. A saída
correta é converter o logo em traçado vetorial quando ele for SVG, e recusar raster com uma
explicação — trabalho que não cabia na Fase 1.

### Texto do SVG não é convertido em contorno

O `<text>` exportado referencia a família da fonte. Uma gráfica sem Archivo instalado substitui a
fonte. O `@pdf-lib/fontkit` já está no projeto e sabe extrair contornos de glifo; dá para reusá-lo
para vetorizar o texto do SVG. Vale a pena quando alguém de fato levar um SVG com moldura para
impressão.

### O eixo de rotação do teste de dano satura

Mede sempre 45°, em todos os níveis de correção, porque os três padrões de localização tornam o
QR invariante a rotação. Fica fora do relatório padrão por não informar nada, mas continua
disponível sob demanda.

### `jsqr` está parado na versão 1.4.0

Sem releases há anos. Mitigado com versão fixada, interface `Decodificador` isolada e a suíte
própria de ida e volta. Trocar por `zxing-wasm` é reescrever um arquivo — mas custaria 440 KB
gzip contra 56 KB, e na investigação os dois concordaram em 24 de 24 casos.

### `npm audit` reporta 9 vulnerabilidades high

Todas transitivas e sem correção upstream: `postcss` e `sharp`/libvips via `next`,
`brace-expansion` → `minimatch` na cadeia do ESLint. Não exploráveis neste projeto — `sharp` não
roda com `images.unoptimized` e export estático, e o `postcss` só processa CSS próprio em build.

---

## Deliberadamente fora de escopo, para sempre

Não são pendências. São coisas que o produto **não vai fazer**, porque fariam dele outra coisa:

- Redirecionamento, encurtador ou QR dinâmico.
- Rastreamento de leituras.
- Conta de usuário, plano pago, limite de uso.
- Analytics de terceiros.

Qualquer um deles exigiria um servidor, e um servidor é exatamente o que pode ser desligado.
