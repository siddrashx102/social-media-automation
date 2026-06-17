import { useState, useEffect } from 'react';
import api from '../services/api';
import StatusTable from '../components/StatusTable';
import ConfirmDialog from '../components/ConfirmDialog';

const PAGE_SIZE = 20;

function StatusesPage() {
    const [statuses, setStatuses] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionError, setActionError] = useState(null);

    // Confirm dialog state
    const [confirmDialog, setConfirmDialog] = useState({
        show: false,
        title: '',
        message: '',
        statusId: null,
        action: null
    });

    useEffect(() => {
        fetchStatuses();
    }, [page]);

    // Auto-poll when any status is in "posting" state
    useEffect(() => {
        const hasPostingStatus = statuses.some(s => s.state === 'posting');
        if (!hasPostingStatus) return;

        const interval = setInterval(() => {
            fetchStatuses();
        }, 3000); // Poll every 3 seconds

        return () => clearInterval(interval);
    }, [statuses]);

    async function fetchStatuses() {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get(`/statuses?page=${page}&pageSize=${PAGE_SIZE}`);
            setStatuses(response.data.statuses);
            setTotal(response.data.total);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    function handleDelete(statusId) {
        setActionError(null);
        setConfirmDialog({
            show: true,
            title: 'Delete Status',
            message: 'Are you sure you want to delete this status? This action cannot be undone.',
            statusId,
            action: 'delete'
        });
    }

    async function handlePublish(statusId) {
        setActionError(null);
        try {
            await api.post(`/statuses/${statusId}/publish-now`);
            await fetchStatuses();
        } catch (err) {
            setActionError(err.message);
        }
    }

    async function handleRetry(statusId) {
        setActionError(null);
        try {
            await api.post(`/statuses/${statusId}/retry`);
            await fetchStatuses();
        } catch (err) {
            setActionError(err.message);
        }
    }

    async function handleStopRecurring(statusId) {
        setActionError(null);
        try {
            await api.post(`/statuses/${statusId}/stop-recurring`);
            await fetchStatuses();
        } catch (err) {
            setActionError(err.message);
        }
    }

    async function handleConfirm() {
        const { statusId, action } = confirmDialog;
        setConfirmDialog({ ...confirmDialog, show: false });

        if (action === 'delete') {
            try {
                await api.delete(`/statuses/${statusId}`);
                await fetchStatuses();
            } catch (err) {
                setActionError(err.message);
            }
        }
    }

    function handleCancel() {
        setConfirmDialog({ ...confirmDialog, show: false });
    }

    const totalPages = Math.ceil(total / PAGE_SIZE);

    if (loading && statuses.length === 0) {
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
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>Statuses</h2>
                <span className="text-muted">{total} total</span>
            </div>

            {actionError && (
                <div className="alert alert-danger alert-dismissible" role="alert">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    {actionError}
                    <button type="button" className="btn-close" onClick={() => setActionError(null)}></button>
                </div>
            )}

            <StatusTable
                statuses={statuses}
                onDelete={handleDelete}
                onPublish={handlePublish}
                onRetry={handleRetry}
                onStopRecurring={handleStopRecurring}
            />

            {/* Pagination */}
            {totalPages > 1 && (
                <nav aria-label="Status pagination">
                    <ul className="pagination justify-content-center">
                        <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                            <button className="page-link" onClick={() => setPage(page - 1)} disabled={page === 1}>
                                Previous
                            </button>
                        </li>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                            <li className={`page-item ${p === page ? 'active' : ''}`} key={p}>
                                <button className="page-link" onClick={() => setPage(p)}>
                                    {p}
                                </button>
                            </li>
                        ))}
                        <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                            <button className="page-link" onClick={() => setPage(page + 1)} disabled={page === totalPages}>
                                Next
                            </button>
                        </li>
                    </ul>
                </nav>
            )}

            {/* Confirm Dialog */}
            <ConfirmDialog
                show={confirmDialog.show}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmLabel="Delete"
                confirmVariant="danger"
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </div>
    );
}

export default StatusesPage;
