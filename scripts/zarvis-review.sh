#!/usr/bin/env bash
# Weekly Zarvis review for the maintainer: what visitors asked (topic labels only), how answers went, what they cost and what feedback said.
# Reads the deploy log and the daily tables through the Railway CLI from the linked checkout; prints nothing but counts, labels and money.
# Usage: scripts/zarvis-review.sh [days]   (default 7). Needs `railway` logged in and linked to the project; set ZARVIS_SERVICE to the service name.
set -euo pipefail
days="${1:-7}"
service="${ZARVIS_SERVICE:?Set ZARVIS_SERVICE to the Railway service name}"
since="$(date -u -v-"${days}"d +%Y-%m-%d 2>/dev/null || date -u -d "${days} days ago" +%Y-%m-%d)"
here="$(cd "$(dirname "$0")" && pwd)"
echo "== Zarvis review: last ${days} days (since ${since} UTC) =="
echo
echo "-- Subjects and languages (zarvis_topic_daily, labels only) --"
railway ssh -s "$service" -- node -e "
const sql = require('postgres')(process.env.DATABASE_URL, { ssl: false });
(async () => {
  const rows = await sql\`select topic, route, lang, sum(count)::int as count from zarvis_topic_daily where day >= \${'${since}'} group by topic, route, lang order by count desc\`;
  const total = rows.reduce((n, r) => n + r.count, 0);
  const byTopic = new Map();
  for (const r of rows) { const t = byTopic.get(r.topic) ?? { count: 0, model: 0 }; t.count += r.count; if (r.route === 'model') t.model += r.count; byTopic.set(r.topic, t); }
  for (const [topic, t] of [...byTopic].sort((a, b) => b[1].count - a[1].count)) console.log(topic.padEnd(20), String(t.count).padStart(5), (100 * t.count / total).toFixed(0).padStart(3) + '%', 'model ' + (100 * t.model / t.count).toFixed(0) + '%');
  const byLang = new Map(); for (const r of rows) byLang.set(r.lang, (byLang.get(r.lang) ?? 0) + r.count);
  console.log('languages:', [...byLang].sort((a, b) => b[1] - a[1]).map(([l, n]) => l + ' ' + n).join(', ') || 'none', '| total', total);
  await sql.end();
})().catch((e) => { console.error('db unavailable:', e.message); process.exit(1); });
" 2>/dev/null | grep -v "^warning\|Migrate:\|Existing files" || echo "(database unavailable)"
echo
echo "-- Daily outcomes, cost and votes (zarvis_metrics_daily) --"
railway ssh -s "$service" -- node -e "
const sql = require('postgres')(process.env.DATABASE_URL, { ssl: false });
(async () => {
  const rows = await sql\`select day, route, completed, failed, aborted, quota + busy + spend_cap as refused, model_calls, web_search_calls, grounding_fallbacks, helpful, unhelpful, estimated_usd from zarvis_metrics_daily where day >= \${'${since}'} order by day, route\`;
  const line = (r) => [new Date(r.day).toISOString().slice(0, 10), r.route.padEnd(5), 'done', r.completed, 'fail', r.failed, 'abort', r.aborted, 'refused', r.refused, 'calls', r.model_calls, 'search', r.web_search_calls, 'guard', r.grounding_fallbacks, 'votes +' + r.helpful + ' -' + r.unhelpful, 'usd', Number(r.estimated_usd).toFixed(2)].join(' ');
  for (const r of rows) console.log(line(r));
  const total = rows.reduce((t, r) => ({ completed: t.completed + r.completed, failed: t.failed + r.failed, usd: t.usd + Number(r.estimated_usd), helpful: t.helpful + r.helpful, unhelpful: t.unhelpful + r.unhelpful }), { completed: 0, failed: 0, usd: 0, helpful: 0, unhelpful: 0 });
  console.log('total: done', total.completed, 'fail', total.failed, 'votes +' + total.helpful + ' -' + total.unhelpful, 'usd', total.usd.toFixed(2));
  const reasons = await sql\`select reason, route, sum(count)::int as count from zarvis_feedback_reasons where day >= \${'${since}'} group by reason, route order by count desc\`;
  console.log(reasons.length ? 'needs-work reasons: ' + reasons.map((r) => r.reason + ' (' + r.route + ') ' + r.count).join(', ') : 'needs-work reasons: none');
  await sql.end();
})().catch((e) => { console.error('db unavailable:', e.message); process.exit(1); });
" 2>/dev/null | grep -v "^warning\|Migrate:\|Existing files" || echo "(database unavailable)"
echo
echo "-- Next steps --"
echo "Frequent model-route topics are candidates for direct answers (src/lib/zarvis/direct-*.ts)."
echo "Refresh the corpora: npm run knowledge:sync   (ZIPs, Monthly PDFs, ECC/ZF posts, ZecHub, forum)"
echo "Re-run the paid checks on a preview: python3 scripts/eval-zarvis-live.py --url http://127.0.0.1:PORT --confirm-paid --extended; python3 scripts/eval-zarvis-zips.py --url http://127.0.0.1:PORT --confirm-paid"
