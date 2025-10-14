// user.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private userSubject = new BehaviorSubject<any>(null);
  public user$ = this.userSubject.asObservable();

  setUser(user: any) {
    this.userSubject.next(user);
    // Store in localStorage
    localStorage.setItem('user_data', JSON.stringify(user));
  }

  getUser() {
    if (this.userSubject.value) return this.userSubject.value;

    const storedUser = localStorage.getItem('user_data');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      this.userSubject.next(user);
      return user;
    }
    return null;
  }

  getUserName(): string {
    const user = this.getUser();
    return user?.name || 'User';
  }

  getUserEmail(): string {
    const user = this.getUser();
    return user?.email || '';
  }

  getUserRoles(): string[] {
    const user = this.getUser();
    if (!user?.roles) return [];
    return typeof user.roles === 'string' ? user.roles.split(',').map((r: string) => r.trim()) : user.roles;
  }

  isAdmin(): boolean {
    return this.getUserRoles().some(r => r.toLowerCase() === 'admin');
  }

  clearUser() {
    this.userSubject.next(null);
    localStorage.removeItem('user_data');
  }
}
