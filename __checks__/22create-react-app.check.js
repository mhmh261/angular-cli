/**
 * To learn more about Playwright Test visit:
 * https://www.checklyhq.com/docs/browser-checks/playwright-test/
 * https://playwright.dev/docs/writing-tests
 */

const { expect, test } = require("@playwright/test")

test("wait for a new page to load and screenshot it", async ({ page }) => {
  // Change checklyhq.com to your site's URL,
  // or, even better, define a ENVIRONMENT_URL environment variable
  // to reuse it across your browser checks
  await page.goto(process.env.ENVIRONMENT_URL || "https://www.checklyhq.com/")

  // Locate the Pricing link
  const pricingLink = page.locator("nav >> text='Pricing'")

  // Attach an event listener to wait for a page navigation
  // and click the link
  await Promise.all([page.waitForNavigation(), pricingLink.click()])

  // Test that you're on the correct page
  await expect(page).toHaveURL(/pricing/)

  // Take a screenshot of the current page
  await page.screenshot({ path: "screenshot.jpg" })
})
