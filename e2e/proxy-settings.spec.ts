import { expect, test } from "@playwright/test";

for (const width of [390, 1440]) {
  test(`central Proxy help detects, retries and fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => {
      const fixture = { available: false, requests: [] as string[] };
      Object.assign(window, { proxySettingsTest: fixture });
      window.addEventListener("message", (event) => {
        if (event.data?.source !== "edunoza-web") return;
        fixture.requests.push(event.data.type);
        if (fixture.available && event.data.type === "bridge-ping") {
          window.postMessage({ source: "proxy-extension", protocol: "proxy-extension-bridge", version: 1, type: "bridge-available", extensionVersion: "0.2.7" }, location.origin);
        }
      });
    });
    await page.goto("/config/proxy");
    await expect(page.getByRole("heading", { name: "Extensión Proxy", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Secciones de configuración" }).getByRole("link", { name: "Extensión Proxy" })).toHaveAttribute("aria-current", "page");
    await page.getByRole("button", { name: "Comprobar extensión", exact: true }).click();
    await expect(page.getByRole("button", { name: "Comprobando…", exact: true })).toBeDisabled();
    await expect(page.getByText(/^No se detecta Proxy\./)).toBeVisible();
    await page.evaluate(() => { (window as unknown as { proxySettingsTest: { available: boolean } }).proxySettingsTest.available = true; });
    await page.getByRole("button", { name: "Comprobar extensión", exact: true }).click();
    await expect(page.getByText(/^Extensión Proxy detectada\./)).toContainText("no comprueba los permisos");
    expect(await page.evaluate(() => (window as unknown as { proxySettingsTest: { requests: string[] } }).proxySettingsTest.requests)).toEqual(["bridge-ping", "bridge-ping"]);
    await expect(page.getByRole("link", { name: "Descargar Proxy (se abre en otra pestaña)" })).toHaveAttribute("href", "https://proxy.gallego.top/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: `.impeccable/review/proxy-${width}.png`, fullPage: true });
    await page.locator("main").getByRole("link", { name: "Moodle", exact: true }).last().click();
    await page.getByRole("link", { name: "Comprobar e instalar la extensión", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Extensión Proxy", exact: true })).toBeVisible();
  });
}

test("Ollama links to central extension help instead of duplicating installation", async ({ page }) => {
  await page.goto("/config/ai");
  await page.getByRole("combobox", { name: "Proveedor", exact: true }).selectOption("ollama");
  const details = page.locator(".ai-ollama-help");
  await details.evaluate((element) => { (element as HTMLDetailsElement).open = true; });
  await expect(details.getByRole("link", { name: "Comprobar e instalar la extensión", exact: true })).toHaveAttribute("href", "/config/proxy");
  await expect(details.locator('a[href="https://proxy.gallego.top/"]')).toHaveCount(0);
});
