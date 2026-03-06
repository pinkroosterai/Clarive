import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TermsPage from "./TermsPage";

beforeAll(() => {
  vi.stubGlobal("scrollTo", vi.fn());
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("TermsPage", () => {
  it("renders the heading 'Terms of Service'", () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Terms of Service" })
    ).toBeInTheDocument();
  });

  it("sets document title", () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>
    );
    expect(document.title).toBe("Clarive — Terms of Service");
  });

  it("contains a link to /privacy", () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>
    );
    const privacyLink = screen.getByRole("link", { name: /privacy policy/i });
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink).toHaveAttribute("href", "/privacy");
  });
});
