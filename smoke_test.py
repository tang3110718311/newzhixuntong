from pathlib import Path
import os
import paramiko


host = os.environ.get("SMOKE_SSH_HOST")
username = os.environ.get("SMOKE_SSH_USER")
password = os.environ.get("SMOKE_SSH_PASSWORD")

if not host or not username or not password:
    raise SystemExit(
        "Missing smoke test SSH credentials. "
        "Set SMOKE_SSH_HOST, SMOKE_SSH_USER and SMOKE_SSH_PASSWORD in your local environment."
    )

local = str(Path(__file__).with_name("smoke_test_server.py"))
remote = "/tmp/smoke_test_server.py"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username=username, password=password, timeout=30)

# 上传脚本
sftp = ssh.open_sftp()
sftp.put(local, remote)
sftp.chmod(remote, 0o755)
ssh.close()

# 在服务器上跑
ssh2 = paramiko.SSHClient()
ssh2.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh2.connect(host, username=username, password=password, timeout=30)
si, so, se = ssh2.exec_command(f"python3 {remote}", timeout=60)
print(so.read().decode('utf-8', 'replace'))
print('ERR:', se.read().decode('utf-8', 'replace'))
ssh2.close()
