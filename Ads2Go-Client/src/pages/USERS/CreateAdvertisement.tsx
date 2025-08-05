import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useLazyQuery } from '@apollo/client';
import { CREATE_AD } from '../../graphql/mutations/createAd';
import { GET_AVAILABLE_VEHICLE_TYPES } from '../../graphql/queries/getVehicleTypes';
import { GET_FILTERED_ADS_PLANS } from '../../graphql/queries/getFilteredPlans';

const CreateAdvertisement: React.FC = () => {
  const navigate = useNavigate();
  const [createAd] = useMutation(CREATE_AD);
  const { data: vehicleData, error: vehicleError } = useQuery(GET_AVAILABLE_VEHICLE_TYPES);
  const [getPlans, { data: plansData }] = useLazyQuery(GET_FILTERED_ADS_PLANS);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    adType: '',
    vehicleType: '',
    materialId: '',
    planId: '',
    adFormat: 'JPG',
    media: null as File | null,
    startTime: '',
  });

  const [materialsOptions, setMaterialsOptions] = useState<{ name: string; id: string }[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<string[]>([]);
  const [planOptions, setPlanOptions] = useState<any[]>([]);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const adTypeOptions = ['Digital', 'Non-Digital'];

  const materialOptionsMap: Record<string, { name: string; id: string }[]> = {
    Car: [ { name: 'LCD Screen', id: 'lcd1' }, { name: 'Stickers', id: 'stick1' } ],
    Motorcycle: [ { name: 'Posters', id: 'post1' } ],
    Bus: [ { name: 'LCD Screen', id: 'lcd2' } ],
    Tricycle: [ { name: 'Posters', id: 'post2' } ],
    Van: [ { name: 'Stickers', id: 'stick2' } ],
    Truck: [ { name: 'Stickers', id: 'stick3' } ],
    Bicycle: [ { name: 'Posters', id: 'post3' } ],
  };

  const adTypeVehicleMap: Record<string, string[]> = {
    DIGITAL: ['Car', 'Bus'],
    NON_DIGITAL: ['Motorcycle', 'Tricycle', 'Van', 'Truck', 'Bicycle'],
  };

  const allVehicleTypes: string[] = (vehicleData?.getAvailableVehicleTypes || []).map(
    (v: string) => v.charAt(0).toUpperCase() + v.slice(1)
  );

  useEffect(() => {
    if (formData.adType) {
      const type = formData.adType.toUpperCase().replace('-', '_');
      const allowed = adTypeVehicleMap[type] || [];
      const filtered = allVehicleTypes.filter((v) => allowed.includes(v));

      setFilteredVehicles((prev) => {
        const isSame = prev.length === filtered.length && prev.every((v) => filtered.includes(v));
        return isSame ? prev : filtered;
      });

      if (formData.vehicleType || formData.materialId || formData.planId) {
        setFormData((prev) => ({ ...prev, vehicleType: '', materialId: '', planId: '' }));
      }

      setMaterialsOptions([]);
      setPlanOptions([]);
    }
  }, [formData.adType, allVehicleTypes]);

  useEffect(() => {
    if (formData.vehicleType) {
      const options = materialOptionsMap[formData.vehicleType] || [];
      setMaterialsOptions(options);

      if (formData.materialId || formData.planId) {
        setFormData((prev) => ({ ...prev, materialId: '', planId: '' }));
      }
    }
  }, [formData.vehicleType]);

  useEffect(() => {
    if (formData.vehicleType && formData.adType && formData.materialId) {
      const vehicleType = formData.vehicleType;
      const adType = formData.adType.toUpperCase().replace('-', '_');
      const materialType = materialsOptions.find((m) => m.id === formData.materialId)?.name;

      if (materialType) {
        getPlans({ variables: { category: adType, materialType, vehicleType } });
      }
    }
  }, [formData.vehicleType, formData.adType, formData.materialId]);

  useEffect(() => {
    if (plansData?.getAdsPlansByFilter) {
      setPlanOptions(plansData.getAdsPlansByFilter);
    }
  }, [plansData]);

  useEffect(() => {
    const selectedPlan = planOptions.find((p) => p._id === formData.planId);
    setEstimatedPrice(selectedPlan?.price || null);
  }, [formData.planId, planOptions]);

  const handleChange = (e: React.ChangeEvent<any>) => {
    const { name, value, files } = e.target;
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
      if (!formData.media) throw new Error('Please select a media file.');
      if (!formData.startTime) throw new Error('Please select a start date.');

      const uploadData = new FormData();
      uploadData.append('file', formData.media);

      const res = await fetch('http://localhost:5000/upload', {
        method: 'POST',
        body: uploadData,
      });

      if (!res.ok) throw new Error('Failed to upload media.');
      const { filename } = await res.json();

      await createAd({
        variables: {
          input: {
            title: formData.title,
            description: formData.description,
            adType: formData.adType.toUpperCase().replace('-', '_'),
            adFormat: formData.adFormat,
            mediaFile: filename,
            materialId: formData.materialId,
            planId: formData.planId,
            price: estimatedPrice,
            startTime: formData.startTime,
          },
        },
      });

      navigate('/advertisements');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-2 pt-20 pl-36 rounded-lg">
      <h1 className="text-3xl font-bold text-center mb-10">Create Advertisement</h1>
      {error && <div className="text-red-600 mb-4">{error}</div>}
      {vehicleError && <div className="text-red-600 mb-4">{vehicleError.message}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="Title" className="w-full border p-2 rounded-lg" required />
        <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Description" className="w-full border p-2 rounded-lg" required />

        <select name="adType" value={formData.adType} onChange={handleChange} className="w-full border p-2 rounded-lg" required>
          <option value="">Select Ad Type</option>
          {adTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <select name="vehicleType" value={formData.vehicleType} onChange={handleChange} className="w-full border p-2 rounded-lg" required>
          <option value="">Select Vehicle Type</option>
          {filteredVehicles.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>

        <select name="materialId" value={formData.materialId} onChange={handleChange} className="w-full border p-2 rounded-lg" required>
          <option value="">Select Material</option>
          {materialsOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        <select name="planId" value={formData.planId} onChange={handleChange} className="w-full border p-2 rounded-lg" required>
          <option value="">Select Plan</option>
          {planOptions.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name} - ₱{p.price.toLocaleString()} for {p.durationDays} day(s)
            </option>
          ))}
        </select>

        {estimatedPrice && (
          <div className="text-green-700 font-semibold">
            Estimated Price: ₱{estimatedPrice.toLocaleString()}
          </div>
        )}

        <input type="date" name="startTime" value={formData.startTime} onChange={handleChange} className="w-full border p-2 rounded-lg" required />

        <select name="adFormat" value={formData.adFormat} onChange={handleChange} className="w-full border p-2 rounded-lg" required>
          <option value="JPG">JPG</option>
          <option value="PNG">PNG</option>
          <option value="SVG">SVG</option>
          <option value="MP4">MP4</option>
        </select>

        <input type="file" name="media" accept="image/*,video/*" onChange={handleChange} className="w-full border p-2 rounded-lg" required />

        <div className="flex justify-between pt-4">
          <Link to="/advertisements">
            <button type="button" className="text-black px-4 py-2 rounded hover:bg-gray-100">Back</button>
          </Link>
          <button type="submit" disabled={isSubmitting} className="px-6 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow disabled:opacity-50">
            {isSubmitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateAdvertisement;
