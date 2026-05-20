// environment.ts — Configuración para DESARROLLO (local)
// Este archivo se usa cuando corres `ng serve`
// Angular lo reemplaza automáticamente por environment.prod.ts al hacer `ng build`

export const environment = {
  // Indica que estamos en modo desarrollo (activa mensajes de error detallados en Angular)
  production: false,

  // URL base de la API Laravel. Todos los servicios la usan desde aquí.
  // Si el puerto cambia, solo lo modificas en este lugar.
  apiUrl: 'http://127.0.0.1:8000/api/v1'
};
