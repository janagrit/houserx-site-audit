import type { Locator, Page, Response } from '@playwright/test';
import { BasePage } from './BasePage';

export class HomePage extends BasePage {
  readonly heroHeading: Locator;
  readonly heroCta: Locator;
  readonly partnerCta: Locator;
  /** "Reach out to receive a complimentary dispensing analysis" lead form at the bottom of the page. */
  readonly leadForm: Locator;

  constructor(page: Page) {
    super(page);
    this.heroHeading = page.getByRole('heading', { level: 1, name: /specialty pharmacy experience/i });
    this.heroCta = page.getByRole('link', { name: 'Learn more', exact: true }).first();
    this.partnerCta = page.getByRole('link', { name: 'Partner With Us' }).first();
    this.leadForm = page.locator('form#wf-form-Case-Study-Form');
  }

  async open(): Promise<Response | null> {
    return super.open('/');
  }
}
