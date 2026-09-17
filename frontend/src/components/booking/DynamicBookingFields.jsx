import React, { useState } from 'react';
import { FiPaperclip, FiCheck, FiX } from 'react-icons/fi';
import { uploadBookingAttachment } from '../../services/bookingService';

const INPUT_CLASS = 'w-full text-sm bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg px-3 py-2';

// Renders whatever custom questions the admin has attached to this service
// (via its booking form) and reports answers back as { field_key: value }.
// A 'file' answer is the uploaded attachment's public URL once upload
// finishes; a 'multiselect' answer is an array of the chosen option
// strings. Used by BookServiceModal — separate from the fixed
// name/phone/notes inputs there, which every booking always collects
// regardless of the service.
//
// Every input explicitly sets bg-white/text-gray-900 rather than relying on
// browser defaults — the app's global `color-scheme: dark` (see index.css)
// otherwise renders unstyled inputs/selects with a dark UA background even
// inside this light modal.
const DynamicBookingFields = ({ fields, values, onChange, productId }) => {
  const [uploading, setUploading] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});

  if (!fields || fields.length === 0) return null;

  const setValue = (key, value) => onChange({ ...values, [key]: value });

  const toggleMultiselect = (key, option) => {
    const current = Array.isArray(values[key]) ? values[key] : [];
    const next = current.includes(option) ? current.filter((o) => o !== option) : [...current, option];
    setValue(key, next);
  };

  const handleFilePick = async (fieldKey, file) => {
    if (!file) return;
    setUploadErrors((e) => ({ ...e, [fieldKey]: '' }));
    setUploading((u) => ({ ...u, [fieldKey]: true }));
    try {
      const url = await uploadBookingAttachment(productId, file);
      setValue(fieldKey, url);
    } catch (err) {
      setUploadErrors((e) => ({ ...e, [fieldKey]: err.message || 'Upload failed' }));
    } finally {
      setUploading((u) => ({ ...u, [fieldKey]: false }));
    }
  };

  return (
    <div className="space-y-2">
      {fields.map((f) => {
        const val = values[f.field_key] ?? '';
        const label = `${f.label}${f.is_required ? ' *' : ''}`;

        if (f.field_type === 'checkbox') {
          return (
            <label key={f.id} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={val === true || val === 'true'}
                onChange={(e) => setValue(f.field_key, e.target.checked)}
              />
              {label}
            </label>
          );
        }

        if (f.field_type === 'multiselect') {
          const selected = Array.isArray(values[f.field_key]) ? values[f.field_key] : [];
          return (
            <div key={f.id} className="space-y-1.5">
              <p className="text-sm text-gray-700">{label}</p>
              <div className="flex flex-wrap gap-1.5">
                {(f.options || []).map((opt) => {
                  const active = selected.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleMultiselect(f.field_key, opt)}
                      className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                        active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }

        if (f.field_type === 'select') {
          return (
            <select
              key={f.id}
              value={val}
              onChange={(e) => setValue(f.field_key, e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">{label}</option>
              {(f.options || []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          );
        }

        if (f.field_type === 'textarea') {
          return (
            <textarea
              key={f.id}
              value={val}
              onChange={(e) => setValue(f.field_key, e.target.value)}
              placeholder={label}
              rows={2}
              className={INPUT_CLASS}
            />
          );
        }

        if (f.field_type === 'file') {
          const isUploading = !!uploading[f.field_key];
          return (
            <div key={f.id} className="space-y-1">
              <label className={`flex items-center gap-2 text-sm border rounded-lg px-3 py-2 cursor-pointer ${
                val ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-300 bg-white text-gray-500'
              }`}>
                {val ? <FiCheck className="h-4 w-4 shrink-0" /> : <FiPaperclip className="h-4 w-4 shrink-0" />}
                <span className="truncate flex-1">
                  {isUploading ? 'Uploading…' : val ? `${f.label} — attached` : label}
                </span>
                {val && !isUploading && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setValue(f.field_key, ''); }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <FiX className="h-4 w-4" />
                  </button>
                )}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  disabled={isUploading}
                  onChange={(e) => handleFilePick(f.field_key, e.target.files?.[0])}
                  className="hidden"
                />
              </label>
              {uploadErrors[f.field_key] && <p className="text-xs text-red-500">{uploadErrors[f.field_key]}</p>}
            </div>
          );
        }

        const inputType = { number: 'number', date: 'date', phone: 'tel', email: 'email' }[f.field_type] || 'text';
        return (
          <input
            key={f.id}
            type={inputType}
            value={val}
            onChange={(e) => setValue(f.field_key, e.target.value)}
            placeholder={label}
            className={INPUT_CLASS}
          />
        );
      })}
    </div>
  );
};

// A required field is "answered" once it has a non-blank value — a
// standalone checker so BookServiceModal can block submission the same way
// the RPC re-checks it server-side. For a 'file' field this also blocks
// submission while the upload is still in flight (no value yet); for
// 'multiselect' it requires at least one option chosen.
export const findMissingRequiredField = (fields, values) =>
  (fields || []).find((f) => {
    if (!f.is_required) return false;
    const v = values[f.field_key];
    if (f.field_type === 'checkbox') return v !== true && v !== 'true';
    if (f.field_type === 'multiselect') return !Array.isArray(v) || v.length === 0;
    return v === undefined || v === null || String(v).trim() === '';
  });

export default DynamicBookingFields;
