#!/usr/bin/python3
"""Read-only operational probes, durable incident transitions and deduplicated email."""
import argparse
import datetime as dt
import fcntl
import hashlib
import html
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
import urllib.request
import uuid
from zoneinfo import ZoneInfo
from participate_database import database_command, database_source

DIRECTORY = Path('/var/lib/participate-monitor')
CONFIG = Path('/etc/participate/monitor.json')
PUBLIC = 'https://openzcash.org'
# The timer runs every 2 minutes. A probe must stay healthy for 30 minutes
# before its recovery email, so a flapping check stays one open incident.
RECOVERY_CHECKS = 15
# Alerts share the Resend quota with login and invite emails. Past this rolling
# 24-hour cap an alert is recorded as suppressed instead of sent.
DAILY_EMAIL_LIMIT = 12
OUTBOX_RETENTION_SECONDS = 14 * 24 * 3600
MESSAGES = {
    'public_site': 'A página pública do Participate não respondeu corretamente.',
    'public_data': 'A leitura pública das propostas não respondeu corretamente.',
    'email_login': 'A configuração pública de login por e-mail não está disponível.',
    'database': 'O banco de dados não respondeu à consulta de saúde.',
    'worker_timer': 'O agendamento da automação está parado.',
    'worker_heartbeat': 'A automação deixou de registrar atividade por mais de 35 minutos.',
    'source_discovery': 'A descoberta de propostas está atrasada ou falhou repetidamente.',
    'anchor_review': 'Há uma ancoragem que precisa de revisão manual. Não refaça a transação.',
    'activity_review': 'Há um lote de comentários ou curtidas que precisa de revisão. Não refaça a transação.',
    'activity_delay': 'Há atividades aguardando ancoragem há mais de 6 horas.',
    'activity_checks': 'A verificação de um lote de atividades falhou repetidamente.',
    'anchor_delay': 'Há uma proposta aguardando ancoragem há mais de 6 horas.',
    'private_node': 'A conexão privada com o nó não respondeu ou o nó está fora de sincronia.',
    'node_progress': 'O nó não avançou por mais de 30 minutos.',
    'archive_reader': 'O leitor independente de recibos não respondeu.',
    'reader_progress': 'A sincronização inicial do leitor não avançou por mais de 45 minutos.',
    'backup_timer': 'O agendamento dos backups está parado.',
    'backup_recent': 'O backup local está ausente, inválido ou tem mais de 26 horas.',
    'backup_service': 'A última execução do backup falhou.',
    'offsite_backup': 'A última cópia criptografada externa está ausente ou atrasada.',
    'disk_space': 'O armazenamento disponível na VPS está abaixo de 10%.',
    'monitor_internal': 'Uma verificação operacional não pôde ser concluída.',
}


def atomic_json(path, value):
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    with temporary.open('w') as handle:
        json.dump(value, handle, ensure_ascii=False)
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(temporary, 0o600)
    temporary.replace(path)
    descriptor = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def run(args, input_text=None, timeout=20):
    return subprocess.run(args, input=input_text, capture_output=True, text=True,
                          check=True, timeout=timeout).stdout.strip()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


def public_get(path, as_json=False):
    request = urllib.request.Request(PUBLIC + path, headers={
        'User-Agent': 'OpenZcash-Participate-Health/1.0', 'Cache-Control': 'no-cache'})
    with urllib.request.build_opener(NoRedirect).open(request, timeout=15) as response:
        body = response.read(2 * 1024 * 1024 + 1)
        if response.status != 200 or len(body) > 2 * 1024 * 1024:
            raise ValueError('PUBLIC_RESPONSE_INVALID')
        return json.loads(body) if as_json else body.decode()


def database_snapshot(host):
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,100}', host):
        raise ValueError('HOST_INVALID')
    query = '''BEGIN READ ONLY; SET LOCAL statement_timeout = '10s';
    SELECT json_build_object(
      'state', (SELECT json_build_object(
        'lastRun', extract(epoch from "lastRunAt"),
        'lastSuccess', extract(epoch from "lastSuccessAt"), 'failures', failures)
        FROM "ParticipateAutomationState" WHERE "hostId" = '%s'),
      'review', (SELECT count(*) FROM "ParticipateAutomationJob"
        WHERE "hostId" = '%s' AND state = 'NEEDS_REVIEW'),
      'oldestPending', (SELECT extract(epoch from min("createdAt")) FROM "ParticipateAutomationJob"
        WHERE "hostId" = '%s' AND state NOT IN ('VERIFIED', 'NEEDS_REVIEW') AND txid IS NULL),
      'activityReview', (SELECT count(*) FROM "ActivityAutomationJob" j JOIN "ArchiveActivityBatch" b ON b.id = j."batchId" WHERE b."communityId" = '%s' AND j.state = 'NEEDS_REVIEW'),
      'activityFailures', (SELECT count(*) FROM "ActivityAutomationJob" j JOIN "ArchiveActivityBatch" b ON b.id = j."batchId" WHERE b."communityId" = '%s' AND j.state <> 'VERIFIED' AND j.attempts >= 3),
      'oldestActivity', (SELECT extract(epoch from min(e."createdAt")) FROM "ArchiveActivityEvent" e JOIN "ProposalArchive" a ON a.id = e."archiveId"
        LEFT JOIN "ArchiveActivityInclusion" i ON i."eventId" = e.id LEFT JOIN "ActivityAutomationJob" j ON j."batchId" = i."batchId"
        LEFT JOIN "ArchiveActivityActor" actor ON actor.id = e."eventJson"::jsonb->>'actor' AND actor."archiveId" = e."archiveId"
        LEFT JOIN "User" u ON u.id = actor."userId"
        WHERE a."communityId" = '%s' AND (e."eventJson"::jsonb->>'actor' = 'SOURCE_OBSERVER' OR (u."emailVerifiedAt" IS NOT NULL AND left(u.id,8) <> 'preview_')) AND (i."eventId" IS NULL OR j.state NOT IN ('VERIFIED','NEEDS_REVIEW'))));
    COMMIT;''' % (host, host, host, host, host, host)
    return json.loads(run(database_command('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], stdin=True), query, 15))


def database_checks(snapshot, now):
    state = snapshot.get('state') or {}
    return {
        'worker_heartbeat': bool(state.get('lastRun') and now - float(state['lastRun']) < 35 * 60),
        'source_discovery': bool(state.get('lastSuccess') and
            now - float(state['lastSuccess']) < 45 * 60 and state.get('failures', 0) < 3),
        'activity_review': snapshot.get('activityReview', 0) == 0,
        'activity_checks': snapshot.get('activityFailures', 0) == 0,
        'activity_delay': not snapshot.get('oldestActivity') or now - float(snapshot['oldestActivity']) < 6 * 3600,
        'anchor_review': snapshot['review'] == 0,
        'anchor_delay': not snapshot.get('oldestPending') or now - float(snapshot['oldestPending']) < 6 * 3600,
    }


def private_read(port, method):
    config = json.loads(Path('/etc/participate/automation.json').read_text())
    host, key = config['sshHost'], config['sshKeyPath']
    if not re.fullmatch(r'[a-z_][a-z0-9_-]*@[a-zA-Z0-9.-]+', host) or not key.startswith('/'):
        raise ValueError('PRIVATE_CONFIGURATION_INVALID')
    reply = json.loads(run(['runuser', '-u', 'participate', '--', 'ssh', '-i', key,
        '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
        '-o', 'ConnectTimeout=10', host, 'participate-archive-v1'], json.dumps({
            'action': 'read', 'port': port, 'body': {'jsonrpc': '2.0', 'id': 'archive-v1',
            'method': method, 'params': []}}), 22))
    if reply.get('error') or reply.get('id') != 'archive-v1':
        raise ValueError('PRIVATE_READER_UNAVAILABLE')
    return reply['result']


def progressed(state, key, value, now, limit):
    before = state.setdefault('progress', {}).get(key)
    if not before or before['value'] != value:
        state['progress'][key] = {'value': value, 'since': now}
        return True
    return now - before['since'] < limit


def backup_is_current(directory, now, require_encrypted, expected_source=None):
    backups = sorted(directory.glob('daily-*.dump'))
    if not backups or now - backups[-1].stat().st_mtime >= 26 * 3600:
        return False
    if expected_source is not None:
        try:
            if json.loads(backups[-1].with_suffix('.source.json').read_text()) != expected_source:
                return False
        except (OSError, ValueError):
            return False
    paths = [backups[-1]]
    if require_encrypted:
        paths.append(backups[-1].with_suffix('.dump.age'))
    for path in paths:
        checksum = path.with_suffix('.age.sha256' if path.suffix == '.age' else '.sha256')
        if not path.is_file() or path.stat().st_size <= 1000 or not checksum.is_file():
            return False
        digest = hashlib.sha256()
        with path.open('rb') as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b''):
                digest.update(chunk)
        if digest.hexdigest() != checksum.read_text().strip():
            return False
    return True


def probes(config, state, now):
    checks = {}
    def check(key, probe):
        try:
            checks[key] = bool(probe())
        except Exception:
            checks[key] = False
    check('public_site', lambda: '/participate' in public_get('/zcg/participate'))
    check('public_data', lambda: bool(public_get(
        '/api/communities/' + config['hostId'] + '/archives/participation', True)['board']['proposals']))
    check('email_login', lambda: public_get('/api/auth/email/options', True) == {
        'emailAvailable': True, 'demoAvailable': False})
    check('worker_timer', lambda: run(['systemctl', 'is-active', 'participate-automation.timer']) == 'active')
    try:
        checks.update(database_checks(database_snapshot(config['hostId']), now))
        checks['database'] = True
    except Exception:
        checks['database'] = False
    try:
        node = private_read(8232, 'getblockchaininfo')
        checks['private_node'] = node['chain'] == 'main' and node['blocks'] == node['headers'] and \
            node.get('verificationprogress', 0) >= 0.9999 and not node.get('initialblockdownload', False) and \
            node.get('initial_block_download_complete', True)
        checks['node_progress'] = progressed(state, 'node', node['blocks'], now, 30 * 60)
    except Exception:
        checks['private_node'] = False
    try:
        reader = private_read(28248, 'getwalletstatus')
        checks['archive_reader'] = isinstance(reader.get('locked'), bool) and bool(reader.get('wallet_tip'))
        checks['reader_progress'] = progressed(state, 'reader', reader.get('fully_synced_height'), now, 45 * 60) \
            if reader.get('locked') else True
    except Exception:
        checks['archive_reader'] = False
    check('backup_timer', lambda: run(['systemctl', 'is-active', 'participate-db-backup.timer']) == 'active')
    check('backup_service', lambda: run(['systemctl', 'show', 'participate-db-backup.service',
        '-p', 'Result', '--value']) == 'success')
    check('backup_recent', lambda: backup_is_current(Path('/var/backups/participate'), now,
        config.get('encryptedBackupsRequired', False), database_source()))
    if config.get('offsiteEnabled'):
        def offsite_recent():
            record = json.loads(Path('/var/backups/participate/offsite-status.json').read_text())
            return record['state'] == 'VERIFIED' and now - record['verifiedAt'] < 26 * 3600
        check('offsite_backup', offsite_recent)
    disk = shutil.disk_usage('/var/backups/participate')
    checks['disk_space'] = disk.free / disk.total >= 0.10
    checks['monitor_internal'] = True
    return checks


def update_incidents(state, checks, now):
    """Unknown/dependent probes retain their incident; two bad observations open it and
    RECOVERY_CHECKS consecutive good ones close it."""
    changes = []
    for key, healthy in checks.items():
        entry = state.setdefault('incidents', {}).setdefault(key, {'active': False, 'bad': 0, 'good': 0})
        entry['bad'] = 0 if healthy else entry['bad'] + 1
        entry['good'] = entry['good'] + 1 if healthy else 0
        threshold = 1 if key == 'anchor_review' else 2
        if not entry['active'] and entry['bad'] >= threshold:
            entry.update(active=True, openedAt=now)
            changes.append({'key': key, 'kind': 'failure'})
        elif entry['active'] and entry['good'] >= RECOVERY_CHECKS:
            entry.update(active=False, recoveredAt=now)
            changes.append({'key': key, 'kind': 'recovery'})
    state['checkedAt'] = now
    state['checks'] = checks
    if changes:
        state.setdefault('outbox', []).append({
            'id': str(uuid.uuid4()), 'createdAt': now, 'changes': changes,
            'status': 'pending', 'attempts': 0, 'nextAttemptAt': now})
    return changes


def email_payload(config, item):
    test = item.get('test', False)
    failures = any(change['kind'] == 'failure' for change in item.get('changes', []))
    title = 'Teste dos alertas operacionais' if test else ('Atenção necessária' if failures else 'Serviço recuperado')
    when = dt.datetime.fromtimestamp(item['createdAt'], ZoneInfo('America/Sao_Paulo')).strftime('%d/%m/%Y às %H:%M %Z')
    lines = ['Os alertas do Participate estão configurados para este endereço. Este é um teste único.'] if test else [
        MESSAGES[change['key']] if change['kind'] == 'failure' else
        'Recuperado. A verificação voltou ao normal após o alerta: “' + MESSAGES[change['key']] + '”'
        for change in item['changes']]
    # Copy is deliberately drawn from constants, never raw errors, user data or RPC responses.
    body = ''.join('<p style="margin:0 0 16px;line-height:1.6">' + html.escape(line) + '</p>' for line in lines)
    return {'from': config['from'], 'to': [config['to']], 'subject': '[Participate] ' + title,
        'text': 'OpenZcash · Participate\n' + title + '\n' + when + '\n\n' + '\n'.join(lines) +
                '\n\nhttps://openzcash.org/zcg/participate',
        'html': '<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f8f7f3;color:#20201c;font-family:Arial,sans-serif">'
        '<table role="presentation" width="100%"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" '
        'style="max-width:560px;margin:auto;background:#fff;border-radius:20px"><tr><td style="padding:32px">'
        '<p style="color:#98640d;font-weight:700;letter-spacing:1px">OPENZCASH · PARTICIPATE</p>'
        '<h1 style="font-size:26px;line-height:1.2">' + html.escape(title) + '</h1><p style="color:#68675f;font-size:13px">' +
        html.escape(when) + '</p>' + body + '<a href="https://openzcash.org/zcg/participate" '
        'style="display:inline-block;background:#f5bc27;color:#181813;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700">'
        'Abrir Participate</a><p style="margin:24px 0 0;color:#68675f;font-size:12px">'
        'Alerta operacional. Não é necessário responder.</p></td></tr></table></td></tr></table></body></html>'}


def send_email(key, payload, idempotency):
    request = urllib.request.Request('https://api.resend.com/emails', method='POST',
        data=json.dumps(payload, ensure_ascii=False).encode(), headers={
            'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json',
            'Idempotency-Key': idempotency, 'User-Agent': 'OpenZcash-Participate-Monitor/1.0'})
    with urllib.request.build_opener(NoRedirect).open(request, timeout=20) as response:
        result = json.loads(response.read(8192))
        if not isinstance(result.get('id'), str):
            raise ValueError('EMAIL_RESPONSE_INVALID')
        return result['id']


def prune_outbox(outbox, now):
    """Drop settled alerts past retention; ambiguous sends stay for manual review."""
    return [item for item in outbox if item['status'] not in ('accepted', 'suppressed')
            or now - item['createdAt'] < OUTBOX_RETENTION_SECONDS]


def sent_last_day(outbox, now):
    return sum(1 for item in outbox if item['status'] == 'accepted' and
               now - item.get('acceptedAt', item['createdAt']) < 24 * 3600)


def deliver(state, config, save, now, sender=send_email):
    for item in state.get('outbox', []):
        if item['status'] != 'pending' or item['nextAttemptAt'] > now:
            continue
        if not item.get('firstAttemptAt') and sent_last_day(state['outbox'], now) >= DAILY_EMAIL_LIMIT:
            item.update(status='suppressed', suppressedAt=now)
            save(state)
            print(json.dumps({'event': 'alert_suppressed_daily_limit', 'id': item['id']}))
            continue
        # Resend only retains idempotency keys for 24h. Never retry an ambiguous send past it.
        if item.get('firstAttemptAt') and now - item['firstAttemptAt'] >= 23 * 3600:
            item['status'] = 'unknown_requires_review'
            save(state)
            print(json.dumps({'event': 'alert_requires_review', 'id': item['id']}))
            continue
        item.setdefault('payload', email_payload(config, item))
        item.setdefault('firstAttemptAt', now)
        item['attempts'] += 1
        item['nextAttemptAt'] = now + min(3600, 120 * 2 ** min(item['attempts'] - 1, 5))
        save(state)  # Stable bytes and key survive a crash after provider acceptance.
        try:
            message_id = sender(config['resendApiKey'], item['payload'], 'participate-ops/' + item['id'])
        except Exception:
            print(json.dumps({'event': 'alert_send_failed', 'id': item['id'], 'code': 'EMAIL_UNAVAILABLE'}))
            break  # Preserve the order of a failure and its subsequent recovery.
        item.update(status='accepted', messageId=message_id, acceptedAt=now)
        save(state)
        print(json.dumps({'event': 'alert_accepted', 'id': item['id'], 'messageId': message_id}))


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true', help='Read-only probes; no email/state changes')
    parser.add_argument('--test-email', action='store_true', help='One persistent, deduplicated delivery test')
    args = parser.parse_args()
    config = json.loads(CONFIG.read_text())
    if config['from'] != 'OpenZcash <support@openzcash.org>' or config['to'] != 'support@openzcash.org':
        raise ValueError('ALERT_RECIPIENT_INVALID')
    DIRECTORY.mkdir(mode=0o700, exist_ok=True)
    with (DIRECTORY / 'lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        state_file = DIRECTORY / 'state.json'
        state = json.loads(state_file.read_text()) if state_file.exists() else {'version': 1}
        now = time.time()
        if args.test_email:
            if not state.get('testQueued'):
                state.setdefault('outbox', []).append({'id': str(uuid.uuid4()), 'test': True,
                    'createdAt': now, 'status': 'pending', 'attempts': 0, 'nextAttemptAt': now})
                state['testQueued'] = True
        else:
            try:
                checks = probes(config, state, now)
            except Exception:
                checks = {'monitor_internal': False}
            if args.check:
                print(json.dumps({'checkedAt': now, 'checks': checks}))
                return
            update_incidents(state, checks, now)
            print(json.dumps({'event': 'monitor_checked', 'failures': [key for key, ok in checks.items() if not ok]}))
        state['outbox'] = prune_outbox(state.get('outbox', []), now)
        save = lambda value: atomic_json(state_file, value)
        save(state)
        deliver(state, config, save, now)


if __name__ == '__main__':
    try:
        main()
    except BlockingIOError:
        pass
    except Exception:
        print(json.dumps({'event': 'monitor_failed', 'code': 'MONITOR_CONFIGURATION_OR_STATE_ERROR'}))
        raise SystemExit(1)
