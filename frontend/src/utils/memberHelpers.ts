export const formatDate = (dateString?: string) => {
  if (! dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-800';
    case 'INACTIVE':
      return 'bg-red-100 text-red-800';
    case 'VISITOR':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getMinistryColor = (ministry?: string) => {
  switch (ministry) {
    case 'FOJ':
      return 'bg-teal-100 text-teal-800';
    case 'ARK':
      return 'bg-blue-100 text-blue-800';
    case 'VINEYARD':
      return 'bg-purple-100 text-purple-800';
    case 'PILGRIMS':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};