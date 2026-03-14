#!/usr/bin/env python3
import sys, os, time, json, re
os.environ['PYTHONUNBUFFERED'] = '1'

# Rich
try:
    from rich.console import Console
    from rich.panel import Panel
    console = Console()
    RICH = True
except:
    RICH = False

def log(m):
    if RICH:
        console.print(m)
    else:
        clean = re.sub(r'\[.*?\]', '', str(m))
        print(f"[{time.strftime('%H:%M:%S')}] {clean}")
    sys.stdout.flush()

if RICH:
    console.print(Panel.fit(
        "[bold cyan]Pinterest Scraper v25[/bold cyan]\n[dim]Search title in aria-label «»[/dim]",
        title="🚀 Scraper"
    ))

import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

SERVER = "https://tgpinbot-production.up.railway.app"
SECRET = "tgpinbot_scraper_2024"

COOKIES = [
    {"name": "cm_sub", "value": "allowed", "domain": "www.pinterest.com"},
    {"name": "_b", "value": "\"AY3q3axRiPZKY7M7Cc2XaR3ognxvPvBxbtcLJlV2LjfdjqYgvbwxEzMmbSRpmhYKqzQ=\"", "domain": ".pinterest.com"},
    {"name": "_routing_id", "value": "\"2320575e-fd07-4104-b403-fa0f027f95a0\"", "domain": "www.pinterest.com"},
]

def get_driver():
    o = Options()
    o.add_argument("--headless=new")
    o.add_argument("--no-sandbox")
    o.add_argument("--disable-gpu")
    o.add_argument("--window-size=1920,3000")
    return webdriver.Chrome(o)

def scrape(url):
    log(f"[cyan]URL: {url}[/cyan]")
    
    d = None
    pins = []
    seen = set()
    
    try:
        d = get_driver()
        
        d.get("https://www.pinterest.com")
        time.sleep(2)
        for c in COOKIES:
            try: d.add_cookie(c)
            except: pass
        
        d.get(url)
        time.sleep(6)
        
        log(f"[dim]Title: {d.title}[/dim]")
        
        m = re.search(r'(\d+)\s+', d.title)
        expected = int(m.group(1)) if m else 50
        log(f"[yellow]Expected: {expected} pins[/yellow]")
        
        # JS - ИЩЕМ TITLE В aria-label с «»
        js = '''
        const results = [];
        const seen = new Set();

        // Ищем все элементы с кавычками «» в aria-label
        const allElements = document.querySelectorAll('[aria-label*="«"], [aria-label*="»"]');

        allElements.forEach(el => {
            const ariaLabel = el.getAttribute('aria-label') || '';

            // Ищем «Название»
            const match = ariaLabel.match(/«([^»]+)»/);
            if (!match) return;

            const title = match[1];

            // Ищем ссылку на пин
            let pinLink = el.closest('a[href*="/pin/"]') || el.querySelector('a[href*="/pin/"]');

            if (!pinLink) {
                // Ищем ссылку рядом
                let parent = el.parentElement;
                for (let i = 0; i < 5 && parent; i++) {
                    pinLink = parent.querySelector('a[href*="/pin/"]');
                    if (pinLink) break;
                    pinLink = parent.querySelector('a');
                    if (pinLink && pinLink.href && pinLink.href.includes('/pin/')) break;
                    parent = parent.parentElement;
                }
            }

            if (!pinLink || !pinLink.href) return;

            const href = pinLink.href;
            const pinMatch = href.match(/\\/pin\\/(\\d+)/);
            if (!pinMatch) return;
            const pinId = pinMatch[1];

            if (seen.has(pinId)) return;

            // Ищем картинку
            let img = el.querySelector('img') || pinLink.querySelector('img');
            if (!img) {
                let parent = el.parentElement;
                for (let i = 0; i < 3 && parent; i++) {
                    img = parent.querySelector('img');
                    if (img) break;
                    parent = parent.parentElement;
                }
            }

            let imageUrl = '';
            if (img) {
                imageUrl = img.src || '';
                if (imageUrl.includes('pinimg.com')) {
                    if (imageUrl.includes('/75x75') ||
                        imageUrl.includes('/140x') ||
                        imageUrl.includes('/60x60') ||
                        imageUrl.includes('_RS') ||
                        imageUrl.includes('/user/')) {
                        return;
                    }
                    imageUrl = imageUrl.replace(/\\/\\d+x\\d*\\//g, '/originals/');
                    imageUrl = imageUrl.split('?')[0];
                }
            }

            seen.add(pinId);

            results.push({
                imageUrl: imageUrl,
                title: title,
                pinId: pinId,
                sourceUrl: `https://www.pinterest.com/pin/${pinId}/`
            });
        });

        return results;
        '''

        last = 0
        no_new = 0

        for scroll in range(1, 60):
            d.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(1.5)

            try:
                result = d.execute_script(js)
                if result:
                    for p in result:
                        key = p.get('pinId')
                        if key and key not in seen:
                            seen.add(key)
                            pins.append({
                                'imageUrl': p.get('imageUrl'),
                                'title': p.get('title'),
                                'description': None,
                                'sourceUrl': p.get('sourceUrl'),
                                'pinId': p.get('pinId')
                            })
            except Exception as e:
                if scroll == 1:
                    log(f"[red]JS Error: {e}[/red]")

            cur = len(pins)

            if scroll % 3 == 0:
                log(f"[dim]Scroll {scroll}: {cur}/{expected}[/dim]")

            if cur >= expected:
                log(f"[green]Got {cur} >= {expected}[/green]")
                break

            if cur == last:
                no_new += 1
                if no_new >= 8: break
            else:
                no_new = 0
            last = cur

        # Fallback через img alt
        if len(pins) < expected:
            log("[yellow]Trying img alt fallback...[/yellow]")

            js2 = '''
            const results = [];
            const seen = new Set();

            document.querySelectorAll('img[src*="pinimg.com"]').forEach(img => {
                let imageUrl = img.src;
                if (imageUrl.includes('/75x75') ||
                    imageUrl.includes('/140x') ||
                    imageUrl.includes('/60x60') ||
                    imageUrl.includes('_RS') ||
                    imageUrl.includes('/user/')) {
                    return;
                }

                let pinLink = img.closest('a[href*="/pin/"]');
                let pinId = null;
                if (pinLink) {
                    const m = pinLink.href.match(/\\/pin\\/(\\d+)/);
                    if (m) pinId = m[1];
                }

                if (!pinId) return;
                if (seen.has(pinId)) return;
                seen.add(pinId);

                let title = img.alt || null;

                imageUrl = imageUrl.replace(/\\/\\d+x\\d*\\//g, '/originals/');
                imageUrl = imageUrl.split('?')[0];

                results.push({
                    imageUrl: imageUrl,
                    title: title,
                    pinId: pinId,
                    sourceUrl: `https://www.pinterest.com/pin/${pinId}/`
                });
            });

            return results;
            '''

            try:
                result = d.execute_script(js2)
                if result:
                    for p in result:
                        key = p.get('pinId')
                        if key and key not in seen:
                            seen.add(key)
                            pins.append({
                                'imageUrl': p.get('imageUrl'),
                                'title': p.get('title'),
                                'description': None,
                                'sourceUrl': p.get('sourceUrl'),
                                'pinId': p.get('pinId')
                            })
            except Exception as e:
                log(f"[red]JS2 Error: {e}[/red]")

        pins = pins[:expected]
        pins.reverse()

        log(f"[bold green]✅ Total: {len(pins)} pins[/bold green]")

        log("[bold]Sample:[/bold]")
        for i, p in enumerate(pins[:10]):
            t = p.get('title') or '[NO TITLE]'
            log(f"  [cyan]{i+1}.[/cyan] {t[:70]}")

        with_title = sum(1 for p in pins if p.get('title'))
        log(f"[yellow]With title: {with_title}/{len(pins)}[/yellow]")

    except Exception as e:
        log(f"[red]Error: {e}[/red]")
        import traceback
        traceback.print_exc()
    finally:
        if d: d.quit()

    return pins, url.rstrip('/').split('?')[0]

def api_get():
    try:
        r = requests.get(f"{SERVER}/api/pinterest/sync/pending", params={"secret": SECRET}, timeout=30)
        return r.json().get("boards", []) if r.status_code == 200 else []
    except: return []

def api_import(tid, url, pins):
    try:
        r = requests.post(f"{SERVER}/api/pins/import", json={"telegramId": str(tid), "boardUrl": url, "pins": pins}, timeout=180)
        return r.json()
    except Exception as e: return {"error": str(e)}

def api_done(url, tid, t, i):
    try:
        requests.post(f"{SERVER}/api/pinterest/sync/complete", json={"boardUrl": url, "telegramId": str(tid), "totalPins": t, "importedPins": i, "secret": SECRET}, timeout=30)
    except: pass

log("[cyan]Starting v25...[/cyan]")
while True:
    try:
        for b in api_get():
            u, t = b.get("boardUrl"), b.get("telegramId")
            if u and t:
                p, n = scrape(u)
                if p:
                    r = api_import(t, n, p)
                    log(f"[cyan]Import: {r}[/cyan]")
                    api_done(n, t, len(p), r.get("imported", 0))
                else:
                    api_done(n, t, 0, 0)
        log("[dim]Sleep 10s...[/dim]")
        time.sleep(10)
    except KeyboardInterrupt:
        break
    except:
        time.sleep(5)
log("[yellow]Exit[/yellow]")
