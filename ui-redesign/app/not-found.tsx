export default function NotFound() {
  return (
    <div className="h-screen flex items-center justify-center bg-bg-app">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
        <p className="text-text-secondary">Could not find requested resource</p>
      </div>
    </div>
  )
}
