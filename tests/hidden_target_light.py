"""Hidden upward redeals, scene targeting, vector icons and ceiling turn lighting."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import atexit
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(root)))
Thread(target=server.serve_forever, daemon=True).start()
atexit.register(server.shutdown)
source = (root/'ui/game.js').read_text(encoding='utf-8').replace(
    '  startNewGame();\n})();',
    '  window.__test={state,render,onUseInventoryCard,openTargetChoice,clearTargetChoice};\n  startNewGame();\n})();')
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chromium')
    page = browser.new_page(viewport={'width':1440,'height':900}, reduced_motion='reduce')
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('**/game.js',lambda r:r.fulfill(body=source,content_type='application/javascript'))
    page.goto(f'http://127.0.0.1:{server.server_port}/ui/')
    page.wait_for_function('window.__test && !__test.state.busy')
    assert page.evaluate('GREED_CARDS.relics.length') == 6
    assert page.evaluate('[...GREED_CARDS.relics,...GREED_CARDS.items].every(c=>GREED_ICONS.has(c.id))')
    assert page.locator('#btn-toggle-disguise').count() == 0
    page.evaluate('''() => {
      const s=__test.state;
      s.phase='turn'; s.turnIdx=0; s.awaitingReaction=false; s.maxDecl=60; s.realDecl=60;
      s.players.forEach((p,i)=>{p.card=[5,6,12,18][i];p.hp=3;});
      s.players[0].inventory=[GREED_CARDS.relics.find(c=>c.id==='rusty_dice_box')];
      __test.render();document.querySelector('#declare-input').value=67;
    }''')
    before=page.evaluate('__test.state.players.slice(1).map(p=>p.card)')
    page.evaluate('''async () => {
      window.flightLabels=[];
      const fly=GREED_SCENE.fly;
      GREED_SCENE.fly=async (...args)=>{flightLabels.push(args[2]);return fly(...args);};
      await __test.onUseInventoryCard(__test.state.players[0].inventory[0]);
    }''')
    assert page.evaluate('__test.state.players[0].card') > 5
    assert page.evaluate('__test.state.players.slice(1).map(p=>p.card)') == before
    assert page.evaluate('flightLabels') == ['?', '?']
    assert page.evaluate('[__test.state.maxDecl,__test.state.realDecl]') == [60,60]
    assert page.locator('#declare-input').input_value() == '67'
    assert page.locator('#card-seat-0 .card-front span').inner_text() == '?'
    # The ceiling case is indistinguishable: same use, message and flights.
    page.evaluate('''async () => {
      __test.state.players[0].card=24;
      __test.state.players[0].usedSwapThisRound=false;flightLabels=[];
      await __test.onUseInventoryCard(__test.state.players[0].inventory[0]);
    }''')
    assert page.evaluate('__test.state.players[0].card') == 24
    assert page.evaluate('flightLabels') == ['?', '?']
    assert page.locator('#declare-input').input_value() == '67'
    print('Hidden redeal only rises; occupied cards, declaration/input and ceiling anonymity preserved: passed')
    page.evaluate('''() => {
      const s=__test.state;s.players[0].inventory=[GREED_CARDS.items.find(c=>c.id==='pickpocket_hook')];
      s.players[1].inventory=[GREED_CARDS.items.find(c=>c.id==='smoke_bomb')];
      __test.render();
    }''')
    assert page.locator('.inventory-panel .inv-icon svg').count() == 1
    page.evaluate('void __test.onUseInventoryCard(__test.state.players[0].inventory[0])')
    page.wait_for_selector('body.targeting')
    assert not page.locator('#choice-dialog').is_visible()
    assert page.locator('#btn-declare').is_disabled()
    page.locator('#seat-1 .standee').hover()
    assert 'target-hover' in page.locator('#seat-1').get_attribute('class')
    page.locator('#seat-1 .standee').click()
    assert page.locator('#target-prompt').count()==0
    assert page.evaluate('__test.state.players[0].inventory.map(c=>c.id)') == ['smoke_bomb']
    assert page.locator('#btn-declare').is_enabled()
    page.evaluate('''() => {__test.state.players[0].inventory=[GREED_CARDS.relics.find(c=>c.id==='meddling_hand')];__test.render();}''')
    page.evaluate('void __test.onUseInventoryCard(__test.state.players[0].inventory[0])')
    page.wait_for_selector('body.targeting')
    page.locator('#seat-2').focus();page.keyboard.press('Enter')
    assert page.locator('#choice-options button').count() == 3
    assert page.locator('#choice-dialog').is_visible()
    page.locator('#btn-choice-cancel').click()
    page.evaluate('__test.openTargetChoice("", "",()=>{});')
    page.keyboard.press('Escape')
    assert page.locator('body.targeting').count()==0
    print('Character hover/click, keyboard targeting, cancellation and RPS without number hints: passed')
    for seat in range(4):
        page.evaluate('(id)=>{__test.state.turnIdx=id;__test.render();}',seat)
        assert page.locator('#turn-spotlight').get_attribute('data-seat') == str(seat)
        assert page.evaluate('document.body.classList.contains("player-lit")') == (seat==0)
        assert page.evaluate('getComputedStyle(document.querySelector(".light-cone")).clipPath') != 'none'
    page.evaluate('__test.state.turnIdx=1;__test.render()')
    page.emulate_media(reduced_motion='no-preference')
    for width in [1440,768,390,320]:
        page.set_viewport_size({'width':width,'height':900})
        page.mouse.move(width-1,70);page.wait_for_timeout(500)
        assert page.locator('#btn-declare').is_visible()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.set_viewport_size({'width':1440,'height':900})
    page.mouse.move(720,450);page.wait_for_timeout(600)
    (root/'artifacts').mkdir(exist_ok=True)
    page.screenshot(path=str(root/'artifacts/ceiling-target-ui.png'))
    assert errors == [], errors
    print('All four turn lights, foreground self light, larger camera movement and responsive layout: passed')
    browser.close()
