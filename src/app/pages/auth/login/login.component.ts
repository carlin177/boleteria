import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {

  // inject() es la forma moderna de inyectar dependencias en Angular (alternativa al constructor)
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  // signal() para manejar estados del componente de forma reactiva
  isLoading = signal(false);       // true mientras espera respuesta del servidor
  errorMessage = signal('');       // mensaje de error para mostrar al usuario

  // FormGroup agrupa los controles del formulario.
  // FormBuilder.group() es un helper que simplifica la creación.
  // Cada control recibe [valorInicial, [validadores]]
  loginForm: FormGroup = this.fb.group({
    email: ['', [
      Validators.required,          // Campo obligatorio
      Validators.email              // Debe tener formato de email
    ]],
    password: ['', [
      Validators.required,
      Validators.minLength(8)       // Mínimo 8 caracteres (igual que en Laravel)
    ]]
  });

  // Getter para acceder fácilmente a los controles en el HTML
  // En vez de escribir loginForm.controls['email'], escribimos f.email
  get f() { return this.loginForm.controls; }

  onSubmit(): void {
    // markAllAsTouched() activa la visualización de errores en todos los campos
    // aunque el usuario no los haya tocado (útil cuando hace click en Submit directamente)
    this.loginForm.markAllAsTouched();

    // Si el formulario tiene errores de validación, no enviamos el request
    if (this.loginForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set('');

    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        // El AuthService ya guardó el token y el usuario.
        // Navegamos al inicio. replaceUrl: true evita que el usuario vuelva
        // al login con el botón "atrás" del navegador.
        this.router.navigate(['/'], { replaceUrl: true });
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        // Laravel devuelve errores de validación en err.error.errors
        // y errores generales en err.error.message
        if (err.status === 422 && err.error?.errors?.email) {
          this.errorMessage.set(err.error.errors.email[0]);
        } else {
          this.errorMessage.set('Credenciales incorrectas. Verifica tu email y contraseña.');
        }
      }
    });
  }
}
