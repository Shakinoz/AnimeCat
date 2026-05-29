import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SignPage } from './sign-page';

describe('SignPage', () => {
  let component: SignPage;
  let fixture: ComponentFixture<SignPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SignPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
