export function formatDate(value, options = { month: 'short', day: 'numeric' }) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat('en-US', options).format(new Date(`${value}T00:00:00`))
}
