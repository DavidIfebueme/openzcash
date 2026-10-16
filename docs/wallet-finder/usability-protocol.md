# Wallet Finder: formative usability protocol

Status: prepared; **0 participants tested**. Automated tests and agent browser checks are engineering evidence, not human usability sessions. Do not describe this document as a completed study.

## Goal and sample

Recruit at least five consenting volunteers who can use a browser, including newcomers and phone users. Compare an archived wallet catalog with the capability finder. No seed phrase, address, balance, account login, personal identifier or transaction is needed. Store only pseudonymous participant IDs and anonymous notes; obtain consent before retaining or publishing notes. The task owner coordinates recruitment; this document does not authorize unsolicited outreach.

## Conditions

- A: the archived `/wallets` catalog and filters from commit `ca9137c`, served only in a separate local checkout. The live `/wallets` URL now redirects to the finder.
- B: `/wallets/find`, direct capability filters with evidence.
- Alternate condition order: P01 A→B, P02 B→A, P03 A→B, P04 B→A, P05 A→B.
- Use equivalent tasks in reversed order to reduce learning effects. Keep browser/device, source dataset revision and facilitator help consistent. Record any interruption or help given.

## Tasks

1. Find a wallet for Android to send and receive private ZEC. Explain the confirmed platform and one relevant limitation.
2. Find an iPhone wallet for private receiving with a hardware signer. Identify the required hardware/companion integration.
3. Find a desktop wallet that can send private ZEC and manage native assets on other chains. Explain why cross-chain payments alone are insufficient evidence.
4. Investigate a wallet with an unknown capability. Identify what is missing rather than treating unknown as yes or no.
5. Reach a combination with no confirmed matches, then edit one requirement. Explain why the result changed without guessing undocumented support.
6. Open an evidence source, identify its review date and version/platform scope, and return to the results without losing the selected answers.

Before the session, the facilitator checks the current dataset to define correct acceptable outcomes. Do not hard-code a wallet name as permanently correct. No task requires downloading a wallet or sending funds.

## Measurements

For each condition/task record completion, correctness against current evidence, time, whether assistance was needed, and confusion points. Correctness requires understanding required capabilities and limitations; choosing a familiar brand alone is insufficient. Ask the participant to explain the difference between supported, unsupported and unknown. Finish with a short preference question and one improvement suggestion.

Use `usability-record.csv`. Leave unrun fields empty; do not populate them with simulated results. Aggregate task outcomes and report all five sessions, mixed or negative outcomes, device mix and sample limitations. Five convenience-sample sessions are formative feedback, not statistically representative adoption evidence.

## Completion gate

Publish an anonymized report only after real sessions and consent. Link the tested code/data revision, protocol, anonymous outcomes and fixes. Record which issues remain. A reproducible implementation, a passing test suite or a prepared integration package does not close this gate by itself.
