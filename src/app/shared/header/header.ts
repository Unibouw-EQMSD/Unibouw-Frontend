import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AccountInfo, PublicClientApplication } from '@azure/msal-browser';
import { UserService } from '../../services/User.service.';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ReminderService } from '../../services/reminder.service';

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header {

  private msalInstance: PublicClientApplication;

  constructor(
    public router: Router,
    private userService: UserService,
    private snackBar: MatSnackBar,
    private reminderService: ReminderService
  ) {
    this.msalInstance = (window as any).msalInstance;
  }

@HostListener('document:click', ['$event'])
handleClickOutside(event: Event) {
  const target = event.target as HTMLElement;

  // Close Max Reminder Sequence dropdown
  if (!target.closest('.custom-dropdown')) {
    this.open = false;
  }

  // Close Reminder Sequence multi-select dropdown
  if (!target.closest('.dropdown')) {
    this.dropdownOpen = false;
  }

}


  isAdmin = false;
  //reminderSequence: number[] = [];
  reminderTimeValue: string = '08:00';
  reminderEmailBody: string = '';
  enableGlobalReminders: boolean = false;
  dropdownOpen = false;
  values = Array.from({ length: 30 }, (_, i) => -1 - i); // [-1, -2, -3...]
  selectedReminderSequence: number[] = [];
  // Add a property to your component
  InitialLoadedReminderConfig: any = null;

   ngOnInit() {

     this.isAdmin = this.userService.isAdmin(); // Check role
     }

  // ------------------ Active Route Checks ------------------

  isProjectsActive(): boolean {
    return this.router.url.startsWith('/projectdetails') ||
      this.router.url.startsWith('/rfq') ||
      this.router.url.startsWith('/add-rfq') ||
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

  // ------------------ User Info ------------------

  getUserName(): string {
    return this.userService.getUserName();
  }

  getUserEmail(): string {
    return this.userService.getUserEmail();
  }

  // ------------------ Logout ------------------

  async signOut() {
    try {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_data');
      this.msalInstance.setActiveAccount(null);

      const accounts: AccountInfo[] = this.msalInstance.getAllAccounts();

      if (accounts.length) {
        await this.msalInstance.logoutRedirect({
          account: accounts[0],
          postLogoutRedirectUri: `${window.location.origin}/login`
        });
        return;
      }

      this.router.navigate(['/login']);

    } catch {
      localStorage.clear();
      this.router.navigate(['/login']);
    }
  }

  // ------------------ Reminder Popup ------------------

  showSetReminderPopup = false;

openReminderConfig() {
  this.reminderService.getGlobalReminderConfig().subscribe({
    next: (res) => {  
      const config = Array.isArray(res) && res.length > 0 ? res[0] : null;
      if (!config) {
        this.snackBar.open("No reminder configuration found", "Close", { duration: 3000 });
        return;
      }

      // Store deep copy for reset
      this.InitialLoadedReminderConfig = JSON.parse(JSON.stringify(config));

      // Fix: Convert to number[]
      this.selectedReminderSequence = config.reminderSequence
        ? config.reminderSequence.split(',').map(Number)
        : [];

this.reminderTimeValue = config.reminderTime || '08:00';
      this.reminderEmailBody = config.reminderEmailBody || '';
      this.enableGlobalReminders = config.isEnable || false;

this.snackBar.open("Reminder configuration loaded successfully", "Close", {
        duration: 3000
      });

this.showSetReminderPopup = true;
    },
    error: (err) => {
      console.error("Error loading reminder config:", err);

this.snackBar.open("Failed to load reminder configuration", "Close", {
        duration: 4000
      });
    }
  });
}


  closeReminderConfig() {
    this.showSetReminderPopup = false;
  }

 resetReminderConfig() {
  const config = this.InitialLoadedReminderConfig;
  if (!config) return; // Nothing to reset

this.selectedReminderSequence = config.reminderSequence
    ? config.reminderSequence.split(',').map(Number)
    : [];
  this.reminderTimeValue = config.reminderTime || '08:00';
  this.reminderEmailBody = config.reminderEmailBody || '';
  this.enableGlobalReminders = config.isEnable || false;
}

  // ------------------ Global Reminder Fields ------------------
   setReminderConfig() {
    const body = {
      id: '00000000-0000-0000-0000-000000000001', // use actual ID from DB
      reminderSequence: this.selectedReminderSequence.join(','),
      reminderTime: this.reminderTimeValue,
      reminderEmailBody: this.reminderEmailBody,
      updatedBy: null,
      updatedAt: null,
      isEnable: this.enableGlobalReminders
    };

    this.reminderService.updateGolbalReminderConfigSet(body).subscribe({
      next: (res) => {       
        this.closeReminderConfig();
        alert("Reminder configuration updated successfully");
        this.snackBar.open("Reminder configuration updated successfully", "Close", { duration: 9000 }); 
      },
      error: (err) => {
            alert("Failed to update reminder configuration");
        this.snackBar.open('Failed to update reminder configuration', 'Close', {duration: 9000});
      }
    });
  }

  // ------------------ Sequence Dropdown (Max 5 values) ------------------

 numberList: number[] = Array.from({ length: 31 }, (_, i) => i);

  maxSequenceLimit: number = 5;

  open = false;

selectLimit(limit: number) {
  this.maxSequenceLimit = limit;

   // 🔥 Reset selected values if they exceed the new limit
  if (this.selectedReminderSequence.length > limit) {
    this.selectedReminderSequence = [];
  }

   // Close this dropdown
  this.open = false;

}

// Toggle Max Reminder Sequence dropdown
toggleMaxSequenceDropdown() {
  this.open = !this.open;
  if (this.open) {
    this.dropdownOpen = false; // close other dropdown
  }
}

// Toggle Reminder Sequence dropdown
toggleReminderDropdown() {
  this.dropdownOpen = !this.dropdownOpen;
  if (this.dropdownOpen) {
    this.open = false; // close other dropdown
  }
}
 
  toggleDropdown() {
     // Close other dropdown when opening this one
  this.open = false;
  this.dropdownOpen = !this.dropdownOpen;
  }

  isChecked(value: number): boolean {
    return this.selectedReminderSequence.includes(value);
  }

  onCheck(value: number, checked: boolean) {
    if (checked) {
      if (this.selectedReminderSequence.length < this.maxSequenceLimit) {
        this.selectedReminderSequence.push(value);
      }
    } else {
      this.selectedReminderSequence = this.selectedReminderSequence.filter(v => v !== value);
    }
  }

  isDisabled(value: number): boolean {
    return !this.isChecked(value) && this.selectedReminderSequence.length >= this.maxSequenceLimit;
  }

  onRowClick(value: number) {
    if (this.isDisabled(value)) return;

    this.isChecked(value)
      ? this.onCheck(value, false)
      : this.onCheck(value, true);
  }

  clearSelected(event: MouseEvent) {
    event.stopPropagation();
    this.selectedReminderSequence = [];
  }

}
