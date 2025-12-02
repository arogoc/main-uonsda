interface MemberFiltersProps {
  filters: {
    search: string;
    ministry: string;
    membershipStatus: string;
    yearGroup: string;
  };
  onFilterChange: (name: string, value: string) => void;
  onClearFilters: () => void;
  memberCount: number;
  viewMode: 'grid' | 'table';
  onViewModeChange: (mode: 'grid' | 'table') => void;
}

export default function MemberFilters({
  filters,
  onFilterChange,
  onClearFilters,
  memberCount,
  viewMode,
  onViewModeChange
}: MemberFiltersProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Search */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by name, email, course..."
              value={filters.search}
              onChange={(e) => onFilterChange('search', e. target.value)}
              className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Ministry Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ministry
          </label>
          <select
            value={filters.ministry}
            onChange={(e) => onFilterChange('ministry', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
          >
            <option value="">All Ministries</option>
            <option value="FOJ">Friends of Jesus</option>
            <option value="ARK">Ark</option>
            <option value="VINEYARD">Vineyard</option>
            <option value="PILGRIMS">Pilgrims</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            value={filters.membershipStatus}
            onChange={(e) => onFilterChange('membershipStatus', e.target. value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="VISITOR">Visitor</option>
          </select>
        </div>

        {/* Year Group Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Year Group
          </label>
          <select
            value={filters.yearGroup}
            onChange={(e) => onFilterChange('yearGroup', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
          >
            <option value="">All Years</option>
            <option value="Year 1">Year 1</option>
            <option value="Year 2">Year 2</option>
            <option value="Year 3">Year 3</option>
            <option value="Year 4">Year 4</option>
            <option value="Year 5">Year 5</option>
            <option value="Graduate">Graduate</option>
            <option value="Postgraduate">Postgraduate</option>
          </select>
        </div>
      </div>

      {/* Filter Actions */}
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={onClearFilters}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear Filters
        </button>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            Showing {memberCount} member{memberCount !== 1 ? 's' : ''}
          </span>
          
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => onViewModeChange('table')}
              className={`px-3 py-1 rounded ${
                viewMode === 'table'
                  ? 'bg-white text-teal-600 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => onViewModeChange('grid')}
              className={`px-3 py-1 rounded ${
                viewMode === 'grid'
                  ?  'bg-white text-teal-600 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}