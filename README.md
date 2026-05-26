# Entrenador de funciones tonales

Aplicación React (Vite + Tailwind) para entrenamiento auditivo de funciones tonales — parte del suite **Método Aural**.

## Stack

- React 18
- Vite 5
- Tailwind CSS 3
- VexFlow (notación)
- soundfont-player (audio)

## Desarrollo local

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`.

## Build de producción

```bash
npm run build
npm run preview
```

## Deploy en Vercel

1. Sube el repo a GitHub.
2. En Vercel: **New Project** → importa el repo.
3. Vercel detecta Vite automáticamente. No hace falta configurar nada.
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Deploy**.

## Estructura

```
.
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── public/
│   └── favicon.png
└── src/
    ├── App.jsx
    ├── main.jsx
    └── index.css
```
