# Findings

Observations from the automated audit of <https://www.houserx.com>, first recorded 2026-10-16.
Each ID is referenced in [data/known-issues.ts](data/known-issues.ts) and shown on the matching test in the
[HTML report](https://janagrit.github.io/houserx-site-audit/), which has the element-level detail.

**Severity:** High = affects users or compliance (WCAG 2.2 AA). Medium = affects search visibility or usability.
Low = polish.

| ID | Sev. | Pages | Observed | Suggested fix |
|----|------|-------|----------|---------------|
| HRX-001 | High | Home | The Optum & Shields white paper link points to `info.shieldshealthsolutions.com`, which no longer resolves. | Host the PDF on the site or update the link. |
| HRX-002 | High | All | `<html>` has no `lang` attribute. Screen readers cannot choose the right pronunciation. | Webflow → Site settings → Localization: set the primary locale to English (`en`). |
| HRX-003 | High | All | Footer logo and LinkedIn, X, Instagram, Facebook icons are links with no accessible name. | Add alt text to the icons, or an `aria-label` such as "House Rx on LinkedIn". |
| HRX-004 | Medium | Home, Technology, Careers, Patient Stories, Testimonials, Marin case study | Some text is below the 4.5:1 contrast ratio, as low as 1.78:1 (`#c1b9a7` on `#f7f5ec`). | Darken the muted text colour in the style guide. |
| HRX-005 | High | Contact | The company-type `<select>` has no label or accessible name. | Add a `<label>` or `aria-label`. |
| HRX-006 | Medium | Patient Stories | Embedded video iframe has no `title`. | Add a descriptive `title` to the embed. |
| HRX-007 | Medium | Home (3), Technology (2), Careers (2), Blog (0) | Number of `<h1>` elements differs from one. | Keep one `<h1>` per page; set other headings to `<h2>` in Webflow. |
| HRX-008 | Medium | Contact, Patient Stories, Marin case study | No meta description. | Add one in page settings (70–160 characters). |
| HRX-009 | Low | Home (294), About (360), Technology (256), Testimonials (194) | Meta description is over 160 characters and gets truncated in search results. | Shorten to 160 characters or fewer. |
| HRX-010 | Medium | All except About | No `<link rel="canonical">`. | Webflow → SEO settings: set the global canonical URL to `https://www.houserx.com`. |
| HRX-011 | Low | All | No JSON-LD structured data. | Add an `Organization` block site-wide in custom code. |
| HRX-012 | Low | Contact, Patient Stories, Marin case study | Open Graph description and/or image not set, so shared links preview without them. | Fill in the Open Graph fields in page settings. |
| HRX-013 | Low | Testimonials | `<title>` is 67 characters; search results show about 60–65. | Shorten the page title. |
| HRX-014 | Low | Patient Stories | The scroll-down arrow is a link to `#` with no label. | Link it to the section it scrolls to and add an `aria-label`. |
| HRX-015 | Medium | Contact | "Phone Number" and "Where did you hear about us?" are required but their labels have no `*`, unlike the other required fields. | Add `*` to both labels, or make the fields optional. |

## Lifecycle

1. A new failing check is reviewed by hand before it is recorded here, so test artefacts are not reported as site issues.
2. It gets the next `HRX-` ID here and an entry in `data/known-issues.ts`. CI stays green.
3. When the site changes and the check passes, the test turns red. Remove the entry from both files.
