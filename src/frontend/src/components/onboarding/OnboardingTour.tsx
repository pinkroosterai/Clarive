import { useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { completeOnboarding } from "@/services/api/authService";
import { ONBOARDING_STEPS, EDITOR_STEPS_START, EDITOR_STEPS_END } from "./tourSteps";
import type { Driver, PopoverDOM, State } from "driver.js";

const LOGO_HTML = `<img src="/clarive-icon.svg" alt="Clarive" />`;

/** Wait for a CSS selector to appear in the DOM */
function waitForElement(selector: string, timeoutMs = 3000): Promise<Element | null> {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) {
      resolve(el);
      return;
    }

    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeoutMs);
  });
}

/** Inject progress dots into the driver.js popover footer */
function renderProgressDots(popover: PopoverDOM, state: State) {
  const current = state.activeIndex ?? 0;
  const total = ONBOARDING_STEPS.length;

  // Remove previous dots if re-rendering
  popover.footer.querySelector(".tour-progress")?.remove();

  const container = document.createElement("div");
  container.className = "tour-progress";
  container.setAttribute("role", "progressbar");
  container.setAttribute("aria-label", `Step ${current + 1} of ${total}`);
  container.setAttribute("aria-valuenow", String(current + 1));
  container.setAttribute("aria-valuemax", String(total));

  for (let i = 0; i < total; i++) {
    const dot = document.createElement("span");
    dot.className = `tour-progress-dot${i < current ? " completed" : ""}${i === current ? " active" : ""}`;
    container.appendChild(dot);
  }

  popover.footer.prepend(container);

  // Inject logo for welcome/closing steps
  const step = ONBOARDING_STEPS[current];
  if (step.popover?.popoverClass?.includes("tour-welcome-modal")) {
    if (!popover.wrapper.querySelector(".tour-welcome-logo")) {
      const logo = document.createElement("div");
      logo.className = "tour-welcome-logo";
      logo.innerHTML = LOGO_HTML;
      popover.wrapper.insertBefore(logo, popover.title);
    }
  }
}

/** Lazy-load driver.js and its styles (only for new users) */
async function loadDriver(): Promise<typeof import("driver.js")["driver"]> {
  const [driverModule] = await Promise.all([
    import("driver.js"),
    import("driver.js/dist/driver.css"),
    import("./onboardingTheme.css"),
  ]);
  return driverModule.driver;
}

export function OnboardingTour() {
  const { currentUser, setUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const driverRef = useRef<Driver | null>(null);
  const isInitialized = useRef(false);
  const navigateRef = useRef(navigate);
  const locationRef = useRef(location.pathname);

  // Keep refs current
  navigateRef.current = navigate;
  locationRef.current = location.pathname;

  const finish = useCallback(() => {
    if (!currentUser) return;
    if (driverRef.current?.isActive()) {
      driverRef.current.destroy();
    }
    driverRef.current = null;
    completeOnboarding().catch(() => {});
    setUser({ ...currentUser, onboardingCompleted: true });
  }, [currentUser, setUser]);

  useEffect(() => {
    if (!currentUser || currentUser.onboardingCompleted) return;
    if (isInitialized.current) return;
    if (location.pathname !== "/") return; // Only start from Dashboard
    isInitialized.current = true;

    let destroyed = false;
    const finishRef = { current: finish };

    (async () => {
      const createDriver = await loadDriver();
      if (destroyed) return;

      const driverObj = createDriver({
        animate: true,
        overlayColor: "rgba(0, 0, 0, 0.75)",
        stagePadding: 8,
        stageRadius: 12,
        popoverClass: "tour-popover",
        showProgress: false,
        allowClose: true,
        smoothScroll: true,
        allowKeyboardControl: true,

        onPopoverRender: (popover, { state }) => {
          renderProgressDots(popover, state);
        },

        onNextClick: async () => {
          const currentIndex = driverObj.getActiveIndex() ?? 0;
          const nextIndex = currentIndex + 1;

          if (nextIndex >= ONBOARDING_STEPS.length) {
            finishRef.current();
            return;
          }

          const nextStep = ONBOARDING_STEPS[nextIndex];

          // Resolve the target route (dynamic or static)
          const targetRoute = nextStep.resolveRoute?.() ?? nextStep.route;

          // If resolveRoute returned null, skip editor steps entirely
          if (nextStep.resolveRoute && targetRoute === null) {
            driverObj.moveTo(EDITOR_STEPS_END + 1);
            return;
          }

          // Cross-page navigation
          if (targetRoute && nextStep.element && locationRef.current !== targetRoute) {
            navigateRef.current(targetRoute);
            const el = await waitForElement(nextStep.element as string);
            if (!el) {
              // Target not found — skip this step
              if (nextIndex + 1 < ONBOARDING_STEPS.length) {
                driverObj.moveTo(nextIndex + 1);
              } else {
                finishRef.current();
              }
              return;
            }
          }

          driverObj.moveNext();
        },

        onPrevClick: async () => {
          const currentIndex = driverObj.getActiveIndex() ?? 0;
          const prevIndex = currentIndex - 1;

          if (prevIndex < 0) return;

          const prevStep = ONBOARDING_STEPS[prevIndex];

          // Navigate if the previous step's target isn't in the DOM
          if (prevStep.element && !document.querySelector(prevStep.element as string)) {
            // For steps with resolveRoute, re-resolve (e.g., editor entry)
            const targetRoute = prevStep.resolveRoute?.() ?? prevStep.route ?? "/";
            if (targetRoute) {
              navigateRef.current(targetRoute);
              await waitForElement(prevStep.element as string);
            }
          }

          driverObj.movePrevious();
        },

        onCloseClick: () => {
          finishRef.current();
        },

        steps: ONBOARDING_STEPS,
      });

      driverRef.current = driverObj;

      // Small delay for Dashboard to fully render
      requestAnimationFrame(() => {
        if (!destroyed) {
          driverObj.drive();
        }
      });
    })();

    return () => {
      destroyed = true;
      if (driverRef.current?.isActive()) {
        driverRef.current.destroy();
      }
      driverRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.onboardingCompleted]);

  return null; // driver.js manages its own DOM
}
