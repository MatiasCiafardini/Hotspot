from pathlib import Path
import re
from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:4173"
PASSWORD = "TestHotspot!2026"

PRODUCTS = [
    ("Carne para medallones", "kg", "CARNE-001", 18, 5, 25),
    ("Pan de papa", "unidad", "PAN-001", 120, 40, 180),
    ("Cheddar en fetas", "unidad", "CHED-001", 180, 60, 250),
    ("Panceta", "kg", "PANC-001", 8, 2, 12),
    ("Lechuga", "kg", "VEG-LEC", 4, 1, 6),
    ("Tomate", "kg", "VEG-TOM", 7, 2, 10),
    ("Cebolla", "kg", "VEG-CEB", 6, 2, 10),
    ("Papas congeladas", "kg", "PAPA-001", 35, 10, 50),
    ("Aros de cebolla congelados", "kg", "AROS-001", 12, 4, 20),
    ("Aceite para freidora", "litro", "ACEI-001", 20, 6, 30),
    ("Ketchup", "kg", "SALS-KET", 10, 3, 15),
    ("Mayonesa", "kg", "SALS-MAY", 10, 3, 15),
    ("Coca-Cola lata", "unidad", "BEB-COCA", 72, 24, 120),
    ("Agua mineral", "unidad", "BEB-AGUA", 48, 18, 72),
    ("Caja para hamburguesa", "unidad", "PACK-CAJA", 150, 50, 250),
    ("Bolsa para delivery", "unidad", "PACK-BOLSA", 120, 40, 200),
    ("Servilletas", "unidad", "PACK-SERV", 600, 200, 1000),
]

SUPPLIERS = [
    ("Frigorífico Don José", "5492326555011", "Ruta 8 km 96,5", "Lun a sáb 7:00 a 13:00", "Entregas martes y viernes", ["Carne para medallones", "Panceta"]),
    ("Panadería La Estación", "5492326555022", "Av. Mitre 845", "Todos los días 5:00 a 12:00", "Pedido antes de las 18 h", ["Pan de papa"]),
    ("Mercado Fresco", "5492326555033", "Sarmiento 1220", "Lun a sáb 6:00 a 14:00", "Verdura seleccionada", ["Lechuga", "Tomate", "Cebolla"]),
    ("Distribuidora Sabores", "5492326555044", "Parque Industrial, nave 14", "Lun a vie 8:00 a 17:00", "Entrega en 24 horas", ["Cheddar en fetas", "Papas congeladas", "Aros de cebolla congelados", "Aceite para freidora", "Ketchup", "Mayonesa"]),
    ("Bebidas del Oeste", "5492326555055", "Colectora Norte 320", "Lun a vie 8:00 a 16:00", "Retornables por separado", ["Coca-Cola lata", "Agua mineral"]),
    ("Packaging Centro", "5492326555066", "Belgrano 430", "Lun a vie 9:00 a 18:00", "Bultos cerrados", ["Caja para hamburguesa", "Bolsa para delivery", "Servilletas"]),
]

LISTS = [
    ("Cocina y producción", "Control de insumos de cocina antes de cada turno", [p[0] for p in PRODUCTS[:12]], ["lucas.cocina@hotspot.local", "sofia.encargada@hotspot.local"]),
    ("Bebidas", "Conteo de heladeras y depósito de bebidas", ["Coca-Cola lata", "Agua mineral"], ["sofia.encargada@hotspot.local"]),
    ("Packaging y despacho", "Materiales para armado y entrega de pedidos", ["Caja para hamburguesa", "Bolsa para delivery", "Servilletas"], ["lucas.cocina@hotspot.local", "sofia.encargada@hotspot.local"]),
]


def click_unique(locator):
    assert locator.count() == 1
    locator.click()


def fill_dialog(dialog, placeholder, value):
    field = dialog.get_by_placeholder(placeholder, exact=True)
    assert field.count() == 1
    field.fill(str(value))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    console_errors = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)

    page.goto(f"{BASE_URL}/admin")
    page.wait_for_load_state("networkidle")
    page.locator("input[type=email]").fill("owner@hotspot.test")
    page.locator("input[type=password]").fill(PASSWORD)
    click_unique(page.get_by_role("button", name="DESBLOQUEAR"))
    page.wait_for_timeout(2500)
    assert page.get_by_text("ENTORNO LOCAL DE PRUEBAS", exact=False).count() == 1
    page.goto(f"{BASE_URL}/admin/stock")
    page.get_by_role("heading", name="Control de stock").wait_for(timeout=15000)

    click_unique(page.get_by_role("button", name="Items", exact=True))
    page.get_by_role("button", name="Agregar item", exact=True).wait_for(timeout=15000)
    while page.locator("button", has_text="Mostrar 25 mas").count() == 1:
        page.locator("button", has_text="Mostrar 25 mas").click()
    for name, unit, sku, quantity, minimum, target in PRODUCTS:
        if page.get_by_text(name, exact=True).count() == 1:
            continue
        click_unique(page.get_by_role("button", name="Agregar item", exact=True))
        dialog = page.get_by_role("dialog", name="Nuevo item")
        dialog.wait_for()
        fill_dialog(dialog, "Nombre", name)
        fill_dialog(dialog, "Unidad", unit)
        fill_dialog(dialog, "SKU", sku)
        fill_dialog(dialog, "Cantidad", quantity)
        fill_dialog(dialog, "Minimo", minimum)
        fill_dialog(dialog, "Objetivo", target)
        click_unique(dialog.get_by_role("button", name="Guardar", exact=True))
        dialog.wait_for(state="hidden", timeout=15000)

    click_unique(page.get_by_role("button", name="Operadores", exact=True))
    for name, email in [("Lucas Cocina", "lucas.cocina@hotspot.local"), ("Sofía Encargada", "sofia.encargada@hotspot.local")]:
        if page.get_by_text(email, exact=True).count() == 1:
            continue
        click_unique(page.get_by_role("button", name="Agregar operador", exact=True))
        dialog = page.get_by_role("dialog", name="Crear operador")
        dialog.wait_for()
        fill_dialog(dialog, "Nombre", name)
        fill_dialog(dialog, "Email", email)
        fill_dialog(dialog, "Contraseña temporal", PASSWORD)
        click_unique(dialog.get_by_role("button", name="Crear", exact=True))
        dialog.wait_for(state="hidden", timeout=15000)

    click_unique(page.get_by_role("button", name="Proveedores", exact=True))
    for name, phone, address, hours, notes, products in SUPPLIERS:
        supplier_name = page.get_by_text(name, exact=True)
        if supplier_name.count() == 1:
            card = supplier_name.locator("..")
            click_unique(card.get_by_role("button", name="Editar", exact=True))
            dialog = page.get_by_role("dialog", name="Editar proveedor")
        else:
            click_unique(page.get_by_role("button", name="Agregar proveedor", exact=True))
            dialog = page.get_by_role("dialog", name="Nuevo proveedor")
        dialog.wait_for()
        fill_dialog(dialog, "Nombre", name)
        fill_dialog(dialog, "WhatsApp (549...)", phone)
        fill_dialog(dialog, "Direccion", address)
        fill_dialog(dialog, "Horarios", hours)
        fill_dialog(dialog, "Observaciones", notes)
        for product in products:
            search = dialog.get_by_placeholder("Buscar productos", exact=True)
            search.fill(product)
            label = dialog.locator("label", has_text=re.compile(f"^{re.escape(product)}"))
            label.wait_for(timeout=5000)
            assert label.count() == 1
            boxes = label.locator('input[type="checkbox"]')
            assert boxes.count() in (1, 2)
            if boxes.count() == 1:
                boxes.check()
                boxes = label.locator('input[type="checkbox"]')
            assert boxes.count() == 2
            boxes.nth(1).check()
        dialog.get_by_placeholder("Buscar productos", exact=True).fill("")
        click_unique(dialog.get_by_role("button", name="Guardar", exact=True))
        page.wait_for_timeout(1200)
        if dialog.is_visible():
            print({"supplier_save_failed": name, "messages": page.locator("[data-sonner-toast]").all_inner_texts()})
        dialog.wait_for(state="hidden", timeout=15000)

    click_unique(page.get_by_role("button", name="Listas", exact=True))
    for name, description, products, operators in LISTS:
        click_unique(page.get_by_role("button", name="Crear lista", exact=True))
        dialog = page.get_by_role("dialog", name="Nueva lista")
        dialog.wait_for()
        fill_dialog(dialog, "Nombre", name)
        fill_dialog(dialog, "Descripcion", description)
        for product in products:
            label = dialog.locator("label", has_text=re.compile(f"^{re.escape(product)}"))
            assert label.count() == 1
            boxes = label.locator('input[type="checkbox"]')
            assert boxes.count() == 1
            boxes.check()
        for operator in operators:
            label = dialog.locator("label", has_text=operator)
            assert label.count() == 1
            box = label.locator('input[type="checkbox"]')
            assert box.count() == 1
            box.check()
        click_unique(dialog.get_by_role("button", name="Guardar", exact=True))
        dialog.wait_for(state="hidden", timeout=15000)

    Path("artifacts").mkdir(exist_ok=True)
    page.screenshot(path="artifacts/stock-auditoria-listas.png", full_page=True)
    click_unique(page.get_by_role("button", name="Proveedores", exact=True))
    page.screenshot(path="artifacts/stock-auditoria-proveedores.png", full_page=True)
    click_unique(page.get_by_role("button", name="Reportes y pedidos", exact=True))
    page.screenshot(path="artifacts/stock-auditoria-reportes.png", full_page=True)

    assert console_errors == []
    print({"ok": True, "products": len(PRODUCTS), "suppliers": len(SUPPLIERS), "lists": len(LISTS), "operators": 2})
    browser.close()
