function DashboardCards({ counts }) {
    const cards = [
        { label: 'Scheduled', count: counts.scheduled, color: 'primary', icon: 'bi-clock' },
        { label: 'Posted', count: counts.posted, color: 'success', icon: 'bi-check-circle' },
        { label: 'Failed', count: counts.failed, color: 'danger', icon: 'bi-x-circle' }
    ];

    return (
        <div className="row g-3 mb-4">
            {cards.map((card) => (
                <div className="col-md-4" key={card.label}>
                    <div className={`card border-${card.color}`}>
                        <div className="card-body d-flex align-items-center">
                            <i className={`bi ${card.icon} fs-1 me-3 text-${card.color}`}></i>
                            <div>
                                <h5 className="card-title mb-0">{card.count}</h5>
                                <p className="card-text text-muted mb-0">{card.label}</p>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default DashboardCards;
