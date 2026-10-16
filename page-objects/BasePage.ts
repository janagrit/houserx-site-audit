import type { Page, Response } from '@playwright/test';

export class BasePage {
  constructor(protected readonly page: Page) {}

  async open(path: string): Promise<Response | null> {
    return this.page.goto(path);
  }
}
