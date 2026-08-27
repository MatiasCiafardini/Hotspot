# Pruebas locales de stock

Este entorno usa Docker y Supabase local. No comparte datos ni credenciales con produccion.

## Preparar y validar la base

```powershell
npm run staging:start
npm run staging:test
```

`staging:test` reconstruye exclusivamente la base local, carga 100 productos ficticios, ejecuta la migracion, crea proveedores y usuarios de prueba, y valida que IDs, nombres, cantidades, minimos y disponibilidad se hayan preservado.

## Abrir la aplicacion de prueba

```powershell
npm run build:staging
npm run preview:staging -- --port 4173
```

Abrir `http://127.0.0.1:4173`. La interfaz muestra una franja roja indicando que no es produccion.

Usuarios locales:

- Propietario: `owner@hotspot.test`
- Operador: `operador@hotspot.test`
- Contrasena para ambos: `TestHotspot!2026`

El operador puede probar directamente `http://127.0.0.1:4173/stock/stock-general`.

Supabase Studio local queda disponible en `http://127.0.0.1:54323`.

## Reglas de seguridad

- `.env.staging.local` se genera automáticamente desde la instancia local activa y esta ignorado por Git.
- Los comandos de staging abortan si la URL no es `127.0.0.1:54321` o si el proyecto local no se llama `hotspot-staging-local`.
- No ejecutar migraciones con `--linked` durante estas pruebas.
- Antes del despliegue real se debe crear un respaldo remoto y repetir las validaciones contra una copia de staging, nunca experimentar directamente sobre produccion.
