import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NavItem } from '../page-objects/SiteHeader';

const ENV_FILE = resolve(__dirname, '..', '.env');
const PRODUCTION_URL = 'https://www.houserx.com';

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

/** Site under test: `BASE_URL` from the environment or `.env`, else production. */
function readBaseUrl(): string {
  const raw = process.env.BASE_URL?.trim() || PRODUCTION_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`BASE_URL is not a valid URL: "${raw}" (set it in .env, e.g. BASE_URL=${PRODUCTION_URL})`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`BASE_URL must be http(s), got "${raw}"`);
  }
  return url.origin;
}

export const BASE_URL = readBaseUrl();

export interface AuditPage {
  readonly name: string;
  readonly path: string;
}

// Pages under audit. Every per-page check runs against each one. Known defects live in known-issues.ts.
export const PAGES: readonly AuditPage[] = [
  { name: 'Home', path: '/' },
  { name: 'About', path: '/about' },
  { name: 'Technology', path: '/technology' },
  { name: 'Contact', path: '/contact' },
  { name: 'Careers', path: '/careers' },
  { name: 'Blog', path: '/blog' },
  { name: 'Patient Stories', path: '/patient-stories' },
  { name: 'Testimonials', path: '/testimonials' },
  { name: 'Case Study: Marin Cancer Care', path: '/marin-cancer-care' },
];

/** Header menu, in on-screen order, with the page each item must open. */
export const NAV_DESTINATIONS: ReadonlyArray<{ item: NavItem; path: RegExp }> = [
  { item: 'About Us', path: /\/about$/ },
  { item: 'Technology', path: /\/technology$/ },
  { item: 'Careers', path: /\/careers$/ },
  { item: 'News & Blog', path: /\/blog$/ },
  { item: 'Contact', path: /\/contact$/ },
];
