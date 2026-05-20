// models/ciudad.model.ts
// Representa una ciudad tal como la devuelve la API

export interface Ciudad {
  id: number;
  nombre: string;
  provincia: string | null;
  pais: string;
  estado: 'activo' | 'inactivo';
  created_at: string;
  updated_at: string;
}

// Datos que se envían al crear o actualizar una ciudad
export interface CiudadRequest {
  nombre: string;
  provincia?: string;
  pais: string;
  estado?: 'activo' | 'inactivo';
}
