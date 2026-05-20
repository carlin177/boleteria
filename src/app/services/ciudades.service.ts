import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Ciudad, CiudadRequest } from '../models/ciudad.model';
import { ApiResponse } from '../models/api-response.model';

@Injectable({
  providedIn: 'root'
})
export class CiudadesService {

  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/ciudades`;

  /**
   * Obtiene todas las ciudades activas.
   * El endpoint no está paginado — devuelve un array directo.
   */
  getAll(): Observable<ApiResponse<Ciudad[]>> {
    return this.http.get<ApiResponse<Ciudad[]>>(this.apiUrl);
  }

  /**
   * Obtiene una ciudad por su ID con sus viajes de origen y destino.
   */
  getById(id: number): Observable<ApiResponse<Ciudad>> {
    return this.http.get<ApiResponse<Ciudad>>(`${this.apiUrl}/${id}`);
  }

  /**
   * Crea una nueva ciudad. Requiere rol admin.
   */
  create(data: CiudadRequest): Observable<ApiResponse<Ciudad>> {
    return this.http.post<ApiResponse<Ciudad>>(this.apiUrl, data);
  }

  /**
   * Actualiza una ciudad existente. Requiere rol admin.
   */
  update(id: number, data: Partial<CiudadRequest>): Observable<ApiResponse<Ciudad>> {
    return this.http.put<ApiResponse<Ciudad>>(`${this.apiUrl}/${id}`, data);
  }

  /**
   * Elimina una ciudad. Requiere rol admin.
   * La API rechaza la eliminación si la ciudad tiene viajes asociados.
   */
  delete(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`);
  }
}
