// components/superadmin/OrganizationForm.tsx
'use client';

import { useState, FormEvent, ChangeEvent } from 'react';

interface OrganizationFormData {
  name: string;
  slug: string;
  domain: string;
  subdomain: string;
  logo_url: string;
  live_db_url: string;
  center_latitude: string | number;
  center_longitude: string | number;
  max_distance_meters: number;
  geofencing_enabled: boolean;
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

interface OrganizationFormProps {
  onSubmit: (data: OrganizationSubmitData) => Promise<void>;
  initialData?: Partial<OrganizationFormData> | null;
}

export default function OrganizationForm({ onSubmit, initialData = null }: OrganizationFormProps) {
  const [formData, setFormData] = useState<OrganizationFormData>({
    name: initialData?.name || '',
    slug: initialData?.slug || '',
    domain: initialData?.domain || '',
    subdomain: initialData?.subdomain || '',
    logo_url: initialData?.logo_url || '',
    live_db_url: initialData?.live_db_url || '',
    center_latitude: initialData?.center_latitude || '',
    center_longitude: initialData?.center_longitude || '',
    max_distance_meters: initialData?.max_distance_meters || 50,
    geofencing_enabled: initialData?.geofencing_enabled || false
  });

  const [loading, setLoading] = useState(false);
  const [showActualDbUrl, setShowActualDbUrl] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create properly typed submit data
      const submitData: OrganizationSubmitData = {
        name: formData.name,
        slug: formData.slug,
        ...(formData.domain && { domain: formData.domain }),
        ...(formData.subdomain && { subdomain: formData.subdomain }),
        ...(formData.logo_url && { logo_url: formData.logo_url }),
        ...(formData.live_db_url && { live_db_url: formData.live_db_url }), 
        ...(formData.center_latitude && {
          center_latitude: typeof formData.center_latitude === 'string'
            ? parseFloat(formData.center_latitude)
            : formData.center_latitude
        }),
        ...(formData.center_longitude && {
          center_longitude: typeof formData.center_longitude === 'string'
            ? parseFloat(formData.center_longitude)
            : formData.center_longitude
        }),
        max_distance_meters: formData.max_distance_meters,
        geofencing_enabled: formData.geofencing_enabled,
      };

      await onSubmit(submitData);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: formData.slug || generateSlug(name)
    });
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData({
          ...formData,
          center_latitude: position.coords.latitude.toFixed(8),
          center_longitude: position.coords.longitude.toFixed(8)
        });
      },
      (error) => {
        alert('Failed to get current location: ' + error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  };

  const openGoogleMaps = () => {
    const lat = formData.center_latitude;
    const lng = formData.center_longitude;
    if (lat && lng) {
      window.open(`https://www.google.com/maps/@${lat},${lng},17z`, '_blank');
    } else {
      window.open('https://www.google.com/maps', '_blank');
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

  const handleInputChange = (field: keyof OrganizationFormData) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      setFormData({ ...formData, [field]: value });
    };

  const handleNumberInputChange = (field: keyof OrganizationFormData) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value === '' ? '' : Number(e.target.value);
      setFormData({ ...formData, [field]: value });
    };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="bg-white p-4 rounded border">
        <h3 className="text-lg font-semibold mb-4">Basic Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Organization Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Slug * (URL identifier)
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={handleInputChange('slug')}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              pattern="^[a-z0-9-]+$"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Will be used as: {formData.slug}.yourapp.com
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Custom Domain (optional)
            </label>
            <input
              type="text"
              value={formData.domain}
              onChange={handleInputChange('domain')}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="school.edu"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Subdomain (optional)
            </label>
            <input
              type="text"
              value={formData.subdomain}
              onChange={handleInputChange('subdomain')}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Will default to slug if empty"
            />
          </div>

          <div className="md:col-span-2">
  <label className="block text-sm font-medium mb-1">
    Live Database URL (optional)
  </label>
  <div className="relative">
    <input
      type={showActualDbUrl ? "text" : "password"}
      value={showActualDbUrl ? formData.live_db_url : maskDatabaseUrl(formData.live_db_url)}
      onChange={handleInputChange('live_db_url')}
      className="w-full border rounded px-3 py-2 pr-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="postgresql://username:password@host:port/database"
    />
    <button
      type="button"
      onClick={() => setShowActualDbUrl(!showActualDbUrl)}
      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-blue-600 hover:text-blue-800"
    >
      {showActualDbUrl ? 'Hide' : 'Show'}
    </button>
  </div>
  <p className="text-xs text-gray-500 mt-1">
    Database connection string for this organization's live environment
  </p>
</div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">
              Logo URL (optional)
            </label>
            <input
              type="url"
              value={formData.logo_url}
              onChange={handleInputChange('logo_url')}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Geofencing Configuration */}
      <div className="bg-blue-50 p-4 rounded border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Geofencing Configuration</h3>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.geofencing_enabled}
              onChange={handleInputChange('geofencing_enabled')}
              className="mr-2"
            />
            <span className="text-sm font-medium">Enable Geofencing</span>
          </label>
        </div>

        {formData.geofencing_enabled && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Center Latitude *
                </label>
                <input
                  type="number"
                  step="0.00000001"
                  min="-90"
                  max="90"
                  value={formData.center_latitude}
                  onChange={handleInputChange('center_latitude')}
                  className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="-1.2921"
                  required={formData.geofencing_enabled}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Center Longitude *
                </label>
                <input
                  type="number"
                  step="0.00000001"
                  min="-180"
                  max="180"
                  value={formData.center_longitude}
                  onChange={handleInputChange('center_longitude')}
                  className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="36.8219"
                  required={formData.geofencing_enabled}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Max Distance (meters)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={formData.max_distance_meters}
                  onChange={handleNumberInputChange('max_distance_meters')}
                  className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum allowed distance from center point
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={getCurrentLocation}
                className="bg-green-500 text-white px-3 py-2 rounded hover:bg-green-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Use Current Location
              </button>

              <button
                type="button"
                onClick={openGoogleMaps}
                className="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                View on Google Maps
              </button>
            </div>

            {formData.center_latitude && formData.center_longitude && (
              <div className="bg-white p-3 rounded border">
                <p className="text-sm">
                  <strong>Center Point:</strong> {formData.center_latitude}, {formData.center_longitude}
                </p>
                <p className="text-sm text-gray-600">
                  Users must be within {formData.max_distance_meters}m of this location
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-500 text-white px-6 py-3 rounded hover:bg-blue-600 disabled:opacity-50 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {loading ? 'Saving...' : (initialData ? 'Update' : 'Create')} Organization
      </button>
    </form>
  );
}