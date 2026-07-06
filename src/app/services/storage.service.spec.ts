import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(StorageService);
  });

  it('should register a new user and store it locally', () => {
    const result = service.register({
      username: 'animefan',
      email: 'animefan@example.com',
      password: 'secret123',
    });

    expect(result.success).toBeTruthy();
    expect(service.isAuthenticated()).toBeTruthy();
    expect(service.getCurrentUser()?.username).toBe('animefan');
  });

  it('should reject a duplicate username', () => {
    service.register({
      username: 'animefan',
      email: 'first@example.com',
      password: 'secret123',
    });

    const result = service.register({
      username: 'animefan',
      email: 'second@example.com',
      password: 'secret123',
    });

    expect(result.success).toBeFalsy();
    expect(result.message).toContain('Pseudo déjà utilisé');
  });

  it('should reject a duplicate email', () => {
    service.register({
      username: 'first',
      email: 'shared@example.com',
      password: 'secret123',
    });

    const result = service.register({
      username: 'second',
      email: 'shared@example.com',
      password: 'secret123',
    });

    expect(result.success).toBeFalsy();
    expect(result.message).toContain('Compte déjà existant');
  });
});
