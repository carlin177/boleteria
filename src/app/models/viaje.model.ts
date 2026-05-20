// models/viaje.model.ts
// Representa un viaje tal como lo devuelve la API (con sus relaciones cargadas)

import { Ciudad } from './ciudad.model';
import { Empresa } from './empresa.model';
import { User } from './user.model';

export interface Viaje {
  id: number;
  empresa_id: number;
  ciudad_origen_id: number;
  ciudad_destino_id: number;
  creado_por_id: number | null;
  hora_salida: string;    // Formato "HH:mm:ss" — viene como string desde Laravel
  hora_llegada: string;
  tipo_servicio: string;
  precio: string;         // Laravel devuelve decimales como string
  asientos_totales: number | null;
  estado: 'activo' | 'inactivo';
  observaciones: string | null;
  created_at: string;
  updated_at: string;

  // Relaciones — solo están presentes si la API las cargó con `with()`
  empresa?: Empresa;
  ciudad_origen?: Ciudad;
  ciudad_destino?: Ciudad;
  creado_por?: User;
}

// Datos que se envían al crear o actualizar un viaje
export interface ViajeRequest {
  empresa_id: number;
  ciudad_origen_id: number;
  ciudad_destino_id: number;
  hora_salida: string;        // Formato "HH:mm:ss"
  hora_llegada: string;
  tipo_servicio: string;
  precio: number;
  asientos_totales?: number;
  estado?: 'activo' | 'inactivo';
  observaciones?: string;
}

// Filtros opcionales para el listado de viajes (GET /viajes?...)
export interface ViajesFiltros {
  empresa_id?: number;
  ciudad_origen_id?: number;
  ciudad_destino_id?: number;
  hora_salida?: string;
}
