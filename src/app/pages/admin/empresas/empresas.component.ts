import { Component, OnInit, signal, inject, ViewChild, ElementRef } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';

import { EmpresasService } from '../../../services/empresas.service';
import { Empresa, EmpresaRequest } from '../../../models/empresa.model';

@Component({
  selector: 'app-empresas',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './empresas.component.html',
  styleUrl: './empresas.component.css',
})
export class EmpresasComponent implements OnInit {

  private readonly service = inject(EmpresasService);

  @ViewChild('dialog') dialogRef!: ElementRef<HTMLDialogElement>;

  readonly empresas  = signal<Empresa[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving  = signal(false);
  readonly errorMsg  = signal<string | null>(null);
  readonly editingId = signal<number | null>(null);

  formData: EmpresaRequest = this.emptyForm();

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.isLoading.set(true);
    this.service.getAll().subscribe({
      next: res => {
        this.empresas.set(res.data);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMsg.set('Error al cargar las empresas.');
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

  openEdit(empresa: Empresa): void {
    this.formData = {
      nombre:    empresa.nombre,
      telefono:  empresa.telefono  ?? '',
      email:     empresa.email     ?? '',
      sitio_web: empresa.sitio_web ?? '',
      estado:    empresa.estado,
    };
    this.editingId.set(empresa.id);
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
    if (!data.telefono)  delete data.telefono;
    if (!data.email)     delete data.email;
    if (!data.sitio_web) delete data.sitio_web;

    const id = this.editingId();
    if (id) {
      // Al actualizar, nunca enviar el id (es inmutable)
      delete data.id;
    } else {
      // Al crear, enviar id solo si fue especificado
      if (!data.id) delete data.id;
    }
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

  delete(empresa: Empresa): void {
    if (!confirm(`¿Eliminar la empresa "${empresa.nombre}"?`)) return;
    this.service.delete(empresa.id).subscribe({
      next: () => this.load(),
      error: () => alert('No se pudo eliminar la empresa.'),
    });
  }

  private emptyForm(): EmpresaRequest {
    return { nombre: '', telefono: '', email: '', sitio_web: '', estado: 'activo' };
  }
}
