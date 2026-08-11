import paramiko
import os
import time
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('171.111.198.77', username='root', password=os.environ.get('JIFU_PW', 'Jifu@2024'), timeout=30)
cmd = """
set -e
cd /data/zxt-next/deploy
# 停旧容器
docker compose --env-file env.test -f docker-compose.test.yml down
# 启动新容器
docker compose --env-file env.test -f docker-compose.test.yml up -d
echo '---'
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | head -10
echo '--- wait for healthy ---'
for i in $(seq 1 30); do
  sleep 3
  api_health=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:14000/api/health || true)
  admin_health=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:13000/ || true)
  echo "iter=$i api=$api_health admin=$admin_health"
  if [ "$api_health" = "200" ] && [ "$admin_health" = "200" ]; then
    echo BOTH_READY
    break
  fi
done
"""
si, so, se = ssh.exec_command(cmd, timeout=180)
print(so.read().decode('utf-8', 'replace'))
print('ERR:', se.read().decode('utf-8', 'replace'))
ssh.close()
