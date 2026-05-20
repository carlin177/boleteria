// environment.prod.ts — Configuración para PRODUCCIÓN
// Este archivo se activa cuando corres `ng build` (build final para deploy)
// Por ahora tiene la misma URL, pero cuando tengas un servidor real
// reemplazas el apiUrl con la URL de producción.

export const environment = {
  // En producción desactivamos el modo debug de Angular
  production: true,

  // URL de la API en producción (cambiar cuando tengas hosting)
  apiUrl: 'http://127.0.0.1:8000/api/v1'
};
