import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export const proposalCardContract = {
    files: ["src/**/*.tsx"],
    ignores: ["src/components/participate/workspace/proposal-card.tsx"],
    rules: {
      "no-restricted-syntax": ["error", {
        selector: "JSXAttribute[name.name='className'] Literal[value=/dao-proposal-row/]",
        message: "All proposal cards must use ProposalCard. See docs/participate/proposal-card-contract.md.",
      }, {
        selector: "JSXAttribute[name.name='className'] TemplateElement[value.raw=/dao-proposal-row/]",
        message: "All proposal cards must use ProposalCard. See docs/participate/proposal-card-contract.md.",
      }, {
        selector: "ImportDeclaration[source.value=/proposal-card-heading$/]",
        message: "Use the complete ProposalCard, not a separate proposal heading.",
      }],
    },
  };

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  proposalCardContract,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Keep the pinned PDF.js distribution unchanged; publication tests verify its hashes.
    "public/monthly/pdfjs/**",
  ]),
]);

export default eslintConfig;
