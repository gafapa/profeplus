import "./MoodleWorkflowStepper.css";

export type MoodleWorkflowStep = {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
  complete?: boolean;
};

type MoodleWorkflowStepperProps = {
  steps: MoodleWorkflowStep[];
  activeStep: string;
  onStepChange: (id: string) => void;
  label: string;
};

export function MoodleWorkflowStepper({ steps, activeStep, onStepChange, label }: MoodleWorkflowStepperProps) {
  return (
    <nav className="moodle-workflow-stepper" aria-label={label}>
      <ol className="moodle-workflow-stepper-list">
        {steps.map((step, index) => {
          const isActive = step.id === activeStep;

          return (
            <li key={step.id} className="moodle-workflow-stepper-item">
              <button
                type="button"
                className="moodle-workflow-stepper-button"
                aria-current={isActive ? "step" : undefined}
                disabled={step.disabled}
                onClick={() => {
                  if (!step.disabled) onStepChange(step.id);
                }}
              >
                <span className="moodle-workflow-stepper-number" aria-hidden="true">{index + 1}</span>
                <span className="moodle-workflow-stepper-copy">
                  <span className="moodle-workflow-stepper-label">{step.label}</span>
                  {step.description ? <span className="moodle-workflow-stepper-description">{step.description}</span> : null}
                  {step.complete ? <span className="moodle-workflow-stepper-complete">Completado</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
