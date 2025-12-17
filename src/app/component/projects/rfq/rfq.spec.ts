import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Rfq } from './rfq';

describe('Rfq', () => {
  let component: Rfq;
  let fixture: ComponentFixture<Rfq>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Rfq],
    }).compileComponents();

    fixture = TestBed.createComponent(Rfq);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
