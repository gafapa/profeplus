import { expect, test } from "@playwright/test";
import { installMoodleFixture } from "./moodle-fixture";
import { openMoodleAccess } from "./moodle-workflow-helpers";

test("password login remembers only its token and not login credentials", async ({ page }) => {
  await installMoodleFixture(page);
  await page.goto("/config/moodle");
  await expect(page.getByLabel("Dirección HTTPS", { exact: true })).toHaveValue("");
  await page.getByLabel("Dirección HTTPS", { exact: true }).fill("https://centros.edu.xunta.gal/iesmontevila/aulavirtual/");
  await openMoodleAccess(page);
  await page.getByLabel("Forma de acceso").selectOption("password");
  await page.getByLabel("Usuario de Moodle", { exact: true }).fill("syntheticTeacher");
  await page.getByLabel("Contraseña de Moodle", { exact: true }).fill("syntheticSecret123");
  await page.getByRole("button", { name: "Obtener token y conectar" }).click();
  await expect(page.getByRole("button", { name: "Desconectar", exact: true })).toBeVisible();
  const evidence = await page.evaluate(async () => {
    const { db } = await import(/* @vite-ignore */ "/src/shared/db/database.ts");
    const calls = (window as unknown as { moodleFixture: { calls: { url: string; body: string }[] } }).moodleFixture.calls;
    return { stored: JSON.stringify([await Promise.all(db.tables.map((table) => table.toArray())), { ...localStorage }, { ...sessionStorage }]), calls };
  });
  for (const secret of ["syntheticSecret123", "syntheticTeacher", "syntheticPrivateToken"]) expect(evidence.stored).not.toContain(secret);
  expect(evidence.stored).toContain("syntheticLoginToken123");
  expect(evidence.calls.filter((call) => call.url.endsWith("/login/token.php"))).toHaveLength(1);
  for (const call of evidence.calls) {
    expect(call.url).not.toContain("syntheticSecret");
    if (!call.url.endsWith("/login/token.php")) expect(call.body).not.toContain("syntheticSecret");
  }
  await page.getByRole("button", { name: "Desconectar", exact: true }).click();
  await page.reload();
  await openMoodleAccess(page);
  await expect(page.getByLabel("Token del servicio web", { exact: true })).toHaveValue("syntheticLoginToken123");
  await page.getByLabel("Forma de acceso").selectOption("password");
  await expect(page.getByLabel("Usuario de Moodle", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Contraseña de Moodle", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Borrar token guardado", exact: true }).click();
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain("syntheticLoginToken123");
});

test("cancelled token requests clear passwords and allow manual-token fallback", async ({ page }) => {
  await installMoodleFixture(page);
  await page.goto("/config/moodle");
  await page.getByLabel("Dirección HTTPS", { exact: true }).fill("https://centros.edu.xunta.gal/iesmontevila/aulavirtual/");
  await openMoodleAccess(page);
  await page.evaluate(() => { (window as unknown as { moodleFixture: { pending: boolean } }).moodleFixture.pending = true; });
  await page.getByLabel("Forma de acceso").selectOption("password");
  await page.getByLabel("Usuario de Moodle", { exact: true }).fill("syntheticTeacher");
  await page.getByLabel("Contraseña de Moodle", { exact: true }).fill("syntheticSecret123");
  await page.getByRole("button", { name: "Obtener token y conectar" }).click();
  await expect(page.getByLabel("Contraseña de Moodle", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByLabel("Forma de acceso").selectOption("token");
  await expect(page.getByLabel("Token del servicio web", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Desconectar", exact: true })).toHaveCount(0);
});
