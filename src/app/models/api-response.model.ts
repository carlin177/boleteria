// models/api-response.model.ts
// Estructura genérica de TODAS las respuestas de la API Laravel
// La API siempre responde con { success, data, message }
// Usando genéricos (<T>) podemos reutilizar esta interfaz para cualquier tipo de dato

export interface ApiResponse<T> {
  success: boolean;
  data: T;           // T es el tipo de dato que varía: Viaje, Empresa, Ciudad[], etc.
  message: string;
}

// Para los listados paginados, la API devuelve además un objeto "pagination"
// Ejemplo: GET /api/v1/viajes devuelve data + pagination
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];         // Array del tipo de dato
  pagination: {
    total: number;         // Total de registros en la BD
    per_page: number;      // Registros por página (15 en la API)
    current_page: number;
    last_page: number;
    from: number;          // Primer registro de esta página
    to: number;            // Último registro de esta página
  };
  message: string;
}
