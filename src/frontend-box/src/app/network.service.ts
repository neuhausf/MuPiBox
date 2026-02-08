import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable, defer, timer } from 'rxjs'
import { distinctUntilChanged, expand, filter, map, shareReplay, switchMap } from 'rxjs/operators'
import { environment } from '../environments/environment'
import type { Network } from './network'

@Injectable({
  providedIn: 'root',
})
export class NetworkService {
  /**
   * Network state observable with adaptive polling:
   * - Polls every 1 second when offline
   * - Polls every 5 seconds when online
   * - First request is after 300ms to allow app initialization
   */
  public readonly network$: Observable<Network>

  constructor(private http: HttpClient) {
    const fetchNetwork = (): Observable<Network> =>
      this.http.get<Network>(`${environment.backend.apiUrl}/network`)

    this.network$ = defer(() => {
      // Initial request after 300ms
      return timer(300).pipe(
        switchMap(() => fetchNetwork()),
        expand((network) => {
          // Poll every 1s when offline, every 5s when online
          const interval = network.onlinestate === 'online' ? 5000 : 1000
          return timer(interval).pipe(switchMap(() => fetchNetwork()))
        }),
      )
    }).pipe(shareReplay({ bufferSize: 1, refCount: false }))
  }

  /**
   * Observable that emits true when online, false when offline.
   * Only emits on state changes (distinctUntilChanged).
   */
  public isOnline(): Observable<boolean> {
    return this.network$.pipe(
      filter((network) => network.ip !== undefined),
      map((network) => network.onlinestate === 'online'),
      distinctUntilChanged(),
    )
  }
}
