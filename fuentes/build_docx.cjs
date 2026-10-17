// Construye el .docx del libro desde los md fuente.
// Uso: node build_docx.cjs [--toc toc.json]  (toc.json: { "<texto heading>": <página lógica> })
// Requiere el paquete docx: `npm install` en la raíz del libro (package.json lo fija). Lo normal es correr ../construir.sh.
// Lee las figuras de ../figs/ y escribe el .docx en ../ (o en $LIBRO_OUT); toc_keys.json queda junto al script.
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, ImageRun,
  Footer, Header, PageNumber, LevelFormat, Tab, TabStopType, LeaderType,
  LineRuleType, VerticalAlign,
} = require("docx");
const JSZip = require("jszip");

const DIR = __dirname;
const LIBRO = path.resolve(DIR, "..");
const FIGS = fs.existsSync(path.join(LIBRO, "figs")) ? path.join(LIBRO, "figs") : path.join(DIR, "figs");
const OUT_DIR = process.env.LIBRO_OUT ? path.resolve(process.env.LIBRO_OUT) : LIBRO;
const INK = "2B2B2B", ACENTO = "8C2F2F", ACENTO2 = "3D5A6C", GRIS = "8A8A8A", CLARO = "F2F0EC";
const SERIF = "Georgia";

const tocArg = process.argv.indexOf("--toc");
const tocMap = tocArg > -1 ? JSON.parse(fs.readFileSync(process.argv[tocArg + 1], "utf8")) : null;

const FILES = ["00_preliminares.md", "01_parte1.md", "02_parte2.md", "03_parte3.md", "04_parte4.md", "05_cierre.md"];

// ---------------------------------------------------------------- md parsing
function parse(md) {
  const lines = md.split("\n");
  const toks = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim() === "") { i++; continue; }
    if (l.startsWith("[PORTADA]")) {
      const buf = [];
      i++;
      while (!lines[i].startsWith("[/PORTADA]")) { if (lines[i].trim()) buf.push(lines[i].trim()); i++; }
      i++; toks.push({ t: "portada", lines: buf }); continue;
    }
    if (l.startsWith("[LEGAL]")) {
      const buf = [];
      i++;
      while (!lines[i].startsWith("[/LEGAL]")) { if (lines[i].trim()) buf.push(lines[i].trim()); i++; }
      i++; toks.push({ t: "legal", lines: buf }); continue;
    }
    const fig = l.match(/^\[FIGURA:\s*(\S+)\s*\|\s*(.+)\]$/);
    if (fig) { toks.push({ t: "figure", file: fig[1], caption: fig[2] }); i++; continue; }
    if (l.startsWith("#### ")) { toks.push({ t: "h4", text: l.slice(5).trim() }); i++; continue; }
    if (l.startsWith("### ")) { toks.push({ t: "h3", text: l.slice(4).trim() }); i++; continue; }
    if (l.startsWith("## ")) { toks.push({ t: "h2", text: l.slice(3).trim() }); i++; continue; }
    if (l.startsWith("# ")) { toks.push({ t: "h1", text: l.slice(2).trim() }); i++; continue; }
    if (l.startsWith("> ")) {
      const buf = [l.slice(2).trim()];
      i++;
      while (i < lines.length && lines[i].startsWith("> ")) { buf.push(lines[i].slice(2).trim()); i++; }
      toks.push({ t: "quote", text: buf.join(" ") }); continue;
    }
    if (/^- /.test(l)) {
      const items = [];
      while (i < lines.length && /^- /.test(lines[i])) { items.push(lines[i].slice(2).trim()); i++; }
      toks.push({ t: "ul", items }); continue;
    }
    if (/^\d+\.\s/.test(l)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, "").trim()); i++; }
      toks.push({ t: "ol", items }); continue;
    }
    if (l.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) { rows.push(lines[i]); i++; }
      const cells = rows.map(r => r.replace(/^\||\|$/g, "").split("|").map(c => c.trim()));
      const body = cells.filter(r => !/^-+$/.test(r[0].replace(/[\s:]/g, "-").replace(/-+/g, "-")) || !r.every(c => /^:?-+:?$/.test(c)));
      const clean = cells.filter(r => !r.every(c => /^:?-+:?$/.test(c)));
      toks.push({ t: "table", rows: clean }); continue;
    }
    // paragraph: acumular hasta línea en blanco o marcador
    const buf = [l.trim()];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !/^(#|\||- |\d+\.\s|> |\[)/.test(lines[i])) {
      buf.push(lines[i].trim()); i++;
    }
    toks.push({ t: "p", text: buf.join(" ") });
  }
  return toks;
}

// ---------------------------------------------------------------- inline runs
function runs(text, base = {}) {
  const out = [];
  // split por **bold** y *italic*
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(new TextRun({ text: tok.slice(2, -2), bold: true, ...base }));
    else out.push(new TextRun({ text: tok.slice(1, -1), italics: true, ...base }));
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out.length ? out : [new TextRun({ text: "", ...base })];
}

// ---------------------------------------------------------------- páginas
// Un párrafo que sólo es una etiqueta («*Una versión posible.*») o que anuncia con dos puntos la lista, la cita o la
// tabla que sigue no queda solo al pie de la página: va con lo que anuncia. Las listas cortas no se parten.
function anuncia(text, next) {
  const etiqueta = /^\*{1,2}[^*]+\*{1,2}$/.test(text) && text.length < 80;
  const sigue = next && ["ol", "ul", "quote", "table", "figure"].includes(next.t);
  return etiqueta || (sigue && /:$/.test(text));
}
function juntarLista(items, j) {
  return items.length <= 5 && j < items.length - 1 && items.every(it => it.length < 400);
}

// ---------------------------------------------------------------- numbering
const olRefs = [];
let olCount = 0;
function newOlRef() { const r = `ol-${olCount++}`; olRefs.push(r); return r; }

// ---------------------------------------------------------------- imágenes
function png(file) {
  const buf = fs.readFileSync(path.join(FIGS, file));
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const maxW = 590; // px @96dpi ~ ancho de caja de texto A4 con márgenes 2,5 cm
  const scale = Math.min(1, maxW / (w / 3.125)); // png a 300dpi → px96 = w/3.125
  const wpx = Math.round((w / 3.125) * scale), hpx = Math.round((h / 3.125) * scale);
  return { data: buf, wpx, hpx };
}

// ---------------------------------------------------------------- estilos
const styles = {
  default: {
    document: { run: { font: SERIF, size: 22, color: INK, language: { value: "es-CL" } }, paragraph: { spacing: { after: 120, line: 276, lineRule: LineRuleType.AUTO } } },
  },
  paragraphStyles: [
    { id: "BodyJ", name: "BodyJ", basedOn: "Normal", run: { font: SERIF, size: 22, color: INK },
      paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 276, lineRule: LineRuleType.AUTO } } },
    { id: "PartLabel", name: "PartLabel", basedOn: "Normal",
      run: { font: SERIF, size: 24, color: ACENTO, bold: true, characterSpacing: 60 },
      paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 2600, after: 160 } } },
    { id: "PartTitle", name: "PartTitle", basedOn: "Normal",
      run: { font: SERIF, size: 44, color: INK, bold: true },
      paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 480 } } },
    { id: "PartIntro", name: "PartIntro", basedOn: "Normal",
      run: { font: SERIF, size: 22, color: "5A5A5A", italics: true },
      paragraph: { alignment: AlignmentType.JUSTIFIED, indent: { left: 850, right: 850 }, spacing: { after: 160, line: 300, lineRule: LineRuleType.AUTO } } },
    { id: "Quote1", name: "Quote1", basedOn: "Normal",
      run: { font: SERIF, size: 23, color: INK, italics: true },
      paragraph: { alignment: AlignmentType.JUSTIFIED, indent: { left: 620, right: 620 }, spacing: { before: 200, after: 220, line: 288, lineRule: LineRuleType.AUTO },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: ACENTO, space: 12 } } } },
    { id: "Caption", name: "Caption", basedOn: "Normal",
      run: { font: SERIF, size: 18, color: GRIS, italics: true },
      paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 60, after: 280 }, indent: { left: 400, right: 400 } } },
    { id: "EnUnaFrase", name: "EnUnaFrase", basedOn: "Normal",
      run: { font: SERIF, size: 22, color: INK },
      paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { before: 220, after: 120 },
        shading: { type: ShadingType.CLEAR, fill: CLARO },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: ACENTO2, space: 10 } },
        indent: { left: 240, right: 240 } } },
    { id: "TallerHead", name: "TallerHead", basedOn: "Normal",
      run: { font: SERIF, size: 22, color: ACENTO2, bold: true },
      paragraph: { spacing: { before: 260, after: 100 },
        shading: { type: ShadingType.CLEAR, fill: CLARO },
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: ACENTO2, space: 4 },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: ACENTO2, space: 4 },
        } } },
    { id: "TocPart", name: "TocPart", basedOn: "Normal",
      run: { font: SERIF, size: 22, color: INK, bold: true }, paragraph: { spacing: { before: 160, after: 60 }, indent: { right: 700 } } },
    { id: "TocEntry", name: "TocEntry", basedOn: "Normal",
      run: { font: SERIF, size: 21, color: INK }, paragraph: { spacing: { after: 50 }, indent: { left: 280, right: 700 } } },
  ],
};

// ---------------------------------------------------------------- documento
const front = [];   // sección 1: portada, legal, contenido
const body = [];    // sección 2
const tocEntries = []; // {text, level: 'part'|'major'|'chapter'}

let partIntroMode = false;

function pushHeadingBody(tok) {
  if (tok.t === "h1") {
    const isPart = tok.text.startsWith("PARTE");
    partIntroMode = isPart;
    if (isPart) {
      const m = tok.text.match(/^(PARTE\s+\S+)\.\s*(.*)$/);
      const label = m ? m[1] : tok.text, title = m ? m[2] : "";
      tocEntries.push({ text: tok.text, level: "part", key: tok.text });
      body.push(new Paragraph({ style: "PartLabel", pageBreakBefore: true, keepNext: true, children: [new TextRun(label)] }));
      body.push(new Paragraph({ style: "PartTitle", keepNext: true, children: [new TextRun(title)] }));
    } else {
      tocEntries.push({ text: tok.text, level: "major", key: tok.text });
      body.push(new Paragraph({
        heading: HeadingLevel.HEADING_1, pageBreakBefore: true, keepNext: true, keepLines: true,
        spacing: { before: 720, after: 320 },
        children: [new TextRun({ text: tok.text, font: SERIF, size: 34, bold: true, color: INK })],
      }));
    }
  } else if (tok.t === "h2") {
    partIntroMode = false;
    tocEntries.push({ text: tok.text, level: "chapter", key: tok.text });
    const m = tok.text.match(/^(Capítulo\s+\d+|Interludio\s+\S+|Cuaderno de casos)\.\s*(.*)$/);
    const kids = [];
    if (m) {
      kids.push(new TextRun({ text: m[1], font: SERIF, size: 22, bold: true, color: ACENTO, break: 0 }));
      kids.push(new TextRun({ text: m[2], font: SERIF, size: 32, bold: true, color: ACENTO2, break: 1 }));
    } else {
      kids.push(new TextRun({ text: tok.text, font: SERIF, size: 32, bold: true, color: ACENTO2 }));
    }
    body.push(new Paragraph({
      heading: HeadingLevel.HEADING_2, pageBreakBefore: true, keepNext: true, keepLines: true,
      spacing: { before: 600, after: 300 }, children: kids,
    }));
  } else if (tok.t === "h3") {
    body.push(new Paragraph({
      heading: HeadingLevel.HEADING_3, keepNext: true, keepLines: true,
      spacing: { before: 280, after: 120 },
      children: [new TextRun({ text: tok.text, font: SERIF, size: 25, bold: true, color: INK })],
    }));
  } else if (tok.t === "h4") {
    body.push(new Paragraph({ style: "TallerHead", keepNext: true, keepLines: true, children: [new TextRun(tok.text)] }));
  }
}

for (const f of FILES) {
  const toks = parse(fs.readFileSync(path.join(DIR, f), "utf8"));
  toks.forEach((tok, k) => {
    const next = toks[k + 1];
    if (tok.t === "portada") {
      const [t1, t2, t3, autor, anio] = tok.lines;
      front.push(new Paragraph({ spacing: { before: 3600, after: 200 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "HECHOS, INFERENCIAS", font: SERIF, size: 56, bold: true, color: INK })] }));
      front.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 340 },
        children: [new TextRun({ text: "E INCERTIDUMBRE", font: SERIF, size: 56, bold: true, color: INK })] }));
      front.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
        children: [new TextRun({ text: "Metacognición, lenguaje y decisión clínica", font: SERIF, size: 28, italics: true, color: ACENTO2 })] }));
      front.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 2400 },
        children: [new TextRun({ text: "Una epistemología operativa para médicos", font: SERIF, size: 24, color: GRIS })] }));
      front.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
        children: [new TextRun({ text: "DANIEL OPAZO", font: SERIF, size: 30, bold: true, color: INK, characterSpacing: 40 })] }));
      front.push(new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "2026 · Edición de trabajo revisada", font: SERIF, size: 22, color: GRIS })] }));
    } else if (tok.t === "legal") {
      front.push(new Paragraph({ children: [new PageBreak()] }));
      front.push(new Paragraph({ spacing: { before: 7000, after: 120 },
        children: [new TextRun({ text: tok.lines[0], font: SERIF, size: 20, bold: true, color: INK })] }));
      front.push(new Paragraph({ spacing: { after: 200 },
        children: [new TextRun({ text: tok.lines[1], font: SERIF, size: 20, color: INK })] }));
      for (const l of tok.lines.slice(2)) {
        front.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 },
          children: runs(l, { size: 18, color: "5A5A5A" }) }));
      }
    } else if (["h1", "h2", "h3", "h4"].includes(tok.t)) {
      pushHeadingBody(tok);
    } else if (tok.t === "quote") {
      body.push(new Paragraph({ style: "Quote1", children: runs(tok.text) }));
    } else if (tok.t === "figure") {
      const { data, wpx, hpx } = png(tok.file);
      const noB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
      body.push(new Table({
        columnWidths: [9026], width: { size: 9026, type: WidthType.DXA },
        borders: { top: noB, bottom: noB, left: noB, right: noB, insideHorizontal: noB, insideVertical: noB },
        rows: [new TableRow({ cantSplit: true, children: [new TableCell({
          width: { size: 9026, type: WidthType.DXA },
          borders: { top: noB, bottom: noB, left: noB, right: noB },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 40 },
              children: [new ImageRun({ type: "png", data, transformation: { width: wpx, height: hpx } })] }),
            new Paragraph({ style: "Caption", children: runs(tok.caption) }),
          ] })] })],
      }));
      body.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
    } else if (tok.t === "ul") {
      tok.items.forEach((it, j) =>
        body.push(new Paragraph({ style: "BodyJ", numbering: { reference: "bullets", level: 0 },
          keepNext: juntarLista(tok.items, j), children: runs(it) })));
    } else if (tok.t === "ol") {
      const ref = newOlRef();
      tok.items.forEach((it, j) =>
        body.push(new Paragraph({ style: "BodyJ", numbering: { reference: ref, level: 0 },
          keepNext: juntarLista(tok.items, j), children: runs(it) })));
    } else if (tok.t === "table") {
      const header = tok.rows[0];
      const dataRows = tok.rows.slice(1);
      const colW = [1750, 2150, 2560, 2560]; // suma 9020 ≈ caja A4
      const mkCell = (text, isHead, w) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        shading: isHead ? { type: ShadingType.CLEAR, fill: "E7E4DE" } : undefined,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        verticalAlign: VerticalAlign.TOP,
        children: [new Paragraph({ spacing: { after: 0 },
          children: runs(text, { size: 17, bold: isHead || undefined }) })],
      });
      body.push(new Table({
        columnWidths: colW,
        width: { size: colW.reduce((a, b) => a + b, 0), type: WidthType.DXA },
        rows: [
          new TableRow({ tableHeader: true, children: header.map((c, k) => mkCell(c.replace(/\*\*/g, ""), true, colW[k])) }),
          ...dataRows.map(r => new TableRow({ cantSplit: true, children: r.map((c, j) => mkCell(c, false, colW[j])) })),
        ],
      }));
      body.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    } else if (tok.t === "p") {
      if (partIntroMode) {
        body.push(new Paragraph({ style: "PartIntro", children: runs(tok.text) }));
      } else if (tok.text.startsWith("**En una frase.**")) {
        body.push(new Paragraph({ style: "EnUnaFrase", children: runs(tok.text) }));
      } else if (tok.text.startsWith("**Tres preguntas")) {
        body.push(new Paragraph({ style: "BodyJ", spacing: { before: 160, after: 80 }, keepNext: true, children: runs(tok.text) }));
      } else {
        body.push(new Paragraph({ style: "BodyJ", keepNext: anuncia(tok.text, next), children: runs(tok.text) }));
      }
    }
  });
}

// ---------------------------------------------------------------- contenido
front.push(new Paragraph({ children: [new PageBreak()] }));
front.push(new Paragraph({ spacing: { before: 500, after: 360 },
  children: [new TextRun({ text: "Contenido", font: SERIF, size: 34, bold: true, color: INK })] }));
for (const e of tocEntries) {
  const pg = tocMap ? (tocMap[e.key] !== undefined ? String(tocMap[e.key]) : "") : "00";
  const style = e.level === "chapter" ? "TocEntry" : "TocPart";
  const display = e.text;
  front.push(new Paragraph({
    style,
    tabStops: [{ type: TabStopType.RIGHT, position: 9026, leader: LeaderType.DOT }],
    children: [
      new TextRun(display),
      new TextRun({ children: [new Tab()] }),
      new TextRun({ text: pg, color: GRIS }),
    ],
  }));
}

// ---------------------------------------------------------------- ensamblaje
const numberingCfg = [
  { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 560, hanging: 280 } } } }] },
  ...olRefs.map(r => ({ reference: r, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 560, hanging: 280 } } } }] })),
];

const headerBody = new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 },
  children: [new TextRun({ text: "HECHOS, INFERENCIAS E INCERTIDUMBRE", font: SERIF, size: 15, color: GRIS, characterSpacing: 30 })] })] });
const footerBody = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 },
  children: [new TextRun({ font: SERIF, size: 18, color: GRIS, children: [PageNumber.CURRENT] })] })] });

const doc = new Document({
  creator: "Daniel Opazo",
  title: "Hechos, inferencias e incertidumbre — Metacognición, lenguaje y decisión clínica",
  description: "Una epistemología operativa para médicos. Edición de trabajo revisada, 2026.",
  styles,
  hyphenation: { autoHyphenation: true, consecutiveHyphenLimit: 2, doNotHyphenateCaps: true },
  numbering: { config: numberingCfg },
  sections: [
    {
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      children: front,
    },
    {
      properties: {
        page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, pageNumbers: { start: 1 } },
      },
      headers: { default: headerBody },
      footers: { default: footerBody },
      children: body,
    },
  ],
});

// ---------------------------------------------------------------- sin partición en títulos
// La partición automática (es-CL) vale para el cuerpo justificado. Los títulos, el contenido, las leyendas y la parte
// preliminar no se parten: docx no expone w:suppressAutoHyphens, así que se agrega al XML ya empaquetado, en el lugar
// que le toca dentro de w:pPr según el esquema de OOXML.
const SIN_PARTICION = ["Heading1", "Heading2", "Heading3", "TallerHead", "TocPart", "TocEntry", "PartLabel", "PartTitle", "Caption"];
const DESPUES = ["kinsoku", "wordWrap", "overflowPunct", "topLinePunct", "autoSpaceDE", "autoSpaceDN", "bidi",
  "adjustRightInd", "snapToGrid", "spacing", "ind", "contextualSpacing", "mirrorIndents", "suppressOverlap", "jc",
  "textDirection", "textAlignment", "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr", "pPrChange"];
function conSupresion(pPr) {
  if (pPr.includes("<w:suppressAutoHyphens")) return pPr;
  const m = pPr.match(new RegExp(`<w:(${DESPUES.join("|")})[ />]`));
  const k = m ? m.index : pPr.lastIndexOf("</w:pPr>");
  return pPr.slice(0, k) + "<w:suppressAutoHyphens/>" + pPr.slice(k);
}
function enParrafo(p) {  // p: un <w:p ...>...</w:p> o el interior de un <w:style>
  if (/<w:pPr>/.test(p)) return p.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/, conSupresion);
  if (p.startsWith("<w:p")) return p.replace(/^<w:p( [^>]*)?>/, m => m + "<w:pPr><w:suppressAutoHyphens/></w:pPr>");
  return p.replace(/(<w:rPr>|$)/, "<w:pPr><w:suppressAutoHyphens/></w:pPr>$1");
}
async function sinParticion(buf) {
  const zip = await JSZip.loadAsync(buf);
  let estilos = await zip.file("word/styles.xml").async("string");
  for (const id of SIN_PARTICION) {
    const re = new RegExp(`(<w:style [^>]*w:styleId="${id}"[^>]*>)([\\s\\S]*?)(</w:style>)`);
    if (!re.test(estilos)) throw new Error(`falta el estilo ${id}`);
    estilos = estilos.replace(re, (_, a, dentro, z) => a + enParrafo(dentro) + z);
  }
  zip.file("word/styles.xml", estilos);
  let docu = await zip.file("word/document.xml").async("string");
  const finPreliminar = docu.indexOf("<w:sectPr");  // el sectPr de la primera sección cierra la parte preliminar
  docu = docu.slice(0, finPreliminar).replace(/<w:p(?: [^>]*)?>[\s\S]*?<\/w:p>/g, enParrafo) + docu.slice(finPreliminar);
  zip.file("word/document.xml", docu);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

Packer.toBuffer(doc).then(sinParticion).then(buf => {
  const out = path.join(OUT_DIR, "Hechos_inferencias_incertidumbre_edicion_revisada.docx");
  fs.writeFileSync(out, buf);
  fs.writeFileSync(path.join(DIR, "toc_keys.json"), JSON.stringify(tocEntries.map(e => e.key), null, 1));
  console.log("OK", out, `(${(buf.length / 1024).toFixed(0)} KB, ${tocEntries.length} entradas TOC)`);
});
