#!/usr/bin/env python3
import sys, os, time, json, re
os.environ['PYTHONUNBUFFERED'] = '1'

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
        "[bold cyan]Pinterest Scraper v29[/bold cyan]\n[dim]Debug image URLs[/dim]",
        title="🚀 Scraper"
    ))

import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

SERVER = "https://tgpinbot-production.up.railway.app"
SECRET = "tgpinbot_scraper_2024"

COOKIES = [
    {"name": "cm_sub", "value": "allowed", "domain": "www.pinterest.com"},
    {"name": "csrftoken", "value": "2dbcb331911aa79562416642894e9b44", "domain": "www.pinterest.com"},
    {"name": "_auth", "value": "1", "domain": ".pinterest.com"},
    {"name": "_pinterest_sess", "value": "TWc9PSZJcTEyRjNsNVZ1OWhNYlA4aUxkcjFSNGc2QTJMdUNMMFVYNDkybStiYmtNNmxWb3FJYVFpZ00xMSs4R1AxOXVaaU1mc2RYcjJDVnpnVW5uNkZuZFZ3YTl5MDhicjBkQUd2ZkZHaUo2TUR2RzBiN1YvUXREYVhqaDZQb01hWTdVWUZDMUQvWFBjSE40cmw2a2ZaNytGNzR6WjJYWWoxT2Q5SmJkTUdKeTBmb0pkT2RWY1ZFdGswYWd4Mnk1MkJNa0dac3l3MDNQVUQ4NVZxVVFDcHNlRjEwbkZwN3VCWkJjY0c3R0laZlZoL1A0dml4OUwvRzRwK1M0TnVkYlBMQU9HOVdHOU52dWswaDZheVovV05uQXkrQk55TEE2U3BvRUZpTHY1bVB5MFV0dmRBUTE4ZG1wRi9TbnByY3BldDl4WXNYbkgwSmk4WWsrcWlFZDZIV0tOcUZ6NmVPc3d4NFBGVWtzRVYxQUphUXhlREpqNGxGTGFsYlorcGR4VEtpUVRYc0c0SmF0QkpNUGVlTlBvNWJHVGF3PT0mVXJWbjBKUXdmaVRKWmNMWDZSekF5NVZPZjZRPQ==", "domain": ".pinterest.com"},
    {"name": "__Secure-s_a", "value": "aHYvSnVDbjdGOVlBNG83SS9Ca3I0YkFxYnMwcDIwMUxRTUljRzZ2d1VKUFZJZWxzOC9aYnA0VTVqNFJxSm1tblJDbTNEQ1orZHlzWjB6RDhNS3ZhRm5ITk93WnpXWlk0WnI3RmpFVE9uR0JYemE4aXQ3T3BKTERDUE5DaVVFTUd5K0IxTlZ0RW9vZnlQUGZQQXZZdXN2UmNPZXI3dGhlSU1KUXIyYkVReDYwcXhiUktwQWJHOWFJRHhKQXlidGJzRFBZK25pdHFqb0drNU9HZzNWTmdpVTY0YWJUN2tOU0ZPT0IvUWkvcDBHL2xrbnVxaXhzSEx4UnZxV2hsOUpDMElOUEJVMVgvbDdnbE04QzdEOENyRXNJQ3VTYnNOa2Y1N2EybUxGYzIrbm89JkN3NGMxN2FUYVY2YW1oby8rejFDelVkNmVXcz0=", "domain": ".pinterest.com"},
    {"name": "_b", "value": '"AY3q3axRiPZKY7M7Cc2XaR3ognxvPvBxbtcLJlV2LjfdjqYgvbwxEzMmbSRpmhYKqzQ="', "domain": ".pinterest.com"},
    {"name": "_routing_id", "value": '"2320575e-fd07-4104-b403-fa0f027f95a0"', "domain": "www.pinterest.com"},
]

def get_driver():
    o = Options()
    o.add_argument("--headless=new")
    o.add_argument("--no-sandbox")
    o.add_argument("--disable-gpu")
    o.add_argument("--window-size=1920,4000")
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
            try:
                cookie = {"name": c["name"], "value": c["value"]}
                if "domain" in c:
                    cookie["domain"] = c["domain"]
                d.add_cookie(cookie)
            except:
                pass
        
        d.refresh()
        time.sleep(3)
        
        d.get(url)
        time.sleep(8)
        
        log(f"[dim]Title: {d.title}[/dim]")
        log(f"[dim]URL now: {d.current_url}[/dim]")
        
        # Ищем количество пинов на странице
        count_js = """
        const el = document.querySelector('h1');
        return el ? el.innerText : '';
        """
        h1 = d.execute_script(count_js)
        log(f"[dim]H1: {h1}[/dim]")
        
        m = re.search(r'(\d+)\s*', d.title)
        if not m:
            m = re.search(r'(\d+)', h1)
        expected = int(m.group(1)) if m else 100
        log(f"[yellow]Expected: {expected} pins[/yellow]")
        
        # Парсим пины с полным дебагом
        js = """
        const results = [];
        const seen = new Set();

        document.querySelectorAll('a[href*="/pin/"]').forEach(a => {
            const href = a.href || '';
            const pinMatch = href.match(/\\/pin\\/(\\d+)/);
            if (!pinMatch) return;
            const pinId = pinMatch[1];
            
            if (seen.has(pinId)) return;
            
            let title = null;
            let aria = a.getAttribute('aria-label') || '';
            
            // «Название» в aria-label
            const m = aria.match(/«([^»]+)»/);
            if (m) {
                title = m[1];
            }
            
            let img = a.querySelector('img');
            if (!img) {
                let p = a.parentElement;
                for (let i = 0; i < 5 && p; i++) {
                    img = p.querySelector('img');
                    if (img && img.src && img.src.includes('pinimg')) break;
                    img = null;
                    p = p.parentElement;
                }
            }
            
            if (!img) return;
            
            let imageUrl = img.src;
            if (imageUrl.includes('/75x75') ||
                imageUrl.includes('/140x') ||
                imageUrl.includes('/60x60') ||
                imageUrl.includes('_RS') ||
                imageUrl.includes('/user/')) {
                return;
            }
            
            // НЕ меняем URL - оставляем как есть
            // imageUrl = imageUrl.replace(/\\/\\d+x\\d*\\//g, '/originals/');
            imageUrl = imageUrl.split('?')[0];
            
            if (!title && img.alt) {
                title = img.alt;
            }
            
            seen.add(pinId);
            results.push({
                imageUrl: imageUrl,
                title: title,
                pinId: pinId,
                sourceUrl: 'https://www.pinterest.com/pin/' + pinId + '/'
            });
        });

        return results;
        """
        
        last = 0
        no_new = 0

        for scroll in range(1, 80):
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

            if scroll % 5 == 0:
                log(f"[dim]Scroll {scroll}: {cur}/{expected}[/dim]")

            if cur >= expected:
                log(f"[green]Got {cur} >= {expected}[/green]")
                break

            if cur == last:
                no_new += 1
                if no_new >= 10: break
            else:
                no_new = 0
            last = cur

        # НЕ обрезаем до expected
        pins.reverse()

        log(f"[bold green]Total: {len(pins)} pins[/bold green]")

        # Показываем примеры URL
        log("[bold]Sample pins:[/bold]")
        for i, p in enumerate(pins[:5]):
            t = p.get('title') or '[NO TITLE]'
            url = p.get('imageUrl', '')[:50]
            log(f"  {i+1}. {t[:50]}")
            log(f"      URL: {url}...")

        # Проверка дубликатов title
        titles = [p.get('title') for p in pins if p.get('title')]
        unique_titles = set(titles)
        log(f"[yellow]Unique titles: {len(unique_titles)}/{len(titles)}[/yellow]")

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

log("[cyan]Starting v29...[/cyan]")
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
