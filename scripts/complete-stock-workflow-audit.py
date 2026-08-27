from pathlib import Path
from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:4173"
PASSWORD = "TestHotspot!2026"


def owner_login(page):
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
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    owner_login(page)
    page.get_by_role("button", name="Items", exact=True).click()
    page.get_by_role("button", name="Agregar item", exact=True).wait_for(timeout=15000)

    for product, quantity in [("Lechuga", "0.8"), ("Coca-Cola lata", "18"), ("Caja para hamburguesa", "35")]:
        row = page.get_by_text(product, exact=True).locator("..")
        row.get_by_role("button", name="Editar", exact=True).click()
        dialog = page.get_by_role("dialog", name="Editar item")
        dialog.wait_for()
        dialog.get_by_placeholder("Cantidad", exact=True).fill(quantity)
        dialog.get_by_role("button", name="Guardar", exact=True).click()
        dialog.wait_for(state="hidden", timeout=15000)

    page.get_by_role("button", name="Reportes y pedidos", exact=True).click()
    page.get_by_text("Faltantes (3)", exact=True).wait_for(timeout=15000)
    if page.get_by_role("button", name="Marcar pedido", exact=True).count() == 0:
        for supplier in ["Mercado Fresco", "Bebidas del Oeste", "Packaging Centro"]:
            panel = page.get_by_text(f"Pedido a {supplier}", exact=True).locator("..")
            panel.get_by_role("button", name="Crear y copiar", exact=True).click()
            page.wait_for_timeout(1200)

    assert page.get_by_text("Pedidos guardados", exact=True).count() == 1
    assert page.get_by_role("button", name="Marcar pedido", exact=True).count() == 3
    Path("artifacts").mkdir(exist_ok=True)
    page.screenshot(path="artifacts/stock-auditoria-pedidos.png", full_page=True)

    context = browser.new_context(viewport={"width": 390, "height": 844})
    operator = context.new_page()
    operator.goto(f"{BASE_URL}/stock/cocina-y-producci-n")
    operator.wait_for_load_state("networkidle")
    operator.locator("input[type=email]").fill("lucas.cocina@hotspot.local")
    operator.locator("input[type=password]").fill(PASSWORD)
    operator.get_by_role("button", name="Ingresar").click()
    operator.locator("article").first.wait_for(timeout=15000)
    operator.get_by_placeholder("Observaciones del control", exact=True).fill("Control inicial de apertura")
    meat = operator.locator("article", has_text="Carne para medallones")
    assert meat.count() == 1
    meat.locator('input[type="number"]').fill("17.5")
    operator.get_by_role("button", name="Guardar control", exact=True).click()
    operator.get_by_text("Control diario guardado.", exact=True).wait_for(timeout=15000)
    operator.screenshot(path="artifacts/stock-auditoria-operador.png", full_page=True)
    context.close()

    page.get_by_role("button", name="Historial", exact=True).click()
    page.get_by_text("Control inicial de apertura", exact=True).wait_for(timeout=15000)
    print({"ok": True, "shortages": 3, "draft_orders": 3, "daily_count": True})
    browser.close()
