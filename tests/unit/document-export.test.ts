import { afterEach, describe, expect, it } from "vitest";
import {
  readProjectAnalysisExport,
  removeProjectAnalysisExport,
  getExportSections,
  safeExportFileName,
  storeProjectAnalysisExport,
} from "@/lib/document-export";

const analysis = {
  summary: "A private project summary.",
  problem: "A local business needs online bookings.",
  solution: "A searchable booking application.",
  targetAudience: "Local businesses and customers",
  targetMarket: "Tunisia",
  businessModel: "Subscription",
  valueProposition: "Easy access to appointments",
  features: '["Search","Booking"]',
  competitors: "Existing booking websites",
  technology: "Web and mobile applications",
  marketingStrategy: "Local business partnerships",
  roadmap: '["MVP","Launch"]',
  risks: "Customer growth",
};

const storedFiles: string[] = [];

afterEach(async () => {
  await Promise.all(storedFiles.splice(0).map((filePath) => removeProjectAnalysisExport(filePath)));
});

describe("project analysis exports", () => {
  it("creates private PDF and DOCX files that can be read back", async () => {
    for (const type of ["PDF", "DOCX"] as const) {
      const file = await storeProjectAnalysisExport("Private project", analysis, type);
      storedFiles.push(file.filePath);
      const bytes = await readProjectAnalysisExport(file.filePath);
      expect(file.filePath).toMatch(/^generated-documents\/[0-9a-f-]{36}\./);
      expect(file.fileSize).toBeGreaterThan(0);
      expect(bytes.byteLength).toBe(file.fileSize);
      expect(type === "PDF" ? bytes.subarray(0, 4).toString() : bytes.subarray(0, 2).toString())
        .toBe(type === "PDF" ? "%PDF" : "PK");
    }
  });

  it("sanitizes the suggested filename and rejects unsafe stored paths", async () => {
    expect(safeExportFileName("../Quarterly / Plan", "pdf")).toBe("Quarterly-Plan-analysis.pdf");
    await expect(readProjectAnalysisExport("../secret.pdf")).rejects.toThrow(
      "Document storage path is invalid.",
    );
  });

  it("builds French cahier des charges sections from the saved analysis", async () => {
    const documentSections = getExportSections(analysis, "CAHIER_DES_CHARGES");
    expect(documentSections.map((section) => section.label)).toEqual([
      "1. Présentation générale du projet",
      "2. Contexte et problématique",
      "3. Objectifs et valeur attendue",
      "4. Utilisateurs et marché cible",
      "5. Périmètre et besoins fonctionnels",
      "6. Solutions existantes et concurrence",
      "7. Exigences et orientations techniques",
      "8. Modèle économique",
      "9. Stratégie de lancement et de communication",
      "10. Planning prévisionnel et étapes",
      "11. Risques, contraintes et points à valider",
    ]);
    expect(documentSections[0].value).toBe(analysis.summary);
    expect(documentSections[2].value).toContain(analysis.valueProposition);
    expect(safeExportFileName("Private project", "pdf", "CAHIER_DES_CHARGES")).toBe(
      "Private-project-cahier-des-charges.pdf",
    );

    for (const type of ["PDF", "DOCX"] as const) {
      const file = await storeProjectAnalysisExport(
        "Private project",
        analysis,
        type,
        "CAHIER_DES_CHARGES",
      );
      storedFiles.push(file.filePath);
      const bytes = await readProjectAnalysisExport(file.filePath);
      expect(file.fileName).toBe(`Private-project-cahier-des-charges.${type.toLowerCase()}`);
      expect(bytes.byteLength).toBe(file.fileSize);
      if (type === "PDF") {
        const pageObjects = bytes.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? [];
        expect(pageObjects.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
