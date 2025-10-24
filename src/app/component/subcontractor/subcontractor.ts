import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { SubcontractorService, Subcontractors } from '../../services/subcontractor.service';
import { UserService } from '../../services/User.service.';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';

@Component({
  selector: 'app-subcontractor',
  standalone: false,
  templateUrl: './subcontractor.html',
  styleUrl: './subcontractor.css',
})
export class Subcontractor implements OnInit, AfterViewInit {
  displayedColumns: string[] = ['name', 'category', 'contactPerson', 'emailId', 'action'];
  dataSource = new MatTableDataSource<Subcontractors>([]);
  
  searchText: string = '';
  isAdmin: boolean = false;
  isLoading: boolean = false;

  showPopup = false;
  popupMessage = '';
  popupError = false;

  // Paginator settings
  pageSize = 100;
  pageSizeOptions = [5, 10, 25, 50, 100];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private subcontractorService: SubcontractorService,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.isAdmin = this.userService.isAdmin();

    // Filter logic
    this.dataSource.filterPredicate = (data: Subcontractors, filter: string) => {
      const f = filter.trim().toLowerCase();
      return (
        data.name?.toLowerCase().includes(f) ||
        (data.category || '').toLowerCase().includes(f) ||
        (data.contactPerson || '').toLowerCase().includes(f) ||
        (data.emailId || '').toLowerCase().includes(f)
      );
    };

    this.loadSubcontractors();
  }

  ngAfterViewInit() {
    // Attach paginator and sort once view is initialized
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  loadSubcontractors() {
    this.isLoading = true;
    this.subcontractorService.getSubcontractors().subscribe({
      next: (subcontractors: Subcontractors[]) => {
        this.isLoading = false;
        this.dataSource.data = subcontractors || [];

        // Reconnect paginator after data load
        if (this.paginator) {
          this.dataSource.paginator = this.paginator;
          this.paginator.pageSize = this.pageSize;
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error fetching subcontractors', err);
        this.dataSource.data = [];
      },
    });
  }

  applyFilter() {
    this.dataSource.filter = this.searchText.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  // Called whenever user changes page size
  onPageSizeChange(event: PageEvent) {
    this.pageSize = event.pageSize;
    this.paginator.pageSize = this.pageSize;
    this.dataSource.paginator = this.paginator;
  }

  toggleIsActive(item: Subcontractors) {
    if (!this.isAdmin) return;

    const newStatus = !item.isActive;
    item.isActive = newStatus;

    this.subcontractorService.updateIsActive(item.id, newStatus).subscribe({
      next: () => this.showPopupMessage('Status updated successfully!'),
      error: () => {
        item.isActive = !newStatus;
        this.showPopupMessage('Failed to update status. Please try again.', true);
      },
    });
  }

  showPopupMessage(message: string, isError: boolean = false) {
    this.popupMessage = message;
    this.popupError = isError;
    this.showPopup = true;
    setTimeout(() => (this.showPopup = false), 3000);
  }
  getShortCategory(category: string | null | undefined): string {
  if (!category) return '';
  return category.length > 3 ? category.substring(0, 3) + '...' : category;
}
}