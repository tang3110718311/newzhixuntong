import urllib.request, urllib.parse, json, ssl
BASE = 'http://127.0.0.1:14000/api'

def post(path, payload):
    req = urllib.request.Request(BASE + path, data=json.dumps(payload).encode(), headers={'Content-Type':'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=10).read())

def get(path):
    return json.loads(urllib.request.urlopen(BASE + path, timeout=10).read())

# login
captcha = get('/auth/captcha')['data']
verified = post('/auth/captcha', {'captchaId': captcha['captchaId'], 'positionX': captcha['targetX']})['data']
res = post('/auth/login', {'mobile':'13800000000','password':'Zxt@2026','captchaToken': verified['captchaToken']})
token = res['data']['token']
print('LOGIN_OK')

# tasks
req = urllib.request.Request(f'{BASE}/tasks?pageSize=2', headers={'Authorization': f'Bearer {token}'})
res = json.loads(urllib.request.urlopen(req, timeout=10).read())
items = res.get('data', {}).get('items', []) if res.get('success') else []
print(f'TASKS_COUNT={len(items)}')
if items:
    first = items[0]
    print('FIRST_TASK_ID=' + first['id'])
    print('FIRST_TASK_NAME=' + first['name'])
    # 取 task detail
    req2 = urllib.request.Request(f'{BASE}/tasks/{first["id"]}', headers={'Authorization': f'Bearer {token}'})
    res2 = json.loads(urllib.request.urlopen(req2, timeout=10).read())
    if res2.get('success'):
        print('TASK_DETAIL_OK')
        print('SCENES=' + str(len(res2['data'].get('scenes', []))))
        for s in res2['data'].get('scenes', []):
            print('  scene:', s.get('sceneName'), 'mode:', s.get('mode'), 'completed:', s.get('completedTrainCount'), '/ required:', s.get('requiredTrainTimes'))
