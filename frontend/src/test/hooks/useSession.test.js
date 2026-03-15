import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSession } from '../../hooks/useSession';
import sessionService from '../../services/SessionService';

vi.mock('../../services/SessionService', () => ({
  default: {
    getSession: vi.fn(),
    saveSession: vi.fn(),
  },
}));

describe('useSession hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with session=null', () => {
    sessionService.getSession.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useSession());
    expect(result.current.session).toBeNull();
  });

  it('loads session on mount', async () => {
    const mockSession = { last_car: 'porsche992rgt3', last_prompt: 'Gulf livery' };
    sessionService.getSession.mockResolvedValueOnce(mockSession);

    const { result } = renderHook(() => useSession());

    await act(async () => { await Promise.resolve(); });

    expect(result.current.session).toEqual(mockSession);
  });

  it('sets session to null if load fails', async () => {
    sessionService.getSession.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useSession());

    await act(async () => { await Promise.resolve(); });

    expect(result.current.session).toBeNull();
  });

  it('saveSession merges data into existing session', async () => {
    const initial = { last_car: 'porsche992rgt3', last_prompt: 'Gulf livery' };
    sessionService.getSession.mockResolvedValueOnce(initial);
    sessionService.saveSession.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useSession());
    await act(async () => { await Promise.resolve(); });

    act(() => {
      result.current.saveSession({ last_prompt: 'Red livery' });
    });

    expect(result.current.session).toEqual({
      last_car: 'porsche992rgt3',
      last_prompt: 'Red livery',
    });
  });

  it('saveSession calls sessionService.saveSession', async () => {
    sessionService.getSession.mockResolvedValueOnce({});
    sessionService.saveSession.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useSession());
    await act(async () => { await Promise.resolve(); });

    act(() => {
      result.current.saveSession({ last_car: 'ferrari488gte' });
    });

    expect(sessionService.saveSession).toHaveBeenCalledWith({ last_car: 'ferrari488gte' });
  });

  it('debouncedSave delays sessionService call', async () => {
    vi.useFakeTimers();
    sessionService.getSession.mockResolvedValueOnce({});
    sessionService.saveSession.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useSession());
    // Flush the mount promise under fake timers
    await act(async () => { await vi.runAllTicks(); });

    act(() => {
      result.current.debouncedSave('last_car', 'porsche992rgt3', 300);
    });

    expect(sessionService.saveSession).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(300); });

    expect(sessionService.saveSession).toHaveBeenCalledWith({ last_car: 'porsche992rgt3' });
    vi.useRealTimers();
  });

  it('debouncedSave cancels previous timer on repeated calls', async () => {
    vi.useFakeTimers();
    sessionService.getSession.mockResolvedValueOnce({});
    sessionService.saveSession.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useSession());
    await act(async () => { await vi.runAllTicks(); });

    act(() => {
      result.current.debouncedSave('last_car', 'first', 200);
      vi.advanceTimersByTime(100);
      result.current.debouncedSave('last_car', 'second', 200);
      vi.advanceTimersByTime(200);
    });

    expect(sessionService.saveSession).toHaveBeenCalledTimes(1);
    expect(sessionService.saveSession).toHaveBeenCalledWith({ last_car: 'second' });
    vi.useRealTimers();
  });

  it('loadSession returns fetched data', async () => {
    const mockSession = { last_car: 'bmwm4gt3' };
    sessionService.getSession.mockResolvedValue(mockSession);

    const { result } = renderHook(() => useSession());

    let data;
    await act(async () => {
      data = await result.current.loadSession();
    });

    expect(data).toEqual(mockSession);
  });
});
