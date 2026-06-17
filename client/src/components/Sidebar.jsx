import { NavLink } from 'react-router-dom';

const navItems = [
    { path: '/', label: 'Dashboard', icon: 'bi-speedometer2' },
    { path: '/create', label: 'Create Status', icon: 'bi-plus-circle' },
    { path: '/statuses', label: 'Statuses', icon: 'bi-collection' },
    { path: '/logs', label: 'Activity Logs', icon: 'bi-journal-text' },
    { path: '/settings', label: 'Settings', icon: 'bi-gear' }
];

function Sidebar() {
    return (
        <div className="d-flex flex-column flex-shrink-0 p-3 bg-light sidebar" style={{ width: '250px', minHeight: '100vh', position: 'fixed', top: '56px', left: 0, overflowY: 'auto' }}>
            <ul className="nav nav-pills flex-column mb-auto">
                {navItems.map((item) => (
                    <li className="nav-item" key={item.path}>
                        <NavLink
                            to={item.path}
                            end={item.path === '/'}
                            className={({ isActive }) =>
                                `nav-link ${isActive ? 'active' : 'text-dark'}`
                            }
                        >
                            <i className={`bi ${item.icon} me-2`}></i>
                            {item.label}
                        </NavLink>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default Sidebar;
