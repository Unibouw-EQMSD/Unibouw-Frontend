import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header {
  constructor(public router: Router) { }

  isProjectsActive(): boolean {
    return this.router.url.startsWith('/projectdetails') ||
      this.router.url.startsWith('/rfq') ||
      this.router.url.startsWith('/add-rfq')||
      this.router.url.startsWith('/view-projects');

  }

  isWorkitemActive(): boolean {
    return this.router.url.startsWith('/workitems') ||
      this.router.url.startsWith('/add-workitem');
  }

  isSubcontractorActive(): boolean {
    return this.router.url.startsWith('/subcontractor') ||
      this.router.url.startsWith('/add-subcontractor');
  }
}
