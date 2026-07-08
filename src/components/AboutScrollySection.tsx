import { DroneScene } from './DroneScene';
import { useScrollyStep } from '../hooks/useScrollyStep';

type ScrollyStep = {
  step: string;
  label: string;
  heading: string;
  body: string;
};

const ABOUT_STEPS: ScrollyStep[] = [
  {
    step: '01',
    label: 'Mission',
    heading: 'Inspect critical infrastructure autonomously',
    body: 'Eadivous Technologies builds autonomous drones that inspect critical infrastructure with no one in the loop, from power lines and pipelines to roads, bridges, construction sites, farmland, and secured perimeters.',
  },
  {
    step: '02',
    label: 'Platform',
    heading: 'Every aircraft built in-house',
    body: 'We build the entire aircraft ourselves: 3D-printed frames, our own flight controllers, ESCs, and integrated AIO boards, all designed in-house.',
  },
  {
    step: '03',
    label: 'Perception',
    heading: 'Navigate and map in real time',
    body: 'Our aircraft navigate GPS-denied environments using LiDAR-inertial odometry and reconstruct each site as real-time 3D, fusing LiDAR and RGB sensors at the nanosecond level.',
  },
];

export function AboutScrollySection() {
  const { activeStep, setStepRef } = useScrollyStep(ABOUT_STEPS.length);

  return (
    <section id="section-about" className="globe-scrolly about-scrolly" aria-label="About Eadivous Technologies">
      <div className="globe-scrolly-layout">
        <div className="globe-scrolly-copy">
          {ABOUT_STEPS.map((item, index) => (
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
                  {ABOUT_STEPS[activeStep].step}
                </span>
                <span className="globe-scrolly-progress-sep">/</span>
                <span>{ABOUT_STEPS[ABOUT_STEPS.length - 1].step}</span>
              </p>
              <div className="hero-drone">
                <DroneScene />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
