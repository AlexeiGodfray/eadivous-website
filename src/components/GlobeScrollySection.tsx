import { GlobeScene, type ConnectivityMode } from './GlobeScene';
import { useScrollyStep } from '../hooks/useScrollyStep';

type ScrollyStep = {
  step: string;
  label: string;
  heading: string;
  body: string;
  connectivityMode: ConnectivityMode;
  focusHub?: string;
};

const SCROLLY_STEPS: ScrollyStep[] = [
  {
    step: '01',
    label: 'Connectivity',
    heading: 'Control your drones from anywhere',
    body: 'Run the entire fleet from a single office. One command center, every aircraft in the field — no matter how far they roam.',
    connectivityMode: 'fleet',
    focusHub: 'us',
  },
  {
    step: '02',
    label: 'Reach',
    heading: 'Deploy on satellite and 5G',
    body: 'Satellite internet and cellular backhaul keep every link alive across oceans, deserts, and cities. Your fleet stays connected where legacy networks drop off.',
    connectivityMode: 'satellite',
  },
  {
    step: '03',
    label: 'Aggregation',
    heading: 'Stream data back in real time',
    body: 'Every sensor feed lands in one pipeline — fused, indexed, and ready before the aircraft lands. Aggregation gets easier, faster, and scales as far as your operation needs.',
    connectivityMode: 'stream',
  },
];

export function GlobeScrollySection() {
  const { activeStep, setStepRef } = useScrollyStep(SCROLLY_STEPS.length);
  const step = SCROLLY_STEPS[activeStep];

  return (
    <section id="section-connectivity" className="globe-scrolly" aria-label="Connectivity">
      <div className="globe-scrolly-layout">
        <div className="globe-scrolly-copy">
          {SCROLLY_STEPS.map((item, index) => (
            <article
              key={item.step}
              ref={setStepRef(index)}
              className={`globe-scrolly-step${activeStep === index ? ' is-active' : ''}`}
            >
              <span className="globe-scrolly-step-num">{item.step}</span>
              <span className="globe-label">{item.label}</span>
              <h2 className="globe-heading">{item.heading}</h2>
              <p className="globe-body">{item.body}</p>
            </article>
          ))}
        </div>

        <div className="globe-scrolly-visual" aria-hidden>
          <div className="globe-scrolly-pin">
            <div className="globe-scrolly-stage">
              <p className="globe-scrolly-progress">
                <span className="globe-scrolly-progress-current">
                  {SCROLLY_STEPS[activeStep].step}
                </span>
                <span className="globe-scrolly-progress-sep">/</span>
                <span>{SCROLLY_STEPS[SCROLLY_STEPS.length - 1].step}</span>
              </p>
              <GlobeScene
                focusedHubId={step.focusHub ?? null}
                connectivityMode={step.connectivityMode}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
