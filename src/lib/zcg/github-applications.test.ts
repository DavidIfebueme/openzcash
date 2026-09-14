import { describe, expect, it } from "vitest";
import { projectSummaryFromBody, requestedAmountFromBody } from "./github-applications-parse";

const clean = `### Requested Grant Amount (USD)

$477,658

### Hardware/Software Costs (USD)

$6,000`;

const blankRequestedWithTotal = `### Requested Grant Amount (USD)

Light wallets need compact blocks to synchronize with the chain. This is prose,
not a number, so the requested field is effectively empty.

### Hardware/Software Costs (USD)

### Total Budget (USD)

50000

### Startup Funding (USD)`;

const proseEverywhere = `### Requested Grant Amount (USD)

Rozo Merchant POS brings Zcash into brick-and-mortar payments.

### Total Budget (USD)

Some qualitative description with no standalone figure line here $30k inline.`;

// Hand-written re-applications (filed outside the issue form) use "##"
// headers instead of the form's "###" — real case: issue #341 (KeepKey).
const h2Headers = `## Applicant Background

We are reapplying based on community feedback.

## Requested Grant Amount (USD)

$135,000

## Category

Wallets

## Compensation Costs (USD)

$135,000`;

// A blank "##" field must not leak an amount from a LATER "##" section.
const h2BlankRequested = `## Requested Grant Amount (USD)

## Category

Wallets

## Compensation Costs (USD)

$99,000`;

// Applicants sometimes write the currency out — real case: issue #355
// (TensorZKP) filled the form field with "US$64,430".
const usPrefixed = `### Requested Grant Amount (USD)

US$64,430

### Hardware/Software Costs (USD)

US$1,750`;

const usdSuffixed = `### Requested Grant Amount (USD)

64,430 USD

### Category`;

describe("requestedAmountFromBody", () => {
  it("parses a clean dollar amount", () => {
    expect(requestedAmountFromBody(clean)).toBe(477658);
  });

  it("parses a 'US$'-prefixed amount (issue #355)", () => {
    expect(requestedAmountFromBody(usPrefixed)).toBe(64430);
  });

  it("parses a 'USD'-suffixed amount", () => {
    expect(requestedAmountFromBody(usdSuffixed)).toBe(64430);
  });

  it("falls back to Total Budget when Requested is prose/blank", () => {
    expect(requestedAmountFromBody(blankRequestedWithTotal)).toBe(50000);
  });

  it("returns null when no standalone amount line exists", () => {
    expect(requestedAmountFromBody(proseEverywhere)).toBeNull();
  });

  it("returns null for empty/undefined bodies", () => {
    expect(requestedAmountFromBody(undefined)).toBeNull();
    expect(requestedAmountFromBody("")).toBeNull();
  });

  it("parses '##' headers from hand-written re-applications (issue #341)", () => {
    expect(requestedAmountFromBody(h2Headers)).toBe(135000);
  });

  it("does not leak an amount from a later '##' section", () => {
    expect(requestedAmountFromBody(h2BlankRequested)).toBeNull();
  });
});

describe("projectSummaryFromBody", () => {
  it("uses the applicant's summary without taking text from adjacent fields", () => {
    expect(projectSummaryFromBody(`### Project Lead
Private contact details
### Project Summary
Build **open-source** tools for [Zcash](https://z.cash) using \`zcash_client_sqlite\`.
### Project Description
The full application continues here.`)).toBe(
      "Build open-source tools for Zcash using zcash_client_sqlite.",
    );
  });

  it("supports hand-written headings, lists, and Windows line endings", () => {
    expect(projectSummaryFromBody("## Project Summary\r\n\r\n- Wallet tools.\r\n- Community education.\r\n## Budget\r\n$5,000"))
      .toBe("Wallet tools. Community education.");
  });

  it("falls back to the project description when the summary is blank", () => {
    expect(projectSummaryFromBody("### Project Summary\n_No response_\n### Project Description\nA privacy education project."))
      .toBe("A privacy education project.");
  });

  it("returns null when neither field contains a summary", () => {
    for (const body of [undefined, null, "", "### Project Lead\nApplicant bio", "### Project Summary\n_No response_\n### Total Budget (USD)\n5000"]) {
      expect(projectSummaryFromBody(body)).toBeNull();
    }
  });

  it("removes comments, images and HTML formatting from the excerpt", () => {
    expect(projectSummaryFromBody("### Project Summary\n<!-- form instructions -->\n<b>Wallet tooling.</b> ![logo](https://example.org/logo.png)"))
      .toBe("Wallet tooling.");
  });

  it("keeps long summaries brief without cutting a word in half", () => {
    const summary = projectSummaryFromBody(`### Project Summary\n${"Community wallet infrastructure. ".repeat(40)}`);
    expect(summary?.length).toBeLessThanOrEqual(480);
    expect(summary).toMatch(/(?:Community|wallet|infrastructure\.)…$/);
  });
});
