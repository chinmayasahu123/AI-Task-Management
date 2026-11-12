import { useState } from 'react'

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

export default function Avatar({ name = '', src = null, className = '' }) {
  const color = ['lavender', 'mint', 'peach', 'sky'][name.length % 4]
  const [failedSrc, setFailedSrc] = useState(null)
  return (
    <span className={`avatar ${color} ${className}`} title={name}>
      {src && failedSrc !== src
        ? <img alt="" onError={() => setFailedSrc(src)} src={src} />
        : initials(name)}
    </span>
  )
}
