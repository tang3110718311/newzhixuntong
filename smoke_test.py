import paramiko, os
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('171.111.198.77', username='root', password=os.environ.get('JIFU_PW', 'Jifu@2024'), timeout=30)

# 上传脚本
sftp = ssh.open_sftp()
local = r'C:\Users\Administrator\Documents\日常办公\zxt-next\smoke_test_server.py'
remote = '/tmp/smoke_test_server.py'
sftp.put(local, remote)
sftp.chmod(remote, 0o755)
ssh.close()

# 在服务器上跑
ssh2 = paramiko.SSHClient()
ssh2.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh2.connect('171.111.198.77', username='root', password=os.environ.get('JIFU_PW', 'Jifu@2024'), timeout=30)
si, so, se = ssh2.exec_command('python3 /tmp/smoke_test_server.py', timeout=60)
print(so.read().decode('utf-8', 'replace'))
print('ERR:', se.read().decode('utf-8', 'replace'))
ssh2.close()
