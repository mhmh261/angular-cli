/**
 * To learn more about Playwright Test visit:
 * https://www.checklyhq.com/docs/browser-checks/playwright-test/
 * https://playwright.dev/docs/writing-tests
 */

const { test } = require("@playwright/test")

const DIMENSIONS = [
  { width: 1920, height: 1080, name: "large" },
  { width: 1000, height: 800, name: "middle" },
  { width: 600, height: 800, name: "small" },
]

test.describe("emulate different viewport sizes", () => {
  // Iterate over defined dimensions
  for (const { name, width, height } of DIMENSIONS) {
    test("take screenshot on " + name + " viewport", async ({ page }) => {
      // Change checklyhq.com to your site's URL,
      // or, even better, define a ENVIRONMENT_URL environment variable
      // to reuse it across your browser checks
      await page.setViewportSize({
        height,
        width,
      })

      await page.goto(
        process.env.ENVIRONMENT_URL || "https://www.checklyhq.com/"
      )

      await page.screenshot({
        path: `${name}.png`,
      })
    })
  }
})
