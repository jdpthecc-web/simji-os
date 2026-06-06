/* 범용 Markdown → Word(.docx) 변환기 (SIMJI OS README 용)
   사용: node gen_readme_docx.js <input.md> <output.docx> */
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, LevelFormat,
  AlignmentType, BorderStyle, ShadingType
} = require('docx');

const inPath = process.argv[2] || 'README.md';
const outPath = process.argv[3] || 'SIMJI_OS_README.docx';
const FONT = 'Malgun Gothic';
const MONO = 'Consolas';

const md = fs.readFileSync(inPath, 'utf8').replace(/\r\n/g, '\n').split('\n');

// 인라인: **bold**, `code`
function parseInline(text, baseOpts) {
  baseOpts = baseOpts || {};
  const runs = [];
  // 토큰화: `code` 우선, 그다음 **bold**
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push(new TextRun(Object.assign({ text: text.slice(last, m.index) }, baseOpts)));
    if (m[1]) runs.push(new TextRun(Object.assign({ text: m[1].slice(1, -1), font: MONO, size: 19, shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' } }, baseOpts)));
    else if (m[2]) runs.push(new TextRun(Object.assign({ text: m[2].slice(2, -2), bold: true }, baseOpts)));
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push(new TextRun(Object.assign({ text: text.slice(last) }, baseOpts)));
  if (!runs.length) runs.push(new TextRun(Object.assign({ text: '' }, baseOpts)));
  return runs;
}

const children = [];
const numConfig = [];
let numCounter = 0, curNumRef = null, inNumbered = false;
let inCode = false, codeBuf = [];

function flushCode() {
  if (!codeBuf.length) { codeBuf = []; return; }
  codeBuf.forEach((ln, i) => {
    children.push(new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
      spacing: { before: i === 0 ? 80 : 0, after: i === codeBuf.length - 1 ? 80 : 0 },
      children: [new TextRun({ text: ln || ' ', font: MONO, size: 18, color: '0F172A' })]
    }));
  });
  codeBuf = [];
}

for (let raw of md) {
  // 코드펜스 토글
  if (/^```/.test(raw.trim())) {
    if (inCode) { flushCode(); inCode = false; } else { inCode = true; }
    continue;
  }
  if (inCode) { codeBuf.push(raw); continue; }

  const line = raw.replace(/\s+$/, '');
  const t = line.trim();

  if (t === '') { inNumbered = false; continue; }

  // 헤딩
  let mh = /^(#{1,4})\s+(.*)$/.exec(t);
  if (mh) {
    inNumbered = false;
    const lvl = mh[1].length;
    const HL = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][lvl - 1];
    children.push(new Paragraph({ heading: HL, children: parseInline(mh[2]) }));
    continue;
  }

  // 블록쿼트
  if (/^>\s?/.test(t)) {
    inNumbered = false;
    children.push(new Paragraph({
      indent: { left: 360 },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: '0F766E', space: 12 } },
      spacing: { before: 60, after: 60 },
      children: parseInline(t.replace(/^>\s?/, ''), { italics: true, color: '475569' })
    }));
    continue;
  }

  // 번호 목록
  let mn = /^(\d+)\.\s+(.*)$/.exec(t);
  if (mn) {
    if (!inNumbered) { numCounter++; curNumRef = 'num' + numCounter; numConfig.push(curNumRef); inNumbered = true; }
    children.push(new Paragraph({ numbering: { reference: curNumRef, level: 0 }, children: parseInline(mn[2]) }));
    continue;
  }

  // 불릿 (들여쓰기 2칸 이상이면 레벨1)
  let mb = /^(\s*)-\s+(.*)$/.exec(raw.replace(/\t/g, '  '));
  if (mb) {
    const indent = mb[1].length;
    const level = indent >= 2 ? 1 : 0;
    if (level === 0) inNumbered = false;
    children.push(new Paragraph({ numbering: { reference: 'bullets', level }, children: parseInline(mb[2]) }));
    continue;
  }

  // 일반 문단
  inNumbered = false;
  children.push(new Paragraph({ spacing: { after: 80 }, children: parseInline(t) }));
}
if (inCode) flushCode();

const numbering = {
  config: [
    { reference: 'bullets', levels: [
      { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 280 } } } },
      { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 280 } } } }
    ] },
    ...numConfig.map(ref => ({
      reference: ref, levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 280 } } } }
      ]
    }))
  ]
};

const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 34, bold: true, font: FONT, color: '1A2E4A' },
        paragraph: { spacing: { before: 300, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 27, bold: true, font: FONT, color: '0F766E' },
        paragraph: { spacing: { before: 260, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 23, bold: true, font: FONT, color: '1A2E4A' },
        paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 2 } },
      { id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: FONT, color: '475569' },
        paragraph: { spacing: { before: 140, after: 80 }, outlineLevel: 3 } }
    ]
  },
  numbering,
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children
  }]
});

Packer.toBuffer(doc).then(buf => { fs.writeFileSync(outPath, buf); console.log('생성:', outPath, '(문단', children.length + ')'); });
