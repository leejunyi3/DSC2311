import { test, expect } from "@playwright/test";

// §29 end-to-end flows, all in Demo Mode (no API keys).

test("loads the dashboard in Demo Mode with all six KPI cards", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("Overall Resilience Risk")).toBeVisible();
  await expect(page.getByText("Estimated Tuas Congestion")).toBeVisible();
  await expect(page.getByText("Weather Risk")).toBeVisible();
  await expect(page.getByText("Marine Conditions")).toBeVisible();
  await expect(page.getByText("Active Disruptions")).toBeVisible();
  await expect(page.getByText("Data Confidence")).toBeVisible();
  // Demo environment connectivity + required disclaimer shown.
  await expect(page.getByText("Demo Environment")).toBeVisible();
  await expect(
    page.getByText("not official PSA berth occupancy", { exact: false }).first(),
  ).toBeVisible();
});

test("switching scenarios updates the shared dataset", async ({ page }) => {
  await page.goto("/dashboard");
  const selector = page.getByLabel("Demo scenario");
  await selector.selectOption("normal-operations");
  await expect(page.getByText("Normal Operations").first()).toBeVisible();
  await selector.selectOption("pharmaceutical-crisis");
  await expect(page.getByText("Pharmaceutical Crisis").first()).toBeVisible();
});

test("runs the simulator and shows a recommendation with human approval", async ({ page }) => {
  await page.goto("/simulator");
  await page.getByRole("button", { name: /run simulation/i }).click();
  await expect(page.getByText("Recommended response")).toBeVisible();
  await expect(
    page.getByText("Human review and authorisation required", { exact: false }),
  ).toBeVisible();
});

test("opens the assistant and streams a grounded answer", async ({ page }) => {
  await page.goto("/assistant");
  await page.getByRole("button", { name: /driving the current risk score/i }).click();
  // Offline deterministic summary (no key) is clearly labelled and grounded.
  await expect(page.getByText("Current Situation").first()).toBeVisible({ timeout: 20_000 });
});

test("diagnostics shows source labels and handles unavailable sources", async ({ page }) => {
  await page.goto("/diagnostics");
  await expect(page.getByText("Data Diagnostics")).toBeVisible();
  await expect(page.getByText("Singapore weather", { exact: false }).first()).toBeVisible();
  // Claude API row reflects the missing key honestly.
  await expect(page.getByText("Assistant disabled", { exact: false })).toBeVisible();
});
