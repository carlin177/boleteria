// models/empresa.model.ts
// Representa una empresa de transporte tal como la devuelve la API

export interface Empresa {
  id: number;
  nombre: string;
  telefono: string | null; // nullable en la BD, puede llegar como null
  email: string | null;
  sitio_web: string | null;
  estado: 'activo' | 'inactivo';
  created_at: string;
  updated_at: string;
}

// Datos que se envían al crear o actualizar una empresa
export interface EmpresaRequest {
  id?: number;        // Solo al crear — determina la zona de ventanilla (1-5)
  nombre: string;
  telefono?: string;
  email?: string;
  sitio_web?: string;
  estado?: 'activo' | 'inactivo';
}
