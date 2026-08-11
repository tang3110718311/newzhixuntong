import paramiko
import os
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('171.111.198.77', username='root', password=os.environ.get('JIFU_PW', 'Jifu@2024'), timeout=30)

deadline = time.time() + 480
log = ''
exit_code = None
while time.time() < deadline:
    check = """
set +e
cd /data/zxt-next/.logs
if [ -f build_0623277_exit.txt ]; then
  cat build_0623277_exit.txt
  echo " --- MARK ---"
fi
stat -c '%s' build_0623277.log 2>/dev/null
echo " --- TAIL ---"
tail -n 15 build_0623277.log 2>/dev/null
"""
    si, so, se = ssh.exec_command(check, timeout=20)
    out = so.read().decode('utf-8', 'replace')
    log = out
    if '--- MARK ---' in out:
        try:
            txt = out.split('\n')[0].strip()
            exit_code = int(txt) if txt.isdigit() else -1
        except Exception:
            exit_code = -1
        if exit_code in (0, 1):
            print('BUILD FINISHED exit=', exit_code)
            print(out)
            break
    time.sleep(15)

if exit_code is None:
    print('TIMEOUT, latest log:')
    print(log)
ssh.close()
