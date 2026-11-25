"""One-heart failed challenges, fast tooltip retargeting and cached eased ink playback."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
import atexit
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start();atexit.register(server.shutdown)
code=(root/'ui/game.js').read_text(encoding='utf-8').replace('  startNewGame();\n})();',
    '  window.__test={state,render,startNewGame,resolveGreed};\n  startNewGame();\n})();')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,channel='chromium')
    page=browser.new_page(viewport={'width':1440,'height':900},reduced_motion='reduce')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/game.js',lambda r:r.fulfill(body=code,content_type='application/javascript'))
    page.goto(f'http://127.0.0.1:{server.server_port}/ui/')
    page.wait_for_function('window.__test && !__test.state.busy')
    for caller,whistle,expected in [(0,False,2),(2,False,2),(0,True,1)]:
        page.evaluate('__test.startNewGame()');page.wait_for_function('!__test.state.busy')
        page.evaluate('''v=>{
          const s=__test.state,p=s.players[v.caller];
          s.realDecl=s.maxDecl=1;s.lastDeclPlayer=s.players[1];s.busy=false;
          if(v.whistle)p.inventory=[GREED_CARDS.relics.find(c=>c.id==='executioner_whistle')];
          void __test.resolveGreed(p);
        }''',{'caller':caller,'whistle':whistle})
        assert page.evaluate(f'__test.state.players[{caller}].hp')==expected
    print('Failed GREED: human/CPU lose one heart; existing whistle multiplier loses two: passed',flush=True)
    page.evaluate('__test.startNewGame()');page.wait_for_function('!__test.state.busy')
    page.emulate_media(reduced_motion='no-preference')
    page.evaluate('''() => {
      __test.state.players[0].inventory=[GREED_CARDS.items.find(c=>c.id==='smoke_bomb'),GREED_CARDS.items.find(c=>c.id==='bloody_bandage')];__test.render();
    }''')
    result=page.evaluate('''async () => {
      const slots=[...document.querySelectorAll('#my-inventory .filled')];
      const failures=[];
      for(let i=0;i<20;i++) {
        const slot=slots[i%2];slot.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'}));
        if(document.querySelector('#cd-title svg').dataset.icon!==slot.card.id)failures.push(i);
        if(document.querySelectorAll('.inspection-echo').length>1)failures.push('ghost');
        await new Promise(r=>setTimeout(r,20));
      }
      return failures;
    }''')
    assert result==[],result
    page.wait_for_timeout(230)
    assert page.locator('.inspection-echo').count()==0
    assert page.locator('#card-detail-dialog').evaluate('e=>e.getAnimations().length')==0
    print('Twenty rapid hover switches show the latest item immediately, with no queued transitions: passed',flush=True)
    curve=page.evaluate('[0,.1,.2,.4,.6,.8,1].map(GREED_INK.entrance)')
    assert curve[0]==0 and curve[-1]==1 and .3<curve[2]<.55
    increments=[curve[2]-curve[0]]+[curve[i+1]-curve[i] for i in range(2,6)]
    assert all(a>b>0 for a,b in zip(increments,increments[1:])),increments
    page.evaluate('void GREED_SCENE.present({title:"28",eyebrow:"GREED!",detail:"Cached diffusion",kind:"verdict"})')
    page.wait_for_timeout(150)
    assert page.locator('.theatre-copy').evaluate('e=>e.style.maskImage.includes("ink-mask.png")')
    assert page.locator('filter[id^="ink-spread-"]').count()==0
    assert page.locator('.theatre-copy').evaluate('e=>e.style.filter')==''
    timing=page.evaluate('''() => new Promise(resolve=>{
      const frames=[];let last=performance.now(),start=last;
      function tick(now){frames.push(now-last);last=now;if(now-start>1100)resolve(frames.slice(2));else requestAnimationFrame(tick);}requestAnimationFrame(tick);
    })''')
    timing.sort()
    p95=timing[int(len(timing)*.95)]
    print(f'Cached mask playback: {len(timing)} frames; p95 frame interval {p95:.1f} ms',flush=True)
    assert p95<60, timing
    page.wait_for_function('document.querySelector(".theatre-copy").style.maskImage===""')
    page.wait_for_timeout(1700)
    assert page.locator('#central-theatre').is_visible()
    page.wait_for_function('document.querySelector(".theatre-copy").dataset.inkFrame!==undefined')
    start=page.evaluate('performance.now()')
    page.wait_for_function('document.querySelector("#central-theatre").hidden')
    assert page.evaluate('performance.now()')-start<500
    print('Fast start/slow tail curve, two-second hold and short linear exit: passed',flush=True)
    assert errors==[],errors
    browser.close()
