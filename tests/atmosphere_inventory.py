"""Stable inventory/tooltip, first-item landing, initialized flights and health atmosphere."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import atexit
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start();atexit.register(server.shutdown)
code=(root/'ui/game.js').read_text(encoding='utf-8').replace('  startNewGame();\n})();',
    '  window.__test={state,render,say,drawRandomCard,renderMaintenanceDialog,animateCardFlight};\n  startNewGame();\n})();')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,channel='chromium')
    page=browser.new_page(viewport={'width':1440,'height':900},reduced_motion='reduce')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/game.js',lambda r:r.fulfill(body=code,content_type='application/javascript'))
    page.goto(f'http://127.0.0.1:{server.server_port}/ui/')
    page.wait_for_function('window.__test && !__test.state.busy')
    page.evaluate('''() => {
      const s=__test.state;s.phase='maintenance';s.players[0].inventory=[];s.players[0].points=100;
      __test.render();__test.renderMaintenanceDialog();document.querySelector('#shop-dialog').showModal();
      Math.random=()=>.99;
    }''')
    page.emulate_media(reduced_motion='no-preference')
    page.locator('#btn-draw-card').click()
    page.wait_for_selector('.landing-reserved',timeout=15000)
    assert page.locator('.landing-reserved').get_attribute('data-slot-kind')=='item'
    assert page.locator('.draw-leaf').get_attribute('data-destination')=='item'
    assert page.locator('#relic-slot .landing-reserved').count()==0
    page.wait_for_selector('#shop-dialog[open]',timeout=15000)
    assert page.locator('#relic-slot .filled').count()==0
    assert page.locator('#my-inventory .filled').count()==1
    print('First ordinary draw with empty relic slot lands and stays in an ordinary slot: passed')
    page.evaluate('document.querySelector("#shop-dialog").close();__test.state.phase="turn";__test.state.turnIdx=0;__test.render()')
    page.locator('#my-inventory .filled').hover()
    page.wait_for_selector('#card-detail-dialog:not(.hidden)')
    page.wait_for_timeout(400)
    page.evaluate('''() => {
      window.slot=document.querySelector('#my-inventory .filled');window.replays=0;
      document.querySelector('#card-detail-dialog').addEventListener('animationstart',()=>replays++);
      for(let i=0;i<5;i++){__test.say('YOU','Same hovered item');__test.state.players[0].points++;__test.render();}
    }''')
    page.wait_for_timeout(450)
    assert page.evaluate('slot===document.querySelector("#my-inventory .filled")')
    assert page.evaluate('replays')==0
    assert page.locator('#card-detail-dialog:not(.hidden)').count()==1
    print('Dialogue and status renders preserve hovered slot and do not replay tooltip entrance: passed')
    page.evaluate('''async () => {
      window.firstFlight=[];
      const observer=new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)
        if(n.nodeType===1&&n.matches('.fx-card'))firstFlight.push({left:n.style.left,top:n.style.top});});
      observer.observe(document.querySelector('#fx-layer'),{childList:true});
      await __test.animateCardFlight(document.querySelector('#center-deck'),document.querySelector('#card-seat-1'),'?');
      observer.disconnect();
    }''')
    assert page.evaluate('firstFlight.length===1 && firstFlight.every(p=>p.left!==""&&p.top!=="")')
    print('Flight coordinates are initialized before the first observable frame: passed')
    page.mouse.move(720,300)
    page.evaluate('void GREED_SCENE.present({title:"28",eyebrow:"CPU · GREED!",detail:"Ink spread test",kind:"verdict"})')
    page.wait_for_timeout(480)
    assert 'ink-mask.png' in page.locator('.theatre-copy').evaluate('e=>e.style.maskImage')
    assert page.locator('filter[id^="ink-spread-"]').count()==0
    (root/'artifacts').mkdir(exist_ok=True)
    page.screenshot(path=str(root/'artifacts/ink-spread-mid.png'))
    page.wait_for_function('document.querySelector(".theatre-copy").style.maskImage===""')
    page.wait_for_timeout(1700)
    assert page.locator('#central-theatre').is_visible()
    assert page.locator('.theatre-copy').evaluate('e=>e.style.maskImage')==''
    page.wait_for_function('document.querySelector("#central-theatre").hidden',timeout=5000)
    print('Fractal/radial ink spread, full reveal and two-second verdict hold: passed')
    samples={}
    for hp in [3,2,1.5,1]:
        page.evaluate('(hp)=>{__test.state.players[0].hp=hp;__test.render();}',hp)
        page.wait_for_timeout(2500)
        samples[hp]=page.evaluate('''() => new Promise(resolve=>{
          const values=[];let start=performance.now();
          function tick(){values.push({blur:+document.querySelector('#scene-camera').dataset.healthBlur,gain:+document.querySelector('#scene-camera').dataset.swayGain});
            if(performance.now()-start>5700)resolve(values);else requestAnimationFrame(tick);}tick();
        })''')
    assert max(s['blur'] for s in samples[3])==0
    assert max(s['blur'] for s in samples[2])<.01
    assert max(s['blur'] for s in samples[1.5])>.8
    assert max(s['blur'] for s in samples[1])>1.7
    assert min(s['blur'] for s in samples[1])<.01
    assert samples[3][-1]['gain']<samples[2][-1]['gain']<samples[1.5][-1]['gain']<samples[1][-1]['gain']
    page.evaluate('GREED_SCENE.pause(true)')
    before=page.locator('#scene-camera').get_attribute('style')
    page.wait_for_timeout(400)
    assert page.locator('#scene-camera').get_attribute('style')==before
    page.evaluate('GREED_SCENE.pause(false)')
    print('Health 3/2/1.5/1: stronger sway; below two hearts periodic haze/clarity; pause freezes phase: passed')
    page.wait_for_function('+document.querySelector("#scene-camera").dataset.healthBlur>1.6',timeout=8000)
    page.screenshot(path=str(root/'artifacts/low-health-haze.png'))
    for width in [390,320]:
        page.set_viewport_size({'width':width,'height':900})
        for x in [0,width-1]:
            page.mouse.move(x,60);page.wait_for_timeout(900)
            cards=page.locator('.opponents-row .num-card').evaluate_all('els=>els.map(e=>{const b=e.getBoundingClientRect();return {left:b.left,right:b.right};})')
            assert all(c['left']>=0 and c['right']<=width for c in cards),(width,cards)
    page.set_viewport_size({'width':1440,'height':900})
    page.evaluate('__test.say("YOU","먹물이 번지며 나타나는 대사")')
    page.wait_for_timeout(480)
    assert 'ink-mask.png' in page.locator('.vn-dialogue:not(.dialogue-echo)').evaluate('e=>e.style.maskImage')
    page.screenshot(path=str(root/'artifacts/ink-dialogue-mid.png'))
    page.wait_for_timeout(600)
    page.evaluate('void GREED_SCENE.present({title:"Reset",kind:"item"})')
    page.wait_for_timeout(150)
    page.evaluate('GREED_SCENE.reset()')
    assert page.locator('filter[id^="ink-spread-"]').count()==0
    assert errors==[],errors
    browser.close()
