import { render, screen } from "@testing-library/react";
import { FileText, Folder } from "lucide-react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState
        icon={FileText}
        title="No prompts yet"
        description="Create your first prompt to get started."
      />
    );
    expect(screen.getByText("No prompts yet")).toBeInTheDocument();
    expect(
      screen.getByText("Create your first prompt to get started.")
    ).toBeInTheDocument();
  });

  it("renders the icon", () => {
    const { container } = render(
      <EmptyState
        icon={Folder}
        title="Empty folder"
        description="This folder has no items."
      />
    );
    // Lucide icons render as SVGs
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders action children when provided", () => {
    render(
      <EmptyState
        icon={FileText}
        title="No prompts"
        description="Get started."
        actions={<button>Create Prompt</button>}
      />
    );
    expect(
      screen.getByRole("button", { name: "Create Prompt" })
    ).toBeInTheDocument();
  });

  it("renders without actions when not provided", () => {
    render(
      <EmptyState
        icon={FileText}
        title="No prompts"
        description="Nothing here."
      />
    );
    expect(screen.getByText("No prompts")).toBeInTheDocument();
    // No action buttons should be present
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
