import { Injectable, signal } from '@angular/core';

const STORAGE_KEY   = 'boleteria_theme';
const TRANS_CLASS   = 'theme-transitioning';
const TRANS_TIMEOUT = 350;

@Injectable({ providedIn: 'root' })
export class ThemeService {

  readonly isDark = signal(false);

  constructor() {
    const saved      = localStorage.getItem(STORAGE_KEY);
    const osPrefDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.applyTheme(saved === 'dark' || (!saved && osPrefDark), false);
  }

  toggle(): void {
    this.applyTheme(!this.isDark(), true);
  }

  private applyTheme(dark: boolean, animate: boolean): void {
    if (animate) {
      document.body.classList.add(TRANS_CLASS);
      window.setTimeout(() => document.body.classList.remove(TRANS_CLASS), TRANS_TIMEOUT);
    }
    document.body.classList.toggle('dark', dark);
    this.isDark.set(dark);
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
  }
}
