import { Component, OnInit, signal, inject, ViewChild, ElementRef } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';

import { CiudadesService } from '../../../services/ciudades.service';
import { Ciudad, CiudadRequest } from '../../../models/ciudad.model';

@Component({
  selector: 'app-ciudades',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './ciudades.component.html',
  styleUrl: './ciudades.component.css',
})
export class CiudadesComponent implements OnInit {

  private readonly service = inject(CiudadesService);

  @ViewChild('dialog') dialogRef!: ElementRef<HTMLDialogElement>;

  readonly ciudades  = signal<Ciudad[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving  = signal(false);
  readonly errorMsg  = signal<string | null>(null);
  readonly editingId = signal<number | null>(null);

  formData: CiudadRequest = this.emptyForm();

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.isLoading.set(true);
    this.service.getAll().subscribe({
      next: res => {
        this.ciudades.set(res.data);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMsg.set('Error al cargar las ciudades.');
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

  openEdit(ciudad: Ciudad): void {
    this.formData = {
      nombre:   ciudad.nombre,
      provincia: ciudad.provincia ?? '',
      pais:     ciudad.pais,
      estado:   ciudad.estado,
    };
    this.editingId.set(ciudad.id);
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

    const data = { ...this.formData };
    if (!data.provincia) delete data.provincia;

    const id = this.editingId();
    const op = id ? this.service.update(id, data) : this.service.create(data);

    op.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.closeDialog();
        this.load();
      },
      error: () => {
        this.isSaving.set(false);
        this.errorMsg.set('Error al guardar. Verificá los datos.');
      },
    });
  }

  delete(ciudad: Ciudad): void {
    if (!confirm(`¿Eliminar la ciudad "${ciudad.nombre}"?\nEsta acción fallará si la ciudad tiene viajes asociados.`)) return;
    this.service.delete(ciudad.id).subscribe({
      next: () => this.load(),
      error: () => alert('No se pudo eliminar. La ciudad puede tener viajes asociados.'),
    });
  }

  private emptyForm(): CiudadRequest {
    return { nombre: '', provincia: '', pais: 'Argentina', estado: 'activo' };
  }
}
