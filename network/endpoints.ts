import type { Request } from '@playwright/test';

// Webflow posts every native form to its own API, keyed by site ID.
export const WEBFLOW_FORM = 'https://webflow.com/api/v1/form/**';

/** Every endpoint that changes state on the live site. Tests intercept these instead of hitting production. */
export const WRITE_ENDPOINTS: readonly string[] = [WEBFLOW_FORM, '**/.wf_auth/**'];

/**
 * Analytics and ad pixels loaded by the site. Test traffic would inflate House Rx's visitor counts
 * and retargeting audiences, so these are aborted outright, GETs included.
 */
export const TRACKER_HOSTS: readonly string[] = [
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'googleadservices.com',
  'connect.facebook.net',
  'facebook.com',
  'snap.licdn.com',
  'px.ads.linkedin.com',
];

export function isTracker({ hostname, pathname }: URL): boolean {
  // google.com hosts both reCAPTCHA (needed by the forms) and ad/analytics collectors.
  if (hostname === 'www.google.com') {
    return /^\/(ccm|g|rmkt|pagead)\//.test(pathname);
  }
  return TRACKER_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

export function formFields(request: Request): Record<string, string> {
  const json = request.postDataJSON() as { fields?: Record<string, string> } | null;
  return json?.fields ?? {};
}
