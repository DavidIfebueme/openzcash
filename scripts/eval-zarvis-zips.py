"""Opt-in synthetic conversation checks against an already running loopback preview.
Uses its configured provider; can incur token charges. Never loads API credentials.
"""
import argparse, json, re, time, urllib.request
from pathlib import Path
from urllib.parse import urlparse
parser=argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:3100')
parser.add_argument('--confirm-paid', action='store_true')
parser.add_argument('--output', default='/private/tmp/zarvis-zip-live.json')
args=parser.parse_args()
if not args.confirm_paid: raise SystemExit('Pass --confirm-paid to use the configured model.')
if urlparse(args.url).hostname not in ('localhost','127.0.0.1','::1'): raise SystemExit('Only a loopback preview is allowed.')
results=[]
def ask(name, question, previous=None, check=None):
    history, session = previous or ([], {})
    history=history+[{'role':'user','content':question}]
    request=urllib.request.Request(args.url+'/api/zarvis',data=json.dumps({'messages':history,'session':session}).encode(),headers={'Origin':args.url,'Content-Type':'application/json'})
    start=time.monotonic(); text=''; events=[]
    try:
        with urllib.request.urlopen(request,timeout=65) as response:
            for line in response:
                event=json.loads(line); events.append(event)
                if event['type']=='replace': text=event['text']
                if event['type']=='delta': text+=event['text']
                if event['type']=='session': session=event['session']
        complete=bool(events and events[-1]['type']=='done')
        passed=complete and (check(text,session) if check else bool(text.strip()))
        results.append({'case':name,'question':question,'seconds':round(time.monotonic()-start,2),'passed':passed,'answer':text,'session':session,'sources':events[-1].get('sources',[]) if complete else [],'error': next((e['message'] for e in events if e['type']=='error'),None)})
    except Exception as error:
        results.append({'case':name,'seconds':round(time.monotonic()-start,2),'passed':False,'error':type(error).__name__})
    Path(args.output).write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in results[-1].items() if k in ('case','seconds','passed','error')},ensure_ascii=False),flush=True)
    return history+[{'role':'assistant','content':text}],session


def cited(t): return bool(re.search(r'https://(?:zips\.z\.cash/|github\.com/zcash/zips/)',t))
ask('local-latest','Qual é o último ZIP?',check=lambda t,s: 'Created' in t and cited(t))
ask('current-zip-research','Check official sources now: what is the latest published Zcash ZIP as of today? Give its title, status, source URL and verification date; do not assume the highest number is the newest publication.',check=lambda t,s: cited(t) and bool(re.search(r'creat',t,re.I)) and bool(re.search(r'2026|September|Sep ',t)))
history=ask('full-corpus-zip-32','Explain ZIP 32 hardened key derivation in plain English, in two sentences with a source.',check=lambda t,s: 'harden' in t.lower() and cited(t))
ask('zip-context-followup','And how does that differ from non-hardened derivation?',previous=history,check=lambda t,s: 'harden' in t.lower() and cited(t))
