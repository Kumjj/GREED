"""Regression coverage for rejected healing, competing CPU reactions, fixed controls and physics dice."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import atexit
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1];out=root/'artifacts'
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start();atexit.register(server.shutdown)
code=(root/'ui/game.js').read_text(encoding='utf-8').replace('  startNewGame();\n})();','  window.__test={state,render,startNewGame,performDeclaration,onUseInventoryCard,addToInventory};\n  startNewGame();\n})();')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,channel='chromium')
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/game.js',lambda r:r.fulfill(body=code,content_type='application/javascript'))
    page.goto(f'http://127.0.0.1:{server.server_port}/ui/',wait_until='domcontentloaded')
    page.evaluate('''() => {
      window.invalidCards=[];
      function check(){
        if(__test.state.phase==='dealing'&&!__test.state.revealing)for(const id of [1,2,3]){
          const card=document.querySelector(`#card-seat-${id}`);
          if(!__test.state.dealtSeats.has(id)&&(getComputedStyle(card).visibility!=='hidden'||card.querySelector('.card-front span').textContent!==''))invalidCards.push(id);
        }
        if(__test.state.busy)requestAnimationFrame(check);
      }
      requestAnimationFrame(check);
    }''')
    page.wait_for_function('!__test.state.busy')
    assert page.evaluate('invalidCards')==[]
    print('Every undealt face is empty and invisible until physical arrival: passed',flush=True)
    page.emulate_media(reduced_motion='reduce')
    page.evaluate('__test.addToInventory(__test.state.players[0],GREED_CARDS.items.find(c=>c.id==="bloody_bandage"));__test.render()')
    page.locator('.inventory-panel button.filled').hover()
    page.wait_for_function('document.querySelector("#cd-note").textContent.length>0')
    assert page.locator('#btn-cd-use').is_hidden()
    page.evaluate('void __test.onUseInventoryCard(GREED_CARDS.items.find(c=>c.id==="bloody_bandage"))')
    assert page.locator('#btn-declare').is_enabled()
    assert page.evaluate('__test.state.busy') is False
    assert page.evaluate('__test.state.players[0].inventory.length')==1
    page.evaluate('''async () => {
      __test.state.players[0].hp=2;__test.state.players[0].noHealThisRound=true;__test.render();
      await __test.onUseInventoryCard(GREED_CARDS.items.find(c=>c.id==='bloody_bandage'));
    }''')
    assert page.locator('#btn-declare').is_enabled()
    page.evaluate('''async () => {
      __test.state.players[0].noHealThisRound=false;__test.render();
      await __test.onUseInventoryCard(GREED_CARDS.items.find(c=>c.id==='bloody_bandage'));
    }''')
    assert page.evaluate('__test.state.players[0].hp')==3
    assert page.locator('#btn-declare').is_enabled()
    print('Full HP/blocked healing do not lock declarations; valid healing unlocks correctly: passed',flush=True)

    def fixed():
        return page.evaluate('''() => Object.fromEntries(['btn-greed','btn-pass','declare-input'].map(id=>{const e=document.getElementById(id),b=e.getBoundingClientRect();return [id,[b.x,b.y,b.width,b.height,getComputedStyle(e).display]]}))''')
    initial=fixed()
    assert page.locator('#btn-pass').inner_text().startswith('넘기기')
    assert page.locator('#btn-pass').is_visible() and page.locator('#btn-pass').is_disabled()
    page.evaluate('Math.random=()=>.99;__test.state.turnIdx=1;void __test.performDeclaration(__test.state.players[1],96)')
    page.wait_for_function('__test.state.awaitingReaction')
    assert fixed()==initial,(initial,fixed())
    assert page.locator('#btn-greed').is_enabled() and page.locator('#btn-pass').is_enabled()
    page.locator('#btn-pass').click()
    page.wait_for_function('__test.state.awaitingReaction && __test.state.turnIdx===2',timeout=15000)
    assert fixed()==initial
    print('GREED/pass/input positions remain identical through declarations and reactions: passed',flush=True)

    page.evaluate('__test.startNewGame()');page.wait_for_function('!__test.state.busy')
    page.evaluate('Math.random=()=>0;__test.state.turnIdx=1;void __test.performDeclaration(__test.state.players[1],96)')
    page.wait_for_function('__test.state.awaitingReaction && !!__test.state.pendingChallenger')
    assert page.locator('#btn-greed').is_enabled()
    page.wait_for_selector('.central-theatre.verdict:not([hidden])',timeout=15000)
    caller_name=page.evaluate('__test.state.players[2].name')
    accused_name=page.evaluate('__test.state.players[1].name')
    assert caller_name in page.locator('.theatre-kicker').inner_text()
    assert accused_name in page.locator('.theatre-detail').inner_text()
    assert page.locator('#vn-speaker').inner_text()==caller_name
    assert not page.locator('#seat-2 .speech-bubble').is_hidden()
    assert page.evaluate('__test.state.players[2].points')>20
    assert page.evaluate('__test.state.declCount')==1
    page.screenshot(path=str(out/'greed-cpu-countercall.png'))
    page.wait_for_selector('#shop-dialog[open]',timeout=15000)
    print('CPU calls GREED on another CPU while human can respond: passed',flush=True)

    page.evaluate('__test.startNewGame()');page.wait_for_function('!__test.state.busy')
    page.evaluate('Math.random=()=>0;__test.state.turnIdx=1;void __test.performDeclaration(__test.state.players[1],96)')
    page.wait_for_function('__test.state.awaitingReaction && !!__test.state.pendingChallenger')
    page.evaluate('Math.random=()=>.99')
    page.keyboard.press('Tab')
    count=page.evaluate('__test.state.declCount')
    page.wait_for_timeout(2700)
    assert page.evaluate('__test.state.awaitingReaction') is True
    assert page.evaluate('__test.state.declCount')==count
    page.locator('#btn-resume').click()
    page.locator('#btn-greed').click()
    page.wait_for_selector('#shop-dialog[open]',timeout=15000)
    assert page.evaluate('__test.state.players[0].points')>20
    assert page.evaluate('__test.state.players[2].points')==20
    hp=page.evaluate('__test.state.players.map(p=>p.hp)')
    page.wait_for_timeout(2700)
    assert page.evaluate('__test.state.players.map(p=>p.hp)')==hp
    print('Pause freezes the CPU deadline; human victory cancels the queued CPU call: passed',flush=True)

    page.evaluate('__test.startNewGame()');page.wait_for_function('!__test.state.busy')
    page.emulate_media(reduced_motion='no-preference')
    page.evaluate('''() => {
      const m=__test.state.players[0];__test.addToInventory(m,GREED_CARDS.items.find(c=>c.id==='fate_bones'));__test.render();
      const rolls=[7,12];GREED_RULES.rollD20=()=>rolls.shift();void __test.onUseInventoryCard(m.inventory[0]);
    }''')
    page.wait_for_selector('.dice-canvas',timeout=15000)
    page.wait_for_timeout(700)
    page.screenshot(path=str(out/'greed-rigid-dice-rolling.png'))
    assert page.locator('.dice-canvas').get_attribute('data-physics')=='cannon-es'
    assert page.locator('.dice-canvas').get_attribute('data-sleeping')=='true'
    assert int(page.locator('.dice-canvas').get_attribute('data-contacts'))>0
    page.wait_for_function('document.querySelector(".dice-canvas")?.dataset.result==="7,12"',timeout=15000)
    page.screenshot(path=str(out/'greed-rigid-dice-rest.png'))
    page.wait_for_function('!__test.state.busy',timeout=15000)
    assert page.locator('#btn-declare').is_enabled()
    print('Actual rigid-body roll and resting face labels match the authoritative result: passed',flush=True)
    assert not errors,errors
    browser.close()
