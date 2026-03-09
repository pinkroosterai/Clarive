import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { OnboardingTour } from './OnboardingTour';

import { useAuthStore } from '@/store/authStore';
import { createUser } from '@/test/factories';

// Mock driver.js
const mockDrive = vi.fn();
const mockDestroy = vi.fn();
const mockIsActive = vi.fn(() => true);
const mockGetActiveIndex = vi.fn(() => 0);
const mockMoveNext = vi.fn();
const mockMoveTo = vi.fn();

const mockDriverInstance = {
  drive: mockDrive,
  destroy: mockDestroy,
  isActive: mockIsActive,
  getActiveIndex: mockGetActiveIndex,
  moveNext: mockMoveNext,
  moveTo: mockMoveTo,
  setConfig: vi.fn(),
  setSteps: vi.fn(),
  getConfig: vi.fn(),
  getState: vi.fn(),
  isFirstStep: vi.fn(),
  isLastStep: vi.fn(),
  getActiveStep: vi.fn(),
  getActiveElement: vi.fn(),
  getPreviousElement: vi.fn(),
  getPreviousStep: vi.fn(),
  hasNextStep: vi.fn(),
  hasPreviousStep: vi.fn(),
  movePrevious: vi.fn(),
  highlight: vi.fn(),
  refresh: vi.fn(),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDriverFn = vi.fn((..._args: any[]) => mockDriverInstance);

vi.mock('driver.js', () => ({
  driver: (...args: unknown[]) => mockDriverFn(...args),
}));

vi.mock('driver.js/dist/driver.css', () => ({}));
vi.mock('./onboardingTheme.css', () => ({}));

const mockCompleteOnboarding = vi.fn(() => Promise.resolve());
vi.mock('@/services/api/profileService', () => ({
  completeOnboarding: () => mockCompleteOnboarding(),
}));

function renderWithRouter(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <OnboardingTour />
    </MemoryRouter>
  );
}

describe('OnboardingTour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsActive.mockReturnValue(true);
    // Reset the store
    useAuthStore.setState({
      currentUser: null,
      isAuthenticated: false,
      isInitialized: true,
    });
  });

  it('renders nothing (null) for all states', () => {
    useAuthStore.setState({
      currentUser: createUser({ onboardingCompleted: false }),
    });
    const { container } = renderWithRouter();
    expect(container.innerHTML).toBe('');
  });

  it('does not load driver.js when onboardingCompleted is true', async () => {
    useAuthStore.setState({
      currentUser: createUser({ onboardingCompleted: true }),
    });

    renderWithRouter();

    // Give async effect time to run
    await act(() => new Promise((r) => setTimeout(r, 50)));

    expect(mockDriverFn).not.toHaveBeenCalled();
  });

  it('does not load driver.js when there is no current user', async () => {
    useAuthStore.setState({ currentUser: null });

    renderWithRouter();

    await act(() => new Promise((r) => setTimeout(r, 50)));

    expect(mockDriverFn).not.toHaveBeenCalled();
  });

  it('loads driver.js and starts tour for new user on dashboard', async () => {
    useAuthStore.setState({
      currentUser: createUser({ onboardingCompleted: false }),
    });

    renderWithRouter('/');

    // Wait for dynamic import + requestAnimationFrame
    await act(() => new Promise((r) => setTimeout(r, 50)));

    expect(mockDriverFn).toHaveBeenCalledTimes(1);
    expect(mockDriverFn).toHaveBeenCalledWith(
      expect.objectContaining({
        animate: true,
        popoverClass: 'tour-popover',
        showProgress: false,
        allowClose: true,
      })
    );
    expect(mockDrive).toHaveBeenCalled();
  });

  it('does not start tour when not on dashboard', async () => {
    useAuthStore.setState({
      currentUser: createUser({ onboardingCompleted: false }),
    });

    renderWithRouter('/library');

    await act(() => new Promise((r) => setTimeout(r, 50)));

    expect(mockDriverFn).not.toHaveBeenCalled();
  });

  it('configures onCloseClick to call completeOnboarding', async () => {
    useAuthStore.setState({
      currentUser: createUser({ onboardingCompleted: false }),
    });

    renderWithRouter('/');

    await act(() => new Promise((r) => setTimeout(r, 50)));

    const config = mockDriverFn.mock.calls[0][0];
    expect(config.onCloseClick).toBeDefined();

    // Simulate close click
    mockIsActive.mockReturnValue(false);
    act(() => {
      config.onCloseClick();
    });

    expect(mockCompleteOnboarding).toHaveBeenCalled();
  });

  it('configures onNextClick handler', async () => {
    useAuthStore.setState({
      currentUser: createUser({ onboardingCompleted: false }),
    });

    renderWithRouter('/');

    await act(() => new Promise((r) => setTimeout(r, 50)));

    const config = mockDriverFn.mock.calls[0][0];
    expect(config.onNextClick).toBeDefined();
  });

  it('configures onPopoverRender for progress dots', async () => {
    useAuthStore.setState({
      currentUser: createUser({ onboardingCompleted: false }),
    });

    renderWithRouter('/');

    await act(() => new Promise((r) => setTimeout(r, 50)));

    const config = mockDriverFn.mock.calls[0][0];
    expect(config.onPopoverRender).toBeDefined();
  });

  it('destroys driver on unmount', async () => {
    useAuthStore.setState({
      currentUser: createUser({ onboardingCompleted: false }),
    });

    const { unmount } = renderWithRouter('/');

    await act(() => new Promise((r) => setTimeout(r, 50)));

    unmount();

    expect(mockDestroy).toHaveBeenCalled();
  });
});
