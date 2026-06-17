import { useState, useEffect } from 'react';
import api from '../services/api';
import SettingsForm from '../components/SettingsForm';

function SettingsPage() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    async function fetchSettings(showLoading = true) {
        try {
            if (showLoading) setLoading(true);
            setError(null);
            const response = await api.get('/settings');
            setSettings(response.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    function handleSaved() {
        // Re-fetch without showing loading spinner so the form stays mounted
        fetchSettings(false);
    }

    if (loading) {
        return (
            <div className="d-flex justify-content-center mt-5">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="alert alert-danger" role="alert">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {error}
            </div>
        );
    }

    return (
        <div>
            <h2 className="mb-4">Settings</h2>
            <SettingsForm settings={settings} onSaved={handleSaved} />
        </div>
    );
}

export default SettingsPage;
