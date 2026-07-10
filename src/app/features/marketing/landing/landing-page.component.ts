import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  signal
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css'
})
export class LandingPageComponent implements AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly host = inject(ElementRef<HTMLElement>);
  private observer?: IntersectionObserver;

  protected readonly heroReady = signal(false);
  protected readonly prefersReducedMotion = signal(false);
  protected readonly contactSent = signal(false);
  protected readonly scrolled = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly currentYear = new Date().getFullYear();

  protected readonly contactForm = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    message: ['', [Validators.required, Validators.minLength(10)]]
  });

  constructor() {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.prefersReducedMotion.set(!!mq?.matches);
    mq?.addEventListener?.('change', (e) => this.prefersReducedMotion.set(e.matches));
    this.scrolled.set(window.scrollY > 8);
  }

  @HostListener('window:scroll')
  protected onWindowScroll(): void {
    this.scrolled.set(window.scrollY > 8);
  }

  ngAfterViewInit() {
    queueMicrotask(() => this.heroReady.set(true));

    if (typeof IntersectionObserver === 'undefined') return;

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            this.observer?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );

    this.host.nativeElement.querySelectorAll('.reveal').forEach((el: Element) => {
      this.observer?.observe(el);
    });
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected scrollTo(id: string) {
    this.closeMenu();
    const el = document.getElementById(id);
    el?.scrollIntoView({
      behavior: this.prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start'
    });
  }

  protected scrollToTop(): void {
    this.closeMenu();
    window.scrollTo({ top: 0, behavior: this.prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  protected submitContact() {
    this.contactForm.markAllAsTouched();
    if (this.contactForm.invalid) return;
    this.contactForm.reset();
    this.contactSent.set(true);
    setTimeout(() => this.contactSent.set(false), 4000);
  }
}
