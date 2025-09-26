import { Component } from '@angular/core';


interface Subcontractors {
  name: string;
  category: string;
  contact: string;
  email:string;
  active?: boolean;
  editItem?: boolean;
}
@Component({
  selector: 'app-subcontractor',
  standalone: false,
  templateUrl: './subcontractor.html',
  styleUrl: './subcontractor.css'
})
export class Subcontractor {
    subcontractor: Subcontractors[] = [];
  filteredItems: Subcontractors[] = [];

searchText: string = '';
  pagedItems: Subcontractors[] = [];

  pageSize = 5;
  currentPage = 1;
  totalPages = 1;
  active?: boolean;

  ngOnInit() {
   this.loadWorkitems();
  }
  loadWorkitems() {
    
      this.subcontractor = [
         { name: 'Bacany', category: 'Painting', contact: 'Zachary Kyle', email:'Zacharykyle@bacny.nl', active: true },
      { name: 'Slimbouw', category: 'Carpentry', contact: 'Eva Pertersen', email:'raymondjose@slimbouw.nl	', active: false },
      { name: 'Contructie & Co', category: 'Pavement', contact: 'the initial preparatory work...', email:'e.pertersen@contructie.com	', active: true },
      { name: 'Sowedane', category: 'Sanitary', contact: 'Raymond Jose', email:'	Douglase@Sowedane.nl', active: false },
      { name: 'TalentBouw', category: 'Foundation', contact: '	Douglas E', email:'	daanNathan@gtalendouw.nl', active: true },
    ];
   

    this.applyFilter();
  }
   applyFilter() {
    const keyword = this.searchText.toLowerCase();
    this.filteredItems = this.subcontractor.filter(item =>
      item.name.toLowerCase().includes(keyword) ||
      item.category.toLowerCase().includes(keyword) ||
      item.email.toLowerCase().includes(keyword)
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

  editItem(item: Subcontractors) {
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
