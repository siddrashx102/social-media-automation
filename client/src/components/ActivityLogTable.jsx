function ActivityLogTable({ logs }) {
    function getEventColor(eventType) {
        switch (eventType) {
            case 'STATUS_POSTED': return 'success';
            case 'STATUS_FAILED': return 'danger';
            case 'STATUS_CREATED': return 'info';
            case 'STATUS_SCHEDULED': return 'primary';
            case 'STATUS_POSTING': return 'warning';
            case 'LOGIN_REQUIRED': return 'warning';
            case 'AUTOMATION_STARTED': return 'success';
            case 'AUTOMATION_STOPPED': return 'danger';
            default: return 'secondary';
        }
    }

    function formatEventType(eventType) {
        return eventType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    }

    if (logs.length === 0) {
        return (
            <div className="text-center py-5 text-muted">
                <i className="bi bi-journal fs-1 d-block mb-2"></i>
                <p>No activity logs yet.</p>
            </div>
        );
    }

    return (
        <div className="table-responsive">
            <table className="table table-hover align-middle">
                <thead className="table-light">
                    <tr>
                        <th style={{ width: '180px' }}>Event</th>
                        <th>Message</th>
                        <th style={{ width: '200px' }}>Timestamp</th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map((entry) => (
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
    );
}

export default ActivityLogTable;
