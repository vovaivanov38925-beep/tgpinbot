#!/usr/bin/env python3
import sys, os, time, json, re
os.environ['PYTHONUNBUFFERED'] = '1'

from rich.console import Console
from rich.panel import Panel
console = Console()

def log(m):
    console.print(m)
    sys.stdout.flush()

console.print(Panel.fit(
    "[bold red]Pinterest DEBUG v26[/bold red]\n[dim]Analyze DOM structure[/dim]",
    title="🔍 DEBUG"
))

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

COOKIES = [
    {"name": "cm_sub", "value": "allowed", "domain": "www.pinterest.com"},
    {"name": "_b", "value": "\"AY3q3axRiPZKY7M7Cc2XaR3ognxvPvBxbtcLJlV2LjfdjqYgvbwxEzMmbSRpmhYKqzQ=\"", "domain": ".pinterest.com"},
]

def get_driver():
    o = Options()
    o.add_argument("--headless=new")
    o.add_argument("--no-sandbox")
    o.add_argument("--disable-gpu")
    o.add_argument("--window-size=1920,3000")
    return webdriver.Chrome(o)

# Тестовый URL
url = "https://www.pinterest.com/MariaWestHealth/1500-%D0%BA%D0%B0%D0%BB%D0%BE%D1%80%D0%B8%D0%B9-%D0%B2-%D0%B4%D0%B5%D0%BD%D1%8C-%D0%BF%D1%80%D0%B0%D0%B2%D0%B8%D0%BB%D1%8C%D0%BD%D0%BE%D0%B5-%D0%BF%D0%B8%D1%82%D0%B0%D0%BD%D0%B8%D0%B5"

log(f"[cyan]URL: {url}[/cyan]")

d = get_driver()

d.get("https://www.pinterest.com")
time.sleep(2)
for c in COOKIES:
    try: d.add_cookie(c)
    except: pass

d.get(url)
time.sleep(6)

# Анализируем структуру
log("[bold yellow]=== АНАЛИЗ DOM ===[/bold yellow]")

# 1. Ищем все ссылки на пины
js1 = '''
const pins = [];
document.querySelectorAll('a[href*="/pin/"]').forEach((a, i) => {
    if (i >= 5) return; // только первые 5
    
    const href = a.href;
    const aria = a.getAttribute('aria-label') || '';
    const text = a.innerText.substring(0, 50);
    
    // Ищем родительские data-атрибуты
    let parent = a.parentElement;
    let dataAttrs = {};
    for (let j = 0; j < 5 && parent; j++) {
        if (parent.dataset) {
            for (let key in parent.dataset) {
                if (!dataAttrs[key]) dataAttrs[key] = parent.dataset[key].substring(0, 30);
            }
        }
        parent = parent.parentElement;
    }
    
    pins.push({href, aria, text, dataAttrs});
});
return pins;
'''

result = d.execute_script(js1)
log(f"[bold]Найдено ссылок /pin/ (первые 5):[/bold]")
for i, p in enumerate(result):
    log(f"  [cyan]{i+1}.[/cyan] href: {p['href'][:50]}")
    log(f"       aria-label: [yellow]{p['aria'][:60]}[/yellow]")
    log(f"       text: {p['text'][:40]}")
    log(f"       data-attrs: {json.dumps(p['dataAttrs'], ensure_ascii=False)[:80]}")
    log("")

# 2. Ищем все элементы с aria-label содержащим «
js2 = '''
const els = [];
document.querySelectorAll('[aria-label*="«"]').forEach((el, i) => {
    if (i >= 5) return;
    const aria = el.getAttribute('aria-label');
    const tag = el.tagName;
    const href = el.href || (el.querySelector('a')?.href) || '';
    els.push({aria, tag, href: href.substring(0, 50)});
});
return els;
'''

result2 = d.execute_script(js2)
log(f"[bold]Элементы с « в aria-label:[/bold]")
for i, p in enumerate(result2):
    log(f"  [cyan]{i+1}.[/cyan] [{p['tag']}] {p['aria'][:70]}")
    log(f"       href: {p['href']}")
    log("")

# 3. Ищем все data-test-id
js3 = '''
const testIds = [];
document.querySelectorAll('[data-test-id]').forEach((el, i) => {
    if (i >= 10) return;
    const tid = el.getAttribute('data-test-id');
    if (!testIds.includes(tid)) testIds.push(tid);
});
return testIds;
'''

result3 = d.execute_script(js3)
log(f"[bold]data-test-id на странице:[/bold]")
log(f"  {result3}")

# 4. Скриншот первых aria-label без «
js4 = '''
const els = [];
document.querySelectorAll('a[href*="/pin/"][aria-label]').forEach((a, i) => {
    if (i >= 5) return;
    els.push(a.getAttribute('aria-label'));
});
return els;
'''

result4 = d.execute_script(js4)
log(f"[bold]aria-label у ссылок на пины (без фильтра):[/bold]")
for i, aria in enumerate(result4):
    log(f"  [cyan]{i+1}.[/cyan] {aria[:100]}")

d.quit()
log("[green]Done[/green]")
