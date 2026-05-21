import { Component, inject, signal, computed, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ViajesService } from '../../services/viajes.service';
import { EmpresasService } from '../../services/empresas.service';
import { CiudadesService } from '../../services/ciudades.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
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

// ── Tipos del flujo de búsqueda guiada ─────────────────────────────────────
export interface DiaDisponible {
  fecha:     Date;
  label:     string;   // "Jue 22"
  labelFull: string;   // "Jueves 22 de mayo"
}

export interface ViajePanel {
  empresa:      string;
  origen:       string;
  destino:      string;
  horaSalida:   string;
  horaLlegada:  string;
  tipoServicio: string;
  precio:       number;
  badges:       Array<'economico' | 'sale-antes' | 'cama'>;
}

// ── Mock de viajes — temporal, preparado para conectar con API real ─────────
const MOCK_VIAJES_PANEL: ViajePanel[] = [
  { empresa: 'Flecha Bus',      origen: 'Goya', destino: 'Corrientes', horaSalida: '07:30', horaLlegada: '10:15', tipoServicio: 'Común',    precio: 4200, badges: ['economico'] },
  { empresa: 'Río Uruguay',     origen: 'Goya', destino: 'Corrientes', horaSalida: '09:00', horaLlegada: '11:30', tipoServicio: 'Semi Cama', precio: 5800, badges: ['sale-antes'] },
  { empresa: 'El Rápido',       origen: 'Goya', destino: 'Corrientes', horaSalida: '12:45', horaLlegada: '15:20', tipoServicio: 'Cama',      precio: 7900, badges: ['cama'] },
  { empresa: 'Flecha Bus',      origen: 'Goya', destino: 'Corrientes', horaSalida: '16:00', horaLlegada: '18:45', tipoServicio: 'Común',    precio: 4200, badges: ['economico'] },
  { empresa: 'Costera Criolla', origen: 'Goya', destino: 'Corrientes', horaSalida: '20:30', horaLlegada: '23:10', tipoServicio: 'Semi Cama', precio: 5500, badges: [] },
];

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
  protected readonly auth  = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  // Referencia al contenedor de la terminal (para cálculo de % en el editor)
  @ViewChild('terminalWrapper')  private readonly terminalWrapperRef!: ElementRef<HTMLElement>;
  @ViewChild('searchInputEl')    private readonly searchInputEl?: ElementRef<HTMLInputElement>;
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

  // ── Estado del flujo de búsqueda guiada ──────────────────────────────────
  readonly searchQuery          = signal('');
  readonly destinoSeleccionado  = signal('');
  readonly resultadosVisible    = signal(false);
  readonly diaSeleccionadoIndex = signal(0);

  /** Map indexado por empresaId — consumido directamente por el template */
  readonly zonesMap = computed(() => {
    const m = new Map<number, VentanillaZone>();
    for (const z of this.overlayZones()) m.set(z.empresaId, z);
    return m;
  });

  /** Próximos 7 días — preparado para conectar con API por fecha */
  readonly diasDisponibles = computed((): DiaDisponible[] => {
    const DC = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const DF = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const MF = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const hoy = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() + i);
      return {
        fecha:     d,
        label:     `${DC[d.getDay()]} ${d.getDate()}`,
        labelFull: `${DF[d.getDay()]} ${d.getDate()} de ${MF[d.getMonth()]}`,
      };
    });
  });

  /** Viajes del panel — datos reales en modo ventanilla, mock en modo búsqueda */
  readonly viajesPanel = computed((): ViajePanel[] => {
    if (this.activeEmpresaId() !== null) {
      const viajesReales = this.viajes();
      if (!viajesReales.length) return [];

      const toMin = (h: string) => {
        const p = h.split(':');
        return parseInt(p[0]) * 60 + parseInt(p[1]);
      };
      const precios  = viajesReales.map(v => parseFloat(v.precio));
      const salidas  = viajesReales.map(v => toMin(v.hora_salida));
      const minPrecio = Math.min(...precios);
      const minSalida = Math.min(...salidas);

      return viajesReales.map(v => ({
        empresa:      v.empresa?.nombre ?? this.empresas().find(e => e.id === v.empresa_id)?.nombre ?? '—',
        origen:       v.ciudad_origen?.nombre  ?? this.getNombreCiudad(v.ciudad_origen_id),
        destino:      v.ciudad_destino?.nombre ?? this.getNombreCiudad(v.ciudad_destino_id),
        horaSalida:   this.formatHora(v.hora_salida),
        horaLlegada:  this.formatHora(v.hora_llegada),
        tipoServicio: v.tipo_servicio,
        precio:       parseFloat(v.precio),
        badges: [
          ...(parseFloat(v.precio) === minPrecio              ? ['economico'  as const] : []),
          ...(toMin(v.hora_salida) === minSalida              ? ['sale-antes' as const] : []),
          ...(v.tipo_servicio.toLowerCase().includes('cama') ? ['cama'       as const] : []),
        ],
      }));
    }
    // Future: filter MOCK_VIAJES_PANEL by destinoSeleccionado() + día seleccionado
    return MOCK_VIAJES_PANEL;
  });

  /** Etiqueta del subtitulo del panel según el modo activo */
  readonly panelSubtitulo = computed(() =>
    this.activeEmpresaId() !== null ? 'Viajes de' : 'Viajes hacia'
  );

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
    if (misma) {
      this.activeEmpresaId.set(null);
      this.viajes.set([]);
      this.resultadosVisible.set(false);
      this.destinoSeleccionado.set('');
    } else {
      this.activeEmpresaId.set(empresaId);
      const nombre = this.empresas().find(e => e.id === empresaId)?.nombre ?? 'Empresa';
      this.destinoSeleccionado.set(nombre);
      this.resultadosVisible.set(true);
      this.diaSeleccionadoIndex.set(0);
      this.cargarViajes();
    }
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

  // ── Flujo de búsqueda guiada ────────────────────────────────────────────────

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  onBuscar(): void {
    const query = this.searchQuery().trim();
    if (!query) return;
    this.destinoSeleccionado.set(query);
    this.resultadosVisible.set(true);
    this.diaSeleccionadoIndex.set(0);
  }

  onVolver(): void {
    this.resultadosVisible.set(false);
    this.activeEmpresaId.set(null);
    this.viajes.set([]);
  }

  onLimpiarBusqueda(): void {
    this.searchQuery.set('');
    this.destinoSeleccionado.set('');
    this.resultadosVisible.set(false);
    this.activeEmpresaId.set(null);
    this.viajes.set([]);
    if (this.searchInputEl?.nativeElement) {
      this.searchInputEl.nativeElement.value = '';
      this.searchInputEl.nativeElement.focus();
    }
  }

  selectDia(index: number): void {
    this.diaSeleccionadoIndex.set(index);
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
