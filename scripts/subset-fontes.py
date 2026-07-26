"""
Gera `src/core/render/pdf-fontes.ts` com as fontes da marca subsetadas.

Por que embutir em vez de servir de `public/`: um `fetch` — ainda que da
propria origem — abre um caminho de rede num produto cuja tese e que nada sai do
navegador. Embutido, a promessa vale sem asterisco, e o custo cai no chunk que
so e baixado quando o usuario clica em exportar PDF.

Por que subsetar: as fontes completas somam 441 KB. O intervalo abaixo cobre
Latin-1 e Latin Extended-A — todo o portugues, mais as linguas da Europa
Ocidental — e derruba isso em uma ordem de grandeza.

O Archivo do Google Fonts e variavel; nao existe mais TTF estatico no
repositorio oficial. Por isso ele e instanciado antes de subsetar, no peso 800 e
na largura 125 que o board pede ("largura expandida quando disponivel").

Uso (precisa de `pip install fonttools`):

    # baixe as fontes de origem uma vez
    curl -L -o scripts/fontes/Archivo-Variable.ttf       "https://github.com/google/fonts/raw/main/ofl/archivo/Archivo%5Bwdth,wght%5D.ttf"
    curl -L -o scripts/fontes/IBMPlexMono-Medium.ttf       "https://github.com/google/fonts/raw/main/ofl/ibmplexmono/IBMPlexMono-Medium.ttf"

    python scripts/subset-fontes.py
"""

import base64
import pathlib
import subprocess
import sys
import tempfile

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ORIGEM = RAIZ / "scripts" / "fontes"
DESTINO = RAIZ / "src" / "core" / "render" / "pdf-fontes.ts"

# ASCII imprimivel, Latin-1, Latin Extended-A e a pontuacao tipografica que o
# board usa: travessao, aspas curvas, bullet, ponto medio, sinal de multiplicacao.
UNICODES = "U+0020-007E,U+00A0-00FF,U+0100-017F,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2022,U+00B7,U+00D7,U+2026,U+20AC"

# (constante, arquivo de origem, eixos para instanciar antes de subsetar)
FONTES = [
    ("ARCHIVO_EXTRABOLD", "Archivo-Variable.ttf", ["wght=800", "wdth=125"]),
    ("PLEX_MONO_MEDIUM", "IBMPlexMono-Medium.ttf", []),
]


def instanciar(entrada: pathlib.Path, eixos: list, destino: pathlib.Path) -> pathlib.Path:
    """Congela uma fonte variavel num peso e largura fixos."""
    if not eixos:
        return entrada
    subprocess.run(
        [sys.executable, "-m", "fontTools.varLib.instancer", str(entrada), *eixos, "-o", str(destino)],
        check=True,
        capture_output=True,
    )
    return destino


def subsetar(entrada: pathlib.Path) -> bytes:
    with tempfile.TemporaryDirectory() as tmp:
        saida = pathlib.Path(tmp) / "subset.ttf"
        subprocess.run(
            [
                sys.executable,
                "-m",
                "fontTools.subset",
                str(entrada),
                f"--unicodes={UNICODES}",
                "--layout-features=kern,liga",
                "--no-hinting",
                "--desubroutinize",
                f"--output-file={saida}",
            ],
            check=True,
            capture_output=True,
        )
        return saida.read_bytes()


def main() -> None:
    partes = [
        "/*",
        " * GERADO POR scripts/subset-fontes.py — NAO EDITE A MAO.",
        " *",
        " * Fontes da marca subsetadas para Latin-1 e Latin Extended-A, em base64.",
        " * Embutidas em vez de servidas de /public para que a exportacao em PDF nao",
        " * faca requisicao nenhuma: a promessa de que nada sai do navegador vale sem",
        " * asterisco. Este modulo so entra no bundle pelo import() do caminho de PDF.",
        " *",
        " * Archivo e IBM Plex Mono estao sob SIL Open Font License 1.1.",
        " */",
        "",
        "function decodificar(base64: string): Uint8Array {",
        "  const binario = atob(base64);",
        "  const bytes = new Uint8Array(binario.length);",
        "  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);",
        "  return bytes;",
        "}",
        "",
    ]

    for nome, arquivo, eixos in FONTES:
        bruto = ORIGEM / arquivo
        if not bruto.exists():
            raise SystemExit(f"fonte ausente: {bruto}")

        with tempfile.TemporaryDirectory() as tmp:
            fixa = instanciar(bruto, eixos, pathlib.Path(tmp) / "fixa.ttf")
            dados = subsetar(fixa)
        b64 = base64.b64encode(dados).decode("ascii")
        kb_antes = bruto.stat().st_size / 1024
        kb_depois = len(dados) / 1024

        print(f"{arquivo}: {kb_antes:.0f} KB -> {kb_depois:.0f} KB subsetada")

        partes.append(f"/** {arquivo} · {kb_depois:.0f} KB subsetada de {kb_antes:.0f} KB. */")
        partes.append(f"const {nome}_B64 =")
        for i in range(0, len(b64), 120):
            fim = ";" if i + 120 >= len(b64) else ""
            partes.append(f"  '{b64[i:i + 120]}'{fim}" if i + 120 >= len(b64) else f"  '{b64[i:i + 120]}' +")
        partes.append("")
        partes.append(f"export const {nome} = /* @__PURE__ */ decodificar({nome}_B64);")
        partes.append("")

    DESTINO.write_text("\n".join(partes), encoding="utf-8", newline="\n")
    print(f"escrito {DESTINO.relative_to(RAIZ)} ({DESTINO.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
