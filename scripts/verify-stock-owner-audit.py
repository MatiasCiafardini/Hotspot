from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:4173"
PASSWORD = "TestHotspot!2026"


def login_admin(page):
    page.goto(f"{BASE_URL}/admin")
    page.wait_for_load_state("networkidle")
    page.locator("input[type=email]").fill("owner@hotspot.test")
    page.locator("input[type=password]").fill(PASSWORD)
    page.get_by_role("button", name="DESBLOQUEAR").click()
    page.wait_for_timeout(2500)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    owner = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    owner.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    login_admin(owner)
    owner.goto(f"{BASE_URL}/admin/stock")
    owner.get_by_role("heading", name="Control de stock").wait_for(timeout=15000)
    owner.get_by_role("button", name="Crear lista", exact=True).wait_for(timeout=15000)

    cards = owner.locator("a", has_text="Abrir")
    assert cards.count() == 3
    hrefs = [cards.nth(index).get_attribute("href") for index in range(cards.count())]
    assert set(hrefs) == {"/stock/cocina-y-producci-n", "/stock/bebidas", "/stock/packaging-y-despacho"}, hrefs

    owner.get_by_role("button", name="Items", exact=True).click()
    owner.get_by_placeholder("Buscar items", exact=True).wait_for()
    item_rows = owner.locator("button", has_text="Editar")
    assert item_rows.count() == 17

    owner.get_by_role("button", name="Proveedores", exact=True).click()
    owner.get_by_role("button", name="Agregar proveedor", exact=True).wait_for()
    supplier_cards = owner.locator("button", has_text="Archivar")
    assert supplier_cards.count() == 6

    for email, paths in [
        ("lucas.cocina@hotspot.local", ["/stock/cocina-y-producci-n", "/stock/packaging-y-despacho"]),
        ("sofia.encargada@hotspot.local", ["/stock/cocina-y-producci-n", "/stock/bebidas", "/stock/packaging-y-despacho"]),
    ]:
        for path in paths:
            context = browser.new_context(viewport={"width": 390, "height": 844})
            operator = context.new_page()
            operator.goto(f"{BASE_URL}{path}")
            operator.wait_for_load_state("networkidle")
            operator.locator("input[type=email]").fill(email)
            operator.locator("input[type=password]").fill(PASSWORD)
            operator.get_by_role("button", name="Ingresar").click()
            operator.wait_for_timeout(2500)
            try:
                operator.locator("article").first.wait_for(timeout=15000)
            except Exception:
                raise AssertionError((email, path, operator.locator("body").inner_text()[:500]))
            context.close()

    print({"ok": True, "items": 17, "suppliers": 6, "lists": 3, "operator_access": True, "console_errors": errors})
    browser.close()
