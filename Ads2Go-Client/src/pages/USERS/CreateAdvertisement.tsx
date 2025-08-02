import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CreateAdvertisement: React.FC = () => {
  const navigate = useNavigate();
  const [category, setCategory] = useState('');
  const [materialType, setMaterialType] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [plan, setPlan] = useState('');
  const [price, setPrice] = useState<number | null>(null);
  const [adFile, setAdFile] = useState<File | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [agreed, setAgreed] = useState(false);

  const digitalMaterials = ['Headrest', 'LCD'];
  const nonDigitalMaterials = ['Sticker', 'Banner'];
  const allVehicleOptions = ['Car', 'Motorcycle', 'E-bike', 'Bus', 'Jeep'];
  const plans = [
    { name: 'Weekly', price: 500 },
    { name: 'Monthly', price: 1800 },
  ];

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategory(e.target.value);
    setMaterialType('');
    setVehicleType('');
  };

  const handleMaterialChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMaterialType(e.target.value);
    setVehicleType('');
  };

  const handlePlanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = plans.find(p => p.name === e.target.value);
    setPlan(selected?.name || '');
    setPrice(selected?.price || null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAdFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      alert('You must agree to the terms.');
      return;
    }
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('category', category);
    formData.append('materialType', materialType);
    formData.append('vehicleType', vehicleType);
    formData.append('startDate', startDate);
    formData.append('endDate', endDate);
    formData.append('qrUrl', qrUrl);
    formData.append('plan', plan);
    formData.append('price', String(price));
    if (adFile) formData.append('adFile', adFile);

    console.log('Submitting ad:', Object.fromEntries(formData));
    alert('Ad submitted successfully!');
    navigate('/advertisements');
  };

  const getVehicleOptions = () => {
    if (materialType === 'headrest') {
      return ['Car', 'Bus'];
    } else if (materialType === 'sticker') {
      return ['Car', 'E-bike', 'Bus', 'Jeep'];
    } else if (materialType === 'lcd') {
      return ['Car', 'Motorcycle', 'E-bike', 'Jeep'];
    }
    return allVehicleOptions;
  };

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-4">Create Advertisement</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Category</label>
          <select value={category} onChange={handleCategoryChange} required className="w-full p-2 border rounded">
            <option value="">-- Select Category --</option>
            <option value="digital">Digital</option>
            <option value="non-digital">Non-Digital</option>
          </select>
        </div>

        {category && (
          <div>
            <label className="block mb-1">Material Type</label>
            <select value={materialType} onChange={handleMaterialChange} required className="w-full p-2 border rounded">
              <option value="">-- Select Material Type --</option>
              {(category === 'digital' ? digitalMaterials : nonDigitalMaterials).map(type => (
                <option key={type} value={type.toLowerCase()}>{type}</option>
              ))}
            </select>
          </div>
        )}

        {materialType && (
          <div>
            <label className="block mb-1">Vehicle Type</label>
            <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} required className="w-full p-2 border rounded">
              <option value="">-- Select Vehicle --</option>
              {getVehicleOptions().map(v => (
                <option key={v} value={v.toLowerCase()}>{v}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block mb-1">Ad Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full p-2 border rounded" />
        </div>

        <div>
          <label className="block mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} required className="w-full p-2 border rounded" />
        </div>

        <div>
          <label className="block mb-1">Plan</label>
          <select value={plan} onChange={handlePlanChange} required className="w-full p-2 border rounded">
            <option value="">-- Select Plan --</option>
            {plans.map(p => (
              <option key={p.name} value={p.name}>{p.name} - ₱{p.price}</option>
            ))}
          </select>
        </div>

        {price !== null && (
          <div>
            <label className="block mb-1">Price</label>
            <input type="text" value={`₱${price}`} readOnly className="w-full p-2 border bg-gray-100 rounded" />
          </div>
        )}

        <div>
          <label className="block mb-1">Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-full p-2 border rounded" />
        </div>

        <div>
          <label className="block mb-1">End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-full p-2 border rounded" />
        </div>

        <div>
          <label className="block mb-1">QR URL (optional)</label>
          <input type="url" value={qrUrl} onChange={(e) => setQrUrl(e.target.value)} className="w-full p-2 border rounded" />
        </div>

        <div>
          <label className="block mb-1">Ad File Upload</label>
          <input type="file" accept={category === 'digital' ? 'image/*,video/*' : 'image/*,application/pdf'} onChange={handleFileChange} required className="w-full" />
        </div>

        <div className="flex items-center space-x-2">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <label>I agree to the terms and conditions.</label>
        </div>

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Submit Advertisement
        </button>
      </form>
    </div>
  );
};

export default CreateAdvertisement;
