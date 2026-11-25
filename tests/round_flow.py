"""Focused regressions for physical card arrival, additive camera and every GREED ending a round."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import atexit
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
out=root/'artifacts'
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start();atexit.register(server.shutdown)
source=(root/'ui/game.js').read_text(encoding='utf-8').replace('  startNewGame();\n})();','  window.__test={state,render,startNewGame,openMaintenance,performDeclaration,resolveGreed};\n  startNewGame();\n})();')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,channel='chromium')
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script("localStorage.setItem('greed-motion','off')")
    page.route('**/game.js',lambda r:r.fulfill(body=source,content_type='application/javascript'))
    page.goto(f'http://127.0.0.1:{server.server_port}/ui/',wait_until='domcontentloaded')
    page.evaluate('''() => {
      window.badArrival=[];
      function check(){
        if(__test.state.phase==='dealing'&&!__test.state.revealing){
          for(const id of [1,2,3]){
            const card=document.querySelector(`#card-seat-${id}`);
            if(card&&!__test.state.dealtSeats.has(id)&&getComputedStyle(card).visibility!=='hidden')badArrival.push(id);
          }
        }
        if(__test.state.busy)requestAnimationFrame(check);
      }
      requestAnimationFrame(check);
    }''')
    page.wait_for_function('!__test.state.busy',timeout=15000)
    assert page.evaluate('badArrival')==[]
    assert page.locator('.character-presence .waiting-card').count()==0
    assert page.locator('#btn-motion').count()==0
    assert page.locator('body.motion-off').count()==0
    assert page.locator('#current-decl-num').is_hidden()
    assert page.locator('#current-decl-by').inner_text()==''
    print('Deal targets remain empty until arrival; removed option and labels: passed',flush=True)

    phase=page.evaluate('''() => {
      const node=document.querySelector('#seat-1 .standee');window.oldPortrait=node;
      const a=node.querySelector('.portrait-head').getAnimations()[0];const time=a.currentTime;
      __test.state.players[1].points++;__test.render();
      return {same:node===document.querySelector('#seat-1 .standee'),time,after:document.querySelector('#seat-1 .portrait-head').getAnimations()[0].currentTime};
    }''')
    assert phase['same'] and phase['after']>=phase['time']-10,phase
    phase=page.evaluate('''() => {
      const before=document.querySelector('#seat-1 .portrait-head').getAnimations()[0].currentTime;
      __test.state.players[1].mood='shock';__test.render();
      return {before,after:document.querySelector('#seat-1 .portrait-head').getAnimations()[0].currentTime};
    }''')
    assert abs(phase['before']-phase['after'])<60,phase
    samples=page.evaluate('''() => new Promise(resolve=>{
      const values=[];let i=0;
      function sample(){
        values.push(new DOMMatrix(getComputedStyle(document.querySelector('#scene-camera')).transform).m41);
        if(i++===8)document.querySelector('.stage-room').dispatchEvent(new PointerEvent('pointermove',{clientX:1400,clientY:400,pointerType:'mouse'}));
        if(i>55)resolve(values);else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    })''')
    assert max(abs(b-a) for a,b in zip(samples,samples[1:]))<5,samples
    assert abs(samples[-1]-samples[0])>8
    print('Portrait clocks survive rendering; pointer movement adds without a pose jump: passed',flush=True)

    page.evaluate('Math.random=()=>.1;__test.state.players[0].points=200;__test.openMaintenance()')
    page.locator('#btn-draw-card').click()
    page.wait_for_selector('.relic-sigil',timeout=15000)
    page.screenshot(path=str(out/'greed-relic-reveal.png'))
    page.wait_for_selector('.landing-reserved',timeout=15000)
    assert page.locator('.landing-reserved').evaluate("e=>Boolean(e.closest('#relic-slot'))")
    assert page.locator('.draw-leaf').get_attribute('data-destination')=='relic'
    page.wait_for_selector('#shop-dialog[open]',timeout=15000)
    assert page.locator('#relic-slot .filled').count()==1
    page.evaluate('Math.random=()=>.99')
    page.locator('#btn-draw-card').click()
    page.wait_for_selector('.landing-reserved',timeout=15000)
    assert page.locator('.landing-reserved').evaluate("e=>Boolean(e.closest('#my-inventory'))")
    assert page.locator('.draw-leaf').get_attribute('data-destination')=='item'
    page.screenshot(path=str(out/'greed-item-landing.png'))
    page.wait_for_selector('#shop-dialog[open]',timeout=15000)
    assert page.locator('#relic-slot .filled').count()==1
    assert page.locator('#my-inventory .filled').count()==1
    assert page.locator('.draw-leaf').count()==0
    print('Relic reveal and separate physical relic/item landing slots: passed',flush=True)

    page.emulate_media(reduced_motion='reduce')
    for success in [False,True]:
      page.evaluate('__test.startNewGame()')
      page.wait_for_function('!__test.state.busy')
      page.evaluate('''(success) => {
        const s=__test.state;[4,6,8,10].forEach((v,i)=>s.players[i].card=v);
        s.maxDecl=success?40:20;s.realDecl=s.maxDecl;s.declCount=1;s.turnIdx=1;
        s.lastDeclPlayer=s.players[1];s.lastDeclReward=20;s.awaitingReaction=true;
        if(success)s.players[1].hp=1;
        __test.render();void __test.resolveGreed(s.players[0]);
      }''',success)
      page.wait_for_selector('.central-theatre.verdict:not([hidden])',timeout=15000)
      assert page.locator('.theatre-title').inner_text()=='28'
      assert page.evaluate('__test.state.players[0].name') in page.locator('.theatre-kicker').inner_text()
      assert page.evaluate('__test.state.players[1].name') in page.locator('.theatre-detail').inner_text()
      assert page.locator('#vn-speaker').inner_text()==page.evaluate('__test.state.players[0].name')
      assert page.evaluate('__test.state.roundRevealSum')==28
      assert page.evaluate('__test.state.declCount')==1
      page.screenshot(path=str(out/f'greed-verdict-{success}.png'))
      try:
        page.wait_for_selector('#shop-dialog[open]',timeout=15000)
      except Exception:
        print('errors',errors,flush=True)
        print(page.evaluate('({phase:__test.state.phase,busy:__test.state.busy,round:__test.state.round,dealt:[...__test.state.dealtSeats],hp:__test.state.players.map(p=>p.hp),shop:document.querySelector("#shop-dialog").open})'),flush=True)
        raise
      assert page.evaluate('__test.state.phase')=='maintenance'
      assert page.evaluate('__test.state.declCount')==1
      assert page.evaluate('__test.state.players[0].hp')==(3 if success else 2)
      if success: assert page.evaluate('__test.state.players[1].hp')==0
      print(f'GREED success={success}: preserved total 28, no next turn, round ended',flush=True)
    for last_survivor in [False,True]:
      page.evaluate('__test.startNewGame()');page.wait_for_function('!__test.state.busy')
      page.evaluate('''last => {
        const s=__test.state;[4,6,8,10].forEach((v,i)=>s.players[i].card=v);
        s.maxDecl=last?40:20;s.realDecl=s.maxDecl;s.declCount=1;s.turnIdx=1;
        s.lastDeclPlayer=s.players[1];s.lastDeclReward=20;s.awaitingReaction=true;
        if(last){s.players[1].hp=1;s.players[2].hp=0;s.players[3].hp=0;}
        else s.players[0].hp=.5;
        __test.render();void __test.resolveGreed(s.players[0]);
      }''',last_survivor)
      page.wait_for_selector('.central-theatre.verdict:not([hidden])')
      assert page.locator('.theatre-title').inner_text()==('10' if last_survivor else '28')
      page.wait_for_selector('#gameover-dialog[open]',timeout=15000)
      assert page.evaluate('__test.state.phase')=='gameover'
      assert page.evaluate('__test.state.players[0].hp')==(3 if last_survivor else 0)
      print(f'Final game verdict last_survivor={last_survivor}: total before game over passed',flush=True)
    assert not errors,errors
    browser.close()
