/** Static example: no simulated requests, stale financial claims, or animation loop. */
export function Terminal() {
  return (
    <div className="ws-terminal">
      <div className="ws-terminal-head">Example research workflow</div>
      <div className="ws-terminal-body ws-terminal-example">
        <p className="ws-t-ink">
          <span className="ws-t-prompt">❯</span>
          I&apos;m building for Colosseum. Find Zcash payment projects, compare
          their grants, and suggest gaps worth investigating. Cite your sources.
        </p>
        <div className="ws-t-body">
          <p><strong className="ws-t-pos">1. Map existing work</strong><br />
            Search the grant ledger and published proposal queue.</p>
        </div>
        <div className="ws-t-body">
          <p><strong className="ws-t-accent">2. Check the evidence</strong><br />
            Separate requested, budgeted, and paid amounts. Check project dates
            and application history.</p>
        </div>
        <div className="ws-t-body">
          <p><strong className="ws-t-accent">3. Test your idea</strong><br />
            Compare overlaps and possible gaps. Treat gaps as research leads,
            with links to the underlying sources.</p>
        </div>
        <p className="ws-t-note">Illustrative workflow. Run the prompt in your agent for current findings.</p>
      </div>
    </div>
  );
}
