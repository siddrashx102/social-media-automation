import { useState, useEffect } from 'react';
import api from '../services/api';
import DashboardCards from '../components/DashboardCards';

function DashboardPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    async function fetchDashboardData() {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get('/statuses/dashboard/data');
            setData(response.data);
        } catch (err) {
            setError(err.message || 'Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
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

    const { counts, nextScheduled, recentActivity, automationHealth } = data;

    return (
        <div>
            <h2 className="mb-4">Dashboard</h2>

            {/* Count Cards */}
            <DashboardCards counts={counts} />

            <div className="row g-3">
                {/* Next Scheduled Status */}
                <div className="col-md-6">
                    <div className="card h-100">
                        <div className="card-header">
                            <i className="bi bi-calendar-event me-2"></i>
                            Next Scheduled Status
                        </div>
                        <div className="card-body">
                            {nextScheduled ? (
                                <div>
                                    <p className="card-text">
                                        {nextScheduled.caption
                                            ? nextScheduled.caption.length > 100
                                                ? nextScheduled.caption.substring(0, 100) + '...'
                                                : nextScheduled.caption
                                            : <span className="text-muted fst-italic">No caption</span>
                                        }
                                    </p>
                                    <p className="text-muted mb-0">
                                        <i className="bi bi-clock me-1"></i>
                                        {new Date(nextScheduled.scheduledAt).toLocaleString()}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-muted mb-0">No upcoming statuses scheduled</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Automation Health */}
                <div className="col-md-6">
                    <div className="card h-100">
                        <div className="card-header">
                            <i className="bi bi-heart-pulse me-2"></i>
                            Automation Health
                        </div>
                        <div className="card-body">
                            <div className="d-flex align-items-center">
                                <span className={`badge bg-${getHealthColor(automationHealth)} me-2`}>
                                    {automationHealth === 'active' ? 'Active' : automationHealth === 'expired' ? 'Expired' : 'Unknown'}
                                </span>
                                <span className="text-muted">
                                    {automationHealth === 'active'
                                        ? 'WhatsApp Web is connected'
                                        : automationHealth === 'expired'
                                            ? 'Login session expired, QR scan required'
                                            : 'Status unknown, verify login in Settings'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="card mt-4">
                <div className="card-header">
                    <i className="bi bi-activity me-2"></i>
                    Recent Activity
                </div>
                <div className="card-body">
                    {recentActivity && recentActivity.length > 0 ? (
                        <div className="table-responsive">
                            <table className="table table-sm table-hover mb-0">
                                <thead>
                                    <tr>
                                        <th>Event</th>
                                        <th>Message</th>
                                        <th>Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentActivity.map((entry) => (
                                        <tr key={entry.id}>
                                            <td>
                                                <span className={`badge bg-${getEventColor(entry.eventType)}`}>
                                                    {formatEventType(entry.eventType)}
                                                </span>
                                            </td>
                                            <td>{entry.message}</td>
                                            <td className="text-muted text-nowrap">
                                                {new Date(entry.createdAt).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-muted mb-0">No recent activity</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function getHealthColor(health) {
    switch (health) {
        case 'active': return 'success';
        case 'expired': return 'danger';
        default: return 'secondary';
    }
}

function getEventColor(eventType) {
    switch (eventType) {
        case 'STATUS_POSTED': return 'success';
        case 'STATUS_FAILED': return 'danger';
        case 'LOGIN_REQUIRED': return 'warning';
        case 'AUTOMATION_STOPPED': return 'danger';
        case 'AUTOMATION_STARTED': return 'success';
        default: return 'info';
    }
}

function formatEventType(eventType) {
    return eventType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export default DashboardPage;
