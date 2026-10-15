"""Set and verify the native client's privacy settings without logging config."""
import pathlib
import re
import sys
import tomllib

path = pathlib.Path('/home/node/.nym/clients/openzcash-directory/config/config.toml')
text = path.read_text()
if sys.argv[1:] == ['configure']:
    section = r'(\[debug\.stats_reporting\]\s*\n)([\s\S]*?)(?=\n\[|$)'
    def disable(match):
        body, count = re.subn(r'^enabled\s*=.*$', 'enabled = false', match[2], count=1, flags=re.M)
        if count != 1:
            raise ValueError('stats setting absent')
        return match[1] + body
    text, count = re.subn(section, disable, text, count=1)
    if count != 1:
        raise ValueError('stats section absent')
    path.write_text(text)
    path.chmod(0o600)
config = tomllib.loads(text)
assert config['debug']['stats_reporting']['enabled'] is False
assert config['socket']['socket_type'] == 'WebSocket'
assert config['socket']['host'] == '127.0.0.1'
assert config['socket']['listening_port'] == 1977
