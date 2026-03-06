import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import PrivacyPage from './PrivacyPage';

beforeAll(() => {
  vi.stubGlobal('scrollTo', vi.fn());
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('PrivacyPage', () => {
  it("renders the heading 'Privacy Policy'", () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument();
  });

  it('sets document title', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>
    );
    expect(document.title).toBe('Clarive — Privacy Policy');
  });

  it('contains a link to /terms', () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>
    );
    const termsLink = screen.getByRole('link', { name: /terms of service/i });
    expect(termsLink).toBeInTheDocument();
    expect(termsLink).toHaveAttribute('href', '/terms');
  });
});
