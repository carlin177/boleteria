import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ViajesService }   from '../../../services/viajes.service';
import { EmpresasService } from '../../../services/empresas.service';
import { CiudadesService } from '../../../services/ciudades.service';
import { Empresa }         from '../../../models/empresa.model';
import { Ciudad }          from '../../../models/ciudad.model';
import { ViajeRequest }    from '../../../models/viaje.model';
import {
  ImportacionViajesParserService,
  ViajeLineaParsed,
} from '../../../services/importacion-viajes-parser.service';

// ─── Tipos locales ─────────────────────────────────────────────────────────────

/**
 * Extiende ViajeLineaParsed añadiendo los IDs resueltos por nombre
 * y un flag `fullyValid` que combina errores de formato + resolución.
 */
export interface ViajeEntradaImport extends ViajeLineaParsed {
  empresa_id?:         number;
  ciudad_origen_id?:   number;
  ciudad_destino_id?:  number;
  fullyValid:          boolean;  // valid de formato AND IDs resueltos
}

type ImportState = 'idle' | 'previewing' | 'importing' | 'done';

// ─── Componente ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-importar-viajes',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './importar-viajes.component.html',
  styleUrl:    './importar-viajes.component.css',
})
export class ImportarViajesComponent implements OnInit {

  // ── Dependencias ────────────────────────────────────────────────────────────
  private readonly parser         = inject(ImportacionViajesParserService);
  private readonly viajesService  = inject(ViajesService);
  private readonly empresasService = inject(EmpresasService);
  private readonly ciudadesService = inject(CiudadesService);

  // ── Catálogos (cargados al init) ─────────────────────────────────────────────
  private empresas: Empresa[] = [];
  private ciudades: Ciudad[]  = [];

  // ── Estado del formulario ────────────────────────────────────────────────────
  rawText = '';   // ngModel — propiedad plain para compatibilidad directa

  // ── Signals ──────────────────────────────────────────────────────────────────
  readonly importState   = signal<ImportState>('idle');
  readonly entries       = signal<ViajeEntradaImport[]>([]);
  readonly importResults = signal({ success: 0, failed: 0 });
  readonly loadError     = signal<string | null>(null);
  readonly catalogsReady = signal(false);

  readonly validCount  = computed(() => this.entries().filter(e => e.fullyValid).length);
  readonly errorCount  = computed(() => this.entries().filter(e => !e.fullyValid).length);

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    forkJoin([
      this.empresasService.getAll(),
      this.ciudadesService.getAll(),
    ]).subscribe({
      next: ([empRes, ciudRes]) => {
        this.empresas = empRes.data;
        this.ciudades = ciudRes.data;
        this.catalogsReady.set(true);
      },
      error: () => {
        this.loadError.set(
          'No se pudieron cargar los catálogos de empresas y ciudades. ' +
          'Verificá la conexión con la API.'
        );
      },
    });
  }

  // ── Acciones ─────────────────────────────────────────────────────────────────

  /** Parsea el texto, resuelve IDs y muestra el preview. */
  previsualizar(): void {
    if (!this.rawText.trim()) return;

    const { entries } = this.parser.parse(this.rawText);
    const resolved    = entries.map(e => this.resolveEntry(e));
    this.entries.set(resolved);
    this.importState.set('previewing');
  }

  /** Envía solo los viajes fullyValid al backend y muestra el resultado. */
  confirmarImportacion(): void {
    const valid = this.entries().filter(e => e.fullyValid);
    if (!valid.length) return;

    this.importState.set('importing');

    const requests = valid.map(e =>
      this.viajesService.create(this.toViajeRequest(e)).pipe(
        catchError(() => of(null))
      )
    );

    forkJoin(requests).subscribe(results => {
      const success = results.filter(r => r !== null).length;
      const failed  = results.filter(r => r === null).length;
      this.importResults.set({ success, failed });
      this.importState.set('done');
    });
  }

  /** Vuelve al estado inicial limpiando todo. */
  resetImport(): void {
    this.rawText = '';
    this.entries.set([]);
    this.importState.set('idle');
    this.importResults.set({ success: 0, failed: 0 });
  }

  // ── Helpers privados ─────────────────────────────────────────────────────────

  /**
   * Intenta resolver los nombres de empresa/origen/destino a sus IDs en la BD.
   * La comparación es case-insensitive y tolera espacios extra.
   * Los errores de resolución se agregan al array `errors` heredado del parser.
   */
  private resolveEntry(entry: ViajeLineaParsed): ViajeEntradaImport {
    // Clonar el array de errores para no mutar el objeto original
    const errors = [...entry.errors];

    const empresa = this.findEmpresa(entry.empresa);
    if (!empresa && entry.valid) {
      errors.push(`empresa "${entry.empresa}" no encontrada en el sistema`);
    }

    const origen = this.findCiudad(entry.origen);
    if (!origen && entry.valid) {
      errors.push(`ciudad de origen "${entry.origen}" no encontrada`);
    }

    const destino = this.findCiudad(entry.destino);
    if (!destino && entry.valid) {
      errors.push(`ciudad de destino "${entry.destino}" no encontrada`);
    }

    return {
      ...entry,
      errors,
      empresa_id:        empresa?.id,
      ciudad_origen_id:  origen?.id,
      ciudad_destino_id: destino?.id,
      fullyValid:        errors.length === 0,
    };
  }

  private findEmpresa(nombre: string): Empresa | undefined {
    const q = nombre.toLowerCase().trim();
    return this.empresas.find(e => e.nombre.toLowerCase().trim() === q);
  }

  private findCiudad(nombre: string): Ciudad | undefined {
    const q = nombre.toLowerCase().trim();
    return this.ciudades.find(c => c.nombre.toLowerCase().trim() === q);
  }

  private toViajeRequest(e: ViajeEntradaImport): ViajeRequest {
    return {
      empresa_id:        e.empresa_id!,
      ciudad_origen_id:  e.ciudad_origen_id!,
      ciudad_destino_id: e.ciudad_destino_id!,
      hora_salida:       e.hora_salida,
      hora_llegada:      e.hora_llegada,
      tipo_servicio:     e.tipo_servicio,
      precio:            e.precio,
    };
  }
}
