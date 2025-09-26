import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface projectdetails {
  code: string;
  name: string;
  customer: string;
  manager: string;
  startDate?: string;
  committedDate?:string;
  status:string;
  active?: boolean;
  editItem?: boolean;
  
}


@Component({
  selector: 'app-project-details',
  standalone: false,
  templateUrl: './project-details.html',
  styleUrl: './project-details.css'
})
export class ProjectDetails {
constructor(private router: Router) {}


  projectdetails: projectdetails[] = [];
  filteredItems: projectdetails[] = [];
  pagedItems: projectdetails[] = [];

  pageSize = 5;
  currentPage = 1;
  totalPages = 1;
  active?: boolean;
 
  searchText: string = '';

    ngOnInit() {
   this.loadWorkitems();

    

  }
goToRFQ() {
  this.router.navigate(['/rfq']);
}
  loadWorkitems() {
  
      this.projectdetails = [
      { code: '129474', name: 'Super Market', customer: 'Timothy Ronald',manager:'David H', startDate:'23-07-2025',committedDate:'18-02-2026',status: 'Started', active: true, },
      { code: '174689', name: '	Alblas Houthandel', customer: 'Matthew Mark',manager:'Christopher Daniel',startDate:'16-09-2024',committedDate:'19-03-2026',status: 'In Progress',  active: false },
      { code: '235689', name: '	Citydocks Amsterdam', customer: 'Eva Pertersen',manager:'David H',startDate:'23-01-2024',committedDate:'24-01-2025',status: 'Completed',  active: true },
      { code: '264589', name: 'Meijs Schilderwerken', customer: 'William Joseph',manager:'Christopher Daniel',startDate:'23-07-2025',committedDate:'24-01-2025',status: 'In Progress',  active: false },
      { code: '348718', name: '	VDG Real Estate Venlo', customer: 'John Doe',manager:'Shelly Kavin',startDate:'23-01-2024',committedDate:'24-05-2025',status: 'Completed',  active: true },
      { code: '753456', name: '	Welvaarts', customer: 'Donald Joshua',manager:'Shelly Kavin',startDate:'16-03-2025',committedDate:'24-01-2027',status: 'In Progress	',  active: true }
    ];
     

    this.applyFilter();
  }
   applyFilter() {
    const keyword = this.searchText.toLowerCase();
    this.filteredItems = this.projectdetails.filter(item =>
      item.code.toLowerCase().includes(keyword) ||
      item.name.toLowerCase().includes(keyword) ||
      item.customer.toLowerCase().includes(keyword)||
      item.manager.toLowerCase().includes(keyword)||
      item.status.toLowerCase().includes(keyword)


    );

   this.currentPage = 1;
  this.totalPages = Math.ceil(this.filteredItems.length / this.pageSize) || 1;
  this.updatePagedItems();
  }

 updatePagedItems() {
  const start = (this.currentPage - 1) * this.pageSize;
  const end = start + this.pageSize;
  this.pagedItems = this.filteredItems.slice(start, end);
}


  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagedItems();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagedItems();
    }
  }

  editItem(item: projectdetails) {
    item.editItem = !item.editItem;  // toggle edit mode
  }

goToPage(page: number) {
  if (page >= 1 && page <= this.totalPages) {
    this.currentPage = page;
    this.updatePagedItems();
  }
}

pageSizes: number[] = [5, 10, 25, 50]; // options for dropdown

onPageSizeChange() {
  this.currentPage = 1; // reset to first page
  this.totalPages = Math.ceil(this.filteredItems.length / this.pageSize) || 1;
  
  if (this.currentPage > this.totalPages) {
    this.currentPage = this.totalPages;
  }

  this.updatePagedItems();
}



}
