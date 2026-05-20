import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

// En Angular 21 los interceptores son funciones (no clases).
// HttpInterceptorFn es el tipo que Angular espera para un interceptor funcional.
// Recibe el request original y "next" (la función para pasar al siguiente interceptor o al servidor).
export const authInterceptor: HttpInterceptorFn = (request, next) => {

  // inject() es la forma de obtener servicios dentro de funciones (fuera de clases)
  const authService = inject(AuthService);

  // Obtenemos el token guardado en localStorage
  const token = authService.getToken();

  // Si hay token, clonamos el request y le agregamos el header Authorization.
  // IMPORTANTE: los requests en Angular son inmutables — no se pueden modificar directamente.
  // Por eso usamos .clone() para crear una copia modificada.
  if (token) {
    request = request.clone({
      setHeaders: {
        // Este header es lo que Laravel Sanctum usa para identificar al usuario
        'Authorization': `Bearer ${token}`,
        // Le decimos a la API que esperamos JSON como respuesta
        'Accept': 'application/json',
      }
    });
  } else {
    // Si no hay token, igual agregamos Accept: application/json
    // para que Laravel responda con JSON y no con HTML en caso de error
    request = request.clone({
      setHeaders: { 'Accept': 'application/json' }
    });
  }

  // Pasamos el request (modificado) al siguiente paso y capturamos posibles errores
  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {

      if (error.status === 401) {
        // 401 = No autorizado: el token expiró o es inválido.
        // Forzamos logout para limpiar la sesión y redirigir al login.
        // Esto evita que el usuario quede en un estado inconsistente.
        authService.logout();
      }

      // Propagamos el error para que cada servicio pueda manejarlo si necesita
      return throwError(() => error);
    })
  );
};
