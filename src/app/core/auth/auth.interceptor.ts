import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthStore } from './auth.store';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const accessToken = authStore.accessToken();

  if (!accessToken) {
    return next(req);
  }

  const authorizedRequest = req.clone({
    setHeaders: { Authorization: `Bearer ${accessToken}` }
  });

  return next(authorizedRequest);
};
