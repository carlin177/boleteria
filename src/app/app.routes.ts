import { Routes } from '@angular/router';

import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/auth.guard';

export const routes: Routes = [

  // ── RUTA RAÍZ ──────────────────────────────────────────────────────────────
  // Pantalla principal: ventanillas de empresas + buscador de viajes
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component')
      .then(m => m.HomeComponent)
  },

  // ── LOGIN DEL ADMINISTRADOR ─────────────────────────────────────────────────
  // No usa guestGuard — el admin puede volver al login cuando quiera
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.component')
      .then(m => m.LoginComponent)
  },

  // ── RUTAS PÚBLICAS ─────────────────────────────────────────────────────────
  // Cualquier usuario (logueado o no) puede ver el listado de viajes

  {
    path: 'viajes',
    loadComponent: () => import('./pages/viajes/viajes-list/viajes-list.component')
      .then(m => m.ViajesListComponent)
  },
  {
    path: 'viajes/:id',
    loadComponent: () => import('./pages/viajes/viaje-detail/viaje-detail.component')
      .then(m => m.ViajeDetailComponent)
  },

  // ── RUTAS PRIVADAS (requieren login) ───────────────────────────────────────

  {
    path: 'admin',
    canActivate: [authGuard, adminGuard], // Debe estar logueado Y ser admin
    loadComponent: () => import('./pages/admin/admin-layout.component')
      .then(m => m.AdminLayoutComponent),
    children: [

      // Gestión de empresas
      {
        path: 'empresas',
        loadComponent: () => import('./pages/admin/empresas/empresas.component')
          .then(m => m.EmpresasComponent)
      },

      // Gestión de ciudades
      {
        path: 'ciudades',
        loadComponent: () => import('./pages/admin/ciudades/ciudades.component')
          .then(m => m.CiudadesComponent)
      },

      // Gestión de viajes (CRUD completo)
      {
        path: 'viajes',
        loadComponent: () => import('./pages/admin/viajes/viajes-admin.component')
          .then(m => m.ViajesAdminComponent)
      },

      // Carga rápida / importación masiva de viajes
      {
        path: 'importar',
        loadComponent: () => import('./pages/admin/importar-viajes/importar-viajes.component')
          .then(m => m.ImportarViajesComponent)
      },

      // Importación masiva de ciudades
      {
        path: 'importar-ciudades',
        loadComponent: () => import('./pages/admin/importar-ciudades/importar-ciudades.component')
          .then(m => m.ImportarCiudadesComponent)
      },

      // Ruta por defecto dentro de /admin
      { path: '', redirectTo: 'viajes', pathMatch: 'full' }
    ]
  },

  // ── RUTA 404 ───────────────────────────────────────────────────────────────
  // "**" captura cualquier URL que no coincidió con las anteriores
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found.component')
      .then(m => m.NotFoundComponent)
  }

];
