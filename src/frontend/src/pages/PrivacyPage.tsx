import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const PrivacyPage = () => {
  useEffect(() => {
    document.title = "Clarive — Privacy Policy";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Button variant="ghost" size="sm" asChild className="mb-8">
          <Link to="/login">
            <ArrowLeft className="size-4 mr-1" />
            Back
          </Link>
        </Button>

        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-foreground-muted mb-10">
          Last updated: March 2, 2026
        </p>

        <div className="space-y-8 text-foreground-secondary text-[15px] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Information We Collect</h2>
            <p className="mb-3">We collect the following types of information:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong className="text-foreground">Account information:</strong> name, email address,
                and hashed password when you create an account. If you sign in with Google, we
                receive your name, email, and Google account ID.
              </li>
              <li>
                <strong className="text-foreground">Content:</strong> prompts, templates, folder
                structures, and other content you create within the Service.
              </li>
              <li>
                <strong className="text-foreground">Usage data:</strong> actions taken within the
                Service (e.g., creating, editing, publishing prompts) are logged for audit and
                security purposes.
              </li>
              <li>
                <strong className="text-foreground">Billing data:</strong> payment processing is
                handled by Stripe. We store your Stripe customer ID but do not store credit card
                numbers or payment details directly.
              </li>
              <li>
                <strong className="text-foreground">Technical data:</strong> IP address, browser type,
                and request metadata collected via server logs.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide, maintain, and improve the Service</li>
              <li>To authenticate your identity and secure your account</li>
              <li>To process credit purchases and manage billing</li>
              <li>To send transactional emails (verification, password reset, account deletion notices)</li>
              <li>To enforce our Terms of Service and detect abuse</li>
              <li>To generate anonymized, aggregated analytics about Service usage</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Third-Party Services</h2>
            <p>We share data with the following third-party services as necessary to operate:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                <strong className="text-foreground">OpenAI:</strong> prompt descriptions and context
                are sent to OpenAI's API when you use AI generation, evaluation, or enhancement
                features. OpenAI's data usage policies apply to this data.
              </li>
              <li>
                <strong className="text-foreground">Stripe:</strong> billing and payment data is
                processed by Stripe. See{" "}
                <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 underline-offset-4 hover:underline">
                  Stripe's Privacy Policy
                </a>.
              </li>
              <li>
                <strong className="text-foreground">Google:</strong> if you use Google sign-in,
                authentication data is exchanged with Google. See{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 underline-offset-4 hover:underline">
                  Google's Privacy Policy
                </a>.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Data Storage and Security</h2>
            <p>
              Your data is stored in PostgreSQL databases with encryption at rest. Passwords are
              hashed using BCrypt. API keys are stored as SHA-256 hashes. Refresh tokens are hashed
              before storage. All communication with the Service uses HTTPS encryption in transit.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Data Retention</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Account data is retained for as long as your account is active</li>
              <li>Trashed prompts remain recoverable until permanently deleted by the user</li>
              <li>Audit logs are retained according to our retention policy and automatically purged</li>
              <li>Expired authentication tokens are automatically cleaned up within 6 hours</li>
              <li>AI session data is automatically deleted after 24 hours</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong className="text-foreground">Access your data:</strong> view all your content
                through the Service interface.
              </li>
              <li>
                <strong className="text-foreground">Export your data:</strong> export your prompts
                and folder structure in YAML format via the import/export feature.
              </li>
              <li>
                <strong className="text-foreground">Delete your data:</strong> request account
                deletion through Settings. A 30-day grace period allows cancellation before permanent
                deletion of all associated data.
              </li>
              <li>
                <strong className="text-foreground">Correct your data:</strong> update your profile
                information at any time through the Service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Cookies and Local Storage</h2>
            <p>
              The Service uses browser local storage to maintain your authentication session (JWT
              tokens). We do not use tracking cookies or third-party analytics cookies. No
              advertising trackers are present on the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Children's Privacy</h2>
            <p>
              The Service is not intended for users under the age of 13. We do not knowingly
              collect personal information from children under 13. If we become aware that we have
              collected data from a child under 13, we will take steps to delete that information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify users of material
              changes via email or through the Service. The "Last updated" date at the top of this
              page indicates when the policy was last revised.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Contact</h2>
            <p>
              If you have questions about this Privacy Policy or your data, please contact us at{" "}
              <a href="mailto:privacy@clarive.app" className="text-primary hover:text-primary/80 underline-offset-4 hover:underline">
                privacy@clarive.app
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-sm text-foreground-muted">
          <Link to="/terms" className="text-primary hover:text-primary/80 underline-offset-4 hover:underline">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
