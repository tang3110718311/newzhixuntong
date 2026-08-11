import paramiko
import os
import time
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
pkey = paramiko.Ed25519Key.from_private_key_file(r'C:\Users\Administrator\.ssh\id_ed25519_zxt_next_deploy')
ssh.connect('171.111.198.77', username='tangdeploy', pkey=pkey, timeout=30)
src = r'C:\Users\Administrator\Documents\日常办公\zxt-next-local-20260811-122000-a666009.tar.gz'
remote = '/data/zxt-next/incoming/zxt-next-local-20260811-122000-a666009.tar.gz'
sftp = ssh.open_sftp()
print('Uploading ...')
t0 = time.time()
sftp.put(src, remote)
sftp.chmod(remote, 0o644)
print(f'OK {time.time()-t0:.1f}s')
ssh.close()

# root 清空 + 解包 + 改 env + 启动后台构建
ssh2 = paramiko.SSHClient()
ssh2.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh2.connect('171.111.198.77', username='root', password=os.environ.get('JIFU_PW', 'Jifu@2024'), timeout=30)
release = 'rel-a666009-20260811-122000'
tar = 'zxt-next-local-20260811-122000-a666009.tar.gz'
cmd = f"""
set -e
cd /data/zxt-next
rm -rf releases/{release}
mkdir -p releases/{release}
tar -xzf incoming/{tar} -C releases/{release}/
sed -i 's|^ZXT_RELEASE_DIR=.*|ZXT_RELEASE_DIR=/data/zxt-next/releases/{release}|' deploy/env.test
echo '--- size ---'
du -sh releases/{release}
echo '--- env ---'
grep '^ZXT_RELEASE_DIR=' deploy/env.test
"""
si, so, se = ssh2.exec_command(cmd, timeout=180)
print(so.read().decode('utf-8', 'replace'))

# 启动后台构建
build_log = '/data/zxt-next/.logs/build_a666009.log'
build_exit = '/data/zxt-next/.logs/build_a666009_exit.txt'
run = f"""
mkdir -p /data/zxt-next/.logs
cd /data/zxt-next/deploy
nohup bash -c 'docker compose --env-file env.test -f docker-compose.test.yml build zxt-api zxt-admin > {build_log} 2>&1; echo $? > {build_exit}' >/dev/null 2>&1 &
disown
sleep 3
echo started
"""
si, so, se = ssh2.exec_command(run, timeout=30)
print(so.read().decode('utf-8', 'replace'))
ssh2.close()

# 轮询
deadline = time.time() + 600
while time.time() < deadline:
    ssp = paramiko.SSHClient()
    ssp.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssp.connect('171.111.198.77', username='root', password=os.environ.get('JIFU_PW', 'Jifu@2024'), timeout=30)
    check = f"""
set +e
cd /data/zxt-next/.logs
if [ -f build_a666009_exit.txt ]; then
  cat build_a666009_exit.txt
  echo ' --- MARK ---'
fi
stat -c '%s' {build_log} 2>/dev/null
echo ' --- TAIL ---'
tail -n 25 {build_log} 2>/dev/null
"""
    si, so, se = ssp.exec_command(check, timeout=20)
    out = so.read().decode('utf-8', 'replace')
    ssp.close()
    if '--- MARK ---' in out:
        try:
            txt = out.split('\n')[0].strip()
            exit_code = int(txt) if txt.isdigit() else -1
        except Exception:
            exit_code = -1
        if exit_code in (0, 1):
            print('BUILD FINISHED exit=', exit_code)
            print(out)
            sys.exit(exit_code)
    time.sleep(15)

print('TIMEOUT, last log:')
print(out)
