import { useState, useEffect } from 'react';
import api from '../services/api';
import ActivityLogTable from '../components/ActivityLogTable';

const PAGE_SIZE = 50;

function ActivityLogsPage() {
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchLogs();
    }, [page]);

    async function fetchLogs() {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get(`/logs?page=${page}&pageSize=${PAGE_SIZE}`);
            setLogs(response.data.logs);
            setTotal(response.data.total);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    const totalPages = Math.ceil(total / PAGE_SIZE);

    if (loading && logs.length === 0) {
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
                <h2>Activity Logs</h2>
                <span className="text-muted">{total} total entries</span>
            </div>

            <ActivityLogTable logs={logs} />

            {/* Pagination */}
            {totalPages > 1 && (
                <nav aria-label="Activity log pagination">
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
        </div>
    );
}

export default ActivityLogsPage;
