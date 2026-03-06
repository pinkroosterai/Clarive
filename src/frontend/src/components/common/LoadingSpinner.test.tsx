import { render } from "@testing-library/react";
import { LoadingSpinner } from "./LoadingSpinner";

describe("LoadingSpinner", () => {
  it("renders without crashing", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("contains the spinning animation element", () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("accepts a custom className", () => {
    const { container } = render(<LoadingSpinner className="h-full" />);
    // The outer div should have the custom class merged in
    expect(container.firstChild).toHaveClass("h-full");
  });
});
