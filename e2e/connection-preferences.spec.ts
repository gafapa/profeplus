import { expect, test } from "@playwright/test";

test("server fields start empty and remember only non-secret preferences", async ({ page }) => {
  await page.goto("/config/nextcloud");
  await expect(page.getByLabel("Servidor Nextcloud", { exact: true })).toHaveValue("");
  await page.getByLabel("Servidor Nextcloud", { exact: true }).fill("https://cloud.example.invalid/school");
  await page.getByLabel("Usuario de Nextcloud", { exact: true }).fill("privateLoginName");
  await page.getByLabel("Contraseña de aplicación de Nextcloud", { exact: true }).fill("privatePassword");
  await page.reload();
  await expect(page.getByLabel("Servidor Nextcloud", { exact: true })).toHaveValue("https://cloud.example.invalid/school");
  await expect(page.getByLabel("Usuario de Nextcloud", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Contraseña de aplicación de Nextcloud", { exact: true })).toHaveValue("");
  await page.goto("/config/moodle");
  await expect(page.getByLabel("Dirección HTTPS", { exact: true })).toHaveValue("");
  await page.getByLabel("Dirección HTTPS", { exact: true }).fill("https://moodle.example.invalid/school");
  await page.reload();
  await expect(page.getByLabel("Dirección HTTPS", { exact: true })).toHaveValue("https://moodle.example.invalid/school");
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  expect(stored).not.toContain("privateLoginName");
  expect(stored).not.toContain("privatePassword");
});

test("previously saved Moodle connections survive removal of the default site", async ({ page }) => {
  await page.goto("/config/moodle");
  await expect(page.getByLabel("Dirección HTTPS", { exact: true })).toHaveValue("");
  await page.evaluate(async () => {
    const { saveConnection } = await import(/* @vite-ignore */ "/src/shared/moodle/service.ts");
    await saveConnection({ siteUrl: "https://previous.example.invalid/aula", siteName: "Previous school", userId: 9, fullName: "Display name", functions: [] });
    localStorage.removeItem("edunoza.connection.moodle.server");
  });
  await page.addInitScript(() => localStorage.removeItem("edunoza.connection.moodle.server"));
  await page.reload();
  await expect(page.getByLabel("Dirección HTTPS", { exact: true })).toHaveValue("https://previous.example.invalid/aula");
  await expect(page.getByText("Previous school", { exact: true })).toBeVisible();
});
