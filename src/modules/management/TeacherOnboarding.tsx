import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";
import type { OnboardingChecklistItem } from "../../shared/onboarding/checklist";
import {
  findCurrentOnboardingStep,
  ONBOARDING_VERSION,
  readOnboardingState,
  type OnboardingState,
  writeOnboardingState
} from "../../shared/onboarding/state";
import { Modal } from "../../shared/ui/Modal";

type GuideView = "welcome" | "step" | "complete";

type TeacherOnboardingProps = {
  items: OnboardingChecklistItem[];
  isReady: boolean;
};

function getBrowserStorage(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

export function TeacherOnboarding({ items, isReady }: TeacherOnboardingProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [persistedState, setPersistedState] = useState<OnboardingState | null>(() =>
    readOnboardingState(getBrowserStorage())
  );
  const [guideView, setGuideView] = useState<GuideView>("welcome");
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const previousCompletedCountRef = useRef(0);

  const completedCount = items.filter((item) => item.complete).length;
  const isComplete = completedCount === items.length;
  const completionPercent = Math.round((completedCount / items.length) * 100);
  const currentStep = useMemo(
    () => findCurrentOnboardingStep(items, persistedState?.currentStepId),
    [items, persistedState?.currentStepId]
  );

  const persist = (state: OnboardingState): void => {
    setPersistedState(state);
    writeOnboardingState(state, getBrowserStorage());
  };

  useEffect(() => {
    if (!isReady || initialized) {
      return;
    }

    const explicitlyRequested = searchParams.get("onboarding") === "1";
    if (explicitlyRequested) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("onboarding");
      setSearchParams(nextParams, { replace: true });
    }

    if (isComplete) {
      if (persistedState?.status !== "completed") {
        persist({ version: ONBOARDING_VERSION, status: "completed" });
      }
    } else if (explicitlyRequested) {
      setGuideView(persistedState?.status === "active" ? "step" : "welcome");
      setIsGuideOpen(true);
    } else if (!persistedState && completedCount === 0) {
      setGuideView("welcome");
      setIsGuideOpen(true);
    }

    previousCompletedCountRef.current = completedCount;
    setInitialized(true);
  }, [
    completedCount,
    initialized,
    isComplete,
    isReady,
    persistedState,
    searchParams,
    setSearchParams
  ]);

  useEffect(() => {
    if (!initialized || !currentStep || persistedState?.status !== "active") {
      return;
    }
    if (persistedState.currentStepId !== currentStep.id) {
      persist({
        version: ONBOARDING_VERSION,
        status: "active",
        currentStepId: currentStep.id
      });
    }
  }, [currentStep, initialized, persistedState]);

  useEffect(() => {
    if (!initialized) {
      return;
    }

    const justFinished =
      isComplete &&
      previousCompletedCountRef.current < items.length &&
      persistedState?.status === "active";

    if (justFinished) {
      persist({ version: ONBOARDING_VERSION, status: "completed" });
      setGuideView("complete");
      setIsGuideOpen(true);
    }
    previousCompletedCountRef.current = completedCount;
  }, [completedCount, initialized, isComplete, items.length, persistedState?.status]);

  if (!isReady || isComplete) {
    return (
      <Modal
        open={isGuideOpen && guideView === "complete"}
        title="Todo listo para tu primera clase"
        subtitle="La configuración esencial de ProfePlus está completa."
        panelClassName="teacher-onboarding-modal"
        onClose={() => setIsGuideOpen(false)}
      >
        <div className="onboarding-finish">
          <div className="onboarding-finish-mark" aria-hidden="true">
            ✓
          </div>
          <p>
            Ya puedes abrir <strong>Hoy</strong>: aparecerán las clases de tu horario y
            tendrás preparados el alumnado y las asignaturas para registrar el día.
          </p>
          <div className="onboarding-modal-actions">
            <button
              type="button"
              className="btn secondary"
              onClick={() => setIsGuideOpen(false)}
            >
              Seguir en Gestión
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setIsGuideOpen(false);
                navigate("/today");
              }}
            >
              Abrir Hoy
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  const openCurrentStep = (): void => {
    setGuideView(currentStep ? "step" : "welcome");
    setIsGuideOpen(true);
  };

  const dismissGuide = (): void => {
    persist({
      version: ONBOARDING_VERSION,
      status: "dismissed",
      currentStepId: currentStep?.id
    });
    setIsGuideOpen(false);
  };

  const startGuide = (): void => {
    if (!currentStep) {
      return;
    }
    persist({
      version: ONBOARDING_VERSION,
      status: "active",
      currentStepId: currentStep.id
    });
    setGuideView("step");
  };

  const configureStep = (item: OnboardingChecklistItem): void => {
    persist({
      version: ONBOARDING_VERSION,
      status: "active",
      currentStepId: item.id
    });
    setIsGuideOpen(false);
    navigate(item.route);
  };

  const compact = persistedState?.status !== "active";

  return (
    <>
      <aside
        className={`onboarding-coach${compact ? " compact" : ""}`}
        aria-labelledby="onboarding-coach-title"
      >
        <div className="onboarding-coach-heading">
          <div>
            <span className="onboarding-eyebrow">Puesta a punto</span>
            <h2 id="onboarding-coach-title">
              {compact ? "Termina de preparar tu espacio" : "Tu primera clase, paso a paso"}
            </h2>
          </div>
          <span className="onboarding-count" aria-hidden="true">
            {completedCount}/{items.length}
          </span>
        </div>

        <div className="onboarding-progress-line">
          <div
            className="onboarding-progress-track"
            role="progressbar"
            aria-label="Progreso de la preparación inicial"
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-valuenow={completedCount}
            aria-valuetext={`${completedCount} de ${items.length} pasos completados`}
          >
            <span style={{ width: `${completionPercent}%` }} />
          </div>
          <span>{completionPercent}%</span>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {completedCount} de {items.length} pasos de preparación completados.
        </p>

        {!compact && currentStep ? (
          <>
            <div className="onboarding-current-step">
              <span className="onboarding-step-number">
                {items.findIndex((item) => item.id === currentStep.id) + 1}
              </span>
              <div>
                <small>Siguiente paso</small>
                <strong>{currentStep.label}</strong>
                <p>{currentStep.description}</p>
              </div>
              <button
                type="button"
                className="btn onboarding-primary-action"
                onClick={() => configureStep(currentStep)}
              >
                Configurar ahora
              </button>
            </div>
            <ol className="onboarding-step-rail" aria-label="Pasos de preparación">
              {items.map((item, index) => (
                <li key={item.id} className={item.complete ? "complete" : ""}>
                  <span aria-hidden="true">{item.complete ? "✓" : index + 1}</span>
                  <NavLink to={item.route}>
                    {item.shortLabel}
                    <small>{item.complete ? "Completado" : "Pendiente"}</small>
                  </NavLink>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="onboarding-compact-copy">
            Quedan {items.length - completedCount} pasos para que Hoy pueda organizar tus
            clases y registros.
          </p>
        )}

        <div className="onboarding-coach-actions">
          <button type="button" className="btn secondary" onClick={openCurrentStep}>
            {compact ? "Retomar guía" : "Ver por qué"}
          </button>
          {!compact ? (
            <button type="button" className="onboarding-text-action" onClick={dismissGuide}>
              Ocultar por ahora
            </button>
          ) : null}
        </div>
      </aside>

      <Modal
        open={isGuideOpen}
        title={
          guideView === "welcome"
            ? "Tu aula, bien preparada desde el principio"
            : currentStep?.label ?? "Preparación inicial"
        }
        subtitle={
          guideView === "welcome"
            ? "Cuatro pasos breves. Tú introduces los datos; ProfePlus comprueba el avance."
            : `Paso ${currentStep ? items.findIndex((item) => item.id === currentStep.id) + 1 : 1} de ${items.length}`
        }
        panelClassName="teacher-onboarding-modal"
        onClose={dismissGuide}
      >
        {guideView === "welcome" ? (
          <div className="onboarding-welcome">
            <div className="onboarding-welcome-visual" aria-hidden="true">
              <span>HOY</span>
              <i />
              <b>4 pasos</b>
            </div>
            <div className="onboarding-welcome-copy">
              <p>
                Vamos a conectar tu grupo, alumnado, horario y asignaturas para que la
                pantalla <strong>Hoy</strong> refleje tu jornada real.
              </p>
              <ol>
                {items.map((item, index) => (
                  <li key={item.id} className={item.complete ? "complete" : ""}>
                    <span aria-hidden="true">{item.complete ? "✓" : index + 1}</span>
                    <div>
                      <strong>{item.shortLabel}</strong>
                      <small>{item.description}</small>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="onboarding-privacy-note">
                Los datos se guardan en este dispositivo. La guía no crea contenido de
                ejemplo ni modifica nada sin tu confirmación.
              </p>
            </div>
            <div className="onboarding-modal-actions">
              <button type="button" className="btn secondary" onClick={dismissGuide}>
                Ahora no
              </button>
              <button type="button" className="btn" onClick={startGuide}>
                Empezar preparación
              </button>
            </div>
          </div>
        ) : currentStep ? (
          <div className="onboarding-step-detail">
            <div className="onboarding-detail-index" aria-hidden="true">
              {items.findIndex((item) => item.id === currentStep.id) + 1}
            </div>
            <div>
              <span className="onboarding-eyebrow">Qué vas a conseguir</span>
              <p className="onboarding-benefit">{currentStep.benefit}</p>
              <div className="onboarding-done-rule">
                <strong>Cómo sabrás que está listo</strong>
                <span>{currentStep.completionHint}</span>
              </div>
            </div>
            <div className="onboarding-modal-actions">
              <button type="button" className="btn secondary" onClick={dismissGuide}>
                Guardar para después
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => configureStep(currentStep)}
              >
                Ir a {currentStep.shortLabel.toLocaleLowerCase("es")}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
