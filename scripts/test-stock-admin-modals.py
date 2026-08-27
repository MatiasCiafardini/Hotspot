from playwright.sync_api import sync_playwright


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)

    page.goto("http://127.0.0.1:4173/admin")
    page.wait_for_load_state("networkidle")
    page.locator("input[type=email]").fill("owner@hotspot.test")
    page.locator("input[type=password]").fill("TestHotspot!2026")
    page.get_by_role("button", name="DESBLOQUEAR").click()
    page.wait_for_url("**/admin/dashboard", timeout=15000)
    page.goto("http://127.0.0.1:4173/admin/stock")
    page.get_by_role("heading", name="Control de stock").wait_for(timeout=15000)

    checks = [
        ("Listas", "Crear lista", "Nueva lista"),
        ("Items", "Agregar item", "Nuevo item"),
        ("Proveedores", "Agregar proveedor", "Nuevo proveedor"),
        ("Operadores", "Agregar operador", "Crear operador"),
    ]
    for section, button, dialog in checks:
        page.get_by_role("button", name=section, exact=True).click()
        page.get_by_role("button", name=button, exact=True).click()
        modal = page.get_by_role("dialog", name=dialog)
        modal.wait_for()
        assert modal.is_visible()
        modal.get_by_role("button", name="Cerrar").click()
        assert not modal.is_visible()

    page.get_by_role("button", name="Proveedores", exact=True).click()
    page.get_by_role("button", name="Agregar proveedor", exact=True).click()
    modal = page.get_by_role("dialog", name="Nuevo proveedor")
    modal.get_by_placeholder("Buscar productos").fill("Item de prueba 010")
    assert modal.get_by_text("Item de prueba 010", exact=True).count() == 1
    assert modal.get_by_text("Item de prueba 011", exact=True).count() == 0

    assert errors == []
    print({"ok": True, "dialogs": len(checks), "supplier_search": True})
    browser.close()
