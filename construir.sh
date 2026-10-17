#!/usr/bin/env bash
# Reconstruye los entregables del libro desde fuentes/ y los comprueba:
#   cotejo del texto de las figuras → [figuras] → DOCX (pasada 1) → PDF → TOC → DOCX (pasada 2) → PDF → TOC estable
#   → EPUB → comprobar.py (referencias, figuras, TOC, comillas rectas).
# Escribe el DOCX, el PDF y el EPUB junto a este archivo (o en $LIBRO_OUT) y actualiza fuentes/toc.json.
#
# Uso: ./construir.sh [--figuras]     --figuras regenera figs/*.png con matplotlib antes de construir
# Requiere (ver AGENTS.md): node 22 con `npm install` hecho aquí (docx), python3 con matplotlib (requirements.txt),
# LibreOffice (soffice), poppler (pdftotext, pdfinfo, pdffonts), pandoc y hyphen-es. La fuente va en fuentes/tipografia/.
# El libro.json del lector se reconstruye aparte: python3 lector/construir_lector.py (resetea las marcas de «qué cambió»).
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")" && pwd)"
SALIDA="${LIBRO_OUT:-$RAIZ}"
export LIBRO_OUT="$SALIDA"  # build_docx.cjs, toc_extract.py, build_epub.py y comprobar.py leen y escriben ahí
mkdir -p "$SALIDA"
DOCX="$SALIDA/Hechos_inferencias_incertidumbre_edicion_revisada.docx"
PDF="$SALIDA/Hechos_inferencias_incertidumbre_edicion_revisada.pdf"
EPUB="$SALIDA/Hechos_inferencias_incertidumbre.epub"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# La fuente del libro (Gelasio, OFL) viaja en fuentes/tipografia/: LibreOffice la toma de ahí sin instalarla.
cat > "$TMP/fonts.conf" <<FC
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
  <dir>$RAIZ/fuentes/tipografia</dir>
  <cachedir>$TMP/fc-cache</cachedir>
</fontconfig>
FC
export FONTCONFIG_FILE="$TMP/fonts.conf"

a_pdf() {
  rm -f "$PDF"
  soffice --headless "-env:UserInstallation=file://$TMP/lo" --convert-to pdf --outdir "$SALIDA" "$DOCX" >/dev/null 2>&1 || true
  test -f "$PDF" || { echo "LibreOffice no produjo el PDF" >&2; exit 1; }
}

cd "$RAIZ/fuentes"
python3 cotejo_figuras.py
if [[ "${1:-}" == "--figuras" ]]; then python3 figuras.py; fi

node build_docx.cjs | tail -1
a_pdf
python3 toc_extract.py | tail -1
cp toc.json "$TMP/toc-pasada1.json"
node build_docx.cjs --toc toc.json | tail -1
a_pdf
python3 toc_extract.py | tail -1
if ! cmp -s toc.json "$TMP/toc-pasada1.json"; then
  echo "El TOC cambió entre la primera y la segunda pasada: vuelve a correr ./construir.sh" >&2
  exit 1
fi
echo "TOC estable entre pasadas; $(pdfinfo "$PDF" | grep Pages)"

rm -f "$EPUB"
python3 build_epub.py | tail -1
python3 comprobar.py
