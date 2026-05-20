import { Injectable } from '@angular/core';

// ─── Tipos públicos ────────────────────────────────────────────────────────────

/**
 * Resultado de parsear una sola línea de texto.
 * Contiene los datos extraídos y los errores de validación de formato
 * (incluida la detección de duplicados dentro del mismo lote).
 */
export interface CiudadLineaParsed {
  lineNumber: number;
  nombre:     string;
  provincia:  string;
  errors:     string[];
  valid:      boolean;  // true si no hay errores de formato ni duplicados en lote
}

/** Resultado completo de procesar un bloque de texto. */
export interface CiudadParseResult {
  entries:    CiudadLineaParsed[];
  totalLines: number;
  validCount: number;
  errorCount: number;
}

// ─── Servicio ──────────────────────────────────────────────────────────────────

/**
 * ImportacionCiudadesParserService
 *
 * Responsabilidad única: parsing y validación de formato del texto estructurado.
 * NO tiene dependencias HTTP — es puro y testeable de forma aislada.
 *
 * Formato esperado (separador ","):
 *   Nombre,Provincia
 *   Goya,Corrientes
 *
 * Detecta duplicados dentro del mismo lote (mismo nombre + provincia).
 * La detección de ciudades ya existentes en la BD es responsabilidad del componente.
 *
 * Arquitectura preparada para extenderse: agregar `parseCSV(text)` o
 * `parseExcel(buffer)` devolviendo el mismo tipo `CiudadParseResult`
 * sin necesidad de modificar el componente importador.
 */
@Injectable({ providedIn: 'root' })
export class ImportacionCiudadesParserService {

  private readonly COLUMNAS_ESPERADAS = 2;

  /**
   * Parsea un bloque de texto con múltiples ciudades.
   * Ignora líneas vacías y la cabecera (si la incluyen).
   * Detecta duplicados dentro del lote.
   */
  parse(rawText: string): CiudadParseResult {
    const lines = rawText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .filter(l => !this.isHeaderLine(l));

    // Mapa para detección de duplicados: clave normalizada → número de línea
    const seen = new Map<string, number>();

    const entries = lines.map((line, idx) =>
      this.parseLine(line, idx + 1, seen)
    );

    return {
      entries,
      totalLines:  entries.length,
      validCount:  entries.filter(e => e.valid).length,
      errorCount:  entries.filter(e => !e.valid).length,
    };
  }

  // ─── Privados ────────────────────────────────────────────────────────────────

  private isHeaderLine(line: string): boolean {
    const first = line.split(',')[0]?.trim().toLowerCase();
    return first === 'nombre' || first === 'ciudad';
  }

  /**
   * Parsea una línea individual y realiza todas las validaciones.
   * Recibe el mapa `seen` para detectar duplicados en el mismo lote.
   */
  private parseLine(
    line: string,
    lineNumber: number,
    seen: Map<string, number>,
  ): CiudadLineaParsed {
    const cols   = line.split(',').map(c => c.trim());
    const errors: string[] = [];

    // ── Validar cantidad de columnas ─────────────────────────────────────────
    if (cols.length !== this.COLUMNAS_ESPERADAS) {
      errors.push(
        `se esperan ${this.COLUMNAS_ESPERADAS} columnas separadas por ",", ` +
        `se encontraron ${cols.length}`
      );
      return {
        lineNumber,
        nombre:    cols[0] ?? '',
        provincia: cols[1] ?? '',
        errors,
        valid: false,
      };
    }

    const [nombre, provincia] = cols;

    // ── Validar campos obligatorios ──────────────────────────────────────────
    if (!nombre)    errors.push('nombre de ciudad vacío');
    if (!provincia) errors.push('provincia vacía');

    // ── Detectar duplicados dentro del lote ──────────────────────────────────
    // Solo aplica si el formato es válido (no tiene otros errores)
    if (errors.length === 0) {
      const key = `${nombre.toLowerCase()}|${provincia.toLowerCase()}`;
      if (seen.has(key)) {
        errors.push(`ciudad duplicada en el lote — ya aparece en la línea ${seen.get(key)}`);
      } else {
        seen.set(key, lineNumber);
      }
    }

    return {
      lineNumber,
      nombre,
      provincia,
      errors,
      valid: errors.length === 0,
    };
  }
}
