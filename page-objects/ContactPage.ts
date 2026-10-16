import type { Locator, Page, Response } from '@playwright/test';
import { BasePage } from './BasePage';

export interface Inquiry {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly company?: string;
  readonly phone: string;
  readonly heardAbout: string;
  readonly comments: string;
}

export class ContactPage extends BasePage {
  readonly form: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly emailInput: Locator;
  readonly companyInput: Locator;
  readonly phoneInput: Locator;
  readonly heardAboutInput: Locator;
  readonly commentsInput: Locator;
  readonly companyTypeOptions: Locator;
  readonly recaptcha: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.form = page.locator('form#email-form');
    this.firstNameInput = this.form.locator('#First-Name');
    this.lastNameInput = this.form.locator('#Last-Name');
    this.emailInput = this.form.locator('#email');
    this.companyInput = this.form.locator('#Company-Name');
    this.phoneInput = this.form.locator('#Phone');
    this.heardAboutInput = this.form.locator('#Where-did-you-hear-about-us');
    this.commentsInput = this.form.locator('#Comments');
    this.companyTypeOptions = this.form.locator('input[type="radio"][name="Company-Type"]');
    this.recaptcha = this.form.locator('.g-recaptcha');
    this.submitButton = this.form.locator('input[type="submit"]');
  }

  async open(): Promise<Response | null> {
    return super.open('/contact');
  }

  async fill(inquiry: Inquiry): Promise<void> {
    await this.firstNameInput.fill(inquiry.firstName);
    await this.lastNameInput.fill(inquiry.lastName);
    await this.emailInput.fill(inquiry.email);
    await this.companyInput.fill(inquiry.company ?? '');
    await this.phoneInput.fill(inquiry.phone);
    await this.heardAboutInput.fill(inquiry.heardAbout);
    await this.commentsInput.fill(inquiry.comments);
  }
}
