import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function passwordsMatchValidator(passwordKey: string, confirmKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get(passwordKey)?.value;
    const confirm = group.get(confirmKey)?.value;
    if (!password || !confirm || password === confirm) return null;
    return { passwordsMismatch: true };
  };
}

const GALLERY_PAGE_PATTERNS = [
  /vecteezy\.com\/free-/i,
  /vecteezy\.com\/vector/i,
  /unsplash\.com\/s\/photos/i,
  /unsplash\.com\/t\//i,
  /pexels\.com\/search/i,
  /pinterest\.com/i,
  /google\.[^/]+\/search/i,
  /shutterstock\.com\/search/i,
  /istockphoto\.com\/search/i,
  /freepik\.com\/free-/i
];

const DIRECT_IMAGE_PATTERNS = [
  /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?.*)?$/i,
  /images\.unsplash\.com\/photo-/i,
  /images\.pexels\.com\//i,
  /static\.vecteezy\.com\//i
];

export function isGalleryPageUrl(url: string): boolean {
  const value = url.trim();
  if (!value) return false;
  if (DIRECT_IMAGE_PATTERNS.some((pattern) => pattern.test(value))) return false;
  return GALLERY_PAGE_PATTERNS.some((pattern) => pattern.test(value));
}

export function isDirectImageUrl(url: string): boolean {
  const value = url.trim();
  if (!value) return false;
  if (/^data:image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml);base64,/i.test(value)) {
    return true;
  }
  if (!/^https?:\/\//i.test(value)) return false;
  return !isGalleryPageUrl(value);
}

export function coverImageUrlValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').trim();
    if (!value) return null;

    if (/^data:image\//i.test(value)) {
      if (!/^data:image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml);base64,/i.test(value)) {
        return { coverImageUrl: 'Format d’image non supporté. Utilisez JPG, PNG, WebP ou GIF.' };
      }
      return null;
    }

    if (!/^https?:\/\//i.test(value)) {
      return { coverImageUrl: 'URL invalide — doit commencer par https://' };
    }

    if (isGalleryPageUrl(value)) {
      return {
        coverImageUrl:
          "Lien de page détecté. Collez l'URL directe de l'image (.jpg, .png…) — pas la page de la galerie."
      };
    }

    return null;
  };
}
