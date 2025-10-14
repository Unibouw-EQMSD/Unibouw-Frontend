import { Component } from '@angular/core';


interface rfq {
  id: string;
  name: string;
  customer: string;
  rfqSentDate: string;
  dueDate: string;
  rfqSent:string;
  quoteRecieved:string;
  editItem?: boolean;
  
}

@Component({
  selector: 'app-rfq',
  standalone: false,
  templateUrl: './rfq.html',
  styleUrl: './rfq.css'
})
export class Rfq {
 rfq: rfq[] = [];
  filteredItems: rfq[] = [];
  pagedItems: rfq[] = [];

  pageSize = 5;
  currentPage = 1;
  totalPages = 1;
  active?: boolean;
 
  searchText: string = '';

    ngOnInit() {
   this.loadWorkitems();

    

  }

  loadWorkitems() {
  
      this.rfq = [
      { id: 'Pp101014', name: 'Meijs Schilderwerken	', customer: 'William Joseph	',rfqSentDate:'23-07-2025', dueDate:'23-08-2025',rfqSent:'12',quoteRecieved: '5', },
      { id: 'Pp101013', name: '	Citydocks Amsterdam		', customer: 'Eva Pertersen	',rfqSentDate:'23-01-2024', dueDate:'01-02-2024',rfqSent:'23',quoteRecieved: '15', },
      { id: 'Pp101012', name: 'Alblas Houthandel	', customer: 'Matthew Mark	',rfqSentDate:'16-09-2024', dueDate:'15-10-2024 ',rfqSent:'20',quoteRecieved: '14', },
      { id: 'Pp101011', name: 'VDG Real Estate Venlo	', customer: 'Timothy Ronald',rfqSentDate:'23-07-2025', dueDate:'23-08-2025',rfqSent:'12',quoteRecieved: '5', },
      { id: 'Pp101011', name: 'Super Market', customer: 'John Doe	',rfqSentDate:'23-07-2025', dueDate:'23-08-2025',rfqSent:'12',quoteRecieved: '5', },
    ];
     

    this.applyFilter();
  }
   applyFilter() {
    const keyword = this.searchText.toLowerCase();
    this.filteredItems = this.rfq.filter(item =>
      item.id.toLowerCase().includes(keyword) ||
      item.name.toLowerCase().includes(keyword) ||
      item.customer.toLowerCase().includes(keyword)||
      item.rfqSent.toLowerCase().includes(keyword)||
      item.quoteRecieved.toLowerCase().includes(keyword)



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

  editItem(item: rfq) {
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

get paginationInfo(): string {
  if (!this.filteredItems || this.filteredItems.length === 0) {
    return 'Showing 0 to 0 of 0 entries';
  }

  const start = (this.currentPage - 1) * this.pageSize + 1;
  let end = start + this.pagedItems.length - 1;

  return `Showing ${start} to ${end} of ${this.filteredItems.length} entries`;
}


}
