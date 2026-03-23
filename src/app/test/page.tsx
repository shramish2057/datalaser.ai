export default function TestPage() {
  return (
    <div className="bg-dl-bg-light min-h-screen p-8 font-sans">
      <div className="max-w-2xl space-y-6">
        <h1 className="text-dl-3xl font-black text-dl-text-dark">DataLaser</h1>
        <p className="text-dl-text-medium text-dl-base">Metabase theme test</p>

        <div className="flex gap-3">
          <button className="dl-btn-primary">Primary</button>
          <button className="dl-btn-secondary">Secondary</button>
          <button className="dl-btn-subtle">Subtle</button>
        </div>

        <input className="dl-input" placeholder="Type something..." />

        <div className="dl-card p-4">
          <p className="dl-section-header mb-3">Section Header</p>
          <p className="text-dl-text-dark text-dl-base">Card content here</p>
        </div>

        <div className="flex gap-2">
          <span className="dl-badge-success">Active</span>
          <span className="dl-badge-error">Error</span>
          <span className="dl-badge-info">Syncing</span>
          <span className="dl-badge-neutral">Paused</span>
        </div>

        <table className="dl-table">
          <thead><tr><th>Source</th><th>Type</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>Production DB</td><td>PostgreSQL</td><td><span className="dl-badge-success">Active</span></td></tr>
            <tr><td>Analytics</td><td>BigQuery</td><td><span className="dl-badge-info">Syncing</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
