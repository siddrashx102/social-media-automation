import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StatusForm from '../components/StatusForm';
import api from '../services/api';

function CreateStatusPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isEdit) {
            fetchStatus();
        }
    }, [id]);

    async function fetchStatus() {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get(`/statuses/${id}`);
            setStatus(response.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    function handleSuccess() {
        navigate('/statuses');
    }

    if (isEdit && loading) {
        return (
            <div className="d-flex justify-content-center mt-5">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    if (isEdit && error) {
        return (
            <div className="alert alert-danger" role="alert">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {error}
            </div>
        );
    }

    return (
        <div>
            <h2 className="mb-4">
                {isEdit ? 'Edit Status' : 'Create Status'}
            </h2>

            <div className="card">
                <div className="card-body">
                    <StatusForm
                        existingStatus={isEdit ? status : null}
                        onSuccess={handleSuccess}
                    />
                </div>
            </div>
        </div>
    );
}

export default CreateStatusPage;
