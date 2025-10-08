import { Component } from '@angular/core';
import { AppModule } from '../../app.module';


interface Workitem {
  code: string;
  workitem: string;
  description: string;
  active?: boolean;
  editItem?: boolean;
  
}


@Component({
  selector: 'app-workitems',
  standalone: false,
  templateUrl: './workitems.html',
  styleUrl: './workitems.css'
})
export class Workitems {
  workitems: Workitem[] = [];
  filteredItems: Workitem[] = [];
  pagedItems: Workitem[] = [];

  pageSize = 5;
  currentPage = 1;
  totalPages = 1;
  active?: boolean;
  activeTab: 'standard' | 'unibouw' = 'standard';
  searchText: string = '';
  
  ngOnInit() {
   this.loadWorkitems();

    

  }
  
  loadWorkitems() {
    if (this.activeTab === 'standard') {
      this.workitems = [
         { code: '126537', workitem: 'Painting', description: 'the initial preparatory work...', active: true },
      { code: '167256', workitem: 'Carpentry', description: 'the initial preparatory work...', active: false },
      { code: '235684', workitem: 'Pavement', description: 'the initial preparatory work...', active: true },
      { code: '236835', workitem: 'Sanitary', description: 'the initial preparatory work...', active: false },
      { code: '346781', workitem: 'Foundation', description: 'the initial preparatory work...', active: true },
      { code: '1245798', workitem: 'Inspection', description: 'the initial preparatory work...', active: true }
    ];
    } else if (this.activeTab === 'unibouw') {
      this.workitems = [
        { code: '235684', workitem: 'Pavement', description: 'the initial preparatory work...', active: true },
        { code: '236835', workitem: 'Sanitary', description: 'the initial preparatory work...', active: false },
        { code: '1245798', workitem: 'Inspection', description: 'the initial preparatory work...', active: true }
      ];
    }

    this.applyFilter();
  }
   applyFilter() {
    const keyword = this.searchText.toLowerCase();
    this.filteredItems = this.workitems.filter(item =>
      item.code.toLowerCase().includes(keyword) ||
      item.workitem.toLowerCase().includes(keyword) ||
      item.description.toLowerCase().includes(keyword)
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

  editItem(item: Workitem) {
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


 setTab(tab: 'standard' | 'unibouw') {
  this.activeTab = tab;       // set tab first
  this.currentPage = 1;       // reset page
  this.loadWorkitems();       // load items for that tab
}
}