import { Component, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.css'
})
export class App {
   constructor(private translate: TranslateService) {
    translate.setDefaultLang('en');

    // later you can read this from user profile / localStorage
    translate.use('en'); // or 'nl'
  }
  protected readonly title = signal('Unibouw');
}
