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
    // Also store in localStorage for persistence
    localStorage.setItem('user_data', JSON.stringify(user));
  }

getUser() {
    if (this.userSubject.value) {
      return this.userSubject.value;
    }
    // Try to get from localStorage if not in memory
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

clearUser() {
    this.userSubject.next(null);
    localStorage.removeItem('user_data');
  }
}