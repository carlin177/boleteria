// models/user.model.ts
// Representa un usuario del sistema tal como lo devuelve la API Laravel

export interface User {
  id: number;
  name: string;
  email: string;
  rol: 'admin' | 'visitante'; // Solo estos dos valores son válidos
  created_at: string;
  updated_at: string;
}

// Datos que se envían al endpoint POST /auth/login
export interface LoginRequest {
  email: string;
  password: string;
}

// Datos que se envían al endpoint POST /auth/register
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  password_confirmation: string; // Laravel requiere confirmación de contraseña
  rol?: 'admin' | 'visitante';  // Opcional, por defecto es 'visitante'
}

// Respuesta que devuelve la API al hacer login o register
export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    access_token: string; // El token Bearer que usaremos en cada request
    token_type: 'Bearer';
  };
  message: string;
}
