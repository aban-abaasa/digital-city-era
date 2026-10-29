import { supabase } from './supabase';
import { compressImageFile } from '../utils/imageCompression';

// Same shared bucket the product photos use (AddProductModal, inventory quick photo).
const SERVICE_PHOTO_BUCKET = 'product-photos';

// First photo is the cover shown on lists and on the customer's Book screen.
export const serviceCoverImage = (service) => {
  const first = Array.isArray(service?.images) ? service.images.find(Boolean) : null;
  return first || service?.image_url || null;
};

// Direct browser -> Supabase Storage upload; returns the public URL. Does not
// touch the product row — saveServiceImages does that.
export const uploadServicePhoto = async (productId, file) => {
  const compressed = await compressImageFile(file, 1280, 0.8);
  const ext = compressed.name.split('.').pop() || 'jpg';
  const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(SERVICE_PHOTO_BUCKET)
    .upload(path, compressed, { upsert: false, cacheControl: '31536000' });
  if (uploadError) throw uploadError;
  return supabase.storage.from(SERVICE_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
};

export const saveServiceImages = async (productId, images) => {
  const { error } = await supabase.from('products').update({ images }).eq('id', productId);
  if (error) throw error;
  return images;
};

export const saveServiceDetails = async (productId, { name, description }) => {
  const { error } = await supabase.from('products').update({ name, description }).eq('id', productId);
  if (error) throw error;
};
