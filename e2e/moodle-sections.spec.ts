import { expect, test } from "@playwright/test";
import { installMoodleFixture, seedMoodleLocalRecords } from "./moodle-fixture";
import { openMoodleAccess } from "./moodle-workflow-helpers";

for (const width of [390, 1440]) {
  test(`Moodle sections preserve connection and mapping drafts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await installMoodleFixture(page);
    await page.goto("/config/moodle");
    await seedMoodleLocalRecords(page);
    await page.reload();
    const navigation = page.getByRole("navigation", { name: "Apartados de Moodle" });
    const configLink = navigation.getByRole("link", { name: "Configuración", exact: true });
    const dataLink = navigation.getByRole("link", { name: "Conexión entre datos", exact: true });
    await expect(configLink).toHaveAttribute("aria-current", "page");
    await dataLink.click();
    await expect(page.getByRole("link", { name: "Ir a configuración de Moodle" })).toBeVisible();
    await expect(page.getByLabel("Dirección HTTPS", { exact: true })).toBeHidden();
    await page.getByRole("link", { name: "Ir a configuración de Moodle" }).click();
    await page.getByLabel("Dirección HTTPS", { exact: true }).fill("https://centros.edu.xunta.gal/iesmontevila/aulavirtual/");
    await openMoodleAccess(page);
    await page.getByLabel("Token del servicio web", { exact: true }).fill("syntheticToken123");
    await page.getByRole("button", { name: "Conectar", exact: true }).click();
    await expect(page.getByRole("link", { name: "Ir a conexión entre datos" })).toBeVisible();
    await page.screenshot({ path: `.impeccable/review/moodle-config-${width}.png`, fullPage: true });
    await dataLink.click();
    await page.getByRole("combobox", { name: "Curso Moodle", exact: true }).selectOption("4");
    await page.getByRole("button", { name: "Cargar curso", exact: true }).click();
    await page.getByRole("combobox", { name: "Grupo de Edunoza", exact: true }).selectOption("moodle-local-class");
    await page.getByRole("combobox", { name: "Materia de Edunoza", exact: true }).selectOption("moodle-local-subject");
    await page.getByRole("button", { name: "Continuar a asociaciones", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Curso Moodle", exact: true })).toBeHidden();
    await expect(page.getByRole("button", { name: "Revisar notas entrantes", exact: true })).toBeHidden();
    await expect(page.getByRole("button", { name: "Revisar cambios", exact: true })).toBeHidden();
    await page.getByRole("combobox", { name: "Decisión para Moodle Pupil", exact: true }).selectOption("link");
    await page.getByRole("combobox", { name: "Registro local para Moodle Pupil", exact: true }).selectOption("moodle-local-student");
    await page.getByRole("button", { name: "Preparar vista previa", exact: true }).click();
    await expect(page.getByRole("region", { name: "Vista previa de asociaciones" })).toBeVisible();
    await configLink.click();
    await expect(page.getByRole("combobox", { name: "Curso Moodle", exact: true })).toBeHidden();
    await page.goBack();
    await expect(dataLink).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("combobox", { name: "Registro local para Moodle Pupil", exact: true })).toHaveValue("moodle-local-student");
    await expect(page.getByRole("region", { name: "Vista previa de asociaciones" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Desconectar", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: `.impeccable/review/moodle-data-${width}.png`, fullPage: true });
  });
}
