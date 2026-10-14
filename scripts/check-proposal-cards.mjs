import { ESLint } from "eslint";
import parser from "@typescript-eslint/parser";
import { proposalCardContract } from "../eslint.config.mjs";

// Run the shared-card architecture rule on every TSX file before publication,
// independently of unrelated lint debt in other areas of the application.
const eslint = new ESLint({ allowInlineConfig: false, overrideConfigFile: true, overrideConfig: [
  { ...proposalCardContract, languageOptions: { parser } },
] });
const results = await eslint.lintFiles(["src/**/*.tsx"]);
const formatter = await eslint.loadFormatter("stylish");
const output = formatter.format(results);
if (output) process.stdout.write(output);
if (results.some(result => result.errorCount > 0)) process.exitCode = 1;
else console.log("Proposal card contract passed for all TSX surfaces.");
