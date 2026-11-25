"""The real Python policy drives browser declarations/reactions, with stale-response guards."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer
from threading import Thread
import atexit
import json
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root))
from main import GameHandler
class Quiet(GameHandler):
    def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start();atexit.register(server.shutdown)
base=f'http://127.0.0.1:{server.server_port}'
try:
    urlopen(Request(base+'/api/npc',data=b'{"action":"wrong","observations":[{}]}',headers={'Content-Type':'application/json'}))
    raise AssertionError('Invalid observation accepted')
except HTTPError as e:
    assert e.code==400
source=(root/'ui/game.js').read_text(encoding='utf-8').replace('  startNewGame();\n})();',
    '  window.__test={state,render,startNewGame,runCpuTurn,performDeclaration,npcObservation};\n  startNewGame();\n})();')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,channel='chromium')
    page=browser.new_page(viewport={'width':1440,'height':900},reduced_motion='reduce')
    errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.post_data_json) if r.url.endswith('/api/npc') and r.method=='POST' else None)
    page.route('**/game.js',lambda r:r.fulfill(body=source,content_type='application/javascript'))
    page.goto(base+'/ui/');page.wait_for_function('window.__test && !__test.state.busy')
    page.evaluate('''() => {
      const s=__test.state;s.players.forEach((p,i)=>p.card=[2,5,11,19][i]);s.turnIdx=1;
      s.maxDecl=s.realDecl=35;s.declCount=1;s.players[1].smokeActive=true;
      __test.render();void __test.runCpuTurn();
    }''')
    page.wait_for_function('__test.state.declCount===2 && __test.state.awaitingReaction',timeout=15000)
    assert page.locator('body').get_attribute('data-npc-policy')=='python'
    assert page.evaluate('__test.state.players[1].npcDecision.value')==page.evaluate('__test.state.maxDecl')
    observation=requests[-1]['observations'][0]
    assert observation['visible_cards']==[2,11,19]
    assert 5 not in observation['known_cards']
    assert 'card' not in observation and 'own_card' not in observation and 'sum' not in observation
    assert page.evaluate('__test.state.players[1].npcMomentum')==0  # smoke produces no reward
    print('Actual Python declaration API used; own card absent from payload: passed',flush=True)

    page.evaluate('__test.startNewGame()');page.wait_for_function('!__test.state.busy')
    page.evaluate('''() => {
      const s=__test.state;s.turnIdx=1;void __test.performDeclaration(s.players[1],96);
    }''')
    page.wait_for_function('__test.state.awaitingReaction && !!__test.state.pendingChallenger',timeout=15000)
    assert requests[-1]['action']=='challenge'
    assert len(requests[-1]['observations'])==2
    page.wait_for_selector('.central-theatre.verdict:not([hidden])',timeout=15000)
    assert page.evaluate('__test.state.players[2].points')>20
    assert page.evaluate('__test.state.players[1].npcFrustration')==1
    print('Python CPU-on-CPU GREED and emotional loss memory: passed',flush=True)

    page.evaluate('__test.startNewGame()');page.wait_for_function('!__test.state.busy')
    pending=[]
    page.route('**/api/npc',lambda r:pending.append(r))
    page.evaluate('__test.state.turnIdx=1;void __test.runCpuTurn()')
    page.wait_for_timeout(1100)
    assert pending
    page.evaluate('__test.startNewGame()')
    pending.pop().fulfill(json={'provider':'python','decisions':[{'value':88,'oath':False,'reason':'reward_temptation'}]})
    page.unroute('**/api/npc');page.wait_for_function('!__test.state.busy')
    assert page.evaluate('__test.state.declCount')==0
    assert page.evaluate('__test.state.players[1].npcDecision') is None
    print('Restart discards a delayed Python response: passed',flush=True)

    pending=[];page.route('**/api/npc',lambda r:pending.append(r))
    page.evaluate('__test.state.turnIdx=1;__test.state.players[1].smokeActive=true;void __test.runCpuTurn()')
    page.wait_for_timeout(1100);assert pending
    page.keyboard.press('Tab')
    pending.pop().fulfill(json={'provider':'python','decisions':[{'value':40,'oath':False,'reason':'reward_temptation'}]})
    page.unroute('**/api/npc');page.wait_for_timeout(350)
    assert page.evaluate('__test.state.declCount')==0
    page.locator('#btn-resume').click()
    page.wait_for_function('__test.state.declCount===1',timeout=15000)
    assert page.evaluate('__test.state.maxDecl')==40
    print('Response during pause waits for resume: passed',flush=True)
    assert not errors,errors
    browser.close()
