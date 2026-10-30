import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import axios from 'axios';
import { vi } from 'vitest';

// Mock axios
vi.mock('axios');
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    connect: vi.fn(),
    removeAllListeners: vi.fn(),
  })),
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock window.addEventListener
vi.spyOn(window, 'addEventListener').mockImplementation(() => {});
vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});

const mockAxios = axios;

describe('AuthContext', () => {
  const mockUser = {
    loginId: 'S001',
    login_id: 'S001',
    name: 'Test Student',
    role: 'passenger',
    routeId: '4',
    route_id: '4',
    feeStatus: 'paid',
    fee_status: 'paid',
    token: 'test-token',
  };

  const mockAuthResponse = {
    status: 'success',
    user: mockUser,
    token: 'test-token',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.removeItem.mockClear();
    mockAxios.get.mockReset();
    mockAxios.post.mockReset();
  });

  const wrapper = ({ children }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  describe('useAuth', () => {
    it('should initialize with loading state and complete async init', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      mockAxios.get.mockRejectedValue({ response: { status: 401 } });

      const { result } = renderHook(() => useAuth(), { wrapper });
      
      // Wait for init to complete
      await waitFor(() => expect(result.current.loading).toBe(false));
      
      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should not set user when no token exists', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      mockAxios.get.mockRejectedValue({ response: { status: 401 } });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should set user when valid token exists in localStorage', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({ ...mockUser, token: 'stored-token' }));
      // Mock both /api/auth/token (returns no cookie) and /api/users/me (returns user)
      mockAxios.get
        .mockRejectedValueOnce(new Error('No cookie')) // /api/auth/token
        .mockResolvedValueOnce({ data: mockUser }); // /api/users/me

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.user).toEqual(expect.objectContaining({
        loginId: 'S001',
        name: 'Test Student',
        role: 'passenger',
      }));
      expect(result.current.loading).toBe(false);
    });

    it('should clear user on 401 response', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({ ...mockUser, token: 'stored-token' }));
      mockAxios.get
        .mockRejectedValueOnce(new Error('No cookie')) // /api/auth/token
        .mockRejectedValueOnce({ response: { status: 401 } }); // /api/users/me

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.user).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('bus_saarthi_user');
    });

    it('should login user and store in localStorage', async () => {
      mockAxios.post.mockResolvedValue({ data: { status: 'success', user: mockUser, token: 'new-token' } });
      mockAxios.get
        .mockRejectedValueOnce(new Error('No cookie'))
        .mockResolvedValueOnce({ data: mockUser });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.login({ ...mockUser, token: 'new-token' });
      });

      expect(result.current.user).toEqual(expect.objectContaining({
        loginId: 'S001',
        token: 'new-token',
      }));
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'bus_saarthi_user',
        expect.stringContaining('"token":"new-token"')
      );
    });

    it('should logout user and clear localStorage', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({ ...mockUser, token: 'stored-token' }));
      mockAxios.get
        .mockRejectedValueOnce(new Error('No cookie'))
        .mockResolvedValueOnce({ data: mockUser });
      mockAxios.post.mockResolvedValue({ status: 'success' });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('bus_saarthi_user');
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/logout'),
        {},
        expect.any(Object)
      );
    });

    it('should update user profile', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({ ...mockUser, token: 'stored-token' }));
      mockAxios.get
        .mockRejectedValueOnce(new Error('No cookie'))
        .mockResolvedValueOnce({ data: mockUser });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const updatedData = { name: 'Updated Name', profile_pic: 'new-pic.jpg' };

      act(() => {
        result.current.updateUser(updatedData);
      });

      expect(result.current.user).toEqual(expect.objectContaining({
        name: 'Updated Name',
        profile_pic: 'new-pic.jpg',
      }));
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'bus_saarthi_user',
        expect.stringContaining('"name":"Updated Name"')
      );
    });
  });

  describe('getAuthToken', () => {
    it('should return token from axios response when cookie available', async () => {
      mockAxios.get.mockResolvedValue({ data: { token: 'cookie-token' } });
      mockLocalStorage.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // The internal getAuthToken is not exported, but we can verify
      // it's called by checking axios was called
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/token'),
        expect.objectContaining({ withCredentials: true })
      );
    });

    it('should fall back to localStorage token when cookie not available', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({ token: 'stored-token' }));
      // First call to /api/auth/token fails (no cookie), second to /api/users/me succeeds
      mockAxios.get
        .mockRejectedValueOnce(new Error('Network error')) // /api/auth/token
        .mockResolvedValueOnce({ data: mockUser }); // /api/users/me

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Should fall back to localStorage token and validate successfully
      expect(result.current.user).toEqual(expect.objectContaining({
        token: 'stored-token',
      }));
    });
  });
});