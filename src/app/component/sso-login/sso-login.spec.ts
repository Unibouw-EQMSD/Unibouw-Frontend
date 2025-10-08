import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SSOLogin } from './sso-login';

describe('SSOLogin', () => {
  let component: SSOLogin;
  let fixture: ComponentFixture<SSOLogin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SSOLogin]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SSOLogin);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
