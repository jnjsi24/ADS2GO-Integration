// pages/USERS/CreateAdvertisement.tsx
import React, { useState, useEffect } from 'react';

const CreateAdvertisement: React.FC = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    vehicleType: '',
    materialsUsed: '',
    adFormat: '',
    plan: '',
    media: null as File | null,
    status: 'PENDING',
  });

  const [materialsOptions, setMaterialsOptions] = useState<string[]>([]);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);

  const vehicleOptions = ['Car', 'Motorcycle', 'Electric Tricycle'];
  const planOptions = ['Weekly', 'Monthly'];

  const materialOptionsMap: Record<string, string[]> = {
    Car: ['LCD Screen', 'Stickers', 'Posters'],
    Motorcycle: ['Posters'],
    'Electric Tricycle': ['Posters'],
  };

  const priceMap: Record<string, Record<string, Record<string, number>>> = {
    Car: {
      'LCD Screen': { Weekly: 1000, Monthly: 3500 },
      Stickers: { Weekly: 500, Monthly: 1500 },
      Posters: { Weekly: 400, Monthly: 1200 },
    },
    Motorcycle: {
      Posters: { Weekly: 200, Monthly: 600 },
    },
    'Electric Tricycle': {
      Posters: { Weekly: 250, Monthly: 750 },
    },
  };

  useEffect(() => {
    if (formData.vehicleType) {
      setMaterialsOptions(materialOptionsMap[formData.vehicleType]);
      setFormData((prev) => ({ ...prev, materialsUsed: '' }));
    }
  }, [formData.vehicleType]);

  useEffect(() => {
    const { vehicleType, materialsUsed, plan } = formData;
    const price = priceMap[vehicleType]?.[materialsUsed]?.[plan] ?? null;
    setEstimatedPrice(price);
  }, [formData.vehicleType, formData.materialsUsed, formData.plan]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, files } = e.target as HTMLInputElement;
    if (name === 'media' && files) {
      setFormData((prev) => ({ ...prev, media: files[0] }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Advertisement created (mocked)!');
    console.log('Form Data:', formData);
    console.log('Total Price:', estimatedPrice);
  };

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6 border rounded-lg shadow-lg bg-white">
      <h1 className="text-2xl font-bold mb-6">Create Advertisement</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          name="title"
          placeholder="Title"
          value={formData.title}
          onChange={handleChange}
          className="w-full border p-2"
          required
        />

        <textarea
          name="description"
          placeholder="Description"
          value={formData.description}
          onChange={handleChange}
          className="w-full border p-2"
          required
        />

        <select
          name="vehicleType"
          value={formData.vehicleType}
          onChange={handleChange}
          className="w-full border p-2"
          required
        >
          <option value="">Select Vehicle Type</option>
          {vehicleOptions.map((vehicle) => (
            <option key={vehicle} value={vehicle}>{vehicle}</option>
          ))}
        </select>

        <select
          name="materialsUsed"
          value={formData.materialsUsed}
          onChange={handleChange}
          className="w-full border p-2"
          required
          disabled={!formData.vehicleType}
        >
          <option value="">Select Material</option>
          {materialsOptions.map((material) => (
            <option key={material} value={material}>{material}</option>
          ))}
        </select>

        <select
          name="plan"
          value={formData.plan}
          onChange={handleChange}
          className="w-full border p-2"
          required
        >
          <option value="">Select Plan</option>
          {planOptions.map((plan) => (
            <option key={plan} value={plan}>{plan}</option>
          ))}
        </select>

        {formData.vehicleType && formData.materialsUsed && formData.plan && (
          <div className="text-green-700 font-semibold">
            {estimatedPrice !== null
              ? `Total Price: ₱${estimatedPrice.toLocaleString()}`
              : <span className="text-red-600">Price unavailable for selected options</span>}
          </div>
        )}

        <select
          name="adFormat"
          value={formData.adFormat}
          onChange={handleChange}
          className="w-full border p-2"
          required
        >
          <option value="">Select Format</option>
          <option value="JPG">JPG</option>
          <option value="PNG">PNG</option>
          <option value="SVG">SVG</option>
          <option value="MP4">MP4</option>
        </select>

        <input
          type="file"
          name="media"
          accept="image/*,video/*"
          onChange={handleChange}
          className="w-full border p-2"
          required
        />

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Create
        </button>
      </form>
    </div>
  );
};

export default CreateAdvertisement;
