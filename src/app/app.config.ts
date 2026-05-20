import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),

    // Registramos HttpClient para que esté disponible en toda la app.
    // withInterceptors([]) recibe la lista de interceptores que se aplicarán
    // a TODOS los requests HTTP en orden. Agregamos nuestro authInterceptor.
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};
