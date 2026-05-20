import { Injectable } from '@angular/core';

// ─── Tipos públicos ────────────────────────────────────────────────────────────

/**
 * Resultado de parsear una sola línea de texto.
 * Contiene tanto los datos extraídos como los errores de validación de formato.
 * Los errores de resolución (empresa/ciudad no encontrada) se agregan en el componente.
 */
export interface ViajeLineaParsed {
  lineNumber: number;
  empresa:       string;
  origen:        string;
  destino:       string;
  hora_salida:   string;   // normalizado a HH:mm:ss
  hora_llegada:  string;   // normalizado a HH:mm:ss
  tipo_servicio: string;
  precio:        number;
  errors:        string[]; // errores de formato (no de resolución de IDs)
  valid:         boolean;  // true si no hay errores de formato
}

/** Resultado completo de procesar un bloque de texto. */
export interface ParseResult {
  entries:     ViajeLineaParsed[];
  totalLines:  number;
  validCount:  number;
  errorCount:  number;
}

// ─── Servicio ──────────────────────────────────────────────────────────────────

/**
 * ImportacionViajesParserService
 *
 * Responsabilidad única: parsing y validación de formato del texto estructurado.
 * NO tiene dependencias HTTP — es puro y testeble de forma aislada.
 *
 * Formato esperado (separador ","):
 *   Empresa,Origen,Destino,Salida,Llegada,Servicio,Precio
 *
 * Esta arquitectura está preparada para extenderse a CSV/Excel:
 * se puede agregar un método `parseCSV(text)` o `parseExcel(buffer)` que
 * devuelva el mismo tipo `ParseResult` sin cambiar el componente importador.
 */
@Injectable({ providedIn: 'root' })
export class ImportacionViajesParserService {

  private readonly COLUMNAS_ESPERADAS = 7;

  // Acepta HH:mm o HH:mm:ss con horas 0-23 y minutos/segundos 0-59
  private readonly HORA_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

  /**
   * Parsea un bloque de texto con múltiples viajes.
   * Ignora líneas en blanco y la línea de encabezado (si la primera es el header).
   */
  parse(rawText: string): ParseResult {
    const lines = rawText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .filter(l => !this.isHeaderLine(l));   // opcional: ignorar cabecera si la pegan

    const entries = lines.map((line, idx) => this.parseLine(line, idx + 1));

    return {
      entries,
      totalLines:  entries.length,
      validCount:  entries.filter(e => e.valid).length,
      errorCount:  entries.filter(e => !e.valid).length,
    };
  }

  // ─── Privados ────────────────────────────────────────────────────────────────

  private isHeaderLine(line: string): boolean {
    // Si la primera columna es "empresa" (case-insensitive) es una cabecera
    const first = line.split(',')[0]?.trim().toLowerCase();
    return first === 'empresa';
  }

  private parseLine(line: string, lineNumber: number): ViajeLineaParsed {
    const cols = line.split(',').map(c => c.trim());
    const errors: string[] = [];

    // ── Validar cantidad de columnas ─────────────────────────────────────────
    if (cols.length !== this.COLUMNAS_ESPERADAS) {
      errors.push(
        `se esperan ${this.COLUMNAS_ESPERADAS} columnas separadas por ",", ` +
        `se encontraron ${cols.length}`
      );
      // Devolver con datos parciales para mostrar contexto en el preview
      return {
        lineNumber,
        empresa:       cols[0] ?? '',
        origen:        cols[1] ?? '',
        destino:       cols[2] ?? '',
        hora_salida:   cols[3] ?? '',
        hora_llegada:  cols[4] ?? '',
        tipo_servicio: cols[5] ?? '',
        precio:        NaN,
        errors,
        valid: false,
      };
    }

    const [empresa, origen, destino, horaSalidaRaw, horaLlegadaRaw, tipo_servicio, precioStr] = cols;

    // ── Validar campos obligatorios ──────────────────────────────────────────
    if (!empresa)       errors.push('empresa vacía');
    if (!origen)        errors.push('origen vacío');
    if (!destino)       errors.push('destino vacío');
    if (!tipo_servicio) errors.push('tipo de servicio vacío');

    // ── Validar formato de horas ─────────────────────────────────────────────
    const horaOk = (raw: string) => this.HORA_REGEX.test(raw);
    if (!horaOk(horaSalidaRaw))  errors.push(`formato de hora de salida inválido: "${horaSalidaRaw}"`);
    if (!horaOk(horaLlegadaRaw)) errors.push(`formato de hora de llegada inválido: "${horaLlegadaRaw}"`);

    // ── Validar precio ───────────────────────────────────────────────────────
    // La coma es el separador de columnas, así que el precio ya no puede contenerla.
    // Se acepta punto decimal para valores como 25000.50.
    const precio = parseFloat(precioStr);
    if (isNaN(precio) || precio <= 0) {
      errors.push(`precio inválido: "${precioStr}"`);
    }

    return {
      lineNumber,
      empresa,
      origen,
      destino,
      hora_salida:   this.normalizeHora(horaSalidaRaw),
      hora_llegada:  this.normalizeHora(horaLlegadaRaw),
      tipo_servicio,
      precio:        isNaN(precio) ? 0 : precio,
      errors,
      valid:         errors.length === 0,
    };
  }

  /**
   * Normaliza una hora al formato HH:mm:ss requerido por Laravel.
   * "08:30" → "08:30:00" | "08:30:45" → "08:30:45"
   */
  private normalizeHora(raw: string): string {
    if (!raw) return raw;
    return raw.length === 5 ? `${raw}:00` : raw;
  }
}
