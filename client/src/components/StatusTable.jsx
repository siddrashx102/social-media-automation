import { useNavigate } from 'react-router-dom';

function StatusTable({ statuses, onDelete, onPublish, onRetry }) {
    const navigate = useNavigate();

    function getStateBadge(state) {
        const variants = {
            draft: 'secondary',
            scheduled: 'primary',
            posting: 'warning',
            posted: 'success',
            failed: 'danger'
        };
        return (
            <span className={`badge bg-${variants[state] || 'secondary'}`}>
                {state.charAt(0).toUpperCase() + state.slice(1)}
            </span>
        );
    }

    function truncateCaption(caption) {
        if (!caption) return <span className="text-muted fst-italic">No caption</span>;
        if (caption.length > 100) return caption.substring(0, 100) + '...';
        return caption;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString();
    }

    if (statuses.length === 0) {
        return (
            <div className="text-center py-5 text-muted">
                <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                <p>No statuses found. Create your first status to get started.</p>
            </div>
        );
    }

    return (
        <div className="table-responsive">
            <table className="table table-hover align-middle">
                <thead className="table-light">
                    <tr>
                        <th style={{ width: '60px' }}>Media</th>
                        <th>Caption</th>
                        <th>Scheduled</th>
                        <th>State</th>
                        <th>Created</th>
                        <th style={{ width: '200px' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {statuses.map((status) => (
                        <tr key={status.id}>
                            <td>
                                <i className={`bi ${status.mediaType === 'image' ? 'bi-image' : 'bi-camera-video'} fs-4`}></i>
                            </td>
                            <td>{truncateCaption(status.caption)}</td>
                            <td className="text-nowrap">{formatDate(status.scheduledAt)}</td>
                            <td>{getStateBadge(status.state)}</td>
                            <td className="text-nowrap">{formatDate(status.createdAt)}</td>
                            <td>
                                <div className="btn-group btn-group-sm">
                                    {/* Edit - only for draft/scheduled */}
                                    {['draft', 'scheduled'].includes(status.state) && (
                                        <button
                                            className="btn btn-outline-primary"
                                            title="Edit"
                                            onClick={() => navigate(`/statuses/${status.id}/edit`)}
                                        >
                                            <i className="bi bi-pencil"></i>
                                        </button>
                                    )}

                                    {/* Publish Now - only for draft/scheduled */}
                                    {['draft', 'scheduled'].includes(status.state) && (
                                        <button
                                            className="btn btn-outline-success"
                                            title="Publish Now"
                                            onClick={() => onPublish(status.id)}
                                        >
                                            <i className="bi bi-send"></i>
                                        </button>
                                    )}

                                    {/* Retry - only for failed with retryCount < 3 */}
                                    {status.state === 'failed' && status.retryCount < 3 && (
                                        <button
                                            className="btn btn-outline-warning"
                                            title={`Retry (${status.retryCount}/3 attempts used)`}
                                            onClick={() => onRetry(status.id)}
                                        >
                                            <i className="bi bi-arrow-clockwise"></i>
                                        </button>
                                    )}

                                    {/* Delete - always available */}
                                    <button
                                        className="btn btn-outline-danger"
                                        title="Delete"
                                        onClick={() => onDelete(status.id)}
                                    >
                                        <i className="bi bi-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default StatusTable;
