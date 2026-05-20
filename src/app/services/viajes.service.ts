import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Viaje, ViajeRequest, ViajesFiltros } from '../models/viaje.model';
import { ApiResponse, PaginatedResponse } from '../models/api-response.model';

@Injectable({
  providedIn: 'root'
})
export class ViajesService {

  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/viajes`;

  /**
   * Obtiene el listado paginado de viajes.
   * Soporta filtros opcionales: empresa_id, ciudad_origen_id, ciudad_destino_id, hora_salida.
   * También acepta el número de página para la paginación.
   */
  getAll(filtros?: ViajesFiltros, page: number = 1): Observable<PaginatedResponse<Viaje>> {
    let params = new HttpParams().set('page', page.toString());

    if (filtros) {
      if (filtros.empresa_id)        params = params.set('empresa_id',        filtros.empresa_id.toString());
      if (filtros.ciudad_origen_id)  params = params.set('ciudad_origen_id',  filtros.ciudad_origen_id.toString());
      if (filtros.ciudad_destino_id) params = params.set('ciudad_destino_id', filtros.ciudad_destino_id.toString());
      if (filtros.hora_salida)       params = params.set('hora_salida',       filtros.hora_salida);
    }

    return this.http.get<PaginatedResponse<Viaje>>(this.apiUrl, { params });
  }

  /**
   * Obtiene un viaje por su ID con todas sus relaciones (empresa, ciudades, creado_por).
   */
  getById(id: number): Observable<ApiResponse<Viaje>> {
    return this.http.get<ApiResponse<Viaje>>(`${this.apiUrl}/${id}`);
  }

  /**
   * Crea un nuevo viaje. Requiere rol admin.
   */
  create(data: ViajeRequest): Observable<ApiResponse<Viaje>> {
    return this.http.post<ApiResponse<Viaje>>(this.apiUrl, data);
  }

  /**
   * Actualiza un viaje existente. Requiere rol admin.
   */
  update(id: number, data: Partial<ViajeRequest>): Observable<ApiResponse<Viaje>> {
    return this.http.put<ApiResponse<Viaje>>(`${this.apiUrl}/${id}`, data);
  }

  /**
   * Elimina un viaje. Requiere rol admin.
   */
  delete(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`);
  }
}
