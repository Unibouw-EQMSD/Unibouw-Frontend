import { Component, OnInit } from '@angular/core';
import { WorkitemService, Workitem, WorkitemCategory, isActive } from '../../services/workitem.service';
import { MsalService } from '@azure/msal-angular';
import { UserService } from '../../services/User.service.';

@Component({
  selector: 'app-workitems',
  standalone: false,
  templateUrl: './workitems.html',
  styleUrls: ['./workitems.css']
})
export class Workitems implements OnInit {
  workitems: Workitem[] = [];
  filteredItems: Workitem[] = [];
  pagedItems: Workitem[] = [];
  pageSize = 5;
  currentPage = 1;
  totalPages = 1;
  activeTab: 'standard' | 'unibouw' = 'standard';
  searchText: string = '';
  categories: WorkitemCategory[] = [];
  categoryMap: { [key: string]: string } = {};
  pageSizes: number[] = [5, 10, 25, 50];

  userRoles: string[] = [];
  isAdmin: boolean = false;
  isLoading: boolean = false; // loading indicator

  constructor(private workitemService: WorkitemService, private msalService: MsalService, private userService: UserService) {}

  ngOnInit() {
   const user = this.userService.getUser();
  this.userRoles = this.userService.getUserRoles();
  this.isAdmin = this.userService.isAdmin();

  this.loadCategoriesAndWorkitems();
  }

setUserRoles() {
  const account = this.msalService.instance.getAllAccounts()[0];
  if (!account) return;

  const claims: any = account.idTokenClaims;

  // Handle string or array for roles
  let roles: string[] = [];

  if (claims?.roles) {
    if (Array.isArray(claims.roles)) {
      roles = claims.roles;
    } else if (typeof claims.roles === 'string') {
      roles = claims.roles.split(',').map((r: string) => r.trim()); // in case multiple roles are comma-separated
    }
  }

  this.userRoles = roles;
  this.isAdmin = roles.some(r => r.toLowerCase() === 'admin');

  console.log('Roles:', this.userRoles, 'isAdmin:', this.isAdmin);
}



  loadCategoriesAndWorkitems() {
    this.isLoading = true;
    this.workitemService.getCategories().subscribe({
      next: (categories: WorkitemCategory[]) => {
        this.isLoading = false;
        if (!categories || categories.length === 0) {
          this.categories = [];
          this.workitems = [];
          this.applyFilter();
          return;
        }

        this.categories = categories;
        categories.forEach(cat => {
          if (!cat?.categoryName) return;
          const name = cat.categoryName.toLowerCase();
          if (name === 'standard') this.categoryMap['standard'] = cat.categoryId;
          if (name === 'unibouw') this.categoryMap['unibouw'] = cat.categoryId;
        });

        const categoryId = this.categoryMap[this.activeTab];
        if (categoryId) this.loadWorkitems(categoryId);
      },
       error: (err) => {
      this.isLoading = false;
      console.error('Error fetching categories', err);
      // alert(err?.error?.message || 'Error fetching categories. Please try again later.');
      this.categories = [];
      this.workitems = [];
      this.applyFilter();
    }
    });
  }

  loadWorkitems(categoryId: string) {
    this.isLoading = true;
    this.workitemService.getWorkitems(categoryId).subscribe({
      next: (workitems: Workitem[]) => {
        this.isLoading = false;
    this.workitems = (workitems || []).map(it => ({
  ...it,
  editItem: false,
  isEditing: false
}));
        this.applyFilter();
      },
      error: (err) => {
      this.isLoading = false;
      console.error('Error fetching workitems', err);
      // alert(err?.error?.message || 'Error fetching workitems. Please try again later.');
      this.workitems = [];
      this.applyFilter();
    }
    });
  }

descriptionEditItem(item: Workitem) {
  if (item.editItem) {
    // Save changes here
    this.workitemService.updateDescription(item.id, item.description)
      .subscribe({
        next: () => alert('Description updated successfully'),
        error: (err) => alert(err?.error?.message || 'Failed to update description')
      });
  }
  item.editItem = !item.editItem;
}

saveDescription(item: Workitem) {
  item.isEditing = false;

  this.workitemService.updateDescription(item.id, item.description).subscribe({
    next: () => {
      item.showSavedMsg = true; // show the saved message

      // hide after 2 seconds
      setTimeout(() => {
        item.showSavedMsg = false;
      }, 2000);
    },
    error: (err) => {
      alert(err?.error?.message || 'Error updating description');
      item.isEditing = true; // revert back if update fails
    }
  });
}

applyFilter() {
  const keyword = this.searchText.toLowerCase().trim();

  if (keyword.length >= 2) {
    this.filteredItems = this.workitems.filter(item =>
      (item.number || '').toLowerCase().includes(keyword) ||
      (item.name || '').toLowerCase().includes(keyword) ||
      (item.description || '').toLowerCase().includes(keyword)
    );
  } else {
    this.filteredItems = [...this.workitems];
  }

  // Sort alphabetically by name
  this.filteredItems.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  this.currentPage = 1;
  this.totalPages = Math.ceil(this.filteredItems.length / this.pageSize) || 1;
  this.updatePagedItems();
}

  updatePagedItems() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.pagedItems = this.filteredItems.slice(start, end);
  }

  nextPage() { if (this.currentPage < this.totalPages) { this.currentPage++; this.updatePagedItems(); } }
  prevPage() { if (this.currentPage > 1) { this.currentPage--; this.updatePagedItems(); } }
  editItem(item: Workitem) { item.editItem = !item.editItem; }
  goToPage(page: number) { if (page >= 1 && page <= this.totalPages) { this.currentPage = page; this.updatePagedItems(); } }
  onPageSizeChange() { this.currentPage = 1; this.totalPages = Math.ceil(this.filteredItems.length / this.pageSize) || 1; this.updatePagedItems(); }

  setTab(tab: 'standard' | 'unibouw') {
    this.activeTab = tab;
    this.currentPage = 1;
    const categoryId = this.categoryMap[tab];
    if (categoryId) this.loadWorkitems(categoryId);
  }


toggleIsActive(item: Workitem) {
  if (!this.isAdmin) return;

  const newStatus = !item.isActive;
  item.isActive = newStatus;

  // Use 'number' as identifier
  this.workitemService.updateIsActive(item.id, newStatus).subscribe({
    next: () => console.log('Status updated successfully'),
    error: (err) => {
      console.error('Error updating status', err);
      item.isActive = !newStatus; // revert if failed
      alert(err?.error?.message || 'Failed to update status. Please try again later.');
    }
  });
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
