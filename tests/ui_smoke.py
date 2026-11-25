"""Run: python tests/ui_smoke.py (requires playwright and its chromium browser).
Starts its own temporary local server. Test hooks are only injected into test responses.
"""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import atexit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts'
OUT.mkdir(exist_ok=True)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
atexit.register(server.shutdown)
source = (ROOT/'ui/game.js').read_text(encoding='utf-8')
source = source.replace('  startNewGame();\n})();', '''  window.__test={state,render,startNewGame,startRound,openMaintenance,finishMaintenance,performDeclaration,payMyDebt,addToInventory,onUseInventoryCard,getMyVisibleSum};
  startNewGame();
})();''')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chromium')
    page = browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('**/game.js',lambda route:route.fulfill(body=source,content_type='application/javascript'))
    page.goto(f'http://127.0.0.1:{server.server_port}/ui/')

    def ready():
        page.wait_for_function('window.__test && __test.state.phase === "turn" && !__test.state.busy && __test.state.turnIdx===0',timeout=20000)

    def restart():
        page.evaluate('__test.startNewGame()')
        ready()

    ready()
    page.wait_for_timeout(1500)
    assert page.locator('#declare-input').input_value()==page.locator('#visible-sum').inner_text()
    page.screenshot(path=str(OUT/'greed-v3-desktop.png'))
    x1=page.evaluate('new DOMMatrix(getComputedStyle(document.querySelector("#scene-camera")).transform).m41')
    page.mouse.move(1400,450)
    page.wait_for_timeout(700)
    x2=page.evaluate('new DOMMatrix(getComputedStyle(document.querySelector("#scene-camera")).transform).m41')
    assert abs(x2-x1)>8
    print('Camera drift and stronger pointer parallax: passed',flush=True)
    page.evaluate('__test.state.players[0].hp=2.5;__test.render()')
    assert page.locator('#my-hp stop[offset="50%"]').count()==2
    page.evaluate('__test.state.players[0].hp=3;__test.render()')

    page.keyboard.press('Tab')
    assert page.locator('#pause-menu').is_visible()
    assert page.evaluate('GREED_SCENE.paused')
    page.locator('#btn-rules').click()
    assert page.locator('#rules-dialog').is_visible()
    page.wait_for_timeout(350)
    page.screenshot(path=str(OUT/'greed-v3-menu.png'))
    page.locator('#btn-close-rules').click()
    page.emulate_media(reduced_motion='reduce')
    page.locator('#btn-resume').click()
    assert not page.evaluate('GREED_SCENE.paused')
    print('Tab menu, notebook and resume: passed',flush=True)

    # Minimum bound uses only visible values, including distinct smallest missing cards.
    page.evaluate('''() => {
      const s=__test.state;[24,1,2,10].forEach((n,i)=>s.players[i].card=n);
      s.players[0].limbs=['눈'];s.players[0].blindTargetId=3;
      document.querySelector('#declare-input').value='';__test.render();
    }''')
    assert page.locator('#visible-sum').inner_text()=='10?'
    assert page.locator('#declare-input').input_value()=='10'
    page.evaluate('__test.state.players[3].card=19;__test.state.players[0].card=8;__test.render()')
    assert page.locator('#visible-sum').inner_text()=='10?'
    print('Information-safe minimum and blindness question mark: passed',flush=True)

    restart()
    page.evaluate('''() => {
      const t=__test,s=t.state,m=s.players[0];m.points=200;
      t.addToInventory(m,GREED_CARDS.relics[0]);t.render();
    }''')
    assert page.locator('#btn-toggle-oath').is_disabled() # First declaration is always 20P.
    page.evaluate('''() => {
      const s=__test.state;s.maxDecl=Math.max(50,__test.getMyVisibleSum());
      s.lastDeclPlayer=s.players[1];s.declCount=1;
      document.querySelector('#declare-input').value=s.maxDecl+6;__test.render();
    }''')
    assert page.locator('#btn-toggle-oath').is_enabled()
    page.locator('#btn-toggle-oath').click()
    assert page.locator('#btn-toggle-oath').get_attribute('aria-pressed')=='true'
    page.evaluate('Math.random=()=>.99')
    page.locator('#btn-declare').click()
    page.wait_for_function('__test.state.players[0].debt===45 && !__test.state.busy',timeout=15000)
    assert page.evaluate('__test.state.players[0].points')==260
    page.evaluate('__test.payMyDebt()')
    assert page.evaluate('__test.state.players[0].debt')==0
    page.evaluate('__test.state.busy=false;void __test.finishMaintenance()')
    ready()
    assert page.evaluate('__test.state.players[0].limbs.length')==0
    print('30P oath threshold, 45P debt and no seizure after repayment: passed',flush=True)

    page.evaluate('''() => {
      const m=__test.state.players[0];m.debt=50;m.points=10;m.limbs=['눈'];m.blindTargetId=3;__test.render();__test.payMyDebt();
    }''')
    assert page.evaluate('__test.state.players[0].debt')==40
    assert page.locator('.btn-pay-debt').inner_text()=='갚기'
    page.evaluate('__test.state.players[0].points=40;__test.payMyDebt()')
    assert page.evaluate('__test.state.players[0].limbs.length')==0
    assert page.evaluate('__test.state.players[0].blindTargetId') is None
    print('Partial/full settlement and collateral cleanup: passed',flush=True)

    page.evaluate('''() => {
      const s=__test.state;s.players[0].debt=50;s.players[0].points=0;s.phase='maintenance';s.busy=false;
      void __test.finishMaintenance();
    }''')
    page.wait_for_selector('#sensory-message.seizure-voice')
    assert '50' in page.locator('#sensory-message').inner_text()
    page.screenshot(path=str(OUT/'greed-v3-seizure.png'))
    ready()
    assert page.evaluate('__test.state.players[0].limbs.length')==1
    page.evaluate('__test.state.players[0].points=100;__test.payMyDebt()')
    assert page.locator('#sensory-message.visible').count()==0
    print('Artifact seizure voice, delay and clearing after payment: passed',flush=True)

    restart()
    page.evaluate('Math.random=()=>.99;__test.state.players[0].points=200;__test.openMaintenance()')
    assert page.locator('#btn-draw-item').count()==0
    assert page.locator('#btn-draw-relic').count()==0
    page.evaluate('Math.random=()=>.1')
    page.locator('#btn-draw-card').click()
    page.wait_for_selector('#shop-dialog[open]',timeout=15000)
    assert page.locator('.relic-panel .inv-slot.filled').count()==1
    page.evaluate('Math.random=()=>0')
    for _ in range(2):
        page.locator('#btn-draw-card').click()
        page.wait_for_selector('#shop-dialog[open]',timeout=15000)
    assert page.locator('.inventory-panel .inv-slot.filled').count()==2
    assert page.locator('#btn-draw-card').is_disabled()
    assert not page.evaluate('__test.addToInventory(__test.state.players[0],GREED_CARDS.items[0])')
    print('Unified blind draw, one relic and two ordinary slots: passed',flush=True)
    page.locator('#btn-next-round').click()
    ready()

    first=page.locator('.inventory-panel .inv-slot.filled').first
    second=page.locator('.inventory-panel .inv-slot.filled').nth(1)
    first.hover()
    page.wait_for_selector('#card-detail-dialog:not(.hidden)')
    second.hover()
    page.wait_for_timeout(400)
    assert page.locator('#btn-cd-close').count()==0
    page.screenshot(path=str(OUT/'greed-v3-hover.png'))
    page.mouse.move(700,180)
    page.wait_for_timeout(500)
    assert page.locator('#card-detail-dialog').is_hidden()
    print('Hover inspection, transitions and automatic dismissal: passed',flush=True)

    # Show real motion for card draw and dice captures.
    page.emulate_media(reduced_motion='no-preference')
    page.evaluate('GREED_RULES.rollD20=()=>1;__test.state.players[0].hp=2')
    first.hover()
    page.wait_for_selector('#btn-cd-use:visible')
    points=page.evaluate('__test.state.players[0].points')
    page.locator('#btn-cd-use').click()
    page.wait_for_selector('canvas.dice-canvas',timeout=15000)
    page.screenshot(path=str(OUT/'greed-v3-dice-rolling.png'))
    page.wait_for_function('document.querySelector(".dice-result")?.textContent.includes("대성공")',timeout=15000)
    page.screenshot(path=str(OUT/'greed-v3-dice.png'))
    page.wait_for_function('!__test.state.busy',timeout=15000)
    assert page.evaluate('__test.state.players[0].hp')==3
    assert page.evaluate('__test.state.players[0].points')==points+30
    print('Two icosahedra settle on authoritative faces and award exact outcome: passed',flush=True)

    # Preserve the manual reaction gate and pause the CPU clock through the menu.
    page.evaluate('Math.random=()=>.99')
    page.locator('#btn-declare').click()
    page.wait_for_function('__test.state.awaitingReaction',timeout=20000)
    snapshot=page.evaluate('[__test.state.turnIdx,__test.state.declCount,__test.state.maxDecl]')
    page.wait_for_timeout(1600)
    assert page.evaluate('[__test.state.turnIdx,__test.state.declCount,__test.state.maxDecl]')==snapshot
    page.keyboard.press('Tab')
    page.wait_for_timeout(1000)
    assert page.evaluate('[__test.state.turnIdx,__test.state.declCount,__test.state.maxDecl]')==snapshot
    page.locator('#btn-resume').click()
    page.screenshot(path=str(OUT/'greed-v3-reaction.png'))
    print('Reaction choice remains manual and menu freezes the game: passed',flush=True)
    page.locator('#btn-pass').click()
    page.keyboard.press('Tab')
    count=page.evaluate('__test.state.declCount')
    page.wait_for_timeout(1600)
    assert page.evaluate('__test.state.declCount')==count
    page.locator('#btn-resume').click()
    page.wait_for_function('__test.state.awaitingReaction && __test.state.turnIdx===2',timeout=20000)
    print('Paused CPU thinking clock resumes without an extra turn: passed',flush=True)

    for width,height in [(1440,900),(1366,768),(768,1024),(390,844),(320,820)]:
        page.set_viewport_size({'width':width,'height':height})
        page.mouse.move(width-1,200)
        page.wait_for_timeout(400)
        cards=page.evaluate('''() => [...document.querySelectorAll('.character-presence > .num-card')].map(e=>{const b=e.getBoundingClientRect();return {x:b.x,right:b.right}})''')
        assert all(c['x']>=0 and c['right']<=width for c in cards),(width,cards)
        page.wait_for_timeout(150)
        page.screenshot(path=str(OUT/f'greed-v3-{width}.png'),full_page=True)
        layout=page.evaluate('''() => ({overflow:document.documentElement.scrollWidth>innerWidth,items:[...document.querySelectorAll('#btn-greed,#btn-pass,#visible-sum,#my-points')].map(e=>{const b=e.getBoundingClientRect();return {id:e.id,x:b.x,right:b.right,width:b.width}})})''')
        assert not layout['overflow'],(width,layout)
        assert all(x['x']>=0 and x['right']<=width and x['width']>5 for x in layout['items']),(width,layout)
        print(f'Layout {width}: passed',flush=True)
    # Outcome boundaries, touch/keyboard inspection and cancellation during presentation.
    page.set_viewport_size({'width':1440,'height':900})
    page.emulate_media(reduced_motion='reduce')
    for a,b,hp,points,no_heal,want_hp,want_points in [(15,1,2,5,False,2,0),(20,20,1,0,False,0,0),(1,1,2,0,True,2,30)]:
        restart()
        page.evaluate('''async (v) => {
          const m=__test.state.players[0];m.hp=v.hp;m.points=v.points;m.noHealThisRound=v.no_heal;
          const card=GREED_CARDS.items.find(c=>c.id==='fate_bones');__test.addToInventory(m,card);
          const rolls=[v.a,v.b];GREED_RULES.rollD20=()=>rolls.shift();__test.render();await __test.onUseInventoryCard(card);
        }''',{'a':a,'b':b,'hp':hp,'points':points,'no_heal':no_heal})
        assert page.evaluate('__test.state.players[0].hp')==want_hp
        assert page.evaluate('__test.state.players[0].points')==want_points
    print('Dice failure floor, critical death and blocked healing: passed',flush=True)
    restart()
    page.evaluate('__test.addToInventory(__test.state.players[0],GREED_CARDS.items.find(c=>c.id==="smoke_bomb"));__test.render()')
    page.keyboard.press('1')
    page.wait_for_selector('#btn-cd-use:visible')
    page.keyboard.press('ArrowDown');page.keyboard.press('Enter')
    page.wait_for_function('!__test.state.busy && __test.state.players[0].smokeActive')
    print('Keyboard inspection and item activation: passed',flush=True)
    restart()
    page.emulate_media(reduced_motion='no-preference')
    page.evaluate('__test.state.players[0].points=200;__test.openMaintenance()')
    page.locator('#btn-draw-card').click()
    page.wait_for_selector('.draw-leaf')
    page.wait_for_timeout(1100)
    page.screenshot(path=str(OUT/'greed-v3-draw.png'))
    page.keyboard.press('Tab');page.locator('#btn-restart').click()
    ready();page.wait_for_timeout(1400)
    assert page.evaluate('__test.state.players[0].inventory.length')==0
    assert page.evaluate('__test.state.players[0].points')==20
    assert page.locator('#shop-dialog').is_hidden()
    print('Restart cancels in-flight drawing and delayed inventory changes: passed',flush=True)
    touch=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    touch.route('**/game.js',lambda route:route.fulfill(body=source,content_type='application/javascript'))
    touch.goto(f'http://127.0.0.1:{server.server_port}/ui/')
    touch.wait_for_function('window.__test && !__test.state.busy')
    touch.evaluate('__test.addToInventory(__test.state.players[0],GREED_CARDS.items[0]);__test.render()')
    touch.locator('.inventory-panel button.filled').tap()
    touch.wait_for_selector('#card-detail-dialog:not(.hidden)')
    touch.wait_for_timeout(650)
    assert touch.locator('#card-detail-dialog').is_visible()
    touch.touchscreen.tap(200,100);touch.wait_for_timeout(350)
    assert touch.locator('#card-detail-dialog').is_hidden()
    touch.close()
    print('Touch inspection remains open until an outside tap: passed',flush=True)
    assert not errors,errors
    print('No browser errors',flush=True)
    browser.close()
