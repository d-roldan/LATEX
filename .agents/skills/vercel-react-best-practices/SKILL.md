---
name: vercel-react-best-practices
description: Mejorar y revisar componentes React, consultas del cliente, tamaño del bundle y renderizados. Usar en desarrollo o diagnóstico de rendimiento del frontend React 18 con Vite; no aplicar APIs exclusivas de Next.js o React 19.
license: MIT
metadata:
  author: vercel
  language: es
  adaptation: Edición en español adaptada a React 18 y Vite
---

# Buenas prácticas de React

Edición adaptada y condensada de las guías de Vercel, con [procedencia](ORIGEN.md). Mantener React 18, Vite y TanStack Query del proyecto. Las reglas generales de React son aplicables; los ejemplos de Next.js, Server Components, `React.cache`, `Activity` y APIs de versiones posteriores no constituyen instrucciones para LATEX.

## Referencias

- Consultas lentas, duplicación y tamaño del código descargado: [Datos y carga](references/datos-carga.md).
- Actualizaciones frecuentes y componentes costosos: [Estado y renderizado](references/estado-renderizado.md).

## Cómo trabajar

1. Identificar la interacción lenta o el componente afectado y observar solicitudes, tiempos y renderizados antes de optimizar.
2. Corregir primero solicitudes secuenciales innecesarias, cargas grandes y trabajo repetido. Dejar microoptimizaciones para problemas medidos.
3. Mantener separadas las consultas y cachés por planta y usuario según el contrato vigente. Una optimización no debe mostrar datos de una planta anterior.
4. Conservar estados de carga, error y falta de señal, además de navegación y accesibilidad. No ocultar un dato obsoleto para presentar una interfaz aparentemente rápida.
5. Validar con `../frontend-validate/SKILL.md` y comprobar visualmente el área cuando cambie su comportamiento. Comparar antes y después bajo condiciones equivalentes; no prometer mejoras porcentuales sin medirlas.

Para revisar estilos y accesibilidad usar también `../web-design-guidelines/SKILL.md`. Comunicar resultados y escribir nuevos comentarios en español, conservando nombres de APIs.
