import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { User, LoginRequest, RegisterRequest, AuthResponse } from '../models/user.model';
import { ApiResponse } from '../models/api-response.model';

// @Injectable indica que esta clase puede ser inyectada en componentes y otros servicios.
// providedIn: 'root' significa que Angular crea UNA sola instancia para toda la app (Singleton).
// Así todos los componentes que lo inyecten comparten el mismo estado.
@Injectable({
  providedIn: 'root'
})
export class AuthService {

  // URL base tomada del environment — no hardcodeamos la URL aquí
  private readonly apiUrl = environment.apiUrl;

  // signal() es la forma moderna de Angular para manejar estado reactivo.
  // Cuando cambia un signal, Angular actualiza automáticamente los componentes
  // que lo usan, sin necesidad de detectar cambios manualmente.
  // Guardamos el usuario actual como signal privado (solo se modifica dentro del servicio)
  private readonly _currentUser = signal<User | null>(this.getUserFromStorage());

  // computed() deriva un valor a partir de otro signal.
  // isAuthenticated se recalcula automáticamente cada vez que _currentUser cambia.
  // Los componentes pueden leer esto para saber si hay sesión activa.
  public readonly isAuthenticated = computed(() => this._currentUser() !== null);

  // Exponemos el usuario como signal de solo lectura para los componentes
  public readonly currentUser = this._currentUser.asReadonly();

  // Angular inyecta HttpClient (para hacer requests HTTP) y Router (para navegar entre rutas)
  constructor(private http: HttpClient, private router: Router) {}

  // --- MÉTODOS PÚBLICOS ---

  /**
   * Inicia sesión con email y password.
   * Devuelve un Observable — en Angular, los HTTP requests son "lazy":
   * no se ejecutan hasta que alguien hace .subscribe() en el componente.
   */
  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, credentials).pipe(
      // tap() ejecuta un efecto secundario sin modificar la respuesta.
      // Aquí guardamos el token y el usuario cuando el login es exitoso.
      tap(response => {
        if (response.success) {
          this.saveSession(response.data.access_token, response.data.user);
        }
      })
    );
  }

  /**
   * Registra un nuevo usuario.
   */
  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/register`, data).pipe(
      tap(response => {
        if (response.success) {
          this.saveSession(response.data.access_token, response.data.user);
        }
      })
    );
  }

  /**
   * Cierra sesión: revoca el token en el servidor y limpia el estado local.
   */
  logout(): void {
    // Solo llamamos al servidor si hay un token activo
    if (this.getToken()) {
      this.http.post(`${this.apiUrl}/auth/logout`, {}).subscribe({
        // complete se ejecuta tanto en éxito como en error — siempre limpiamos la sesión
        complete: () => this.clearSession(),
        error: () => this.clearSession()
      });
    } else {
      this.clearSession();
    }
  }

  /**
   * Obtiene el token Bearer guardado en localStorage.
   * El interceptor HTTP lo usa para agregarlo a cada request.
   */
  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  /**
   * Verifica si el usuario autenticado tiene rol de administrador.
   * Útil para mostrar/ocultar botones de edición en los componentes.
   */
  isAdmin(): boolean {
    return this._currentUser()?.rol === 'admin';
  }

  // --- MÉTODOS PRIVADOS ---

  /**
   * Guarda el token en localStorage y actualiza el signal del usuario.
   * localStorage persiste aunque el usuario cierre el navegador.
   */
  private saveSession(token: string, user: User): void {
    localStorage.setItem('access_token', token);
    // También guardamos el usuario para no tener que pedirlo al servidor en cada recarga
    localStorage.setItem('current_user', JSON.stringify(user));
    // Actualizamos el signal — esto notifica a todos los componentes que usan currentUser
    this._currentUser.set(user);
  }

  /**
   * Elimina todos los datos de sesión y redirige al login.
   */
  private clearSession(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('current_user');
    // Reseteamos el signal a null — isAuthenticated pasará a false automáticamente
    this._currentUser.set(null);
    this.router.navigate(['/login']);
  }

  /**
   * Al iniciar la app, intenta recuperar el usuario guardado en localStorage.
   * Esto permite que la sesión persista al recargar la página.
   * Se llama en la inicialización del signal _currentUser.
   */
  private getUserFromStorage(): User | null {
    const userJson = localStorage.getItem('current_user');
    if (!userJson) return null;

    try {
      return JSON.parse(userJson) as User;
    } catch {
      // Si el JSON está corrupto, limpiamos y forzamos nuevo login
      localStorage.removeItem('current_user');
      localStorage.removeItem('access_token');
      return null;
    }
  }
}
