import type { Locator, Page } from '@playwright/test';

export type NavItem = 'About Us' | 'Technology' | 'Careers' | 'News & Blog' | 'Contact';

export class SiteHeader {
  /** Webflow navbar menu. On mobile it moves into `.w-nav-overlay` once the menu button is pressed. */
  readonly menu: Locator;
  readonly menuButton: Locator;
  readonly mobileOverlay: Locator;
  readonly logo: Locator;

  constructor(private readonly page: Page) {
    this.logo = page.locator('.nav_component a[href="/"]').first();
    this.menu = page.locator('.nav_component .w-nav-menu');
    this.menuButton = page.locator('.nav_component .w-nav-button');
    this.mobileOverlay = page.locator('.w-nav-overlay');
  }

  link(item: NavItem): Locator {
    return this.menu.getByRole('link', { name: item, exact: true }).first();
  }

  /** Clicks a menu link and waits until the browser lands on its target, from any starting page. */
  async navigateTo(item: NavItem): Promise<void> {
    const link = this.link(item);
    const href = await link.getAttribute('href');
    if (!href) {
      throw new Error(`Nav link "${item}" has no href`);
    }
    const target = new URL(href, this.page.url()).pathname;
    await Promise.all([this.page.waitForURL((url) => url.pathname === target), link.click()]);
  }

  async goHome(): Promise<void> {
    await Promise.all([this.page.waitForURL((url) => url.pathname === '/'), this.logo.click()]);
  }

  async openMobileMenu(): Promise<void> {
    await this.menuButton.click();
  }
}
