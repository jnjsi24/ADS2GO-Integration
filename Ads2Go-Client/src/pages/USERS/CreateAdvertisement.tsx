  mediaFile?: string;
  price: number;
  status: string;
  createdAt: string;
  adType: 'DIGITAL' | 'NON_DIGITAL';
  planId: {
    _id: string;
    name: string;
    durationDays: number;
    price: number;
  };
  materialId: {
    _id: string;
    name: string;
  };
};

const Advertisements: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [planFilter, setPlanFilter] = useState('All Plans');

  const { data, loading, error } = useQuery(GET_MY_ADS);
  const ads: Ad[] = data?.getMyAds || [];

  const filteredAds = ads.filter((ad) => {
    const matchesSearch =
      ad.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ad.id.toString().includes(searchTerm);

    const matchesStatus =
      statusFilter === 'All Status' || ad.status === statusFilter;

    const matchesPlan =
      planFilter === 'All Plans' || ad.planId?.name === planFilter;

    return matchesSearch && matchesStatus && matchesPlan;
  });

  if (loading) return <div className="pl-60 pt-10">Loading ads...</div>;
  if (error) return <div className="pl-60 pt-10 text-red-600">Error: {error.message}</div>;

  return (
    <div className="flex-1 pl-60 pb-6 bg-white">
      <div className="bg-white p-6 shadow flex justify-between items-center">
        <div className="relative w-96">
          <input
            type="text"
            placeholder="Search Ads"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-gray-500 w-full rounded-md p-2 pl-10 focus:outline-none"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
      </div>

      <div className="bg-white p-6 flex justify-between items-center">
        <h1 className="text-3xl font-semibold">My Advertisements</h1>
        <div className="space-x-4 flex items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-gray-300 rounded-md p-2 focus:outline-none"
          >
            <option value="All Status">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="RUNNING">Running</option>
            <option value="ENDED">Ended</option>
          </select>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="bg-white border border-gray-300 rounded-md p-2 focus:outline-none"
          >
            <option value="All Plans">All Plans</option>
            <option value="Monthly">Monthly</option>
            <option value="Weekly">Weekly</option>
          </select>
          <button
            onClick={() => navigate('/create-advertisement')}
            className="bg-[#251f70] text-white px-4 py-2 rounded hover:bg-[#1b1853] transition-all"
          >
            + Create Ad
          </button>
        </div>
      </div>

      <div className="bg-white p-6 grid grid-cols-4 gap-6">
        {filteredAds.length > 0 ? (
          filteredAds.map((ad) => (
            <div
              key={ad.id}
              className="rounded-xl shadow-lg overflow-hidden cursor-pointer relative flex flex-col h-full hover:scale-105 transition-all duration-300"
            >
              <div className="w-full h-48 flex-shrink-0 relative">
                {ad.adFormat === 'MP4' && ad.mediaFile ? (
                  <video
                    src={`/uploads/${ad.mediaFile}`}
                    className="w-full h-full object-cover"
                    controls
                  />
                ) : ad.mediaFile ? (
                  <img
                    src={`/uploads/${ad.mediaFile}`}
                    alt={ad.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-500 flex items-center justify-center text-white">
                    No Media
                  </div>
                )}
              </div>
              <div className="p-4 bg-gray-100 flex-grow flex flex-col">
                <h3 className="text-xl font-semibold">{ad.title}</h3>
                <p className="text-gray-600 text-sm">{ad.description}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Material: {ad.materialId?.name || 'N/A'}
                </p>
                <div className="mt-auto pt-4">
                  <p className="text-sm text-gray-500">
                    Plan: {ad.planId?.name || 'N/A'} ({ad.planId?.durationDays} days)
                  </p>
                  <p className="text-sm text-gray-500">
                    ₱{ad.price.toLocaleString()}
                  </p>
                </div>
              </div>
              <span
                className={`absolute top-2 left-2 px-2 py-1 text-xs font-bold rounded ${
                  ad.status === 'PENDING'
                    ? 'bg-yellow-200 text-yellow-800'
                    : ad.status === 'APPROVED'
                    ? 'bg-blue-200 text-blue-800'
                    : ad.status === 'REJECTED'
                    ? 'bg-red-200 text-red-800'
                    : ad.status === 'RUNNING'
                    ? 'bg-green-200 text-green-800'
                    : ad.status === 'ENDED'
                    ? 'bg-gray-400 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                {ad.status}
              </span>
            </div>
          ))
        ) : (
          <div className="col-span-4 text-center text-gray-500">
            No advertisements found.
          </div>
        )}
      </div>
    </div>
  );
};

export default Advertisements;
