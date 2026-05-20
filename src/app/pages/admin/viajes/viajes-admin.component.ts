import { Component, OnInit, signal, inject, ViewChild, ElementRef } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';

import { ViajesService }   from '../../../services/viajes.service';
import { EmpresasService } from '../../../services/empresas.service';
import { CiudadesService } from '../../../services/ciudades.service';
import { Viaje, ViajeRequest } from '../../../models/viaje.model';
import { Empresa }             from '../../../models/empresa.model';
import { Ciudad }              from '../../../models/ciudad.model';

@Component({
  selector: 'app-viajes-admin',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './viajes-admin.component.html',
  styleUrl: './viajes-admin.component.css',
})
export class ViajesAdminComponent implements OnInit {

  private readonly viajesService   = inject(ViajesService);
  private readonly empresasService = inject(EmpresasService);
  private readonly ciudadesService = inject(CiudadesService);

  @ViewChild('dialog') dialogRef!: ElementRef<HTMLDialogElement>;

  readonly viajes      = signal<Viaje[]>([]);
  readonly empresas    = signal<Empresa[]>([]);
  readonly ciudades    = signal<Ciudad[]>([]);
  readonly isLoading   = signal(false);
  readonly isSaving    = signal(false);
  readonly errorMsg    = signal<string | null>(null);
  readonly editingId   = signal<number | null>(null);
  readonly currentPage = signal(1);
  readonly lastPage    = signal(1);
  readonly totalItems  = signal(0);

  formData: ViajeRequest = this.emptyForm();

  ngOnInit(): void {
    this.empresasService.getAll().subscribe({ next: res => this.empresas.set(res.data) });
    this.ciudadesService.getAll().subscribe({ next: res => this.ciudades.set(res.data) });
    this.loadViajes(1);
  }

  loadViajes(page: number): void {
    this.isLoading.set(true);
    this.errorMsg.set(null);
    this.viajesService.getAll(undefined, page).subscribe({
      next: res => {
        this.viajes.set(res.data);
        this.currentPage.set(res.pagination.current_page);
        this.lastPage.set(res.pagination.last_page);
        this.totalItems.set(res.pagination.total);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMsg.set('Error al cargar los viajes.');
        this.isLoading.set(false);
      },
    });
  }

  openCreate(): void {
    this.formData = this.emptyForm();
    this.editingId.set(null);
    this.errorMsg.set(null);
    this.dialogRef.nativeElement.showModal();
  }

  openEdit(viaje: Viaje): void {
    this.formData = {
      empresa_id:        viaje.empresa_id,
      ciudad_origen_id:  viaje.ciudad_origen_id,
      ciudad_destino_id: viaje.ciudad_destino_id,
      hora_salida:       viaje.hora_salida.substring(0, 5),
      hora_llegada:      viaje.hora_llegada.substring(0, 5),
      tipo_servicio:     viaje.tipo_servicio,
      precio:            parseFloat(viaje.precio),
      asientos_totales:  viaje.asientos_totales ?? undefined,
      estado:            viaje.estado,
      observaciones:     viaje.observaciones ?? '',
    };
    this.editingId.set(viaje.id);
    this.errorMsg.set(null);
    this.dialogRef.nativeElement.showModal();
  }

  closeDialog(): void {
    this.dialogRef.nativeElement.close();
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) return;

    this.isSaving.set(true);
    this.errorMsg.set(null);

    // The API validates hora_salida/llegada as H:i:s — append seconds if missing
    const data: ViajeRequest = {
      ...this.formData,
      hora_salida:  this.toTimeWithSeconds(this.formData.hora_salida),
      hora_llegada: this.toTimeWithSeconds(this.formData.hora_llegada),
    };
    if (!data.observaciones) delete data.observaciones;

    const id = this.editingId();
    const op = id ? this.viajesService.update(id, data) : this.viajesService.create(data);

    op.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closeDialog();
        this.loadViajes(this.currentPage());
      },
      error: () => {
        this.isSaving.set(false);
        this.errorMsg.set('Error al guardar. Verificá que origen ≠ destino y que los datos sean correctos.');
      },
    });
  }

  delete(viaje: Viaje): void {
    const ruta = `${viaje.ciudad_origen?.nombre ?? viaje.ciudad_origen_id} → ${viaje.ciudad_destino?.nombre ?? viaje.ciudad_destino_id}`;
    if (!confirm(`¿Eliminar el viaje "${ruta}"?`)) return;
    this.viajesService.delete(viaje.id).subscribe({
      next: () => this.loadViajes(this.currentPage()),
      error: () => alert('No se pudo eliminar el viaje.'),
    });
  }

  prevPage(): void { if (this.currentPage() > 1) this.loadViajes(this.currentPage() - 1); }
  nextPage(): void { if (this.currentPage() < this.lastPage()) this.loadViajes(this.currentPage() + 1); }

  getNombreEmpresa(id: number): string {
    return this.empresas().find(e => e.id === id)?.nombre ?? `Empresa #${id}`;
  }

  private toTimeWithSeconds(time: string): string {
    return time.length === 5 ? `${time}:00` : time;
  }

  private emptyForm(): ViajeRequest {
    return {
      empresa_id:        0,
      ciudad_origen_id:  0,
      ciudad_destino_id: 0,
      hora_salida:       '',
      hora_llegada:      '',
      tipo_servicio:     '',
      precio:            0,
      asientos_totales:  undefined,
      estado:            'activo',
      observaciones:     '',
    };
  }
}
