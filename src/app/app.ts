import { Component, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.css'
})
export class App {
  constructor(
    private translate: TranslateService,
    private titleService: Title
  ) {
    // Set the initial translated title when the app loads
    this.setTranslatedTitle();

    // Listen for language change and update title accordingly
    this.translate.onLangChange.subscribe(() => {
      this.setTranslatedTitle();
    });
  }

  private setTranslatedTitle() {
    this.translate.get('APP.TITLE').subscribe(title => {
      this.titleService.setTitle(title);
    });
  }
}
