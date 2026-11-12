import { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import Icon from './Icon'

const maximumSize = 2 * 1024 * 1024
const maximumDimension = 1600

export default function ProfilePhotoDialog({ user, onClose, onUpload, onRemove }) {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [imageSize, setImageSize] = useState(null)
  const previewObjectUrl = useRef('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    return () => {
      if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current)
    }
  }, [])

  function chooseFile(event) {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return
    event.target.value = ''
    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current)
    previewObjectUrl.current = ''
    setPreviewUrl('')
    setImageSize(null)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selectedFile.type)) {
      setError('Choose a JPEG, PNG, or WebP image.')
      setFile(null)
      return
    }
    if (selectedFile.size > maximumSize) {
      setError('Profile pictures must be 2 MB or smaller.')
      setFile(null)
      return
    }
    setError('')
    setFile(selectedFile)
    previewObjectUrl.current = URL.createObjectURL(selectedFile)
    setPreviewUrl(previewObjectUrl.current)
  }

  function imageLoaded(event) {
    setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
  }

  async function createFullImageFile() {
    if (!file || !imageSize) throw new Error('Wait for the image to finish loading, then try again.')
    const scale = Math.min(1, maximumDimension / Math.max(imageSize.width, imageSize.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(imageSize.width * scale)
    canvas.height = Math.round(imageSize.height * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not prepare the image.')

    const image = new Image()
    image.src = previewUrl
    await image.decode()
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const imageBlob = await new Promise((resolve) => canvas.toBlob(resolve, file.type, 0.9))
    if (!imageBlob) throw new Error('Your browser could not prepare the image.')
    if (imageBlob.size > maximumSize) throw new Error('The image is still larger than 2 MB. Choose a smaller image.')
    return new File([imageBlob], file.name, { type: file.type, lastModified: Date.now() })
  }

  async function savePhoto() {
    if (!file || !imageSize) return
    setIsSaving(true)
    setError('')
    try {
      await onUpload(await createFullImageFile())
      onClose()
    } catch (uploadError) {
      setError(uploadError.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function removePhoto() {
    setIsSaving(true)
    setError('')
    try {
      await onRemove()
      onClose()
    } catch (removeError) {
      setError(removeError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="task-modal profile-photo-modal" role="dialog" aria-modal="true" aria-labelledby="profile-photo-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">YOUR ACCOUNT</p>
            <h2 id="profile-photo-title">Profile picture</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog" type="button"><Icon name="close" /></button>
        </div>
        <div className="profile-photo-content">
          {previewUrl ? (
            <div
              aria-label="Full profile picture preview"
              className="profile-photo-crop"
              role="img"
            >
              <img
                alt=""
                draggable="false"
                onError={() => setError('This image could not be opened. Please choose another one.')}
                onLoad={imageLoaded}
                src={previewUrl}
                style={imageSize ? {
                  maxWidth: '100%',
                  maxHeight: '100%',
                } : undefined}
              />
            </div>
          ) : (
            <Avatar name={user.name} src={user.avatarUrl} className="profile-photo-preview" />
          )}
          <strong>{user.name}</strong>
          <span>{user.email}</span>
          <label className="secondary-button profile-photo-picker">
            <Icon name="plus" size={16} />
            {previewUrl ? 'Choose a different picture' : 'Choose a picture'}
            <input accept="image/jpeg,image/png,image/webp" onChange={chooseFile} type="file" />
          </label>
          <p className="profile-photo-help">{previewUrl ? 'Your full photo will be saved without cropping.' : 'JPEG, PNG, or WebP · up to 2 MB'}</p>
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
        <div className="modal-actions">
          {user.avatarUrl && <button className="remove-photo-button" disabled={isSaving} onClick={removePhoto} type="button">Remove picture</button>}
          <button className="secondary-button" disabled={isSaving} onClick={onClose} type="button">Cancel</button>
          <button className="primary-button" disabled={!file || !imageSize || isSaving} onClick={savePhoto} type="button">{isSaving ? 'Saving...' : 'Save picture'}</button>
        </div>
      </section>
    </div>
  )
}
