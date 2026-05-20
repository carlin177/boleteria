import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { CiudadesService } from '../../../services/ciudades.service';
import { Ciudad }          from '../../../models/ciudad.model';
import {
  ImportacionCiudadesParserService,
  CiudadLineaParsed,
} from '../../../services/importacion-ciudades-parser.service';

// ─── Tipos locales ─────────────────────────────────────────────────────────────

/**
 * Extiende CiudadLineaParsed añadiendo el resultado de la comprobación
 * contra el catálogo existente en la BD.
 * `yaExiste` es una advertencia: no bloquea la importación (el admin decide),
 * pero queda visible en el preview para que tome una decisión informada.
 */
export interface CiudadEntradaImport extends CiudadLineaParsed {
  yaExiste:   boolean;  // advertencia — ciudad con mismo nombre+provincia ya en BD
  fullyValid: boolean;  // sin errores de formato ni duplicados en lote
}

type ImportState = 'idle' | 'previewing' | 'importing' | 'done';

// ─── Componente ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-importar-ciudades',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './importar-ciudades.component.html',
  styleUrl:    './importar-ciudades.component.css',
})
export class ImportarCiudadesComponent implements OnInit {

  // ── Dependencias ────────────────────────────────────────────────────────────
  private readonly parser         = inject(ImportacionCiudadesParserService);
  private readonly ciudadesService = inject(CiudadesService);

  // ── Catálogo existente (para detección de "ya existe") ────────────────────
  private existingCiudades: Ciudad[] = [];

  // ── Estado del formulario ────────────────────────────────────────────────────
  rawText = '';

  // ── Signals ──────────────────────────────────────────────────────────────────
  readonly importState   = signal<ImportState>('idle');
  readonly entries       = signal<CiudadEntradaImport[]>([]);
  readonly importResults = signal({ success: 0, failed: 0 });
  readonly loadError     = signal<string | null>(null);
  readonly catalogReady  = signal(false);

  readonly validCount = computed(() => this.entries().filter(e => e.fullyValid).length);
  readonly errorCount = computed(() => this.entries().filter(e => !e.fullyValid).length);
  /** Cuántos viajes válidos ya existen en la BD (advertencia, no bloqueo). */
  readonly warnCount  = computed(() => this.entries().filter(e => e.fullyValid && e.yaExiste).length);

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.ciudadesService.getAll().subscribe({
      next: res => {
        this.existingCiudades = res.data;
        this.catalogReady.set(true);
      },
      error: () => {
        // No es fatal: sin el catálogo la detección de "ya existe" no funciona,
        // pero el usuario puede seguir importando. Se muestra el aviso.
        this.loadError.set(
          'No se pudo cargar el catálogo de ciudades. ' +
          'La detección de duplicados con la BD no estará disponible.'
        );
        this.catalogReady.set(true); // permite usar la herramienta igual
      },
    });
  }

  // ── Acciones ─────────────────────────────────────────────────────────────────

  /** Parsea el texto, detecta duplicados en BD y muestra el preview. */
  previsualizar(): void {
    if (!this.rawText.trim()) return;

    const { entries } = this.parser.parse(this.rawText);
    const enriched    = entries.map(e => this.enrichEntry(e));
    this.entries.set(enriched);
    this.importState.set('previewing');
  }

  /** Envía solo los `fullyValid` al backend y muestra el resultado. */
  confirmarImportacion(): void {
    const valid = this.entries().filter(e => e.fullyValid);
    if (!valid.length) return;

    this.importState.set('importing');

    const requests = valid.map(e =>
      this.ciudadesService.create({
        nombre:    e.nombre,
        provincia: e.provincia,
        pais:      'Argentina',
        estado:    'activo',
      }).pipe(catchError(() => of(null)))
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
   * Compara la entrada contra el catálogo cargado de la BD.
   * La comparación es case-insensitive y tolera espacios extra.
   */
  private enrichEntry(entry: CiudadLineaParsed): CiudadEntradaImport {
    const yaExiste = entry.valid && this.existingCiudades.some(
      c =>
        c.nombre.toLowerCase().trim()          === entry.nombre.toLowerCase().trim() &&
        (c.provincia ?? '').toLowerCase().trim() === entry.provincia.toLowerCase().trim()
    );

    return {
      ...entry,
      yaExiste,
      fullyValid: entry.valid,
    };
  }
}
