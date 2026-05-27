import { TestBed } from '@angular/core/testing';
import { HttpInterceptorFn } from '@angular/common/http';

import { apiAuthInterceptor } from './api-auth-interceptor';

describe('apiAuthInterceptor', () => {
  const interceptor: HttpInterceptorFn = (req, next) =>
    TestBed.runInInjectionContext(() => apiAuthInterceptor(req, next));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(interceptor).toBeTruthy();
  });
});
