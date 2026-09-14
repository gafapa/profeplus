import { expect, type Page } from "@playwright/test";

export const MOODLE_TEST_SERVER = "https://centros.edu.xunta.gal/iesmontevila/aulavirtual/";

export async function openMoodleAccess(page: Page): Promise<void> {
  await page.getByRole("navigation", { name: "Pasos para conectar Moodle" }).getByRole("button", { name: "Acceso Token o inicio de sesión", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Forma de acceso", exact: true })).toBeVisible();
}

export async function goToMoodleConfiguration(page: Page): Promise<void> {
  await page.getByRole("navigation", { name: "Apartados de Moodle" }).getByRole("link", { name: "Configuración", exact: true }).click();
}

export async function connectMoodleToken(page: Page, token: string): Promise<void> {
  await goToMoodleConfiguration(page);
  const serverField = page.getByLabel("Dirección HTTPS", { exact: true });
  if (await serverField.isVisible()) await serverField.fill(MOODLE_TEST_SERVER);
  await openMoodleAccess(page);
  await page.getByRole("combobox", { name: "Forma de acceso", exact: true }).selectOption("token");
  await page.getByLabel("Token del servicio web", { exact: true }).fill(token);
  await page.getByRole("button", { name: "Conectar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Desconectar", exact: true })).toBeVisible();
}
