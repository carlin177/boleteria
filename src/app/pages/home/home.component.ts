import { Component, inject, signal, computed, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ViajesService } from '../../services/viajes.service';
import { EmpresasService } from '../../services/empresas.service';
import { CiudadesService } from '../../services/ciudades.service';
import { AuthService } from '../../services/auth.service';
import { Empresa } from '../../models/empresa.model';
import { Ciudad } from '../../models/ciudad.model';
import { Viaje, ViajesFiltros } from '../../models/viaje.model';

// ── Tipos y constantes del editor de overlays ──────────────────────────────
export interface VentanillaZone {
  empresaId: number;
  top:    number;   // % del alto del contenedor (0–100)
  left:   number;   // % del ancho del contenedor (0–100)
  width:  number;
  height: number;
}

const DEFAULT_ZONES: VentanillaZone[] = [
  { empresaId: 1, top: 7, left: 0,  width: 20, height: 75 },
  { empresaId: 2, top: 7, left: 20, width: 20, height: 75 },
  { empresaId: 3, top: 7, left: 40, width: 20, height: 75 },
  { empresaId: 4, top: 7, left: 60, width: 20, height: 75 },
  { empresaId: 5, top: 7, left: 80, width: 20, height: 75 },
];

const OVERLAY_STORAGE_KEY = 'boleteria_overlay_zones_v1';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy {

  private readonly viajesService   = inject(ViajesService);
  private readonly empresasService = inject(EmpresasService);
  private readonly ciudadesService = inject(CiudadesService);

  // Expuesto como protected para que el template pueda acceder al estado de sesión
  protected readonly auth = inject(AuthService);
  // Referencia al contenedor de la terminal (para cálculo de % en el editor)
  @ViewChild('terminalWrapper') private readonly terminalWrapperRef!: ElementRef<HTMLElement>;
  // ── Estado ──────────────────────────────────────────────────────────────────
  readonly empresas  = signal<Empresa[]>([]);
  readonly ciudades  = signal<Ciudad[]>([]);
  readonly viajes    = signal<Viaje[]>([]);

  // Ventanilla actualmente abierta (null = ninguna)
  readonly activeEmpresaId = signal<number | null>(null);

  // Filtros del buscador
  readonly filtroOrigenId  = signal<number | null>(null);
  readonly filtroDestinoId = signal<number | null>(null);

  readonly isLoadingEmpresas = signal(false);
  readonly isLoadingViajes   = signal(false);
  readonly errorViajes       = signal('');

  // ── Derived state ───────────────────────────────────────────────────────────

  // Empresas activas — únicas que aparecen en el overlay de ventanillas
  readonly empresasActivas = computed(() =>
    this.empresas().filter(e => e.estado === 'activo')
  );

  // Ciudades activas — únicas que aparecen en el buscador
  readonly ciudadesActivas = computed(() =>
    this.ciudades().filter(c => c.estado === 'activo')
  );

  // true si el usuario aplicó algún filtro de búsqueda
  readonly hayFiltros = computed(() =>
    this.filtroOrigenId() !== null || this.filtroDestinoId() !== null
  );

  // El panel de viajes es visible si hay ventanilla abierta o filtros activos
  readonly panelVisible = computed(() =>
    this.activeEmpresaId() !== null || this.hayFiltros()
  );

  // Título dinámico del panel según el contexto activo
  readonly panelTitulo = computed(() => {
    if (this.hayFiltros()) return 'Resultados de búsqueda';
    const id = this.activeEmpresaId();
    if (id !== null) {
      return this.empresas().find(e => e.id === id)?.nombre ?? 'Viajes';
    }
    return 'Viajes';
  });

  // Colores de referencia (usados por getColor)
  private readonly COLORS = [
    '#1a3a8f', '#1a7a3a', '#b91c1c', '#0e7490',
    '#7c3aed', '#15803d', '#92400e', '#1d4ed8',
  ];

  // ── Overlay zones — señal mutable que persiste en localStorage ──────────────
  readonly overlayZones   = signal<VentanillaZone[]>(this.loadZonesFromStorage());
  readonly editorMode     = signal(false);
  readonly selectedZoneId = signal<number | null>(null);
  readonly savedMessage   = signal(false);

  /** Map indexado por empresaId — consumido directamente por el template */
  readonly zonesMap = computed(() => {
    const m = new Map<number, VentanillaZone>();
    for (const z of this.overlayZones()) m.set(z.empresaId, z);
    return m;
  });

  // Estado de drag/resize — no necesita ser reactivo
  private dragState = {
    active: false,
    type:   null as 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | null,
    zoneId: null as number | null,
    startX: 0,
    startY: 0,
    startZone: null as VentanillaZone | null,
  };

  // Handlers con referencia fija para poder desregistrarlos de document
  private readonly onMouseMove = (e: MouseEvent) => this.handleMouseMove(e);
  private readonly onMouseUp   = ()               => this.handleMouseUp();

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.cargarEmpresasYCiudades();
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup',   this.onMouseUp);
    document.body.style.cursor = '';
  }

  // ── Manejadores de eventos ──────────────────────────────────────────────────

  /**
   * Abre o cierra una ventanilla.
   * Si la ventanilla ya estaba activa la cierra; si no, la abre y carga sus viajes.
   */
  toggleVentanilla(empresaId: number): void {
    const misma = this.activeEmpresaId() === empresaId;
    this.activeEmpresaId.set(misma ? null : empresaId);
    this.cargarViajes();
  }

  onOrigenChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.filtroOrigenId.set(val ? +val : null);
    this.cargarViajes();
  }

  onDestinoChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.filtroDestinoId.set(val ? +val : null);
    this.cargarViajes();
  }

  limpiarFiltros(): void {
    this.filtroOrigenId.set(null);
    this.filtroDestinoId.set(null);
    this.cargarViajes();
  }

  // ── Overlay Editor ─────────────────────────────────────────────────────────

  toggleEditorMode(): void {
    this.editorMode.update(v => !v);
    if (!this.editorMode()) this.selectedZoneId.set(null);
  }

  saveZones(): void {
    localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(this.overlayZones()));
    this.savedMessage.set(true);
    setTimeout(() => this.savedMessage.set(false), 2000);
  }

  resetZones(): void {
    this.overlayZones.set(DEFAULT_ZONES.map(z => ({ ...z })));
    localStorage.removeItem(OVERLAY_STORAGE_KEY);
  }

  startDrag(event: MouseEvent, zoneId: number): void {
    event.preventDefault();
    event.stopPropagation();
    const zone = this.zonesMap().get(zoneId);
    if (!zone) return;
    this.selectedZoneId.set(zoneId);
    this.dragState = {
      active: true, type: 'move', zoneId,
      startX: event.clientX, startY: event.clientY,
      startZone: { ...zone },
    };
    document.body.style.cursor = 'move';
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup',   this.onMouseUp);
  }

  startResize(event: MouseEvent, zoneId: number, handle: 'nw' | 'ne' | 'sw' | 'se'): void {
    event.preventDefault();
    event.stopPropagation();
    const zone = this.zonesMap().get(zoneId);
    if (!zone) return;
    this.selectedZoneId.set(zoneId);
    this.dragState = {
      active: true,
      type:   `resize-${handle}` as typeof this.dragState.type,
      zoneId, startX: event.clientX, startY: event.clientY,
      startZone: { ...zone },
    };
    document.body.style.cursor = `${handle}-resize`;
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup',   this.onMouseUp);
  }

  private loadZonesFromStorage(): VentanillaZone[] {
    try {
      const raw = localStorage.getItem(OVERLAY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as VentanillaZone[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore corrupt data */ }
    return DEFAULT_ZONES.map(z => ({ ...z }));
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.dragState.active || !this.dragState.startZone || !this.dragState.zoneId) return;
    const container = this.terminalWrapperRef?.nativeElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const dx   = ((event.clientX - this.dragState.startX) / rect.width)  * 100;
    const dy   = ((event.clientY - this.dragState.startY) / rect.height) * 100;
    const z    = this.dragState.startZone;

    this.overlayZones.update(zones => zones.map(zone => {
      if (zone.empresaId !== this.dragState.zoneId) return zone;
      switch (this.dragState.type) {
        case 'move': return {
          ...zone,
          left: Math.max(0, Math.min(100 - z.width,  z.left + dx)),
          top:  Math.max(0, Math.min(100 - z.height, z.top  + dy)),
        };
        case 'resize-se': return {
          ...zone,
          width:  Math.max(5, Math.min(100 - z.left, z.width  + dx)),
          height: Math.max(5, Math.min(100 - z.top,  z.height + dy)),
        };
        case 'resize-sw': {
          const newLeft = Math.max(0, z.left + dx);
          return {
            ...zone, left: newLeft,
            width:  Math.max(5, z.left + z.width  - newLeft),
            height: Math.max(5, Math.min(100 - z.top, z.height + dy)),
          };
        }
        case 'resize-ne': {
          const newTop = Math.max(0, z.top + dy);
          return {
            ...zone, top: newTop,
            width:  Math.max(5, Math.min(100 - z.left, z.width + dx)),
            height: Math.max(5, z.top + z.height - newTop),
          };
        }
        case 'resize-nw': {
          const newLeft = Math.max(0, z.left + dx);
          const newTop  = Math.max(0, z.top  + dy);
          return {
            ...zone, left: newLeft, top: newTop,
            width:  Math.max(5, z.left + z.width  - newLeft),
            height: Math.max(5, z.top  + z.height - newTop),
          };
        }
        default: return zone;
      }
    }));
  }

  private handleMouseUp(): void {
    this.dragState.active = false;
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup',   this.onMouseUp);
  }

  // ── Helpers de presentación ─────────────────────────────────────────────────

  getColor(index: number): string {
    return this.COLORS[index % this.COLORS.length];
  }

  /** Convierte "14:30:00" → "14:30" */
  formatHora(hora: string): string {
    return hora.substring(0, 5);
  }

  /** Formatea el precio como moneda argentina */
  formatPrecio(precio: string): string {
    return parseFloat(precio).toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    });
  }

  /**
   * Busca el nombre de una ciudad por ID en el listado ya cargado.
   * Sirve como fallback cuando la relación no viene incluida en el viaje.
   */
  getNombreCiudad(id: number): string {
    return this.ciudades().find(c => c.id === id)?.nombre ?? '—';
  }

  // ── Métodos privados ────────────────────────────────────────────────────────

  private cargarEmpresasYCiudades(): void {
    this.isLoadingEmpresas.set(true);

    this.empresasService.getAll().subscribe({
      next: res => {
        this.empresas.set(res.data);
        this.isLoadingEmpresas.set(false);
      },
      error: () => this.isLoadingEmpresas.set(false),
    });

    // Ciudades se usan en el buscador y como fallback en los cards de viajes
    this.ciudadesService.getAll().subscribe({
      next: res => this.ciudades.set(res.data),
    });
  }

  /**
   * Llama a la API con los filtros activos en ese momento.
   * Combina ventanilla seleccionada + filtros de búsqueda si ambos están activos.
   * Si no hay ningún criterio activo, limpia la lista sin llamar a la API.
   */
  private cargarViajes(): void {
    const empresaId = this.activeEmpresaId();
    const origenId  = this.filtroOrigenId();
    const destinoId = this.filtroDestinoId();

    if (!empresaId && !origenId && !destinoId) {
      this.viajes.set([]);
      return;
    }

    const filtros: ViajesFiltros = {};
    if (empresaId) filtros.empresa_id        = empresaId;
    if (origenId)  filtros.ciudad_origen_id  = origenId;
    if (destinoId) filtros.ciudad_destino_id = destinoId;

    this.isLoadingViajes.set(true);
    this.errorViajes.set('');

    this.viajesService.getAll(filtros).subscribe({
      next: res => {
        this.viajes.set(res.data);
        this.isLoadingViajes.set(false);
      },
      error: () => {
        this.errorViajes.set('No se pudieron cargar los viajes. Intentá de nuevo.');
        this.isLoadingViajes.set(false);
      },
    });
  }
}
