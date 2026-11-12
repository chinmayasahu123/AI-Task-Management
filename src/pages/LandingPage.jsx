import CursorGrid from '../components/CursorGrid'
import AnimatedContent from '../components/AnimatedContent'
import GradientText from '../components/GradientText'
import Icon from '../components/Icon'
import StarBorder from '../components/StarBorder'
import './LandingPage.css'

const headingGradientColors = ['#f5f7fc', '#a4c3ff', '#8289eb']

const features = [
  {
    icon: 'check',
    title: 'Tasks that stay clear',
    description: 'Create tasks, set priorities and due dates, and keep the next action easy to find.',
  },
  {
    icon: 'users',
    title: 'Teams that stay in sync',
    description: 'Bring people together around shared work and see each member’s progress in one place.',
  },
  {
    icon: 'calendar',
    title: 'A plan you can see',
    description: 'Keep upcoming deadlines in view and sort work by project, schedule, or priority.',
  },
  {
    icon: 'note',
    title: 'Ideas worth keeping',
    description: 'Save private notes by name, then return to edit or revisit your thoughts whenever you need.',
  },
  {
    icon: 'chart',
    title: 'Progress with context',
    description: 'See what is complete, what is moving, and where overdue work needs attention.',
  },
  {
    icon: 'spark',
    title: 'A little help from AI',
    description: 'Get optional suggestions for task planning and team summaries when AI is configured.',
  },
]

function Brand({ light = false }) {
  return (
    <a className={`landing-brand${light ? ' landing-brand-light' : ''}`} href="#top" aria-label="Tracklap home">
      <span className="brand-mark"><img alt="" src="/tracklap-logo.svg" /></span>
      <span>TRACK<span>LAP</span></span>
    </a>
  )
}

function ProductPreview() {
  return (
    <AnimatedContent className="landing-preview-animation" distance={34} direction="horizontal" duration={0.9}>
      <div className="landing-preview-wrap" aria-label="Preview of the Tracklap workspace">
        <div className="landing-preview-glow" />
        <StarBorder
          as="div"
          className="landing-preview-star"
          color="#a9c5ff"
          trailColor="#798be8"
          duration={8}
          direction="clockwise"
          stars={1}
          trailLength={0.24}
          thickness={1}
          radius={15}
          glow={0.45}
          hover="brighten"
          sparkle={false}
          clickPulse
          theme="dark"
          backgroundColor="transparent"
          textColor="#f3f6fc"
          borderColor="rgba(154, 179, 222, 0.21)"
        >
          <div className="landing-preview">
            <div className="preview-topbar">
              <div className="preview-brand-mark"><img alt="" src="/tracklap-logo.svg" /></div>
              <div className="preview-search"><Icon name="search" size={13} /><span>Search your workspace</span></div>
              <span className="preview-avatar">A</span>
            </div>
            <div className="preview-main">
              <div className="preview-greeting">
                <div><span className="preview-kicker">MONDAY, YOUR WAY</span><h2>A calmer week starts here.</h2></div>
                <span className="preview-date">My workspace</span>
              </div>
              <div className="preview-stats">
                <div><span>Open tasks</span><strong>12</strong><i className="preview-stat-blue" /></div>
                <div><span>In progress</span><strong>04</strong><i className="preview-stat-purple" /></div>
                <div><span>Completed</span><strong>08</strong><i className="preview-stat-green" /></div>
              </div>
              <div className="preview-task-panel">
                <div className="preview-task-title"><strong>Today’s focus</strong><span>View all <Icon name="arrow" size={12} /></span></div>
                <div className="preview-task-row"><span className="preview-check" /><span><b>Outline the launch plan</b><small>Product launch</small></span><i className="preview-priority">HIGH</i></div>
                <div className="preview-task-row"><span className="preview-check preview-check-active"><Icon name="check" size={11} /></span><span><b>Review project feedback</b><small>Website refresh</small></span><i className="preview-priority preview-priority-medium">MED</i></div>
                <div className="preview-task-row"><span className="preview-check" /><span><b>Share ideas with the team</b><small>Team workspace</small></span><i className="preview-priority preview-priority-low">LOW</i></div>
              </div>
              <div className="preview-note"><Icon name="note" size={15} /><span><b>Saved for later</b><small>One good idea can change the whole plan.</small></span><Icon name="arrow" size={13} /></div>
            </div>
            <div className="preview-caption"><span className="preview-live-dot" />A little more focus, every day</div>
          </div>
        </StarBorder>
      </div>
    </AnimatedContent>
  )
}

export default function LandingPage({ children, onOpenAuth, initialError = '' }) {
  return (
    <main className="landing-page" id="top">
      <CursorGrid
        cellSize={60}
        color="#818cf8"
        highlight="area"
        gridStyle="lines"
        radius={140}
        holdTime={400}
        fadeDuration={800}
        fillOpacity={0.06}
        gridOpacity={0.08}
        clickPulse
      />
      <div className="landing-background-wash" />
      <header className="landing-header">
        <div className="landing-header-inner">
          <Brand light />
          <nav className="landing-nav" aria-label="Landing page navigation">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#about">About Tracklap</a>
          </nav>
          <div className="landing-auth-actions">
            <button className="landing-signin" onClick={() => onOpenAuth('login')} type="button">Sign in</button>
            <button className="landing-register" onClick={() => onOpenAuth('register')} type="button">Get started <Icon name="arrow" size={15} /></button>
          </div>
        </div>
      </header>

      {initialError && <p className="landing-error" role="alert">{initialError}</p>}

      <section className="landing-hero">
        <AnimatedContent className="landing-hero-copy" distance={28} duration={0.8}>
          <span className="landing-eyebrow"><span className="landing-eyebrow-dot" />YOUR WORK, IN A BETTER RHYTHM</span>
          <h1>
            <GradientText colors={headingGradientColors} animationSpeed={8} variant="flow" glow={0.25}>
              Make space for<br />your best work.
            </GradientText>
          </h1>
          <p className="landing-hero-description">Tracklap brings tasks, teams, plans, and the ideas behind them into one calm, clear workspace.</p>
          <div className="landing-hero-actions">
            <button className="landing-cta" onClick={() => onOpenAuth('register')} type="button">Create your free workspace <Icon name="arrow" size={17} /></button>
            <a className="landing-secondary-link" href="#features">Explore Tracklap <span>↓</span></a>
          </div>
          <div className="landing-trust-line"><span className="landing-trust-icon"><Icon name="check" size={13} /></span>Private by default <span className="landing-trust-divider" />Built to help you focus</div>
        </AnimatedContent>
        <ProductPreview />
      </section>

      <section className="landing-benefit-strip" aria-label="Tracklap at a glance">
        <span>ONE PLACE FOR THE WORK</span><i />
        <span>TASKS WITH MOMENTUM</span><i />
        <span>TEAMS IN THE LOOP</span><i />
        <span>IDEAS KEPT CLOSE</span>
      </section>

      <section className="landing-section landing-features" id="features">
        <AnimatedContent className="landing-section-heading" distance={24} duration={0.7}>
          <span className="landing-eyebrow">A WORKSPACE THAT WORKS WITH YOU</span>
          <h2>
            <GradientText colors={headingGradientColors} animationSpeed={8} variant="flow" glow={0.2}>
              Everything in its right place.
            </GradientText>
          </h2>
          <p>From the first thought to the final checkmark, keep the details of work connected.</p>
        </AnimatedContent>
        <AnimatedContent className="landing-feature-grid" distance={30} duration={0.65} stagger={0.08}>
          {features.map((feature, index) => (
            <article className="landing-feature-card" key={feature.title}>
              <span className={`landing-feature-icon landing-feature-icon-${index}`}><Icon name={feature.icon} size={19} /></span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <span className="landing-feature-number">0{index + 1}</span>
            </article>
          ))}
        </AnimatedContent>
      </section>

      <section className="landing-how" id="how-it-works">
        <AnimatedContent className="landing-how-copy" distance={28} duration={0.75}>
          <span className="landing-eyebrow">SIMPLE BY DESIGN</span>
          <h2>Less juggling.<br /><span>More moving forward.</span></h2>
          <p>Start with what matters today. Tracklap keeps the plan visible and gives every task, team update, and saved idea a place to land.</p>
          <button className="landing-text-cta" onClick={() => onOpenAuth('register')} type="button">Start your workspace <Icon name="arrow" size={16} /></button>
        </AnimatedContent>
        <AnimatedContent className="landing-steps" distance={24} duration={0.7} stagger={0.1}>
          <article><span>01</span><div><h3>Bring your work together</h3><p>Create tasks and organize them by project, deadline, and priority.</p></div></article>
          <article><span>02</span><div><h3>Make progress visible</h3><p>Update your status, work with teammates, and see what needs attention.</p></div></article>
          <article><span>03</span><div><h3>Keep the good ideas</h3><p>Save personal notes alongside your workspace and return to them anytime.</p></div></article>
        </AnimatedContent>
      </section>

      <section className="landing-final-cta" id="about">
        <div className="landing-final-orb" />
        <AnimatedContent className="landing-final-cta-content" distance={24} duration={0.75} stagger={0.08}>
          <span className="landing-eyebrow">YOUR NEXT STEP STARTS HERE</span>
          <h2>
            <GradientText colors={headingGradientColors} animationSpeed={8} variant="flow" glow={0.25}>
              Make work feel a little lighter.
            </GradientText>
          </h2>
          <p>Set up your Tracklap workspace and bring your next idea to life.</p>
          <button className="landing-cta" onClick={() => onOpenAuth('register')} type="button">Get started with Tracklap <Icon name="arrow" size={17} /></button>
        </AnimatedContent>
      </section>

      <footer className="landing-footer">
        <Brand light />
        <p>Thoughtful work starts with a little clarity.</p>
        <span>© {new Date().getFullYear()} Tracklap</span>
      </footer>
      {children}
    </main>
  )
}
