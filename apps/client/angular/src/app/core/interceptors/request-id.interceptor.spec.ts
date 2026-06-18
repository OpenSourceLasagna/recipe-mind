import { TestBed } from '@angular/core/testing';
import { HttpEvent, HttpHeaders, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';

import { REQUEST_ID_HEADER, requestIdInterceptor } from './request-id.interceptor';

describe('requestIdInterceptor', () => {
  const captureRequest = (req: HttpRequest<unknown>): HttpRequest<unknown> => {
    let captured: HttpRequest<unknown> | null = null;
    const next = (r: HttpRequest<unknown>): Observable<HttpEvent<unknown>> => {
      captured = r;
      return of(new HttpResponse({ status: 200 }));
    };
    TestBed.runInInjectionContext(() => requestIdInterceptor(req, next));
    return captured as unknown as HttpRequest<unknown>;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('attaches a generated request id when none is present', () => {
    const req = new HttpRequest('GET', '/v1/recipes');
    const forwarded = captureRequest(req);

    expect(forwarded.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
  });

  it('preserves a caller-supplied request id', () => {
    const headers = new HttpHeaders({ [REQUEST_ID_HEADER]: 'caller-supplied-id' });
    const req = new HttpRequest('GET', '/v1/recipes', { headers });
    const forwarded = captureRequest(req);

    expect(forwarded.headers.get(REQUEST_ID_HEADER)).toBe('caller-supplied-id');
  });

  it('generates a different id per request', () => {
    const req1 = new HttpRequest('GET', '/a');
    const req2 = new HttpRequest('GET', '/b');
    const id1 = captureRequest(req1).headers.get(REQUEST_ID_HEADER);
    const id2 = captureRequest(req2).headers.get(REQUEST_ID_HEADER);

    expect(id1).not.toBe(id2);
  });
});
