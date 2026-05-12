-- Real Hotspot menu. Keeps old products in history but hides them from the public menu.

INSERT INTO public.product_categories (key, label, sort_order, active) VALUES
  ('burgers', 'Hamburguesas', 1, true),
  ('sides', 'Papas y acompañamientos', 2, true),
  ('combos', 'Combos', 3, true),
  ('proteico', 'Menú proteico', 4, true),
  ('drinks', 'Bebidas', 5, true),
  ('extras', 'Extras', 6, true)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active;

UPDATE public.products SET available = false;

INSERT INTO public.products (
  name, description, price, category, image_url, badge, available, sort_order,
  stock_quantity, low_stock_threshold, ingredients
) VALUES
  ('BIG MC', 'Doble carne, doble cheddar, salsita BIG MC, lechuga y pepinillos. Viene con papas.', 16000, 'burgers', '/src/assets/burger-double.jpg', 'NUEVA', true, 1, 30, 5, ARRAY['Doble carne','Doble cheddar','Salsita BIG MC','Lechuga','Pepinillos','Papas']),
  ('Terra Burguer', 'BBQ, cebolla crispy, desmechadito de roast beef, crema griega y verdeito fino. Edición limitada. Viene con papas.', 17000, 'burgers', '/src/assets/burger-spicy.jpg', 'LIMITADA', true, 2, 30, 5, ARRAY['Doble carne','BBQ','Cebolla crispy','Roast beef desmechado','Crema griega','Verdeito fino','Papas']),
  ('Cuarto Heinz Burguer', 'Doble carne, doble cheddar, aderezos Heinz importados, mayonesa, mostaza, ketchup, cebollita cruda y pepinillos de la casa. Viene con papas.', 16000, 'burgers', '/src/assets/burger-classic.jpg', 'USA', true, 3, 30, 5, ARRAY['Doble carne','Doble cheddar','Mayonesa Heinz','Mostaza Heinz','Ketchup Heinz','Cebolla cruda','Pepinillos','Papas']),
  ('Sweet Baby', 'Doble carne, doble cheddar, Sweet Baby BBQ importada, cebolla caramel, bacon y aros de cebolla. Viene con papas.', 17000, 'burgers', '/src/assets/burger-spicy.jpg', 'USA', true, 4, 30, 5, ARRAY['Doble carne','Doble cheddar','Sweet Baby BBQ','Cebolla caramel','Bacon','Aros de cebolla','Papas']),
  ('Golden Hot''s', 'Alioli de verdeo, doble carne, doble cheddar, mermelada de bacon y full cebollita crispy. Viene con papas.', 17000, 'burgers', '/src/assets/burger-double.jpg', 'TOP', true, 5, 30, 5, ARRAY['Doble carne','Doble cheddar','Alioli de verdeo','Mermelada de bacon','Cebollita crispy','Papas']),
  ('La Rasta', 'Alioli de roque, cebolla caramel, doble carne, provolone y parra verde de rúcula. Viene con papas.', 16000, 'burgers', '/src/assets/burger-veggie.jpg', null, true, 6, 30, 5, ARRAY['Doble carne','Provolone','Alioli de roque','Cebolla caramel','Rúcula','Papas']),
  ('La Gaucha', 'Mayonesa, doble carne, queso ahumado, criolla ahumada y parra verde de rúcula. Viene con papas.', 15000, 'burgers', '/src/assets/burger-classic.jpg', null, true, 7, 30, 5, ARRAY['Doble carne','Queso ahumado','Mayonesa','Criolla ahumada','Rúcula','Papas']),
  ('Hot''s Checken', 'Mayo picante, dedos de pollo x3, lechuga, tomate y mostaza. Viene con papas.', 15500, 'burgers', '/src/assets/burger-spicy.jpg', 'POLLO', true, 8, 30, 5, ARRAY['Dedos de pollo x3','Mayo picante','Lechuga','Tomate','Mostaza','Papas']),
  ('BACO BURGUER', 'Doble carne, cheddar, cebollita al vino tinto, aros de cebolla, bacon, BBQ y alioli. Viene con papas.', 16000, 'burgers', '/src/assets/burger-double.jpg', null, true, 9, 30, 5, ARRAY['Doble carne','Cheddar','Cebollita al vino tinto','Aros de cebolla','Bacon','BBQ','Alioli','Papas']),
  ('AMERICAN', 'Doble carne, cheddar, cebollita, lechuga, tomate, pepinillos, thousand, alioli y ketchup. Viene con papas.', 16000, 'burgers', '/src/assets/burger-classic.jpg', null, true, 10, 30, 5, ARRAY['Doble carne','Cheddar','Cebollita','Lechuga','Tomate','Pepinillos','Thousand','Alioli','Ketchup','Papas']),
  ('CRISPY', 'Doble carne, doble cheddar, bacon, cebolla crispy, barbacoa y alioli. Viene con papas.', 16000, 'burgers', '/src/assets/burger-spicy.jpg', null, true, 11, 30, 5, ARRAY['Doble carne','Doble cheddar','Bacon','Cebolla crispy','Barbacoa','Alioli','Papas']),
  ('CHEESE BURGER', 'Simple pero letal: doble carne, doble cheddar y nada más. Viene con papas.', 13500, 'burgers', '/src/assets/burger-double.jpg', null, true, 12, 30, 5, ARRAY['Doble carne','Doble cheddar','Papas']),
  ('HOTSPOT CLASSIC', 'Doble carne, doble cheddar, cebollita cruda, ketchup y thousand. Viene con papas.', 14000, 'burgers', '/src/assets/burger-classic.jpg', 'TOP', true, 13, 30, 5, ARRAY['Doble carne','Doble cheddar','Cebollita cruda','Ketchup','Thousand','Papas']),
  ('BBQ', 'Doble carne, doble cheddar, cebollita caramel, bacon y barbacoa. Viene con papas.', 16000, 'burgers', '/src/assets/burger-spicy.jpg', null, true, 14, 30, 5, ARRAY['Doble carne','Doble cheddar','Cebollita caramel','Bacon','Barbacoa','Papas']),
  ('PROVOLONE', 'Doble carne, doble provolone, bacon, ketchup y alioli. Viene con papas.', 16000, 'burgers', '/src/assets/burger-double.jpg', null, true, 15, 30, 5, ARRAY['Doble carne','Doble provolone','Bacon','Ketchup','Alioli','Papas']),
  ('ZAPIOLA BURGUER', 'Doble carne smasheada con cebolla, doble cheddar, mostaza y pepinillos. Viene con papas.', 14500, 'burgers', '/src/assets/burger-classic.jpg', null, true, 16, 30, 5, ARRAY['Doble carne smasheada','Cebolla','Doble cheddar','Mostaza','Pepinillos','Papas']),

  ('Papas Crosstrax solas', 'Papas tipo Crosstrax o regillas. Porción para compartir.', 12000, 'sides', '/src/assets/side-fries.jpg', null, true, 101, 40, 8, ARRAY['Papas Crosstrax']),
  ('Papas Crosstrax con cheddar', 'Papas tipo Crosstrax o regillas con cheddar. Porción para compartir.', 16000, 'sides', '/src/assets/side-fries.jpg', null, true, 102, 40, 8, ARRAY['Papas Crosstrax','Cheddar']),
  ('Desmechadito Crosstrax', 'Papas tipo Crosstrax o regillas con desmechadito. Porción para compartir.', 20000, 'sides', '/src/assets/side-fries.jpg', 'FULL', true, 103, 40, 8, ARRAY['Papas Crosstrax','Desmechadito']),
  ('Papas con cheddar', 'Papas con cheddar, alioli, bacon y verdeo. Ideal para compartir.', 14000, 'sides', '/src/assets/side-fries.jpg', null, true, 104, 40, 8, ARRAY['Papas','Cheddar','Alioli','Bacon','Verdeo']),
  ('Papas individuales', 'Porción individual de papas.', 7000, 'sides', '/src/assets/side-fries.jpg', null, true, 105, 40, 8, ARRAY['Papas']),
  ('Nuggets o aros de cebolla x18', 'Elegí nuggets o aros de cebolla. Porción de 18 unidades.', 14000, 'sides', '/src/assets/side-rings.jpg', null, true, 106, 40, 8, ARRAY['Nuggets o aros de cebolla']),
  ('Nuggets o aros de cebolla x7', 'Elegí nuggets o aros de cebolla. Porción de 7 unidades.', 7000, 'sides', '/src/assets/side-rings.jpg', null, true, 107, 40, 8, ARRAY['Nuggets o aros de cebolla']),
  ('Dedos de pollo x10', 'Dedos de pollo, porción de 10 unidades.', 14000, 'sides', '/src/assets/side-rings.jpg', 'POLLO', true, 108, 40, 8, ARRAY['Dedos de pollo']),
  ('Dedos de pollo x5', 'Dedos de pollo, porción de 5 unidades.', 5000, 'sides', '/src/assets/side-rings.jpg', 'POLLO', true, 109, 40, 8, ARRAY['Dedos de pollo']),

  ('Mystery Box', '2 Cheesebacon en una pileta de cheddar + papas x2 + nuggets x1 + 2 bebidas.', 40000, 'combos', '/src/assets/burger-double.jpg', 'BOX', true, 201, 20, 5, ARRAY['2 Cheesebacon','Cheddar','Papas x2','Nuggets x1','2 bebidas']),
  ('Mystery Box individual', 'Versión individual de la Mystery Box.', 20000, 'combos', '/src/assets/burger-double.jpg', 'BOX', true, 202, 20, 5, ARRAY['Cheesebacon','Cheddar','Papas','Nuggets','Bebida']),

  ('Pollito Crispy', 'Mix de verdes, cherrys confitados, parmesano rallado, cubitos de queso, huevo poché, alioli cítrico. Opcional: vinagreta de mostaza y miel.', 16000, 'proteico', '/src/assets/burger-veggie.jpg', 'PROTE', true, 301, 20, 5, ARRAY['Mix de verdes','Cherrys confitados','Parmesano','Cubitos de queso','Huevo poché','Alioli cítrico']),
  ('Full Prote', 'Mix de verdes, endivias, palta, cherrys confitados, parmesano, cubitos de queso, albahaca fresca, ricota, huevo poché, churrasquito de cuadril, frutos secos tostados y alioli de la casa.', 18000, 'proteico', '/src/assets/burger-veggie.jpg', 'PROTE', true, 302, 20, 5, ARRAY['Mix de verdes','Endivias','Palta','Cherrys','Parmesano','Ricota','Huevo poché','Cuadril','Frutos secos','Alioli']),
  ('Turbo Carbo', 'Pasta, cebollita morada, zanahoria, morrón en brunoise, choclo, mayo de palta, verdeo, atún, huevo poché y frutos secos tostados.', 16000, 'proteico', '/src/assets/burger-veggie.jpg', 'PROTE', true, 303, 20, 5, ARRAY['Pasta','Cebolla morada','Zanahoria','Morrón','Choclo','Mayo de palta','Verdeo','Atún','Huevo poché','Frutos secos']),
  ('César de la casa', 'Mix de verdes, parmesano rallado, cubitos de queso, pollito salteado, crutones, huevo poché, césar de la casa y lluvia de semillas.', 16000, 'proteico', '/src/assets/burger-veggie.jpg', 'PROTE', true, 304, 20, 5, ARRAY['Mix de verdes','Parmesano','Cubitos de queso','Pollo salteado','Crutones','Huevo poché','César de la casa','Semillas']),
  ('Oriental Style', 'Fideos de arroz con vegetales salteados: zuchinis, zanahoria, champiñón, morrón amarillo, cebolla, brotes de soja, huevito coreano, verdeo y mix de semillas.', 16000, 'proteico', '/src/assets/burger-veggie.jpg', 'PROTE', true, 305, 20, 5, ARRAY['Fideos de arroz','Zuchinis','Zanahoria','Champiñón','Morrón amarillo','Cebolla','Brotes de soja','Huevo coreano','Verdeo','Semillas']),

  ('Agregado de pollo', 'Opcional para menú proteico.', 4000, 'extras', '/src/assets/side-rings.jpg', null, true, 401, 40, 8, ARRAY['Pollo']),
  ('Agregado de gambas y salsa de ostras', 'Opcional para Oriental Style.', 7000, 'extras', '/src/assets/side-rings.jpg', null, true, 402, 40, 8, ARRAY['Gambas','Salsa de ostras']),
  ('Agrandá tu burguer', 'Agregá más carne y más cheddar a tu hamburguesa.', 3500, 'extras', '/src/assets/burger-double.jpg', 'EXTRA', true, 403, 40, 8, ARRAY['Carne extra','Cheddar extra']),

  ('Lata Pepsi o 7up', 'Lata de gaseosa Pepsi o 7up.', 2500, 'drinks', '/src/assets/drink-cola.jpg', null, true, 501, 60, 10, ARRAY[]::TEXT[]),
  ('Lata de cerveza', 'Cerveza en lata.', 5000, 'drinks', '/src/assets/drink-shake.jpg', null, true, 502, 60, 10, ARRAY[]::TEXT[]);
