import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { WorkitemService, Workitem, WorkitemCategory } from '../../services/workitem.service';
import { MsalService } from '@azure/msal-angular';
import { UserService } from '../../services/User.service.';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';

@Component({
  selector: 'app-workitems',
  standalone: false,
  templateUrl: './workitems.html',
  styleUrls: ['./workitems.css']
})
export class Workitems implements OnInit, AfterViewInit {
  displayedColumns: string[] = ['number', 'name'];
  dataSource = new MatTableDataSource<Workitem>([]);
  activeTab: 'standard' | 'unibouw' = 'unibouw';
  searchText: string = '';
  categories: WorkitemCategory[] = [];
  categoryMap: { [key: string]: string } = {};
  pageSize = 100;
  pageSizeOptions = [5, 10, 25, 50, 100, 200];
  isAdmin: boolean = false;
  isLoading: boolean = false;
  isSkeletonLoading: boolean = true;

  showPopup = false;
  popupMessage = '';
  popupError = false;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private workitemService: WorkitemService,
    private msalService: MsalService,
    private userService: UserService
  ) {}

  ngOnInit() {
  
    const showWelcome = localStorage.getItem('show_welcome');

  if (showWelcome === 'true') {
    // Fetch user data if needed
    const userData = localStorage.getItem('user_data');
    const user = userData ? JSON.parse(userData) : null;
    const userName = user?.name || user?.email?.split('@')[0] || 'User';

    // Show your welcome message (any style you want)
    //alert(`Welcome ${userName}! 👋`);
    this.showPopupMessage(`Welcome, ${userName}! You have successfully signed in to Unibouw.`);

    // Mark as shown so it doesn’t show again
    localStorage.setItem('show_welcome', 'false');
  }

 this.isAdmin = this.userService.isAdmin(); // Check role
  this.updateDisplayedColumns();  

     this.dataSource.filterPredicate = (data: Workitem, filter: string) => {
    const f = filter.trim().toLowerCase();
    return data.number.toString().includes(f)
        || data.name.toLowerCase().includes(f)
        || (data.description || '').toLowerCase().includes(f);
  };

  this.dataSource.sortingDataAccessor = (item: Workitem, property: string) => {
    switch (property) {
      case 'number':
        return typeof item.number === 'number' ? item.number : parseInt(item.number.toString()) || 0;
      case 'name':
        return item.name?.toLowerCase() || '';
      case 'description':
        return (item.description || '').toLowerCase();
      default:
        return (item as any)[property];
    }
  };

  // first page load
  this.loadCategoriesAndWorkitems(true);
}

updateDisplayedColumns() {
  if (this.isAdmin) {
    if (!this.displayedColumns.includes('action')) {
      this.displayedColumns.push('action');
    }
  } else {
    this.displayedColumns = this.displayedColumns.filter(c => c !== 'action');
  }
}

  ngAfterViewInit() {
    // Initialize paginator and sort
    setTimeout(() => {
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    });
  }

  applyFilter() {
    this.dataSource.filter = this.searchText.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

setTab(tab: 'standard' | 'unibouw') {
  this.activeTab = tab;
  this.searchText = '';
  this.dataSource.filter = '';

  // Clear existing data immediately
  this.dataSource.data = [];
  if (this.paginator) this.paginator.firstPage();

  const categoryId = this.categoryMap[tab];
  if (categoryId) {
    this.loadWorkitems(categoryId);
  } else {
    console.warn(`Category ID not found for tab ${tab}.`);
  }
}

loadCategoriesAndWorkitems(isFirstLoad = false) {
  if (isFirstLoad) {
    this.isSkeletonLoading = true;
  } else {
    this.isLoading = true;
  }

  this.workitemService.getCategories().subscribe({
    next: (categories) => {
      this.isLoading = false;
      if (isFirstLoad) this.isSkeletonLoading = false;

      this.categories = categories || [];
      categories.forEach(cat => {
        const name = cat.categoryName.toLowerCase();
        if (name === 'standard') this.categoryMap['standard'] = cat.categoryID;
        if (name === 'unibouw') this.categoryMap['unibouw'] = cat.categoryID;
      });

      const categoryId = this.categoryMap[this.activeTab];
      if (categoryId) this.loadWorkitems(categoryId);
    },
    error: () => {
      this.isLoading = false;
      this.isSkeletonLoading = false;
    }
  });
}

loadWorkitems(categoryId: string) {
  this.isLoading = true;

  this.workitemService.getWorkitems(categoryId).subscribe({
    next: (workitems) => {
      this.isLoading = false;
      this.isSkeletonLoading = false;

      let mapped = (workitems || []).map(it => ({ ...it, isEditing: false }));
      mapped = mapped.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      this.dataSource.data = mapped;

      setTimeout(() => {
        if (this.paginator) {
          this.dataSource.paginator = this.paginator;
          this.paginator.firstPage();
        }
        if (this.sort) {
          this.dataSource.sort = this.sort;
          this.sort.active = 'name';
          this.sort.direction = 'asc';
          this.sort.sortChange.emit({ active: 'name', direction: 'asc' });
        }
      });
    },
    error: () => {
      this.isLoading = false;
      this.isSkeletonLoading = false;
    }
  });
}


  saveDescription(item: Workitem) {
    item.isEditing = false;
    this.workitemService.updateDescription(item.workItemID, item.description).subscribe({
      next: () => this.showPopupMessage('Description saved successfully!'),
      error: () => {
        this.showPopupMessage('Failed to save description. Please try again.', true);
        item.isEditing = true;
      }
    });
    
  }

  toggleIsActive(item: Workitem) {
    if (!this.isAdmin) return;
    const newStatus = !item.isActive;
    item.isActive = newStatus;
    this.workitemService.updateIsActive(item.workItemID, newStatus).subscribe({
      next: () => this.showPopupMessage('Status updated successfully!'),
      error: () => {
        item.isActive = !newStatus;
        this.showPopupMessage('Failed to update status. Please try again.', true);
      }
    });
  }

  showPopupMessage(message: string, isError: boolean = false) {
    this.popupMessage = message;
    this.popupError = isError;
    this.showPopup = true;
    setTimeout(() => (this.showPopup = false), 3000);
  }
  getStartIndex(): number {
  if (!this.paginator) return 0;
  return this.paginator.pageIndex * this.paginator.pageSize + 1;
}

getEndIndex(): number {
  if (!this.paginator) return 0;
  const end = (this.paginator.pageIndex + 1) * this.paginator.pageSize;
  return end > this.dataSource.data.length ? this.dataSource.data.length : end;
}
}