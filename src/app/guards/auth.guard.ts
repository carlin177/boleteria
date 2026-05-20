import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * authGuard — Protege rutas PRIVADAS (requieren login).
 *
 * Uso en app.routes.ts:
 *   { path: 'viajes', component: ViajesComponent, canActivate: [authGuard] }
 *
 * Si el usuario NO está autenticado → redirige a /login.
 * Si el usuario SÍ está autenticado → permite el acceso.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    // El signal isAuthenticated() vale true → hay sesión activa → permitir acceso
    return true;
  }

  // No hay sesión → redirigir al login
  // createUrlTree() crea una URL de Angular sin navegar directamente,
  // lo que permite que el guard devuelva el destino de redirección de forma limpia
  return router.createUrlTree(['/login']);
};

/**
 * guestGuard — Protege rutas PÚBLICAS de autenticación (login, register).
 *
 * Uso en app.routes.ts:
 *   { path: 'login', component: LoginComponent, canActivate: [guestGuard] }
 *
 * Si el usuario YA está autenticado → redirige al inicio (no tiene sentido volver al login).
 * Si el usuario NO está autenticado → permite el acceso al login/register.
 */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    // No hay sesión → puede acceder al login/register
    return true;
  }

  // Ya está logueado → redirigir al dashboard o inicio
  return router.createUrlTree(['/']);
};

/**
 * adminGuard — Protege rutas exclusivas para administradores.
 *
 * Uso en app.routes.ts:
 *   { path: 'admin/empresas', component: EmpresasAdminComponent, canActivate: [adminGuard] }
 *
 * Si NO es admin → redirige al inicio con acceso denegado.
 */
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAdmin()) {
    return true;
  }

  // Está logueado pero no es admin → redirigir al inicio
  return router.createUrlTree(['/']);
};
