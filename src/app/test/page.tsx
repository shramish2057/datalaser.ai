export default function TestPage() {
  return (
    <div className="bg-mb-bg-light min-h-screen p-8 font-sans">
      <div className="max-w-2xl space-y-6">
        <h1 className="text-mb-3xl font-black text-mb-text-dark">DataLaser</h1>
        <p className="text-mb-text-medium text-mb-base">Metabase theme test</p>

        <div className="flex gap-3">
          <button className="mb-btn-primary">Primary</button>
          <button className="mb-btn-secondary">Secondary</button>
          <button className="mb-btn-subtle">Subtle</button>
        </div>

        <input className="mb-input" placeholder="Type something..." />

        <div className="mb-card p-4">
          <p className="mb-section-header mb-3">Section Header</p>
          <p className="text-mb-text-dark text-mb-base">Card content here</p>
        </div>

        <div className="flex gap-2">
          <span className="mb-badge-success">Active</span>
          <span className="mb-badge-error">Error</span>
          <span className="mb-badge-info">Syncing</span>
          <span className="mb-badge-neutral">Paused</span>
        </div>

        <table className="mb-table">
          <thead><tr><th>Source</th><th>Type</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>Production DB</td><td>PostgreSQL</td><td><span className="mb-badge-success">Active</span></td></tr>
            <tr><td>Analytics</td><td>BigQuery</td><td><span className="mb-badge-info">Syncing</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
