import Icon from '../Icon'

export default function AIActionCard({
  title,
  description,
  buttonLabel,
  isRunning,
  isDisabled = false,
  error,
  onRun,
  children,
}) {
  return (
    <section className="panel ai-feature-card">
      <div className="ai-feature-heading">
        <span className="ai-feature-icon"><Icon name="spark" size={18} /></span>
        <div><h2>{title}</h2><p>{description}</p></div>
      </div>
      {children}
      {error && <p className="ai-error" role="alert">{error}</p>}
      <button className="primary-button ai-run-button" disabled={isDisabled || isRunning} onClick={onRun} type="button">
        <Icon name="spark" size={16} />{isRunning ? 'Working...' : buttonLabel}
      </button>
    </section>
  )
}
