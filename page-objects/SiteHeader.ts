import type { Locator, Page } from '@playwright/test';

export type NavItem = 'About Us' | 'Technology' | 'Careers' | 'News & Blog' | 'Contact';

export class SiteHeader {
  /** Webflow navbar menu. On mobile it moves into `.w-nav-overlay` once the menu button is pressed. */
  readonly menu: Locator;
  readonly menuButton: Locator;
  readonly mobileOverlay: Locator;

  constructor(private readonly page: Page) {
    this.menu = page.locator('.nav_component .w-nav-menu');
    this.menuButton = page.locator('.nav_component .w-nav-button');
    this.mobileOverlay = page.locator('.w-nav-overlay');
  }

  link(item: NavItem): Locator {
    return this.menu.getByRole('link', { name: item, exact: true }).first();
  }

  async navigateTo(item: NavItem): Promise<void> {
    await Promise.all([this.page.waitForURL((url) => url.pathname !== '/'), this.link(item).click()]);
  }

  async openMobileMenu(): Promise<void> {
    await this.menuButton.click();
  }
}
