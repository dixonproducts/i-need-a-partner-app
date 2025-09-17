import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

// Simple query client setup
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: false,
    },
  },
});

// Simple fetcher function
async function fetcher(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

function AdminSetup() {
  const [email, setEmail] = useState("Dixonproducts@yahoo.com");
  const [name, setName] = useState("Sammy Dixon");
  const [groupSize, setGroupSize] = useState(4);

  const setupAdmin = async () => {
    try {
      const response = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, groupSize }),
      });
      const result = await response.json();
      if (result.success) {
        alert("Admin setup successful!");
        window.location.reload();
      } else {
        alert("Setup failed: " + (result.error || "Unknown error"));
      }
    } catch (error) {
      alert("Setup failed: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-900">
          I Need A Partner
        </h1>
        <h2 className="text-lg font-semibold mb-4 text-gray-700">Admin Setup</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admin Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="input-admin-name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admin Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="input-admin-email"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team Size
            </label>
            <input
              type="number"
              min="2"
              max="10"
              value={groupSize}
              onChange={(e) => setGroupSize(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="input-group-size"
            />
          </div>
          
          <button
            onClick={setupAdmin}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="button-setup-admin"
          >
            Setup Administrator
          </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { data: admin, isLoading: adminLoading } = useQuery({
    queryKey: ["/api/admin/current"],
    queryFn: () => fetcher("/api/admin/current"),
  });

  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ["/api/companies"],
    queryFn: () => fetcher("/api/companies"),
  });

  const { data: users } = useQuery({
    queryKey: ["/api/users"],
    queryFn: () => fetcher("/api/users"),
  });

  const { data: partnerships } = useQuery({
    queryKey: ["/api/partnerships"],
    queryFn: () => fetcher("/api/partnerships"),
  });

  if (adminLoading || companiesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600" data-testid="loading-dashboard">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <h1 className="text-2xl font-bold text-gray-900" data-testid="text-app-title">
              I Need A Partner - Partnership Management
            </h1>
            {admin && (
              <p className="text-sm text-gray-600 mt-1" data-testid="text-admin-info">
                Administrator: {admin.name} ({admin.email})
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Users</h3>
            <p className="text-3xl font-bold text-blue-600" data-testid="text-user-count">
              {users?.length || 0}
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Active Teams</h3>
            <p className="text-3xl font-bold text-green-600" data-testid="text-team-count">
              {partnerships?.length || 0}
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Companies</h3>
            <p className="text-3xl font-bold text-purple-600" data-testid="text-company-count">
              {companies?.length || 0}
            </p>
          </div>
        </div>

        {companies && companies.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Companies</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {companies.map((company: any) => (
                <div key={company.id} className="px-6 py-4" data-testid={`row-company-${company.id}`}>
                  <h3 className="text-lg font-medium text-gray-900">{company.name}</h3>
                  <p className="text-sm text-gray-600">
                    Team Size: {company.groupSize} | Created: {new Date(company.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  const { data: admin, isLoading, error } = useQuery({
    queryKey: ["/api/admin/current"],
    queryFn: () => fetcher("/api/admin/current"),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error || !admin) {
    return <AdminSetup />;
  }

  return <Dashboard />;
}

function AppWithProvider() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

export default AppWithProvider;
