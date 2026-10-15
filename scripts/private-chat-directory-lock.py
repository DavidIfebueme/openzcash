#!/usr/bin/env python3
"""Exec the directory under a kernel advisory lock; SIGKILL also releases it."""
import fcntl
import os
import stat
import sys

def main():
    directory = os.environ.get("PRIVATE_CHAT_DIRECTORY_DATA", "")
    if not os.path.isabs(directory) or len(sys.argv) < 2:
        raise ValueError("configuration")
    os.makedirs(directory, mode=0o700, exist_ok=True)
    info = os.lstat(directory)
    if not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise ValueError("permissions")
    path = os.path.join(directory, "runtime.lock")
    fd = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    info = os.fstat(fd)
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise ValueError("permissions")
    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    os.set_inheritable(fd, True)
    environment = dict(os.environ, PRIVATE_CHAT_DIRECTORY_LOCK_FD=str(fd))
    # exec preserves the locked descriptor and process identity, including signals.
    os.execvpe(sys.argv[1], sys.argv[1:], environment)

try:
    main()
except (OSError, ValueError):
    sys.stderr.write("Directory lock/configuration unavailable. No instance started.\n")
    sys.exit(75)
