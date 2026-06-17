import { Link } from 'react-router-dom';

function NotFoundPage() {
    return (
        <div className="text-center mt-5">
            <h2 className="display-4">404</h2>
            <p className="lead">Page not found</p>
            <p className="text-muted">The page you are looking for does not exist.</p>
            <Link to="/" className="btn btn-primary">
                Back to Dashboard
            </Link>
        </div>
    );
}

export default NotFoundPage;
