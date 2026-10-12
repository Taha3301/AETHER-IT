import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import {
  AlignmentType,
  Document as DocxDocument,
  Footer,
  Header,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

export type ExportableAnalysis = {
  summary: string | null;
  problem: string | null;
  solution: string | null;
  targetAudience: string | null;
  targetMarket: string | null;
  businessModel: string | null;
  valueProposition: string | null;
  features: string | null;
  competitors: string | null;
  technology: string | null;
  marketingStrategy: string | null;
  roadmap: string | null;
  risks: string | null;
};

const sections: Array<{ key: keyof ExportableAnalysis; label: string }> = [
  { key: "summary", label: "Executive Summary" },
  { key: "problem", label: "Problem" },
  { key: "solution", label: "Solution" },
  { key: "targetAudience", label: "Target Audience" },
  { key: "targetMarket", label: "Target Market" },
  { key: "businessModel", label: "Business Model" },
  { key: "valueProposition", label: "Value Proposition" },
  { key: "features", label: "Features" },
  { key: "competitors", label: "Competitors" },
  { key: "technology", label: "Technology" },
  { key: "marketingStrategy", label: "Marketing Strategy" },
  { key: "roadmap", label: "Roadmap" },
  { key: "risks", label: "Risks" },
];

export type ExportDocumentKind = "ANALYSIS" | "CAHIER_DES_CHARGES";

const cahierDesChargesSections: Array<{
  label: string;
  values: Array<keyof ExportableAnalysis>;
}> = [
  { label: "1. Présentation générale du projet", values: ["summary"] },
  { label: "2. Contexte et problématique", values: ["problem"] },
  { label: "3. Objectifs et valeur attendue", values: ["solution", "valueProposition"] },
  { label: "4. Utilisateurs et marché cible", values: ["targetAudience", "targetMarket"] },
  { label: "5. Périmètre et besoins fonctionnels", values: ["features"] },
  { label: "6. Solutions existantes et concurrence", values: ["competitors"] },
  { label: "7. Exigences et orientations techniques", values: ["technology"] },
  { label: "8. Modèle économique", values: ["businessModel"] },
  { label: "9. Stratégie de lancement et de communication", values: ["marketingStrategy"] },
  { label: "10. Planning prévisionnel et étapes", values: ["roadmap"] },
  { label: "11. Risques, contraintes et points à valider", values: ["risks"] },
];

const storageDirectory = path.join(process.cwd(), "storage", "generated-documents");
const palette = {
  ink: "14243A",
  muted: "63758A",
  accent: "168C8C",
  pale: "EAF4F3",
  paper: "F6F8FB",
  white: "FFFFFF",
  body: "344256",
};

function plainText(value: string): string {
  return value.replace(/\u0000/g, "").trim();
}

export function getExportSections(
  analysis: ExportableAnalysis,
  documentKind: ExportDocumentKind = "ANALYSIS",
): Array<{ label: string; value: string }> {
  if (documentKind === "CAHIER_DES_CHARGES") {
    return cahierDesChargesSections.flatMap(({ label, values }) => {
      const content = values
        .map((key) => analysis[key]?.trim())
        .filter((value): value is string => Boolean(value))
        .join("\n\n");
      return content ? [{ label, value: content }] : [];
    });
  }
  return sections.flatMap(({ key, label }) => {
    const value = analysis[key];
    return value?.trim() ? [{ label, value }] : [];
  });
}

async function createPdf(
  title: string,
  analysis: ExportableAnalysis,
  documentKind: ExportDocumentKind,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: "A4",
      margins: { top: 76, right: 58, bottom: 68, left: 58 },
      compress: true,
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    const pageWidth = document.page.width;
    const pageHeight = document.page.height;
    document.rect(0, 0, pageWidth, pageHeight).fill(palette.paper);
    document.rect(0, 0, pageWidth, 320).fill(palette.ink);
    document.rect(58, 74, 54, 5).fill(palette.accent);
    document
      .fillColor("#9CB0C5")
      .font("Helvetica")
      .fontSize(9)
      .text("AETHER IT  /  DOCUMENT CONFIDENTIEL", 58, 100, { characterSpacing: 1.5 });
    document
      .fillColor(`#${palette.white}`)
      .font("Helvetica-Bold")
      .fontSize(13)
      .text(
        documentKind === "CAHIER_DES_CHARGES" ? "CAHIER DES CHARGES" : "ANALYSE DE PROJET",
        58,
        174,
        { characterSpacing: 2 },
      );
    document
      .fillColor(`#${palette.white}`)
      .font("Helvetica-Bold")
      .fontSize(30)
      .text(plainText(title), 58, 207, {
        width: pageWidth - 116,
        height: 78,
        ellipsis: true,
      });
    document.roundedRect(58, 346, pageWidth - 116, 102, 8).fill(`#${palette.white}`);
    document
      .fillColor(`#${palette.accent}`)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("OBJECTIF DU DOCUMENT", 78, 366, { characterSpacing: 1 });
    document
      .fillColor(`#${palette.body}`)
      .font("Helvetica")
      .fontSize(11)
      .text(
        documentKind === "CAHIER_DES_CHARGES"
          ? "Formaliser le besoin, le périmètre et les orientations du projet."
          : "Synthétiser la vision, les hypothèses et les prochaines étapes du projet.",
        78,
        385,
        { width: pageWidth - 156, lineGap: 3 },
      );
    document
      .fillColor(`#${palette.muted}`)
      .font("Helvetica")
      .fontSize(9)
      .text(
        "Document de travail — les éléments non confirmés restent à valider avec les parties prenantes.",
        58,
        pageHeight - 92,
        { width: pageWidth - 116, lineGap: 3 },
      );

    document.addPage();
    document.moveDown();
    for (const section of getExportSections(analysis, documentKind)) {
      if (document.y > pageHeight - 150) {
        document.addPage();
      }
      const headingY = document.y;
      document.roundedRect(58, headingY, pageWidth - 116, 30, 5).fill(`#${palette.pale}`);
      document
        .fillColor(`#${palette.accent}`)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(section.label, 70, headingY + 8, {
          width: pageWidth - 140,
          height: 16,
          ellipsis: true,
        });
      document.y = headingY + 42;
      document
        .fillColor(`#${palette.body}`)
        .font("Helvetica")
        .fontSize(10)
        .text(plainText(section.value), { lineGap: 4, paragraphGap: 3 });
      document.moveDown(1.1);
    }

    const pageRange = document.bufferedPageRange();
    for (let index = 1; index < pageRange.count; index += 1) {
      document.switchToPage(index);
      document
        .moveTo(58, 48)
        .lineTo(pageWidth - 58, 48)
        .lineWidth(0.7)
        .stroke(`#${palette.accent}`);
      document
        .fillColor(`#${palette.muted}`)
        .font("Helvetica-Bold")
        .fontSize(8)
        .text("AETHER IT", 58, 32, { characterSpacing: 1 });
      document
        .fillColor(`#${palette.muted}`)
        .font("Helvetica")
        .fontSize(8)
        .text("DOCUMENT CONFIDENTIEL", 0, 32, { align: "right", width: pageWidth - 58 });
      document
        .moveTo(58, pageHeight - 48)
        .lineTo(pageWidth - 58, pageHeight - 48)
        .lineWidth(0.5)
        .stroke("#D8E1EA");
      document
        .fillColor(`#${palette.muted}`)
        .font("Helvetica")
        .fontSize(8)
        .text(plainText(title), 58, pageHeight - 35, {
          width: pageWidth - 130,
          ellipsis: true,
        });
      document.text(`PAGE ${index + 1}`, 0, pageHeight - 35, {
        width: pageWidth - 58,
        align: "right",
      });
    }
    document.end();
  });
}

async function createDocx(
  title: string,
  analysis: ExportableAnalysis,
  documentKind: ExportDocumentKind,
): Promise<Buffer> {
  const paragraphs = [
    new Paragraph({
      spacing: { before: 1800, after: 280 },
      children: [
        new TextRun({
          text: "AETHER IT  /  DOCUMENT CONFIDENTIEL",
          bold: true,
          color: palette.accent,
          font: "Aptos",
          size: 20,
          characterSpacing: 24,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 1450, after: 360 },
      children: [
        new TextRun({
          text: documentKind === "CAHIER_DES_CHARGES" ? "CAHIER DES CHARGES" : "ANALYSE DE PROJET",
          bold: true,
          color: palette.accent,
          font: "Aptos",
          size: 24,
          characterSpacing: 18,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 360 },
      children: [
        new TextRun({
          text: plainText(title),
          bold: true,
          color: palette.ink,
          font: "Aptos Display",
          size: 44,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 260 },
      border: {
        bottom: {
          color: palette.accent,
          space: 8,
          style: "single",
          size: 18,
        },
      },
    }),
    new Paragraph({
      spacing: { before: 240, after: 160 },
      children: [
        new TextRun({
          text: "OBJECTIF DU DOCUMENT",
          bold: true,
          color: palette.accent,
          font: "Aptos",
          size: 19,
          characterSpacing: 12,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 180 },
      children: [
        new TextRun({
          text:
            documentKind === "CAHIER_DES_CHARGES"
              ? "Formaliser le besoin, le périmètre et les orientations du projet."
              : "Synthétiser la vision, les hypothèses et les prochaines étapes du projet.",
          color: palette.body,
          font: "Aptos",
          size: 22,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 440, after: 520 },
      children: [
        new TextRun({
          text: "Document de travail — les éléments non confirmés restent à valider avec les parties prenantes.",
          italics: true,
          color: palette.muted,
          font: "Aptos",
          size: 18,
        }),
      ],
    }),
    ...getExportSections(analysis, documentKind).flatMap(({ label, value }, index) => [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          pageBreakBefore: index === 0,
          spacing: { before: 360, after: 140 },
          border: {
            left: {
              color: palette.accent,
              space: 8,
              style: "single",
              size: 20,
            },
          },
          run: {
            color: palette.ink,
            bold: true,
            font: "Aptos Display",
            size: 28,
          },
          text: label,
        }),
        new Paragraph({
          spacing: { after: 240, line: 330 },
          run: {
            color: palette.body,
            font: "Aptos",
            size: 22,
          },
          children: [new TextRun(plainText(value))],
        }),
      ]),
  ];
  const document = new DocxDocument({
    styles: {
      default: {
        document: {
          run: { font: "Aptos", size: 22, color: palette.body },
        },
        heading1: {
          run: { font: "Aptos Display", size: 28, bold: true, color: palette.ink },
          paragraph: { spacing: { before: 360, after: 140 }, keepNext: true },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1180, right: 1180, bottom: 1180, left: 1180 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: {
                  bottom: { color: palette.accent, space: 6, style: "single", size: 8 },
                },
                children: [
                  new TextRun({
                    text: "AETHER IT  •  DOCUMENT CONFIDENTIEL",
                    bold: true,
                    color: palette.muted,
                    font: "Aptos",
                    size: 16,
                    characterSpacing: 10,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: {
                  top: { color: "D8E1EA", space: 6, style: "single", size: 4 },
                },
                children: [
                  new TextRun({
                    text: "AETHER IT  •  PAGE ",
                    color: palette.muted,
                    font: "Aptos",
                    size: 16,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    color: palette.muted,
                    font: "Aptos",
                    size: 16,
                  }),
                ],
              }),
            ],
          }),
        },
        children: paragraphs,
      },
    ],
  });
  return Packer.toBuffer(document);
}

export function safeExportFileName(
  title: string,
  extension: "pdf" | "docx",
  documentKind: ExportDocumentKind = "ANALYSIS",
): string {
  const baseName = title
    .normalize("NFKD")
    .replace(/[^\w -]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  const suffix = documentKind === "CAHIER_DES_CHARGES" ? "cahier-des-charges" : "analysis";
  return `${baseName || "project"}-${suffix}.${extension}`;
}

export async function storeProjectAnalysisExport(
  title: string,
  analysis: ExportableAnalysis,
  type: "PDF" | "DOCX",
  documentKind: ExportDocumentKind = "ANALYSIS",
): Promise<{ fileName: string; filePath: string; fileSize: number }> {
  const extension = type.toLowerCase() as "pdf" | "docx";
  const fileName = safeExportFileName(title, extension, documentKind);
  const storageName = `${randomUUID()}.${extension}`;
  const bytes =
    type === "PDF"
      ? await createPdf(title, analysis, documentKind)
      : await createDocx(title, analysis, documentKind);

  await mkdir(storageDirectory, { recursive: true });
  await writeFile(path.join(storageDirectory, storageName), bytes, { flag: "wx", mode: 0o600 });
  return {
    fileName,
    filePath: `generated-documents/${storageName}`,
    fileSize: bytes.byteLength,
  };
}

export async function readProjectAnalysisExport(filePath: string): Promise<Buffer> {
  if (!/^generated-documents\/[0-9a-f-]{36}\.(pdf|docx)$/.test(filePath)) {
    throw new Error("Document storage path is invalid.");
  }
  return readFile(path.join(storageDirectory, path.basename(filePath)));
}

export async function removeProjectAnalysisExport(filePath: string): Promise<void> {
  if (!/^generated-documents\/[0-9a-f-]{36}\.(pdf|docx)$/.test(filePath)) {
    throw new Error("Document storage path is invalid.");
  }
  await rm(path.join(storageDirectory, path.basename(filePath)));
}
