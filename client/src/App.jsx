import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import CreateStatusPage from './pages/CreateStatusPage';
import StatusesPage from './pages/StatusesPage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
    return (
        <div>
            <Navbar />
            <div className="d-flex" style={{ marginTop: '56px' }}>
                <Sidebar />
                <main className="flex-grow-1 p-4" style={{ marginLeft: '250px' }}>
                    <Routes>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/create" element={<CreateStatusPage />} />
                        <Route path="/statuses" element={<StatusesPage />} />
                        <Route path="/statuses/:id/edit" element={<CreateStatusPage />} />
                        <Route path="/logs" element={<ActivityLogsPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
}

export default App;
