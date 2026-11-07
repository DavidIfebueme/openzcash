import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import time
import unittest

MODULE = Path(__file__).resolve().parents[2] / 'deploy/participate-monitor.py'
sys.path.insert(0, str(MODULE.parent))
spec = importlib.util.spec_from_file_location('participate_monitor', MODULE)
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)
CONFIG = {'from': 'OpenZcash <support@openzcash.org>', 'to': 'support@openzcash.org', 'resendApiKey': 'test-key'}
NOW = 1791676800


class MonitorTest(unittest.TestCase):
    def test_backup_from_old_database_is_not_accepted_after_cutover(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'daily-20261011T010000Z.dump'
            data = b'fixture data' * 200
            path.write_bytes(data)
            path.with_suffix('.sha256').write_text(hashlib.sha256(data).hexdigest())
            current = {'databaseSource': 'railway-remote', 'databaseIdentity': 'new-database'}
            self.assertFalse(monitor.backup_is_current(Path(directory), time.time(), False, current))
            path.with_suffix('.source.json').write_text(json.dumps({'databaseSource': 'vps-local', 'databaseIdentity': 'vps-local:participate'}))
            self.assertFalse(monitor.backup_is_current(Path(directory), time.time(), False, current))
            path.with_suffix('.source.json').write_text(json.dumps(current))
            self.assertTrue(monitor.backup_is_current(Path(directory), time.time(), False, current))

    def failure(self):
        state = {}
        monitor.update_incidents(state, {'public_data': False}, NOW)
        monitor.update_incidents(state, {'public_data': False}, NOW + 120)
        return state

    def test_transient_failure_does_not_send(self):
        state = {}
        for healthy in [True, False, True, True]:
            monitor.update_incidents(state, {'public_data': healthy}, NOW)
        self.assertFalse(state.get('outbox'))

    def recover(self, state, key, at):
        for step in range(monitor.RECOVERY_CHECKS):
            monitor.update_incidents(state, {key: True}, at + step * 120)

    def test_failure_and_recovery_only_on_stable_transitions(self):
        state = self.failure()
        for _ in range(100):
            monitor.update_incidents(state, {'public_data': False}, NOW + 240)
        self.assertEqual(len(state['outbox']), 1)
        monitor.update_incidents(state, {}, NOW + 300)
        self.assertTrue(state['incidents']['public_data']['active'])
        for _ in range(monitor.RECOVERY_CHECKS - 1):
            monitor.update_incidents(state, {'public_data': True}, NOW + 360)
        self.assertEqual(len(state['outbox']), 1)
        monitor.update_incidents(state, {'public_data': True}, NOW + 480)
        self.assertEqual(state['outbox'][-1]['changes'], [{'key': 'public_data', 'kind': 'recovery'}])
        for _ in range(100):
            monitor.update_incidents(state, {'public_data': True}, NOW + 600)
        self.assertEqual(len(state['outbox']), 2)

    def test_flapping_probe_keeps_one_incident_open(self):
        # 11/2026: anchor_delay alternated two bad and two good checks for weeks
        # and produced 1,245 emails. A flap shorter than 30 minutes is one incident.
        state = {}
        for cycle in range(50):
            for offset, healthy in enumerate([False, False, True, True, True, True]):
                monitor.update_incidents(state, {'anchor_delay': healthy}, NOW + (cycle * 6 + offset) * 120)
        self.assertEqual(len(state['outbox']), 1)
        self.assertTrue(state['incidents']['anchor_delay']['active'])

    def test_needs_review_is_immediate_and_new_incident_has_new_key(self):
        state = {}
        monitor.update_incidents(state, {'anchor_review': False}, NOW)
        self.assertEqual(len(state['outbox']), 1)
        self.recover(state, 'anchor_review', NOW + 120)
        monitor.update_incidents(state, {'anchor_review': False}, NOW + 4000)
        self.assertEqual(len({item['id'] for item in state['outbox']}), 3)

    def test_reverification_of_anchored_jobs_is_not_an_anchor_delay(self):
        queries = []
        original_run, original_command = monitor.run, monitor.database_command
        monitor.run = lambda args, query, timeout: queries.append(query) or json.dumps({'review': 0})
        monitor.database_command = lambda *args, **kwargs: ['psql']
        try:
            monitor.database_snapshot('zcg-host')
        finally:
            monitor.run, monitor.database_command = original_run, original_command
        pending = queries[0].split("'oldestPending'")[1].split("'activityReview'")[0]
        failures = queries[0].split("'activityFailures'")[1].split("'oldestActivity'")[0]
        self.assertIn('txid IS NULL', pending)
        self.assertIn("j.state <> 'VERIFIED'", failures)

    def accepted(self, count, at):
        return [{'id': 'sent-%d' % index, 'createdAt': at, 'status': 'accepted', 'attempts': 1,
                 'nextAttemptAt': at, 'acceptedAt': at, 'changes': []} for index in range(count)]

    def test_daily_limit_suppresses_excess_alerts(self):
        state = self.failure()
        state['outbox'] = self.accepted(monitor.DAILY_EMAIL_LIMIT, NOW) + state['outbox']
        monitor.deliver(state, CONFIG, lambda x: None, NOW + 120,
                        lambda *args: self.fail('Must not send past the daily limit'))
        self.assertEqual(state['outbox'][-1]['status'], 'suppressed')
        later = self.failure()
        later['outbox'] = self.accepted(monitor.DAILY_EMAIL_LIMIT, NOW - 25 * 3600) + later['outbox']
        sent = []
        monitor.deliver(later, CONFIG, lambda x: None, NOW + 120, lambda *args: sent.append(args) or 'message-2')
        self.assertEqual(len(sent), 1)

    def test_old_delivered_alerts_are_pruned(self):
        state = {'outbox': self.accepted(3, NOW - 15 * 24 * 3600) + self.accepted(2, NOW) +
                 [{'id': 'review', 'createdAt': NOW - 40 * 24 * 3600, 'status': 'unknown_requires_review'}]}
        pruned = monitor.prune_outbox(state['outbox'], NOW)
        self.assertEqual(len(pruned), 3)
        self.assertEqual(len(state['outbox']), 6)
        self.assertIn('review', [item['id'] for item in pruned])

    def test_worker_is_not_stale_during_legitimate_long_proving(self):
        snap = {'state': {'lastRun': NOW - 25 * 60, 'lastSuccess': NOW - 25 * 60, 'failures': 0},
                'review': 0, 'oldestPending': NOW - 3600}
        self.assertTrue(all(monitor.database_checks(snap, NOW).values()))
        self.assertFalse(monitor.database_checks(snap, NOW + 20 * 60)['worker_heartbeat'])
        snap['state']['failures'] = 3
        self.assertFalse(monitor.database_checks(snap, NOW)['source_discovery'])

    def test_empty_state_and_aged_pending_are_detected(self):
        checks = monitor.database_checks({'state': None, 'review': 1, 'oldestPending': NOW - 7 * 3600, 'activityReview': 1, 'activityFailures': 1, 'oldestActivity': NOW - 7 * 3600}, NOW)
        self.assertFalse(any(checks.values()))

    def test_initial_reader_progress_is_not_a_failure(self):
        state = {}
        self.assertTrue(monitor.progressed(state, 'reader', 3400000, NOW, 2700))
        self.assertTrue(monitor.progressed(state, 'reader', 3400100, NOW + 2600, 2700))
        self.assertFalse(monitor.progressed(state, 'reader', 3400100, NOW + 5400, 2700))

    def test_retry_reuses_exact_payload_and_idempotency_key_after_crash(self):
        state = self.failure()
        persisted, requests = [], []
        def crash(key, payload, ident):
            requests.append((copy.deepcopy(payload), ident))
            raise KeyboardInterrupt()
        with self.assertRaises(KeyboardInterrupt):
            monitor.deliver(state, CONFIG, lambda x: persisted.append(copy.deepcopy(x)), NOW + 120, crash)
        restored = persisted[-1]
        def success(key, payload, ident):
            requests.append((payload, ident))
            return 'message-1'
        monitor.deliver(restored, {**CONFIG, 'to': 'changed@example.invalid'}, lambda x: None, NOW + 300, success)
        self.assertEqual(requests[0], requests[1])
        self.assertEqual(restored['outbox'][0]['status'], 'accepted')
        monitor.deliver(restored, CONFIG, lambda x: None, NOW + 500, success)
        self.assertEqual(len(requests), 2)

    def test_delivery_failure_preserves_pending_and_order(self):
        state = self.failure()
        self.recover(state, 'public_data', NOW + 240)
        self.assertEqual(len(state['outbox']), 2)
        calls = []
        def fail(*args):
            calls.append(args)
            raise TimeoutError('sensitive RPC content must never enter email')
        monitor.deliver(state, CONFIG, lambda x: None, NOW + 240, fail)
        self.assertEqual(len(calls), 1)
        self.assertTrue(all(item['status'] == 'pending' for item in state['outbox']))

    def test_ambiguous_send_is_not_retried_after_provider_window(self):
        state = self.failure()
        state['outbox'][0]['firstAttemptAt'] = NOW - 24 * 3600
        monitor.deliver(state, CONFIG, lambda x: None, NOW + 120,
                        lambda *args: self.fail('Must not re-send after idempotency expiration'))
        self.assertEqual(state['outbox'][0]['status'], 'unknown_requires_review')

    def test_email_has_fixed_recipient_no_secret_and_branded_link(self):
        item = self.failure()['outbox'][0]
        payload = monitor.email_payload(CONFIG, item)
        self.assertEqual(payload['to'], ['support@openzcash.org'])
        self.assertIn('https://openzcash.org/zcg/participate', payload['html'])
        self.assertNotIn(CONFIG['resendApiKey'], str(payload))
        self.assertIn('A leitura pública', payload['text'])

    def test_state_is_atomic_and_private(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'state.json'
            monitor.atomic_json(target, self.failure())
            self.assertEqual(target.stat().st_mode & 0o777, 0o600)
            self.assertFalse(target.with_suffix('.tmp').exists())

    def test_backup_probe_detects_missing_encryption_and_tampering(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'daily-20261011T010000Z.dump'
            data = b'fixture data' * 200
            path.write_bytes(data)
            path.with_suffix('.sha256').write_text(hashlib.sha256(data).hexdigest())
            self.assertTrue(monitor.backup_is_current(Path(directory), time.time(), False))
            self.assertFalse(monitor.backup_is_current(Path(directory), time.time(), True))
            encrypted = path.with_suffix('.dump.age')
            encrypted.write_bytes(data)
            encrypted.with_suffix('.age.sha256').write_text(hashlib.sha256(data).hexdigest())
            self.assertTrue(monitor.backup_is_current(Path(directory), time.time(), True))
            encrypted.write_bytes(data + b'changed')
            self.assertFalse(monitor.backup_is_current(Path(directory), time.time(), True))


if __name__ == '__main__':
    unittest.main()
