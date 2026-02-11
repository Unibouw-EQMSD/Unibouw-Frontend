import { Component, ElementRef, HostListener, ViewChild, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AccountInfo, PublicClientApplication } from '@azure/msal-browser';
import { UserService } from '../../services/User.service.';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ReminderService } from '../../services/reminder.service';
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';

export function midnightNotAllowedValidator(control: AbstractControl): ValidationErrors | null {
  if (control.value === '00:00') {
    return { midnightNotAllowed: true };
  }
  return null;
}

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnInit {
  private msalInstance: PublicClientApplication;
  reminderForm: FormGroup;
  currentLang: 'en' | 'nl' = 'en';

  constructor(
    public router: Router,
    private userService: UserService,
    private snackBar: MatSnackBar,
    private reminderService: ReminderService,
    private fb: FormBuilder,
    private translate: TranslateService, // ← Add this
  ) {
    this.msalInstance = (window as any).msalInstance;

    this.reminderForm = this.fb.group({
      maxReminderSequence: [1, [Validators.required, Validators.min(1)]], // must be > 0
      reminderSequence: [[], Validators.required],
      reminderTime: ['', [Validators.required, midnightNotAllowedValidator]],
      reminderEmailBody: ['', [Validators.required, this.noWhitespaceValidator]],
      isEnable: [true],
    });
    this.translate.setDefaultLang('en');
    this.translate.use('en');
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

    // ✅ Close User Dropdown
    if (!target.closest('.user-dropdown')) {
      this.userDropdownOpen = false;
    }
  }
  toggleLanguage(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const lang: 'en' | 'nl' = checked ? 'nl' : 'en';

    this.switchLang(lang);
  }

  switchLang(lang: 'en' | 'nl') {
    this.currentLang = lang;
    this.translate.use(lang);
    localStorage.setItem('lang', lang);
  }
  isAdmin = false;
  dropdownOpen = false;
  values = Array.from({ length: 60 }, (_, i) => -1 - i); // [-1, -2, -3...]
  selectedReminderSequence: number[] = [];
  // Add a property to your component
  InitialLoadedReminderConfig: any = null;
  userDropdownOpen = false;

  ngOnInit() {
    const savedLang = localStorage.getItem('lang') as 'en' | 'nl' | null;

    this.currentLang = savedLang ?? 'en';
    this.translate.use(this.currentLang);
    this.isAdmin = this.userService.isAdmin(); // Check role

    this.reminderForm.get('isEnable')?.valueChanges.subscribe((enabled) => {
      const action = enabled ? 'enable' : 'disable';

      ['reminderTime', 'reminderEmailBody', 'maxReminderSequence', 'reminderSequence'].forEach(
        (control) => this.reminderForm.get(control)?.[action]({ emitEvent: false }),
      );
    });
  }

  noWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
    const isWhitespace = (control.value || '').trim().length === 0;
    return isWhitespace ? { whitespace: true } : null;
  }

  toggleUserDropdown(event: MouseEvent) {
    event.stopPropagation();
    this.userDropdownOpen = !this.userDropdownOpen;
  }

  // ------------------ Active Route Checks ------------------

  isProjectsActive(): boolean {
    return (
      this.router.url.startsWith('/projectdetails') ||
      this.router.url.startsWith('/rfq') ||
      this.router.url.startsWith('/add-rfq') ||
      this.router.url.startsWith('/view-projects')
    );
  }

  isWorkitemActive(): boolean {
    return this.router.url.startsWith('/workitems') || this.router.url.startsWith('/add-workitem');
  }

  isSubcontractorActive(): boolean {
    return (
      this.router.url.startsWith('/subcontractor') ||
      this.router.url.startsWith('/add-subcontractor')
    );
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
          postLogoutRedirectUri: `${window.location.origin}/login`,
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
          // this.snackBar.open('No reminder configuration found', 'Close', { duration: 3000 });
          this.reminderForm.patchValue({
            maxReminderSequence: 5,
            reminderSequence: [],
            reminderTime: '08:00',
            reminderEmailBody:
              'This is to inform you that the global reminder has been successfully configured in the system.',
            isEnable: true,
          });

          this.showSetReminderPopup = true;
          return;
        }

        this.InitialLoadedReminderConfig = JSON.parse(JSON.stringify(config));

        const sequenceArray = config.reminderSequence
          ? config.reminderSequence.split(',').map(Number)
          : [];

        // ✅ PATCH FORM VALUES
        this.reminderForm.patchValue({
          maxReminderSequence: sequenceArray.length || 5,
          reminderSequence: sequenceArray,
          reminderTime: config.reminderTime || '',
          reminderEmailBody:
            config.reminderEmailBody ||
            ' is to inform you that the global reminder has been successfully configured in the system.',
          isEnable: config.isEnable ?? false,
        });

        // UI helpers
        this.selectedReminderSequence = sequenceArray;
        // this.maxSequenceLimit = sequenceArray.length || 5;

        this.showSetReminderPopup = true;
      },
      error: (ex) => {
        console.error('Error fetching reminder config:', ex);
        this.snackBar.open('Failed to load reminder configuration', 'Close', { duration: 4000 });
      },
    });
  }

  closeReminderConfig() {
    this.showSetReminderPopup = false;
  }

  resetReminderConfig() {
    const config = this.InitialLoadedReminderConfig;
    if (!config) return;

    const sequenceArray = config.reminderSequence
      ? config.reminderSequence.split(',').map(Number)
      : [];

    this.reminderForm.reset({
      maxReminderSequence: sequenceArray.length || 1,
      reminderSequence: sequenceArray,
      reminderTime: config.reminderTime || '08:00',
      reminderEmailBody: config.reminderEmailBody || '',
      isEnable: config.isEnable ?? false,
    });

    this.selectedReminderSequence = sequenceArray;
  }

  // ------------------ Global Reminder Fields ------------------
  setReminderConfig() {
    this.reminderForm.markAllAsTouched();

    const formValue = this.reminderForm.value;

    // Validate only when enabled
    if (formValue.isEnable && (this.reminderForm.invalid || !formValue.reminderEmailBody?.trim())) {
      console.warn('🚫 Reminder form is invalid');
      return;
    }

    const reminderSequence = Array.isArray(formValue.reminderSequence)
      ? formValue.reminderSequence
      : [];

    const body = {
      id: '00000000-0000-0000-0000-000000000001',
      reminderSequence: reminderSequence.join(','),
      reminderTime: formValue.reminderTime || '',
      reminderEmailBody: formValue.reminderEmailBody?.trim() || '',
      isEnable: formValue.isEnable,
    };

    this.reminderService.saveGlobalReminderConfig(body).subscribe({
      next: () => {
        this.closeReminderConfig();
        this.snackBar.open('Reminder configuration updated successfully', 'Close', {
          duration: 5000,
        });
      },
      error: (ex) => {
        console.error('Failed to update reminder configuration:', ex);
        this.snackBar.open('Failed to update reminder configuration', 'Close', {
          duration: 5000,
        });
      },
    });
  }

  // ------------------ Sequence Dropdown (Max 5 values) ------------------

  numberList: number[] = Array.from({ length: 31 }, (_, i) => i);

  //maxSequenceLimit: number = 5;

  open = false;

  // selectLimit(limit: number) {
  //   this.maxSequenceLimit = limit;

  //   // 🔥 Reset selected values if they exceed the new limit
  //   if (this.selectedReminderSequence.length > limit) {
  //     this.selectedReminderSequence = [];
  //   }

  //   // Close this dropdown
  //   this.open = false;
  // }

  selectLimit(limit: number) {
    // this.maxSequenceLimit = limit;

    this.reminderForm.get('maxReminderSequence')?.setValue(limit);
    this.reminderForm.get('maxReminderSequence')?.markAsTouched();

    if (this.selectedReminderSequence.length > limit) {
      this.selectedReminderSequence = [];
      this.reminderForm.get('reminderSequence')?.setValue([]);
    }

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

  // onCheck(value: number, checked: boolean) {
  //   const max = this.reminderForm.get('maxReminderSequence')?.value || 1;
  //   if (checked) {
  //     if (this.selectedReminderSequence.length < max) {
  //       this.selectedReminderSequence.push(value);
  //     }
  //   } else {
  //     this.selectedReminderSequence = this.selectedReminderSequence.filter((v) => v !== value);
  //   }

  //   //SYNC WITH FORM
  //   this.reminderForm.get('reminderSequence')?.setValue(this.selectedReminderSequence);
  //   this.reminderForm.get('reminderSequence')?.markAsTouched();
  // }

  onCheck(value: number, checked: boolean) {
    const max = this.reminderForm.get('maxReminderSequence')?.value || 1;

    if (checked) {
      if (
        this.selectedReminderSequence.length < max &&
        !this.selectedReminderSequence.includes(value)
      ) {
        this.selectedReminderSequence.push(value);
      }
    } else {
      this.selectedReminderSequence = this.selectedReminderSequence.filter((v) => v !== value);
    }

    // 🔽 Sort in descending order
    this.selectedReminderSequence.sort((a, b) => b - a);

    // Sync with form
    this.reminderForm.get('reminderSequence')?.setValue(this.selectedReminderSequence);

    this.reminderForm.get('reminderSequence')?.markAsTouched();
  }

  isDisabled(value: number): boolean {
    const max = this.reminderForm.get('maxReminderSequence')?.value || 1;
    return !this.isChecked(value) && this.selectedReminderSequence.length >= max;
  }

  onRowClick(value: number) {
    if (this.isDisabled(value)) return;

    this.isChecked(value) ? this.onCheck(value, false) : this.onCheck(value, true);
  }

  clearSelected(event: MouseEvent) {
    event.stopPropagation();
    this.selectedReminderSequence = [];
    this.reminderForm.get('reminderSequence')?.setValue([]);
  }
}
