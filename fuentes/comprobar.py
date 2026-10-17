#!/usr/bin/env python3
"""Comprobaciones del libro que no dependen de mirar. Sale con 1 si alguna falla.

- Referencias: cada entrada de «# Referencias» (05_cierre.md) se cita en el cuerpo (apellido y año en la misma
  cita), y cada año entre paréntesis del cuerpo que acompaña a un apellido tiene su entrada.
- Figuras: las marcas `[FIGURA: archivo | Figura N. …]` van numeradas 1, 2, 3… sin saltos.
- TOC: `toc.json` tiene una página para cada entrada de `toc_keys.json`.
- Rayas: los incisos van con raya pegada y cerrada («texto —inciso— texto», también «—inciso—.» al final), nunca
  con la raya espaciada inglesa « — »; quedan fuera las citas entre «», los bloques citados, el índice analítico, las
  referencias, la lista de figuras y las etiquetas «**H — Hechos**».
- Idioma: el DOCX declara es-CL y la partición automática; el PDF, /Lang(es-CL).
- PDF (si existe y hay pdftotext): cero comillas rectas en el texto maquetado y ningún título ni etiqueta
  («Una versión posible.», «Tres preguntas…») como última línea de una página.

Uso (desde fuentes/): python3 comprobar.py
`cotejo_figuras.py` revisa aparte el texto de las figuras; `construir.sh` corre los dos al final.
"""

import glob
import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata
import zipfile

DIR = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.environ.get("LIBRO_OUT", os.path.join(DIR, ".."))
PDF = os.path.join(SALIDA, "Hechos_inferencias_incertidumbre_edicion_revisada.pdf")
DOCX = os.path.join(SALIDA, "Hechos_inferencias_incertidumbre_edicion_revisada.docx")
SIN_RAYAS = ("# Índice analítico", "# Referencias", "# Lista de figuras")


def ascii(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()


def fuentes():
    src = {os.path.basename(f): open(f, encoding="utf-8").read() for f in sorted(glob.glob(os.path.join(DIR, "0*.md")))}
    cierre = src["05_cierre.md"]
    i = cierre.index("# Referencias")
    j = cierre.index("\n# ", i + 1)
    refs = [linea for linea in cierre[i:j].split("\n") if linea.strip() and not linea.startswith("#")]
    cuerpo = "".join(src.values()).replace(cierre[i:j], "")
    return refs, cuerpo


def referencias(refs, cuerpo):
    problemas = []
    texto = ascii(cuerpo)
    pares = set()  # (apellido, año) de cada autor de cada entrada
    for r in refs:
        r = ascii(r)
        anio = re.search(r"\((\d{4}[a-z]?)", r)
        primero = re.match(r"([^,(]+?)(?:,| &|\s\()", r)
        if not anio or not primero:
            problemas.append(f"referencia sin apellido o sin año: {r[:70]}")
            continue
        for w in re.findall(r"[A-Z][A-Za-z'\-]+", r[: anio.start()]):
            pares.add((w, anio.group(1)))
        apellido = primero.group(1).strip().rstrip(".")
        if not re.search(re.escape(apellido) + r"[^()]{0,160}?" + re.escape(anio.group(1)), texto):
            problemas.append(f"referencia sin citar: {r[:70]}")
    # cada cita de un paréntesis («(A, 2019; B & C, 2020)»); la primera mira también lo que precede («A (2019)»)
    for m in re.finditer(r"\(([^()]*\d{4}[a-z]?[^()]*)\)", texto):
        for k, cita in enumerate(m.group(1).split(";")):
            contexto = cita if k else texto[max(0, m.start() - 80) : m.start()] + cita
            palabras = re.findall(r"[A-Z][A-Za-z'\-]+", contexto)
            for anio in re.findall(r"\b(\d{4}[a-z]?)\b", cita):
                if palabras and not any((w, anio) in pares for w in palabras):
                    problemas.append(f"cita sin entrada en Referencias: «…{contexto.strip()[-60:]}»")
    return problemas, len(refs)


def figuras(cuerpo):
    nums = [int(n) for n in re.findall(r"\[FIGURA: \S+ \| Figura (\d+)\.", cuerpo)]
    if nums != list(range(1, len(nums) + 1)):
        return [f"figuras fuera de orden o con saltos: {nums}"], len(nums)
    return [], len(nums)


def toc():
    claves = json.load(open(os.path.join(DIR, "toc_keys.json"), encoding="utf-8"))
    paginas = json.load(open(os.path.join(DIR, "toc.json"), encoding="utf-8"))
    faltan = [k for k in claves if k not in paginas]
    return ([f"entradas del TOC sin página: {faltan}"] if faltan else []), len(claves)


def oraciones(parrafo):
    """Corta un párrafo en oraciones (punto, cierre de interrogación o exclamación seguido de mayúscula)."""
    cortes, ini = [], 0
    for m in re.finditer(r"(?<=[.?!…])(?:[»”)]*)\s+(?=[A-ZÁÉÍÓÚÑ¿¡«(*\d])", parrafo):
        if re.search(r"\b(et al|p|pp|vs|cap|caps|fig)\.$", parrafo[ini : m.start()]):
            continue
        cortes.append(parrafo[ini : m.end()])
        ini = m.end()
    return cortes + [parrafo[ini:]]


def rayas():
    problemas = []
    for f in sorted(glob.glob(os.path.join(DIR, "0*.md"))):
        seccion = ""
        for n, linea in enumerate(open(f, encoding="utf-8").read().split("\n"), 1):
            if linea.startswith("# "):
                seccion = linea
            if seccion.startswith(SIN_RAYAS) or linea.startswith(">") or re.match(r"^(- )?\*\*[HID] — ", linea):
                continue
            for o in oraciones(linea):
                fuera = [m.start() for m in re.finditer("—", o) if o.count("«", 0, m.start()) <= o.count("»", 0, m.start())]
                espaciadas = [k for k in fuera if o[k - 1 : k + 2] == " — "]
                donde = f"{os.path.basename(f)}:{n}"
                if espaciadas:
                    problemas.append(f"raya espaciada en {donde}: «…{o[max(0, espaciadas[0] - 30) : espaciadas[0] + 30]}…»")
                elif len(fuera) % 2:
                    problemas.append(f"inciso sin raya de cierre en {donde}: «…{o[max(0, fuera[-1] - 30) : fuera[-1] + 40]}…»")
    return problemas


def idioma():
    problemas = []
    if os.path.exists(DOCX):
        with zipfile.ZipFile(DOCX) as z:
            if 'w:lang w:val="es-CL"' not in z.read("word/styles.xml").decode():
                problemas.append("el DOCX no declara es-CL")
            if "<w:autoHyphenation" not in z.read("word/settings.xml").decode():
                problemas.append("el DOCX no activa la partición automática")
    if os.path.exists(PDF) and b"/Lang(es-CL)" not in open(PDF, "rb").read():
        problemas.append("el PDF no declara /Lang(es-CL)")
    return problemas


def titulos(cuerpo):
    """Títulos de sección, de taller y etiquetas sueltas, tal como salen en el PDF."""
    t = set(re.findall(r"^#{3,4} (.+)$", cuerpo, re.M))
    t |= {re.sub(r"\*", "", x) for x in re.findall(r"^(\*{1,2}[^*\n]{1,78}\*{1,2})$", cuerpo, re.M)}
    return {" ".join(x.split()) for x in t if len(x) > 3}


def pdf(cuerpo):
    if not os.path.exists(PDF) or not shutil.which("pdftotext"):
        return [], None
    t = subprocess.run(["pdftotext", PDF, "-"], capture_output=True, text=True, check=True).stdout
    rectas = t.count('"')
    problemas = [f"{rectas} comillas rectas en el PDF"] if rectas else []
    nombres = titulos(cuerpo)
    for n, pagina in enumerate(t.split("\f"), 1):
        lineas = [x.strip() for x in pagina.split("\n") if x.strip() and not x.strip().isdigit()]
        cola = " ".join(" ".join(lineas[-2:]).split())
        al_pie = [x for x in nombres if cola.endswith(x)]
        if al_pie:
            problemas.append(f"página física {n} termina en un título o etiqueta: «{al_pie[0]}»")
    return problemas, rectas


def main():
    refs, cuerpo = fuentes()
    problemas = []
    p, n_refs = referencias(refs, cuerpo)
    problemas += p
    p, n_figs = figuras(cuerpo)
    problemas += p
    p, n_toc = toc()
    problemas += p
    problemas += rayas()
    problemas += idioma()
    p, rectas = pdf(cuerpo)
    problemas += p
    for x in problemas:
        print("problema:", x)
    estado_pdf = "sin PDF" if rectas is None else f"{rectas} comillas rectas en el PDF"
    print(f"{n_refs} referencias, {n_figs} figuras, TOC {n_toc} entradas, {estado_pdf}: {len(problemas)} problemas")
    return 1 if problemas else 0


if __name__ == "__main__":
    sys.exit(main())
