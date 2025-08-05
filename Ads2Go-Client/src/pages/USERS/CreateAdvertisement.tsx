import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { CREATE_AD } from '../../graphql/mutations/createAd';

const CreateAdvertisement: React.FC = () => {
  const navigate = useNavigate();
  const [createAd] = useMutation(CREATE_AD);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    vehicleType: '',
    materialsUsed: '',
    adFormat: 'JPG',
    plan: 'Weekly',
    media: null as File | null,
    status: 'PENDING',
  });

  const [materialsOptions, setMaterialsOptions] = useState<string[]>([]);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setMaterialsOptions(materialOptionsMap[formData.vehicleType] || []);
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
      const file = files[0];
      const isValid = file.type.startsWith('image/') || file.type.startsWith('video/');
      if (!isValid) {
        setError('Only image or video files are allowed.');
        return;
      }
      setFormData((prev) => ({ ...prev, media: file }));
      setError(null);
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!formData.media) {
        setError('Please select a media file.');
        return;
      }

      const uploadData = new FormData();
      uploadData.append('file', formData.media);

      const uploadRes = await fetch('http://localhost:5000/upload', {
        method: 'POST',
        body: uploadData,
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload media file.');
      }

      const uploadResult = await uploadRes.json();
      if (!uploadResult.filename) {
        throw new Error('Upload succeeded but no filename returned.');
      }

      const mediaFilename = uploadResult.filename;

      await createAd({
        variables: {
          input: {
            ...formData,
            mediaFile: mediaFilename,
            price: estimatedPrice,
          },
        },
      });

      navigate('/advertisements');
    } catch (err: any) {
      setError(err.message || 'An error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-2 pt-20 pl-36 rounded-lg">
      <h1 className="text-3xl font-bold text-center mb-10">Create Advertisement</h1>
      {error && <div className="text-red-600 mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">

        <input
          type="text"
          name="title"
          placeholder="Title"
          value={formData.title}
          onChange={handleChange}
          className="w-full border border-gray-300 rounded-lg p-2"
          required
        />

        <textarea
          name="description"
          placeholder="Description"
          value={formData.description}
          onChange={handleChange}
          className="w-full border border-gray-300 rounded-lg p-2"
          required
        />

        <select
          name="vehicleType"
          value={formData.vehicleType}
          onChange={handleChange}
          className="w-full border border-gray-300 rounded-lg p-2"
          required
        >
          <option value="">Select Vehicle Type</option>
          {vehicleOptions.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <select
          name="materialsUsed"
          value={formData.materialsUsed}
          onChange={handleChange}
          className="w-full border border-gray-300 rounded-lg p-2"
          required
          disabled={!formData.vehicleType}
        >
          <option value="">Select Material</option>
          {materialsOptions.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <select
          name="plan"
          value={formData.plan}
          onChange={handleChange}
          className="w-full border border-gray-300 rounded-lg p-2"
          required
        >
          <option value="">Select Plan</option>
          {planOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
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
          className="w-full border border-gray-300 rounded-lg p-2"
          required
        >
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
          className="w-full border border-gray-300 rounded-lg p-2"
          required
        />

        <div className="flex justify-between pt-4">
          <Link to="/advertisements">
            <button
              type="button"
              className="text-black px-4 py-2 rounded hover:bg-gray-100"
            >
              Back
            </button>
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateAdvertisement;
