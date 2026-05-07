# Panel de negocio con React y Vite

Aplicacion para gestionar ventas, gastos, clientes, servicios, agenda y fidelizacion.

## Arrancar

```bash
npm install
npm run dev
```

## Estructura

- `src/components`: formularios, listados y resumen.
- `src/services/DataService.js`: persistencia en `localStorage` y configuracion base.
- `src/App.jsx`: estado principal y conexion entre componentes.

La app inicia sin ventas, gastos, clientes ni citas. Los datos que introduzcas se guardan en `localStorage`.
