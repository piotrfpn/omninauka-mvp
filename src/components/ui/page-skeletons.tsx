import { Skeleton } from "./skeleton"

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-12 w-32 rounded-xl" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="omni-card p-4 lg:p-6 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-5 h-5 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="omni-card p-4 lg:p-6 space-y-3">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Recent Sessions List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <Skeleton className="w-1.5 h-1.5 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="omni-card p-4 md:p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3 md:gap-4 flex-1">
                      <Skeleton className="w-11 h-11 md:w-10 md:h-10 rounded-xl md:rounded-lg" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                    <Skeleton className="w-5 h-5 ml-3" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function HistorySkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="omni-card p-4 space-y-3">
            <Skeleton className="w-5 h-5" />
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Explorer Header */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-full max-w-md" />
        <div className="flex flex-col md:flex-row gap-4 p-4 omni-card">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 w-full md:w-48 rounded-xl" />
        </div>
      </div>

      {/* Folders Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="omni-card p-6 flex flex-col items-center gap-3">
            <Skeleton className="w-10 h-8 rounded" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>

      {/* Sessions List */}
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-5 w-32 ml-1" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="omni-card p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-xl" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-6 w-12 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AnalysisSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-3 flex-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-8 w-1/2" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="w-24 h-24 lg:w-48 lg:h-48 rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <Skeleton className="w-10 h-10 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="omni-card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="w-5 h-5" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>

      {/* Key Concepts */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="omni-card p-5 flex gap-3">
              <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="omni-card p-6 space-y-4">
              <Skeleton className="w-14 h-14 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
