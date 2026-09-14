import { expect, type Page } from "@playwright/test";

export const MOODLE_TEST_SERVER = "https://centros.edu.xunta.gal/iesmontevila/aulavirtual/";

/** The access fields (token / user+password) appear inline once the server URL is valid. */
export async function openMoodleAccess(page: Page): Promise<void> {
  await expect(page.getByRole("combobox", { name: "Forma de acceso", exact: true })).toBeVisible();
}

export async function connectMoodleToken(page: Page, token: string): Promise<void> {
  // .fill() auto-waits for the field (absorbs the lazy-loaded route's initial render).
  await page.getByLabel("Dirección HTTPS", { exact: true }).fill(MOODLE_TEST_SERVER);
  await openMoodleAccess(page);
  await page.getByRole("combobox", { name: "Forma de acceso", exact: true }).selectOption("token");
  await page.getByLabel("Token del servicio web", { exact: true }).fill(token);
  await page.getByRole("button", { name: "Conectar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Desconectar", exact: true })).toBeVisible();
}

/** From the "Elegir clase" step: pick a Moodle course and wait for the snapshot to load. */
export async function selectMoodleCourse(page: Page, courseValue: string): Promise<void> {
  await page.getByRole("combobox", { name: "Curso Moodle", exact: true }).selectOption(courseValue);
  await expect(page.getByRole("combobox", { name: "Grupo de Edunoza", exact: true })).toBeVisible();
}
