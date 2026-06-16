import { Injectable } from '@angular/core';
import { createFetchAuthInterceptor } from '../interceptors/api-auth-interceptor';
import { createFetchRecipeContextInterceptor } from '../interceptors/recipe-context-interceptor';

@Injectable({
  providedIn: 'root',
})
export class FetchService {
  readonly interceptors = [createFetchAuthInterceptor(), createFetchRecipeContextInterceptor()];

  fetch(...args: Parameters<typeof fetch>) {
    const [finalInput, finalInit] = this.interceptors.reduce((currentParams, interceptor) => {
      const [input, init = {}] = currentParams;
      return interceptor(input, { ...init });
    }, args);

    return fetch(finalInput, finalInit);
  }
}
