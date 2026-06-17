import { useState } from 'react';
import api from '../services/api';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/3gpp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 16 * 1024 * 1024;
const MAX_CAPTION_LENGTH = 700;
const MIN_SCHEDULE_AHEAD_MS = 5 * 60 * 1000;

function StatusForm({ existingStatus = null, onSuccess }) {
    const isEdit = !!existingStatus;

    const [media, setMedia] = useState(null);
    const [caption, setCaption] = useState(existingStatus?.caption || '');
    const [scheduledAt, setScheduledAt] = useState(
        existingStatus?.scheduledAt ? formatDateForInput(existingStatus.scheduledAt) : ''
    );
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    function validate(publishNow = false) {
        const newErrors = {};

        // Media required for new statuses
        if (!isEdit && !media) {
            newErrors.media = 'Media file is required';
        }

        // Validate file type and size
        if (media) {
            if (!ALLOWED_TYPES.includes(media.type)) {
                newErrors.media = 'Only image (JPEG, PNG, GIF) and video (MP4, 3GP) files are supported';
            } else {
                const isImage = media.type.startsWith('image/');
                const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
                if (media.size > maxSize) {
                    newErrors.media = `File size exceeds the ${isImage ? '5 MB' : '16 MB'} limit`;
                }
            }
        }

        // Caption validation
        if (caption.length > MAX_CAPTION_LENGTH) {
            newErrors.caption = `Caption must not exceed ${MAX_CAPTION_LENGTH} characters`;
        }

        // Schedule validation (only if not publishing now and schedule is provided)
        if (!publishNow && scheduledAt) {
            const scheduleDate = new Date(scheduledAt);
            const minDate = new Date(Date.now() + MIN_SCHEDULE_AHEAD_MS);
            if (scheduleDate < minDate) {
                newErrors.scheduledAt = 'Scheduled time must be at least 5 minutes in the future';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!validate()) return;

        setSubmitting(true);
        setSubmitError(null);
        setSuccessMsg(null);

        try {
            if (isEdit) {
                await api.put(`/statuses/${existingStatus.id}`, {
                    caption: caption || null,
                    scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null
                });
                setSuccessMsg('Status updated successfully');
            } else {
                const formData = new FormData();
                formData.append('media', media);
                if (caption) formData.append('caption', caption);
                if (scheduledAt) formData.append('scheduledAt', new Date(scheduledAt).toISOString());

                await api.post('/statuses', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                setSuccessMsg('Status created successfully');
            }

            if (onSuccess) {
                setTimeout(() => onSuccess(), 1000);
            }
        } catch (err) {
            setSubmitError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    async function handlePublishNow(e) {
        e.preventDefault();
        if (!validate(true)) return;

        setSubmitting(true);
        setSubmitError(null);
        setSuccessMsg(null);

        try {
            if (isEdit) {
                // Publish existing status
                await api.post(`/statuses/${existingStatus.id}/publish-now`);
                setSuccessMsg('Status is being published...');
            } else {
                // Create and immediately publish
                const formData = new FormData();
                formData.append('media', media);
                if (caption) formData.append('caption', caption);

                const response = await api.post('/statuses', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                // Trigger publish now on the created status
                await api.post(`/statuses/${response.data.id}/publish-now`);
                setSuccessMsg('Status is being published...');
            }

            if (onSuccess) {
                setTimeout(() => onSuccess(), 1500);
            }
        } catch (err) {
            setSubmitError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    function handleFileChange(e) {
        const file = e.target.files[0];
        setMedia(file || null);
        if (errors.media) {
            setErrors({ ...errors, media: null });
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            {submitError && (
                <div className="alert alert-danger" role="alert">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    {submitError}
                </div>
            )}

            {successMsg && (
                <div className="alert alert-success" role="alert">
                    <i className="bi bi-check-circle me-2"></i>
                    {successMsg}
                </div>
            )}

            {/* Media Upload */}
            {!isEdit && (
                <div className="mb-3">
                    <label htmlFor="media" className="form-label">
                        Media File <span className="text-danger">*</span>
                    </label>
                    <input
                        type="file"
                        className={`form-control ${errors.media ? 'is-invalid' : ''}`}
                        id="media"
                        accept="image/jpeg,image/png,image/gif,video/mp4,video/3gpp"
                        onChange={handleFileChange}
                    />
                    <div className="invalid-feedback">{errors.media}</div>
                    <div className="form-text">
                        Images: JPEG, PNG, GIF (max 5 MB) | Videos: MP4, 3GP (max 16 MB)
                    </div>
                </div>
            )}

            {/* Media Preview for edit mode */}
            {isEdit && existingStatus.originalFilename && (
                <div className="mb-3">
                    <label className="form-label">Media File</label>
                    <p className="form-control-plaintext">
                        <i className={`bi ${existingStatus.mediaType === 'image' ? 'bi-image' : 'bi-camera-video'} me-2`}></i>
                        {existingStatus.originalFilename}
                    </p>
                </div>
            )}

            {/* Caption */}
            <div className="mb-3">
                <label htmlFor="caption" className="form-label">Caption</label>
                <textarea
                    className={`form-control ${errors.caption ? 'is-invalid' : ''}`}
                    id="caption"
                    rows="3"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Enter an optional caption..."
                    maxLength={MAX_CAPTION_LENGTH + 50}
                />
                <div className="invalid-feedback">{errors.caption}</div>
                <div className="form-text">
                    {caption.length}/{MAX_CAPTION_LENGTH} characters
                </div>
            </div>

            {/* Schedule Time */}
            <div className="mb-3">
                <label htmlFor="scheduledAt" className="form-label">Schedule Time</label>
                <input
                    type="datetime-local"
                    className={`form-control ${errors.scheduledAt ? 'is-invalid' : ''}`}
                    id="scheduledAt"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                />
                <div className="invalid-feedback">{errors.scheduledAt}</div>
                <div className="form-text">
                    Leave empty to save as draft. Must be at least 5 minutes in the future.
                </div>
            </div>

            {/* Action Buttons */}
            <div className="d-flex gap-2">
                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting}
                >
                    {submitting ? (
                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                    ) : (
                        <i className="bi bi-save me-1"></i>
                    )}
                    {isEdit ? 'Update Status' : 'Save Status'}
                </button>

                <button
                    type="button"
                    className="btn btn-success"
                    disabled={submitting}
                    onClick={handlePublishNow}
                >
                    {submitting ? (
                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                    ) : (
                        <i className="bi bi-send me-1"></i>
                    )}
                    Publish Now
                </button>
            </div>
        </form>
    );
}

function formatDateForInput(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
}

export default StatusForm;
