from playwright.sync_api import sync_playwright


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 390, "height": 844})
    errors = []
    auth_urls = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("request", lambda request: auth_urls.append(request.url) if "/auth/v1/" in request.url else None)
    page.goto("http://127.0.0.1:4173/stock/stock-general")
    page.wait_for_load_state("networkidle")
    if page.locator("input[type=email]").count() == 0:
        print({"initial_url": page.url, "initial_text": page.locator("body").inner_text(), "console_errors": errors})
    page.locator("input[type=email]").fill("operador@hotspot.test")
    page.locator("input[type=password]").fill("TestHotspot!2026")
    page.get_by_role("button", name="Ingresar").click()
    page.wait_for_timeout(2500)
    if page.get_by_role("heading", name="Stock general").count() == 0:
        print({"url": page.url, "visible_text": page.locator("body").inner_text(), "auth_urls": auth_urls, "console_errors": errors})
    page.get_by_role("heading", name="Stock general").wait_for(timeout=15000)

    articles = page.locator("article")
    item_count = articles.count()
    first_item = articles.first
    quantity = first_item.locator("input[type=number]")
    before = float(quantity.input_value())
    first_item.locator('button[aria-label^="Sumar "]').click()
    after = float(quantity.input_value())
    page.get_by_role("button", name="Guardar control").click()
    page.get_by_text("Control diario guardado.").wait_for(timeout=15000)
    page.wait_for_timeout(500)
    persisted = float(page.locator("article").first.locator("input[type=number]").input_value())

    assert item_count == 100
    assert after > before
    assert persisted == after
    assert page.get_by_text("Entorno local de pruebas · No es produccion").count() == 1
    assert errors == []
    print({"ok": True, "items": item_count, "before": before, "after": after, "persisted": persisted})
    browser.close()
