# ProfePlus

Cuaderno digital docente en formato web app (PWA), con datos locales y soporte de IA en el navegador.

## Estado actual

- Interfaz principal por pestañas: Asistencia, Cuaderno, Planner, Evaluación e Informes.
- Sección de Configuración con gestión académica y gestión de base de datos.
- Evaluación con Rúbricas y Listas de cotejo (incluye generación con IA).
- Persistencia local con IndexedDB (Dexie).
- Sin datos de ejemplo al iniciar.

## Stack

- React 19 + TypeScript
- Vite 6
- Redux Toolkit
- Dexie (IndexedDB)
- React Router
- WebLLM (`@mlc-ai/web-llm`)
- `vite-plugin-pwa`

## Requisitos

- Node.js 20+ (recomendado)
- npm 10+
- Navegador con soporte moderno (WebGPU recomendado para IA local)

## Desarrollo local

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Salida en `dist/`.

## Despliegue en subdirectorio

La app está preparada para desplegarse tanto en raíz (`/`) como en subruta (por ejemplo `/profeplus/`).

Variables:

- `VITE_BASE_PATH=/` para local o raíz de dominio.
- `VITE_BASE_PATH=/profeplus/` para subdirectorio.

Archivos de ejemplo:

- `.env.example`
- `.env.production`

Puntos clave ya configurados:

- `vite.config.ts` usa `base` dinámico.
- `src/main.tsx` configura `BrowserRouter basename` con `import.meta.env.BASE_URL`.
- Manifest PWA con `start_url` y `scope` alineados al `base`.

## Scripts

- `npm run dev`: entorno de desarrollo.
- `npm run build`: compilación TypeScript + build Vite.
- `npm run preview`: vista previa del build.
- `npm run test`: pruebas con Vitest.

## Gestión de datos

En Configuración > Base de datos:

- Exportar copia de seguridad (JSON).
- Importar copia de seguridad.
- Borrar todos los datos.

## IA (WebLLM)

- Selección de modelo en Configuración IA.
- Descarga de modelos detectables desde fuentes públicas.
- Generación asistida de rúbricas y listas de cotejo.

## Estructura

```txt
src/
  app/
  modules/
    attendance/
    gradebook/
    planner/
    rubrics/
    reports/
    ai-assistant/
    management/
  shared/
    db/
    ui/
    utils/
```

## Notas

- El proyecto está orientado a uso local/offline-first.
- Si se publica en hosting estático, asegúrate de servir correctamente los archivos de `dist/` respetando la subruta configurada.
