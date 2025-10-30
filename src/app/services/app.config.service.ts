import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
 
@Injectable({
  providedIn: 'root'
})
export class AppConfigService {
 
  private config!: AppConfig;
  loaded = false;
  constructor(private http: HttpClient) {}
  loadConfig(): Promise<void> {
      return this.http
          .get<AppConfig>('/assets/app.config.json')
          .toPromise()
          .then(data => {
            console.log(data)
            if(data !=undefined){
              this.config = data;
              this.loaded = true;
            }
          });
  }
 
  getConfig(): AppConfig {
      return this.config;
  }
}
export interface AppConfig {
  apiURL: string;
}
 