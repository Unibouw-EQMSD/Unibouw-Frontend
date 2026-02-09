import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SubcontractorService } from '../../../services/subcontractor.service';

@Component({
  selector: 'app-subcontractor-details',
  standalone: false,
  templateUrl: './subcontractor-details.html',
  styleUrl: './subcontractor-details.css'
})
export class SubcontractorDetails {
subcontractor: any = null;
  isLoading = true;
  errorMsg = '';
  selectedTab: 'unibouw' | 'standard' = 'unibouw';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private subcontractorService: SubcontractorService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMsg = 'Subcontractor not found.';
      this.isLoading = false;
      return;
    }
  this.subcontractorService.getSubcontractorById(id).subscribe(
    (res) => {
      this.subcontractor = res; // ✅ just assign the object
      this.isLoading = false;
    },
    (err) => {
      this.errorMsg = err.error?.message || 'Unable to load subcontractor details.';
      this.isLoading = false;
    }
  );
  }

  backToListing() {
    this.router.navigate(['/subcontractor']);
  }

}
