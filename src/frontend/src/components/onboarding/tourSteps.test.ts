import {
  ONBOARDING_STEPS,
  EDITOR_STEPS_START,
  EDITOR_STEPS_END,
} from "./tourSteps";

describe("tourSteps", () => {
  it("has exactly 11 steps", () => {
    expect(ONBOARDING_STEPS).toHaveLength(11);
  });

  it("each step has a popover with title and description", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.popover?.title).toBeTruthy();
      expect(step.popover?.description).toBeTruthy();
    }
  });

  it("first step is a welcome modal with no element", () => {
    const first = ONBOARDING_STEPS[0];
    expect(first.element).toBeUndefined();
    expect(first.popover?.popoverClass).toContain("tour-welcome-modal");
    expect(first.popover?.nextBtnText).toBe("Start Tour");
  });

  it("last step is a closing modal with no element", () => {
    const last = ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1];
    expect(last.element).toBeUndefined();
    expect(last.popover?.popoverClass).toContain("tour-welcome-modal");
    expect(last.popover?.nextBtnText).toBe("Get Started");
  });

  it("step 5 (library) has a route for cross-page navigation", () => {
    const libraryStep = ONBOARDING_STEPS[5];
    expect(libraryStep.route).toBe("/library");
    expect(libraryStep.element).toBeTruthy();
  });

  it("step 6 (editor) has a resolveRoute for dynamic navigation", () => {
    const editorStep = ONBOARDING_STEPS[6];
    expect(editorStep.resolveRoute).toBeTypeOf("function");
    expect(editorStep.element).toBe("[data-tour='prompt-editor']");
  });

  it("editor steps span indices 6-9", () => {
    expect(EDITOR_STEPS_START).toBe(6);
    expect(EDITOR_STEPS_END).toBe(9);

    const editorSteps = ONBOARDING_STEPS.slice(EDITOR_STEPS_START, EDITOR_STEPS_END + 1);
    expect(editorSteps).toHaveLength(4);

    const expectedTargets = [
      "[data-tour='prompt-editor']",
      "[data-tour='system-message']",
      "[data-tour='editor-actions']",
      "[data-tour='version-panel']",
    ];
    editorSteps.forEach((step, i) => {
      expect(step.element).toBe(expectedTargets[i]);
    });
  });

  it("element-targeting steps have valid CSS selectors", () => {
    const elementSteps = ONBOARDING_STEPS.filter((s) => s.element);
    expect(elementSteps.length).toBeGreaterThan(0);
    for (const step of elementSteps) {
      expect(typeof step.element).toBe("string");
      expect(step.element).toMatch(/^\[data-tour=/);
    }
  });

  it("static routes are used for library step", () => {
    const stepsWithRoutes = ONBOARDING_STEPS.filter((s) => s.route);
    expect(stepsWithRoutes).toHaveLength(1);
    expect(stepsWithRoutes[0].route).toBe("/library");
  });
});
