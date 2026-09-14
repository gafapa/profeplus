import { expect, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";

test("edited report downloads as native Word, ODT and multipage PDF without external uploads", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const externalRequests: string[] = [];
  page.on("request", request => { if (request.url().startsWith("http") && !request.url().startsWith("http://127.0.0.1:5276")) externalRequests.push(request.url()); });
  await page.goto("/reports");
  await page.evaluate(async () => {
    const { db } = await import(/* @vite-ignore */ "/src/shared/db/database.ts");
    await db.classGroups.put({ id: "export", name: "Grupo simulado", level: "ESO", schoolYear: "2026-2027" });
    await db.aiReports.put({ id: "v", reportId: "r", classId: "export", title: "Informe simulado", text: "Revisión inicial", context: "Grupo simulado · 2026-2027", provider: "ollama", model: "simulated", createdAt: "2026-09-08T12:00:00Z" });
  });
  await page.reload();
  await page.locator(".group-context-selector select").selectOption("export");
  await page.getByRole("button", { name: /^Informe simulado ·/ }).click();
  const body = "Lucía, Íñigo e Antón: evolución positiva. Texto <script> & contido editable.\n".repeat(50) + "FIN DO INFORME";
  await page.getByLabel("Contenido del informe", { exact: true }).fill(body);
  for (const [label, extension] of [["Word", "docx"], ["ODT", "odt"], ["PDF", "pdf"]]) {
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: `Descargar ${label}`, exact: true }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${extension}$`));
    await download.saveAs(testInfo.outputPath(`report.${extension}`));
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    if (extension === "pdf") {
      expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
    } else {
      const files = unzipSync(bytes);
      const xml = strFromU8(files[extension === "docx" ? "word/document.xml" : "content.xml"]);
      expect(xml).toContain("Lucía, Íñigo e Antón");
      expect(xml).toContain("FIN DO INFORME");
      expect(xml).not.toContain("<script>");
    }
  }
  expect(externalRequests).toEqual([]);
  await expect(page.getByLabel("Contenido del informe", { exact: true })).toHaveValue(body);
  expect(await page.evaluate(async () => (await import(/* @vite-ignore */ "/src/shared/db/database.ts")).db.aiReports.count())).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Descargar PDF", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("export-mobile.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
