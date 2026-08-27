from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:4173"
PASSWORD = "TestHotspot!2026"


def admin_login(page):
    page.goto(f"{BASE_URL}/admin")
    page.wait_for_load_state("networkidle")
    page.locator("input[type=email]").fill("owner@hotspot.test")
    page.locator("input[type=password]").fill(PASSWORD)
    page.get_by_role("button", name="DESBLOQUEAR").click()
    page.wait_for_timeout(2500)
    page.goto(f"{BASE_URL}/admin/stock")
    page.get_by_role("heading", name="Control de stock").wait_for(timeout=15000)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)

    owner = browser.new_page(viewport={"width": 1440, "height": 900})
    admin_login(owner)
    owner.get_by_role("button", name="Crear lista", exact=True).wait_for(timeout=15000)

    kitchen = owner.get_by_text("Cocina y producción", exact=True).locator("../..")
    kitchen.get_by_role("button", name="Editar", exact=True).click()
    list_dialog = owner.get_by_role("dialog", name="Editar lista")
    list_dialog.get_by_placeholder("Enlace de la lista", exact=True).fill("cocina-y-produccion")
    assert list_dialog.get_by_text("Lucas Cocina", exact=False).count() == 1
    list_dialog.get_by_role("button", name="Guardar", exact=True).click()
    list_dialog.wait_for(state="hidden", timeout=15000)

    owner.get_by_role("button", name="Proveedores", exact=True).click()
    owner.get_by_role("button", name="Agregar proveedor", exact=True).wait_for(timeout=15000)
    supplier = owner.get_by_text("Frigorífico Don José", exact=True).locator("..")
    supplier.get_by_role("button", name="Editar", exact=True).click()
    supplier_dialog = owner.get_by_role("dialog", name="Editar proveedor")
    supplier_dialog.get_by_placeholder("Observaciones", exact=True).fill("Entregas martes y viernes. Confirmar peso por WhatsApp.")
    supplier_dialog.get_by_role("button", name="Guardar", exact=True).click()
    supplier_dialog.wait_for(state="hidden", timeout=15000)
    assert owner.get_by_text("Frigorífico Don José", exact=True).count() == 1

    owner.get_by_role("button", name="Reportes y pedidos", exact=True).click()
    owner.get_by_text("Pedidos guardados", exact=True).wait_for(timeout=15000)
    owner.wait_for_timeout(800)
    assert owner.locator("p", has_text="Borrador").count() == 3
    pending = owner.get_by_role("button", name="Pedido pendiente", exact=True)
    assert pending.count() == 3
    assert all(not pending.nth(index).is_enabled() for index in range(pending.count()))

    operator = browser.new_page(viewport={"width": 390, "height": 844})
    operator.goto(f"{BASE_URL}/stock/cocina-y-produccion")
    operator.wait_for_load_state("networkidle")
    operator.locator("input[type=email]").fill("lucas.cocina@hotspot.local")
    operator.locator("input[type=password]").fill(PASSWORD)
    operator.get_by_role("button", name="Ingresar").click()
    operator.locator("article").first.wait_for(timeout=15000)
    assert operator.get_by_placeholder("Buscar producto", exact=True).count() == 1
    assert operator.get_by_text("Hamburguesas honestas", exact=False).count() == 0
    save = operator.get_by_role("button", name="Guardar control", exact=True)
    assert save.is_enabled()
    operator.get_by_placeholder("Observaciones del control", exact=True).fill("Control sin diferencias")
    save.click()
    operator.get_by_text("Control diario guardado.", exact=True).wait_for(timeout=15000)

    operator.goto(f"{BASE_URL}/stock/packaging-y-despacho")
    operator.locator("article").first.wait_for(timeout=15000)
    assert operator.get_by_role("heading", name="Packaging y despacho", exact=True).count() == 1

    owner.get_by_role("button", name="Historial", exact=True).click()
    owner.get_by_text("Control sin diferencias", exact=True).wait_for(timeout=15000)
    assert owner.locator("p", has_text="Lucas Cocina").count() >= 1

    print({"ok": True, "atomic_supplier": True, "duplicate_orders_blocked": True, "unchanged_count": True, "list_switch": True, "fresh_history": True})
    browser.close()
