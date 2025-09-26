import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Subcontractor } from './subcontractor';

describe('Subcontractor', () => {
  let component: Subcontractor;
  let fixture: ComponentFixture<Subcontractor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Subcontractor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Subcontractor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
