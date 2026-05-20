import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Empresa, EmpresaRequest } from '../models/empresa.model';
import { ApiResponse } from '../models/api-response.model';

@Injectable({
  providedIn: 'root'
})
export class EmpresasService {

  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/empresas`;

  /**
   * Obtiene todas las empresas activas.
   * El endpoint no está paginado — devuelve un array directo.
   */
  getAll(): Observable<ApiResponse<Empresa[]>> {
    return this.http.get<ApiResponse<Empresa[]>>(this.apiUrl);
  }

  /**
   * Obtiene una empresa por su ID con sus viajes asociados.
   */
  getById(id: number): Observable<ApiResponse<Empresa>> {
    return this.http.get<ApiResponse<Empresa>>(`${this.apiUrl}/${id}`);
  }

  /**
   * Crea una nueva empresa. Requiere rol admin.
   */
  create(data: EmpresaRequest): Observable<ApiResponse<Empresa>> {
    return this.http.post<ApiResponse<Empresa>>(this.apiUrl, data);
  }

  /**
   * Actualiza una empresa existente. Requiere rol admin.
   */
  update(id: number, data: Partial<EmpresaRequest>): Observable<ApiResponse<Empresa>> {
    return this.http.put<ApiResponse<Empresa>>(`${this.apiUrl}/${id}`, data);
  }

  /**
   * Elimina una empresa. Requiere rol admin.
   */
  delete(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`);
  }
}
