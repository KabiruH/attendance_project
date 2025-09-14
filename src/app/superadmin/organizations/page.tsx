// app/superadmin/organizations/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Users, BookOpen, MapPin, ExternalLink, Eye, Plus, X, Edit } from 'lucide-react';
import OrganizationForm from '../../../components/superadmin/OrganizationForm';

interface Organization {
  live_db_url: string;
  organization_type: string;
  id: number;
  name: string;
  slug: string;
  domain?: string;
  subdomain?: string;
  logo_url?: string;
  center_latitude?: number;
  center_longitude?: number;
  max_distance_meters?: number;
  geofencing_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  _count: {
    users: number;
    classes: number;
  };
}

interface OrganizationSubmitData {
  name: string;
  slug: string;
  domain?: string;
  subdomain?: string;
  logo_url?: string;
  live_db_url?: string;
  center_latitude?: number;
  center_longitude?: number;
  max_distance_meters?: number;
  geofencing_enabled?: boolean;
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showActualDbUrl, setShowActualDbUrl] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setError(null);
      const response = await fetch('/api/superAdmin/organizations');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: Organization[] = await response.json();
      const clientOrganizations = data.filter(org => org.organization_type === 'client');
      setOrganizations(clientOrganizations);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  };

  const maskDatabaseUrl = (url: string): string => {
    if (!url || url.length === 0) return '';
    if (url.length <= 10) return url; // Don't mask very short URLs

    const firstTwo = url.substring(0, 2);
    const lastTwo = url.substring(url.length - 2);
    const maskedMiddle = '*'.repeat(Math.min(url.length - 4, 20)); // Limit asterisks to 20

    return `${firstTwo}${maskedMiddle}${lastTwo}`;
  };

  const handleCreateOrganization = async (orgData: OrganizationSubmitData) => {
    try {
      const response = await fetch('/api/superAdmin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orgData)
      });

      if (response.ok) {
        setShowForm(false);
        await fetchOrganizations();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.message || 'Failed to create organization'}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleUpdateOrganization = async (orgData: OrganizationSubmitData) => {
    if (!editingOrg) return;

    try {
      const response = await fetch(`/api/superAdmin/organizations/${editingOrg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orgData)
      });

      if (response.ok) {
        setEditingOrg(null);
        await fetchOrganizations();
        // If we're viewing the organization details, update the selected org too
        if (selectedOrg && selectedOrg.id === editingOrg.id) {
          const updatedOrgs = organizations.find(org => org.id === editingOrg.id);
          if (updatedOrgs) {
            setSelectedOrg(updatedOrgs);
          }
        }
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.message || 'Failed to update organization'}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Error: ${errorMessage}`);
    }
  };

  const getLoginUrl = (org: Organization) => {
    if (org.domain) {
      return `https://${org.domain}/login`;
    } else if (org.subdomain) {
      return `https://${org.subdomain}.yourplatform.com/login`;
    }
    return `/login?org=${org.slug}`;
  };

  const handleBackToDashboard = () => {
    window.location.href = '/superadmin';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading organizations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="container mx-auto">
          <button
            onClick={handleBackToDashboard}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>

          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-red-800 font-semibold text-lg">Error Loading Organizations</h2>
            <p className="text-red-600 mt-2">{error}</p>
            <button
              onClick={fetchOrganizations}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Detailed view modal
  if (selectedOrg) {
    // If we're editing this organization, show the edit form instead
    if (editingOrg && editingOrg.id === selectedOrg.id) {
      return (
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="container mx-auto max-w-4xl">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setEditingOrg(null)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
              >
                <ArrowLeft size={20} />
                Back to Details
              </button>

              <button
                onClick={handleBackToDashboard}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft size={18} />
                Dashboard
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Edit Organization: {selectedOrg.name}</h2>
                <button
                  onClick={() => setEditingOrg(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
              <OrganizationForm
                onSubmit={handleUpdateOrganization}
                initialData={{
                  name: selectedOrg.name,
                  slug: selectedOrg.slug,
                  domain: selectedOrg.domain || '',
                  subdomain: selectedOrg.subdomain || '',
                  logo_url: selectedOrg.logo_url || '',
                  live_db_url: selectedOrg.live_db_url || '',
                  center_latitude: selectedOrg.center_latitude || '',
                  center_longitude: selectedOrg.center_longitude || '',
                  max_distance_meters: selectedOrg.max_distance_meters || 50,
                  geofencing_enabled: selectedOrg.geofencing_enabled
                }}
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setSelectedOrg(null)}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <ArrowLeft size={20} />
              Back to Organizations
            </button>

            <button
              onClick={handleBackToDashboard}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft size={18} />
              Dashboard
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-start gap-6 mb-8">
              {selectedOrg.logo_url ? (
                <img
                  src={selectedOrg.logo_url}
                  alt={`${selectedOrg.name} logo`}
                  className="w-20 h-20 rounded-lg object-cover border"
                />
              ) : (
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-2xl">
                    {selectedOrg.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">{selectedOrg.name}</h1>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${selectedOrg.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                    }`}>
                    {selectedOrg.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <p className="text-gray-600 mb-4">Organization ID: {selectedOrg.slug}</p>

                <div className="flex gap-3">
                  <button
                    onClick={() => window.open(getLoginUrl(selectedOrg), '_blank')}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <ExternalLink size={18} />
                    Login to {selectedOrg.name}
                  </button>

                  <button
                    onClick={() => setEditingOrg(selectedOrg)}
                    className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
                  >
                    <Edit size={18} />
                    Edit Organization
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="text-blue-600" size={24} />
                  <h3 className="font-semibold text-gray-900">Users</h3>
                </div>
                <p className="text-2xl font-bold text-blue-600">{selectedOrg._count.users}</p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <BookOpen className="text-green-600" size={24} />
                  <h3 className="font-semibold text-gray-900">Classes</h3>
                </div>
                <p className="text-2xl font-bold text-green-600">{selectedOrg._count.classes}</p>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <MapPin className="text-purple-600" size={24} />
                  <h3 className="font-semibold text-gray-900">Geofencing</h3>
                </div>
                <p className="text-sm font-medium text-purple-600">
                  {selectedOrg.geofencing_enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Organization Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Domain</label>
                      <p className="mt-1 text-gray-900">{selectedOrg.domain || 'Not set'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Subdomain</label>
                      <p className="mt-1 text-gray-900">{selectedOrg.subdomain || 'Not set'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Live Database URL</label>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-gray-900 font-mono text-xs break-all flex-1">
                          {maskDatabaseUrl(selectedOrg.live_db_url)}
                        </p>
                      
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Created</label>
                      <p className="mt-1 text-gray-900">{new Date(selectedOrg.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Created By</label>
                      <p className="mt-1 text-gray-900">{selectedOrg.created_by}</p>
                    </div>
                  </div>
                </div>
              </div>

              {selectedOrg.geofencing_enabled && selectedOrg.center_latitude && selectedOrg.center_longitude && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">Location Settings</h2>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Center Coordinates</p>
                        <p className="font-mono text-sm">
                          {Number(selectedOrg.center_latitude).toFixed(6)}, {Number(selectedOrg.center_longitude).toFixed(6)}
                        </p>
                        {selectedOrg.max_distance_meters && (
                          <p className="text-sm text-gray-600 mt-1">
                            Radius: {selectedOrg.max_distance_meters} meters
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => window.open(
                          `https://www.google.com/maps/@${selectedOrg.center_latitude},${selectedOrg.center_longitude},17z`,
                          '_blank'
                        )}
                        className="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 transition-colors flex items-center gap-2"
                      >
                        <MapPin size={16} />
                        View on Map
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="container mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToDashboard}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
            >
              <ArrowLeft size={20} />
              Dashboard
            </button>
            <div className="w-px h-6 bg-gray-300"></div>
            <h1 className="text-3xl font-bold text-gray-900">Organizations</h1>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 shadow-lg"
          >
            {showForm ? <X size={20} /> : <Plus size={20} />}
            {showForm ? 'Cancel' : 'Add Organization'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-6">Create New Organization</h2>
            <OrganizationForm onSubmit={handleCreateOrganization} />
          </div>
        )}

        {editingOrg && !selectedOrg && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Edit Organization: {editingOrg.name}</h2>
              <button
                onClick={() => setEditingOrg(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            <OrganizationForm
              onSubmit={handleUpdateOrganization}
              initialData={{
                name: editingOrg.name,
                slug: editingOrg.slug,
                domain: editingOrg.domain || '',
                subdomain: editingOrg.subdomain || '',
                logo_url: editingOrg.logo_url || '',
                live_db_url: editingOrg.live_db_url || '',
                center_latitude: editingOrg.center_latitude || '',
                center_longitude: editingOrg.center_longitude || '',
                max_distance_meters: editingOrg.max_distance_meters || 50,
                geofencing_enabled: editingOrg.geofencing_enabled
              }}
            />
          </div>
        )}

        {organizations.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-white rounded-xl shadow-lg p-12">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <BookOpen size={32} className="text-gray-400" />
              </div>
              <p className="text-gray-500 text-xl font-medium">No organizations found</p>
              <p className="text-gray-400 mt-2">Create your first organization to get started</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group overflow-hidden"
                onClick={() => setSelectedOrg(org)}
              >
                <div className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    {org.logo_url ? (
                      <img
                        src={org.logo_url}
                        alt={`${org.name} logo`}
                        className="w-12 h-12 rounded-lg object-cover border"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold">
                          {org.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}

                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
                        {org.name}
                      </h3>
                      <p className="text-gray-500 text-sm">{org.slug}</p>
                    </div>

                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${org.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                      }`}>
                      {org.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-1">
                      <Users size={16} />
                      <span>{org._count.users} users</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BookOpen size={16} />
                      <span>{org._count.classes} classes</span>
                    </div>
                  </div>

                  {org.geofencing_enabled && (
                    <div className="flex items-center gap-2 text-xs text-blue-600 mb-4">
                      <MapPin size={14} />
                      <span>Geofencing enabled</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(getLoginUrl(org), '_blank');
                      }}
                      className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={14} />
                      Login
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingOrg(org);
                      }}
                      className="bg-orange-100 text-orange-700 py-2 px-3 rounded-lg hover:bg-orange-200 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Edit size={14} />
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrg(org);
                      }}
                      className="bg-gray-100 text-gray-700 py-2 px-3 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Eye size={14} />
                      View
                    </button>
                  </div>
                </div>

                <div className="h-1 bg-gradient-to-r from-blue-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}