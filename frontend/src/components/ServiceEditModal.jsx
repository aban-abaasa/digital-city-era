/**
 * Service Edit Modal
 * Lets an admin fix a listed service (name, description) and manage its photos
 * without leaving the Services tab. Photo changes save the moment they are made
 * (add, remove, make cover); name and description save with the Save button.
 *
 *   service           the row from the Services tab (id, name, description, images)
 *   openPhotoPicker   open straight on the "choose or upload a photo" step, for the
 *                     one-tap camera on the service's thumbnail
 *   onChange(patch)   called with the fields that changed, so the list updates live
 */

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { FiX, FiCamera, FiTrash2, FiStar, FiPlus } from 'react-icons/fi';
import ProductPhotoSource from './ProductPhotoSource';
import { saveServiceDetails, saveServiceImages, uploadServicePhoto } from '../services/servicePhotoService';
import { useBackLayer } from '../hooks/useBackLayer';

const ServiceEditModal = ({ service, openPhotoPicker = false, onClose, onChange }) => {
  useBackLayer(true, onClose);
  const [name, setName] = useState(service.name || '');
  const [description, setDescription] = useState(service.description || '');
  const [images, setImages] = useState(Array.isArray(service.images) ? service.images.filter(Boolean) : []);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(openPhotoPicker);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !pickerOpen) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, pickerOpen]);

  const persistImages = async (next, successMessage) => {
    setPhotoBusy(true);
    try {
      await saveServiceImages(service.id, next);
      setImages(next);
      onChange?.({ images: next });
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      console.error('Error saving service photos:', error);
      toast.error('Failed to save photos');
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    const valid = files.filter((f) => f.type.startsWith('image/'));
    if (valid.length < files.length) toast.error('Only image files can be added');
    if (valid.length === 0) return;

    setPhotoBusy(true);
    try {
      const urls = [];
      for (const file of valid) urls.push(await uploadServicePhoto(service.id, file));
      const next = [...images, ...urls];
      await saveServiceImages(service.id, next);
      setImages(next);
      onChange?.({ images: next });
      toast.success(urls.length > 1 ? `✅ ${urls.length} photos added` : '✅ Photo added');
    } catch (error) {
      console.error('Error uploading service photo:', error);
      toast.error('Failed to upload photo');
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleExistingPicked = (url) => {
    setPickerOpen(false);
    if (images.includes(url)) return;
    persistImages([...images, url], '✅ Photo added');
  };

  const handleUploadNew = () => {
    setPickerOpen(false);
    fileInputRef.current?.click();
  };

  const removeImage = (url) => persistImages(images.filter((u) => u !== url), 'Photo removed');
  const makeCover = (url) => persistImages([url, ...images.filter((u) => u !== url)], '✅ Cover photo changed');

  const handleSave = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('A service needs a name');
      return;
    }
    setSaving(true);
    try {
      const details = { name: trimmedName, description: description.trim() };
      await saveServiceDetails(service.id, details);
      onChange?.(details);
      toast.success('✅ Service updated');
      onClose();
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error('Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-60 flex items-end sm:items-center justify-center z-50 sm:p-4"
        onClick={() => !photoBusy && !saving && onClose()}
      >
        <form
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${service.name}`}
          onSubmit={handleSave}
          onClick={(e) => e.stopPropagation()}
          className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">Edit service</h3>
            <button type="button" onClick={onClose} aria-label="Close" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
              <FiX className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Photos</label>
                <span className="text-[11px] text-gray-400">First photo is the cover customers see</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {images.map((url, index) => (
                  <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100 group">
                    <img src={url} alt={`${service.name} photo ${index + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    {index === 0 && (
                      <span className="absolute left-1 top-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">Cover</span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1">
                      {index > 0 ? (
                        <button
                          type="button"
                          onClick={() => makeCover(url)}
                          disabled={photoBusy}
                          title="Make cover photo"
                          aria-label="Make cover photo"
                          className="rounded-full bg-white/90 p-1 text-amber-500 hover:bg-white disabled:opacity-50"
                        >
                          <FiStar className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span />
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(url)}
                        disabled={photoBusy}
                        title="Remove photo"
                        aria-label="Remove photo"
                        className="rounded-full bg-white/90 p-1 text-red-500 hover:bg-white disabled:opacity-50"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  disabled={photoBusy}
                  className="aspect-square rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 text-blue-600 hover:bg-blue-100 flex flex-col items-center justify-center gap-1 text-xs font-semibold disabled:opacity-60"
                >
                  {photoBusy ? (
                    <span className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  ) : images.length === 0 ? (
                    <FiCamera className="h-5 w-5" />
                  ) : (
                    <FiPlus className="h-5 w-5" />
                  )}
                  {photoBusy ? 'Saving…' : 'Add photo'}
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
            </div>

            <div>
              <label htmlFor="service-edit-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                id="service-edit-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label htmlFor="service-edit-description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                id="service-edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="What's included, how long it takes, anything customers should know"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="flex gap-2 border-t border-gray-200 p-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={saving || photoBusy}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>

      {pickerOpen && (
        <ProductPhotoSource
          initialQuery={name}
          onClose={() => setPickerOpen(false)}
          onSelect={handleExistingPicked}
          onUploadNew={handleUploadNew}
        />
      )}
    </>
  );
};

export default ServiceEditModal;
