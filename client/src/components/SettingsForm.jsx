import { useState } from 'react';
import api from '../services/api';

function SettingsForm({ settings, onSaved }) {
    const [formData, setFormData] = useState({
        automationEnabled: settings.automationEnabled || false,
        headlessMode: settings.headlessMode || true,
        slowMoMs: settings.slowMoMs || 0,
        whatsAppWebUrl: settings.whatsAppWebUrl || '',
        playwrightProfilePath: settings.playwrightProfilePath || ''
    });
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState(null);
    const [actionLoading, setActionLoading] = useState({
        verifyLogin: false,
        launchWhatsApp: false,
        reinitialize: false
    });

    function validate() {
        const newErrors = {};

        if (!formData.whatsAppWebUrl.startsWith('http://') && !formData.whatsAppWebUrl.startsWith('https://')) {
            newErrors.whatsAppWebUrl = 'URL must start with http:// or https://';
        }

        if (!formData.playwrightProfilePath.trim()) {
            newErrors.playwrightProfilePath = 'Profile path cannot be empty';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    async function handleSave(e) {
        e.preventDefault();
        if (!validate()) return;

        setSaving(true);
        setNotification(null);

        try {
            await api.put('/settings', formData);
            showNotification('success', 'Settings saved successfully');
            if (onSaved) onSaved();
        } catch (err) {
            showNotification('danger', err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleVerifyLogin() {
        setActionLoading({ ...actionLoading, verifyLogin: true });
        setNotification(null);

        try {
            const response = await api.post('/settings/verify-login');
            const { loginStatus } = response.data;
            if (loginStatus === 'active') {
                showNotification('success', 'WhatsApp Web login is active');
            } else if (loginStatus === 'qr_scan_required') {
                showNotification('warning', 'QR scan required — use "Launch WhatsApp" to scan');
            } else {
                showNotification('secondary', 'Login status could not be determined');
            }
        } catch (err) {
            showNotification('danger', `Verify login failed: ${err.message}`);
        } finally {
            setActionLoading({ ...actionLoading, verifyLogin: false });
        }
    }

    async function handleLaunchWhatsApp() {
        setActionLoading({ ...actionLoading, launchWhatsApp: true });
        setNotification(null);
        showNotification('info', 'Launching browser for QR scan... Please scan the QR code in the browser window.');

        try {
            const response = await api.post('/settings/launch-whatsapp');
            if (response.data.success) {
                showNotification('success', 'QR code scanned successfully! WhatsApp Web is now logged in.');
            } else {
                showNotification('warning', 'QR scan was not completed. Please try again.');
            }
        } catch (err) {
            showNotification('danger', `Launch failed: ${err.message}`);
        } finally {
            setActionLoading({ ...actionLoading, launchWhatsApp: false });
        }
    }

    async function handleReinitialize() {
        if (!confirm('Are you sure you want to reinitialize the session? This will delete your saved login and require a new QR scan.')) {
            return;
        }

        setActionLoading({ ...actionLoading, reinitialize: true });
        setNotification(null);

        try {
            const response = await api.post('/settings/reinitialize');
            if (response.data.success) {
                showNotification('success', 'Session reinitialized successfully. A new QR scan will be required.');
            } else {
                showNotification('danger', `Reinitialization failed: ${response.data.error}`);
            }
        } catch (err) {
            showNotification('danger', `Reinitialize failed: ${err.message}`);
        } finally {
            setActionLoading({ ...actionLoading, reinitialize: false });
        }
    }

    function showNotification(type, message) {
        setNotification({ type, message });
    }

    function handleChange(field, value) {
        setFormData({ ...formData, [field]: value });
        if (errors[field]) {
            setErrors({ ...errors, [field]: null });
        }
    }

    return (
        <div>
            {notification && (
                <div className={`alert alert-${notification.type} alert-dismissible`} role="alert">
                    {notification.message}
                    <button type="button" className="btn-close" onClick={() => setNotification(null)}></button>
                </div>
            )}

            <form onSubmit={handleSave}>
                {/* Automation Settings */}
                <div className="card mb-4">
                    <div className="card-header">
                        <i className="bi bi-robot me-2"></i>
                        Automation Settings
                    </div>
                    <div className="card-body">
                        <div className="mb-3 form-check form-switch">
                            <input
                                type="checkbox"
                                className="form-check-input"
                                id="automationEnabled"
                                checked={formData.automationEnabled}
                                onChange={(e) => handleChange('automationEnabled', e.target.checked)}
                            />
                            <label className="form-check-label" htmlFor="automationEnabled">
                                Automation Enabled
                            </label>
                            <div className="form-text">
                                When enabled, the scheduler will automatically publish statuses at their scheduled time.
                            </div>
                        </div>

                        <div className="mb-3 form-check form-switch">
                            <input
                                type="checkbox"
                                className="form-check-input"
                                id="headlessMode"
                                checked={formData.headlessMode}
                                onChange={(e) => handleChange('headlessMode', e.target.checked)}
                            />
                            <label className="form-check-label" htmlFor="headlessMode">
                                Headless Mode
                            </label>
                            <div className="form-text">
                                When enabled, the browser runs in the background without a visible window.
                            </div>
                        </div>

                        <div className="mb-3">
                            <label htmlFor="slowMoMs" className="form-label">
                                Slow Motion Delay: {formData.slowMoMs}ms
                            </label>
                            <input
                                type="range"
                                className="form-range"
                                id="slowMoMs"
                                min="0"
                                max="2000"
                                step="100"
                                value={formData.slowMoMs}
                                onChange={(e) => handleChange('slowMoMs', parseInt(e.target.value))}
                            />
                            <div className="form-text">
                                Adds a delay between each browser action so you can watch the automation step by step. Set to 0 for maximum speed.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Connection Settings */}
                <div className="card mb-4">
                    <div className="card-header">
                        <i className="bi bi-link-45deg me-2"></i>
                        Connection Settings
                    </div>
                    <div className="card-body">
                        <div className="mb-3">
                            <label htmlFor="whatsAppWebUrl" className="form-label">WhatsApp Web URL</label>
                            <input
                                type="text"
                                className={`form-control ${errors.whatsAppWebUrl ? 'is-invalid' : ''}`}
                                id="whatsAppWebUrl"
                                value={formData.whatsAppWebUrl}
                                onChange={(e) => handleChange('whatsAppWebUrl', e.target.value)}
                            />
                            <div className="invalid-feedback">{errors.whatsAppWebUrl}</div>
                        </div>

                        <div className="mb-3">
                            <label htmlFor="playwrightProfilePath" className="form-label">Playwright Profile Path</label>
                            <input
                                type="text"
                                className={`form-control ${errors.playwrightProfilePath ? 'is-invalid' : ''}`}
                                id="playwrightProfilePath"
                                value={formData.playwrightProfilePath}
                                onChange={(e) => handleChange('playwrightProfilePath', e.target.value)}
                            />
                            <div className="invalid-feedback">{errors.playwrightProfilePath}</div>
                            <div className="form-text">
                                Directory where the browser profile is stored for persistent login.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <button type="submit" className="btn btn-primary mb-4" disabled={saving}>
                    {saving ? (
                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                    ) : (
                        <i className="bi bi-save me-1"></i>
                    )}
                    Save Settings
                </button>
            </form>

            {/* WhatsApp Actions */}
            <div className="card">
                <div className="card-header">
                    <i className="bi bi-whatsapp me-2"></i>
                    WhatsApp Actions
                </div>
                <div className="card-body">
                    <div className="d-flex flex-wrap gap-2">
                        <button
                            className="btn btn-outline-primary"
                            onClick={handleVerifyLogin}
                            disabled={actionLoading.verifyLogin}
                        >
                            {actionLoading.verifyLogin && (
                                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                            )}
                            <i className="bi bi-shield-check me-1"></i>
                            Verify Login
                        </button>

                        <button
                            className="btn btn-outline-success"
                            onClick={handleLaunchWhatsApp}
                            disabled={actionLoading.launchWhatsApp}
                        >
                            {actionLoading.launchWhatsApp && (
                                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                            )}
                            <i className="bi bi-box-arrow-up-right me-1"></i>
                            Launch WhatsApp
                        </button>

                        <button
                            className="btn btn-outline-danger"
                            onClick={handleReinitialize}
                            disabled={actionLoading.reinitialize}
                        >
                            {actionLoading.reinitialize && (
                                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                            )}
                            <i className="bi bi-arrow-counterclockwise me-1"></i>
                            Reinitialize Session
                        </button>
                    </div>
                    <div className="form-text mt-2">
                        Use these actions to manage your WhatsApp Web connection and session.
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SettingsForm;
