import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { WizardContent } from "@/components/wizard/WizardContent";

const WizardPage = () => {
  useEffect(() => { document.title = "Clarive — AI Wizard"; }, []);
  const navigate = useNavigate();

  return (
    <WizardContent
      mode="new"
      onClose={() => navigate("/library")}
    />
  );
};

export default WizardPage;
