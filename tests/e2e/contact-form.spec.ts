import { test, expect } from '../../fixtures';
import type { Inquiry } from '../../page-objects/ContactPage';

// Both forms post to Webflow's form API, which the write guard aborts. Submit also stays disabled until
// a human solves reCAPTCHA, so these tests cover the form's structure and validation, never a real send.
const INQUIRY: Inquiry = {
  firstName: 'Playwright',
  lastName: 'Test',
  email: 'qa@example.com',
  company: 'Test Practice (automated)',
  phone: '5555550100',
  heardAbout: 'Automated site audit',
  comments: 'Automated test inquiry. Blocked by the test suite and never delivered.',
};

test.describe('E2E — Contact form', () => {
  test.beforeEach(async ({ contactPage }) => {
    await contactPage.open();
  });

  test('every field has a visible label', async ({ contactPage }) => {
    const unlabelled = await contactPage.form
      .locator('input:not([type="hidden"]):not([type="submit"]), textarea:not([name="g-recaptcha-response"])')
      .evaluateAll((fields) =>
        fields
          .filter((field) => !(field as HTMLInputElement).labels?.length)
          .map((field) => (field as HTMLInputElement).name),
      );
    expect(unlabelled).toEqual([]);
  });

  test('required fields are marked with * in their label', async ({ contactPage }) => {
    test.fail(true, 'Known site defect — FINDINGS #8');
    const unmarked = await contactPage.form.locator('[required]').evaluateAll((fields) =>
      fields
        .filter((field) => !(field as HTMLInputElement).labels?.[0]?.textContent?.includes('*'))
        .map((field) => (field as HTMLInputElement).labels?.[0]?.textContent?.trim() ?? (field as HTMLInputElement).name),
    );
    expect(unmarked, 'required but no * in label').toEqual([]);
  });

  test('offers the company-type options', async ({ contactPage }) => {
    await expect(contactPage.companyTypeOptions).not.toHaveCount(0);
  });

  test('flags an invalid email address', async ({ contactPage }) => {
    await contactPage.fill({ ...INQUIRY, email: 'not-an-email' });

    await expect(contactPage.emailInput).toHaveJSProperty('validity.typeMismatch', true);
  });

  test('keeps Submit disabled until reCAPTCHA is solved, and sends nothing', async ({ contactPage, blockedWrites }) => {
    await expect(contactPage.recaptcha).toBeAttached();

    await contactPage.fill(INQUIRY);

    await expect(contactPage.submitButton).toBeDisabled();
    expect(blockedWrites).toEqual([]);
  });

  test('shows the confirmation after a successful submit', async () => {
    test.fixme(true, 'Needs a staging copy without reCAPTCHA (or a Webflow test key) to submit and assert .w-form-done.');
  });
});

test.describe('E2E — Home lead form ("complimentary dispensing analysis")', () => {
  test('asks for name, email, phone and practice, all required', async ({ homePage }) => {
    await homePage.open();

    const fields = await homePage.leadForm.locator('input:not([type="submit"]):not([type="hidden"])').evaluateAll((inputs) =>
      inputs.map((input) => ({ name: (input as HTMLInputElement).name, required: (input as HTMLInputElement).required })),
    );
    expect(fields).toEqual(
      ['First-Name', 'Last-Name', 'Email', 'Phone', 'Practice'].map((name) => ({ name, required: true })),
    );
  });
});
