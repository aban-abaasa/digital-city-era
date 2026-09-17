import React, { useEffect, useState } from 'react';
import { FiTrash2, FiArrowUp, FiArrowDown, FiPlus, FiX, FiEdit2, FiCheck } from 'react-icons/fi';
import {
  getBookableServices,
  listBookingForms,
  createBookingForm,
  renameBookingForm,
  getServiceForm,
  getFormServiceLinks,
  attachServiceToForm,
  detachServiceFromForm,
  getBookingFormFields,
  saveBookingFormField,
  deleteBookingFormField,
  slugifyFieldKey,
} from '../../services/bookingService';

const INPUT_CLASS = 'bg-white text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg';

const FIELD_TYPES = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'select', label: 'Dropdown (choose one)' },
  { value: 'multiselect', label: 'Multiple choice (choose many)' },
  { value: 'checkbox', label: 'Yes/No' },
  { value: 'file', label: 'File upload (image/PDF)' },
];

const OPTIONS_TYPES = ['select', 'multiselect'];

const emptyDraft = { id: null, fieldKey: null, label: '', fieldType: 'text', options: '', isRequired: false };

// Lets the admin build a small custom intake form per bookable service —
// e.g. a salon adds "Preferred stylist?" (dropdown) and a required "ID
// photo" (file upload). A form is a reusable, named thing (not tied to one
// product): once built for "Haircut", the admin can attach the exact same
// form to "Hair colouring" too instead of re-typing every question, rename
// it, and edit any question's label/type/options in place — every service
// using that form sees the update immediately. Those questions then show up
// in BookServiceModal/DynamicBookingFields for the customer, and the
// answers (plus any uploaded files) ride along with the booking. Same
// service-picker pattern as BookingsPanel's AvailabilityTab, kept
// deliberately separate from it since availability and the intake form are
// unrelated admin concerns for the same service.
const BookingFormEditor = ({ supermarketId, focusServiceId }) => {
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [allForms, setAllForms] = useState([]);
  const [form, setForm] = useState(null);
  const [fields, setFields] = useState([]);
  const [linkedServices, setLinkedServices] = useState([]);
  const [newFormName, setNewFormName] = useState('');
  const [attachFormId, setAttachFormId] = useState('');
  const [addServiceId, setAddServiceId] = useState('');
  const [draft, setDraft] = useState(emptyDraft);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (supermarketId) {
      getBookableServices(supermarketId).then(setServices);
      listBookingForms(supermarketId).then(setAllForms);
    }
  }, [supermarketId]);

  useEffect(() => {
    if (focusServiceId && services.length) {
      const svc = services.find((s) => s.id === focusServiceId);
      if (svc) setSelectedService(svc);
    }
  }, [focusServiceId, services]);

  const reloadFormState = async (productId) => {
    const f = await getServiceForm(productId);
    setForm(f);
    if (f) {
      const [fieldRows, linked] = await Promise.all([getBookingFormFields(f.id), getFormServiceLinks(f.id)]);
      setFields(fieldRows);
      setLinkedServices(linked);
    } else {
      setFields([]);
      setLinkedServices([]);
    }
  };

  useEffect(() => {
    setError('');
    setDraft(emptyDraft);
    setEditingName(false);
    if (selectedService) reloadFormState(selectedService.id);
  }, [selectedService]);

  const refreshAllForms = () => listBookingForms(supermarketId).then(setAllForms);

  const handleCreateForm = async () => {
    if (!selectedService || !newFormName.trim()) return;
    setSaving(true);
    setError('');
    try {
      const created = await createBookingForm({ supermarketId, name: newFormName.trim() });
      await attachServiceToForm({ supermarketId, productId: selectedService.id, formId: created.id });
      setNewFormName('');
      await refreshAllForms();
      await reloadFormState(selectedService.id);
    } catch (err) {
      setError(err.message || 'Could not create that form');
    } finally {
      setSaving(false);
    }
  };

  const handleAttachExisting = async () => {
    if (!selectedService || !attachFormId) return;
    setSaving(true);
    setError('');
    try {
      await attachServiceToForm({ supermarketId, productId: selectedService.id, formId: attachFormId });
      setAttachFormId('');
      await reloadFormState(selectedService.id);
    } catch (err) {
      setError(err.message || 'Could not attach that form');
    } finally {
      setSaving(false);
    }
  };

  const handleDetachCurrent = async () => {
    if (!selectedService) return;
    await detachServiceFromForm(selectedService.id);
    reloadFormState(selectedService.id);
  };

  const startRenaming = () => {
    setNameDraft(form.name);
    setEditingName(true);
  };

  const handleSaveName = async () => {
    if (!form || !nameDraft.trim()) return;
    setSaving(true);
    try {
      await renameBookingForm(form.id, nameDraft.trim());
      setEditingName(false);
      await refreshAllForms();
      await reloadFormState(selectedService.id);
    } catch (err) {
      setError(err.message || 'Could not rename that form');
    } finally {
      setSaving(false);
    }
  };

  const handleAddServiceToForm = async () => {
    if (!form || !addServiceId) return;
    setSaving(true);
    try {
      await attachServiceToForm({ supermarketId, productId: addServiceId, formId: form.id });
      setAddServiceId('');
      reloadFormState(selectedService.id);
    } catch (err) {
      setError(err.message || 'Could not add that service');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLinkedService = async (productId) => {
    await detachServiceFromForm(productId);
    reloadFormState(selectedService.id);
  };

  const uniqueKeyFor = (label) => {
    const base = slugifyFieldKey(label);
    let key = base;
    let n = 2;
    while (fields.some((f) => f.field_key === key && f.id !== draft.id)) {
      key = `${base}_${n++}`;
    }
    return key;
  };

  const startEditingField = (f) => {
    setDraft({
      id: f.id,
      fieldKey: f.field_key,
      label: f.label,
      fieldType: f.field_type,
      options: (f.options || []).join(', '),
      isRequired: f.is_required,
    });
  };

  const handleSaveField = async () => {
    if (!form || !draft.label.trim()) return;
    setSaving(true);
    setError('');
    try {
      const isEditing = !!draft.id;
      const existing = isEditing ? fields.find((f) => f.id === draft.id) : null;
      await saveBookingFormField({
        id: draft.id || undefined,
        supermarketId,
        formId: form.id,
        label: draft.label.trim(),
        // A field being edited keeps its original key so past bookings'
        // form_responses stay attributable to it; only a brand-new field
        // gets a freshly slugified one.
        fieldKey: isEditing ? draft.fieldKey : uniqueKeyFor(draft.label.trim()),
        fieldType: draft.fieldType,
        options: OPTIONS_TYPES.includes(draft.fieldType)
          ? draft.options.split(',').map((o) => o.trim()).filter(Boolean)
          : undefined,
        isRequired: draft.isRequired,
        sortOrder: existing ? existing.sort_order : fields.length,
      });
      setDraft(emptyDraft);
      reloadFormState(selectedService.id);
    } catch (err) {
      setError(err.message || 'Could not save that question');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteField = async (id) => {
    await deleteBookingFormField(id);
    if (draft.id === id) setDraft(emptyDraft);
    reloadFormState(selectedService.id);
  };

  const handleToggleRequired = async (field) => {
    await saveBookingFormField({
      id: field.id,
      supermarketId,
      formId: field.form_id,
      label: field.label,
      fieldKey: field.field_key,
      fieldType: field.field_type,
      options: field.options,
      isRequired: !field.is_required,
      sortOrder: field.sort_order,
    });
    reloadFormState(selectedService.id);
  };

  const handleMoveField = async (index, direction) => {
    const otherIndex = index + direction;
    if (otherIndex < 0 || otherIndex >= fields.length) return;
    const a = fields[index];
    const b = fields[otherIndex];
    await Promise.all([
      saveBookingFormField({ id: a.id, supermarketId, formId: a.form_id, label: a.label, fieldKey: a.field_key, fieldType: a.field_type, options: a.options, isRequired: a.is_required, sortOrder: b.sort_order }),
      saveBookingFormField({ id: b.id, supermarketId, formId: b.form_id, label: b.label, fieldKey: b.field_key, fieldType: b.field_type, options: b.options, isRequired: b.is_required, sortOrder: a.sort_order }),
    ]);
    reloadFormState(selectedService.id);
  };

  if (services.length === 0) {
    return (
      <p className="text-sm text-gray-400 p-4">
        No bookable services yet — mark a "service_item" product as bookable in Inventory first.
      </p>
    );
  }

  const linkedIds = new Set(linkedServices.map((s) => s.id));
  const addableServices = services.filter((s) => !linkedIds.has(s.id));
  const isEditingField = !!draft.id;

  return (
    <div className="space-y-4">
      <select
        value={selectedService?.id || ''}
        onChange={(e) => setSelectedService(services.find((s) => s.id === e.target.value) || null)}
        className={`w-full sm:w-auto text-sm px-3 py-2 ${INPUT_CLASS}`}
      >
        <option value="">Select a service…</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>

      {selectedService && !form && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">
            "{selectedService.name}" doesn't have a booking form yet — customers just give their name/phone/notes.
          </p>
          <div className="rounded-xl border border-gray-100 p-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Create a new form</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={newFormName}
                onChange={(e) => setNewFormName(e.target.value)}
                placeholder="e.g. Salon intake"
                className={`flex-1 min-w-[160px] text-sm px-3 py-1.5 ${INPUT_CLASS}`}
              />
              <button onClick={handleCreateForm} disabled={saving || !newFormName.trim()} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-50">
                Create
              </button>
            </div>
          </div>
          {allForms.length > 0 && (
            <div className="rounded-xl border border-gray-100 p-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Or reuse an existing form</p>
              <div className="flex flex-wrap items-center gap-2">
                <select value={attachFormId} onChange={(e) => setAttachFormId(e.target.value)} className={`text-sm px-2 py-1.5 ${INPUT_CLASS}`}>
                  <option value="">Select a form…</option>
                  {allForms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <button onClick={handleAttachExisting} disabled={saving || !attachFormId} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-50">
                  Attach
                </button>
              </div>
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}

      {selectedService && form && (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  autoFocus
                  className={`text-sm px-2 py-1 ${INPUT_CLASS}`}
                />
                <button onClick={handleSaveName} disabled={saving || !nameDraft.trim()} className="text-emerald-600 hover:text-emerald-700">
                  <FiCheck className="h-4 w-4" />
                </button>
                <button onClick={() => setEditingName(false)} className="text-gray-400 hover:text-gray-600">
                  <FiX className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-700 flex items-center gap-1.5">
                Using form <span className="font-semibold">{form.name}</span>
                <button onClick={startRenaming} className="text-gray-400 hover:text-blue-600" title="Rename this form">
                  <FiEdit2 className="h-3.5 w-3.5" />
                </button>
              </p>
            )}
            <button onClick={handleDetachCurrent} className="text-xs text-red-500 hover:underline">
              Remove form from this service
            </button>
          </div>
          <p className="text-xs text-gray-400">
            These questions show up when a customer books any service using this form, in addition to their
            name/phone. Mark a question required to block booking until it's answered.
          </p>

          <div className="space-y-1">
            {fields.length === 0 && (
              <p className="text-xs text-gray-400">No custom questions yet.</p>
            )}
            {fields.map((f, i) => (
              <div key={f.id} className={`flex items-center justify-between gap-2 text-sm rounded-lg px-3 py-2 ${draft.id === f.id ? 'bg-blue-50 ring-1 ring-blue-200' : 'bg-gray-50'}`}>
                <div className="min-w-0">
                  <span className="font-medium text-gray-700">{f.label}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    {FIELD_TYPES.find((t) => t.value === f.field_type)?.label}
                    {OPTIONS_TYPES.includes(f.field_type) && f.options?.length ? ` (${f.options.join(', ')})` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    <input type="checkbox" checked={!!f.is_required} onChange={() => handleToggleRequired(f)} />
                    Required
                  </label>
                  <button onClick={() => handleMoveField(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                    <FiArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleMoveField(i, 1)} disabled={i === fields.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                    <FiArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => startEditingField(f)} className="text-gray-400 hover:text-blue-600">
                    <FiEdit2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDeleteField(f.id)} className="text-red-400 hover:text-red-600">
                    <FiTrash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-gray-100 p-3">
            <p className="text-sm font-medium text-gray-700 mb-2">{isEditingField ? 'Edit question' : 'Add a question'}</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={draft.label}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                placeholder="e.g. Preferred stylist?"
                className={`flex-1 min-w-[160px] text-sm px-3 py-1.5 ${INPUT_CLASS}`}
              />
              <select
                value={draft.fieldType}
                onChange={(e) => setDraft((d) => ({ ...d, fieldType: e.target.value }))}
                className={`text-sm px-2 py-1.5 ${INPUT_CLASS}`}
              >
                {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {OPTIONS_TYPES.includes(draft.fieldType) && (
                <input
                  value={draft.options}
                  onChange={(e) => setDraft((d) => ({ ...d, options: e.target.value }))}
                  placeholder="Options, comma-separated"
                  className={`flex-1 min-w-[160px] text-sm px-3 py-1.5 ${INPUT_CLASS}`}
                />
              )}
              <label className="flex items-center gap-1 text-xs text-gray-600">
                <input type="checkbox" checked={draft.isRequired} onChange={(e) => setDraft((d) => ({ ...d, isRequired: e.target.checked }))} />
                Required
              </label>
              <button
                onClick={handleSaveField}
                disabled={saving || !draft.label.trim()}
                className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-50"
              >
                {isEditingField ? <FiCheck className="h-3.5 w-3.5" /> : <FiPlus className="h-3.5 w-3.5" />}
                {isEditingField ? 'Save' : 'Add'}
              </button>
              {isEditingField && (
                <button onClick={() => setDraft(emptyDraft)} className="text-xs text-gray-500 hover:underline">
                  Cancel
                </button>
              )}
            </div>
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          </div>

          <div className="rounded-xl border border-gray-100 p-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Also used by</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {linkedServices.map((s) => (
                <span key={s.id} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-1">
                  {s.name}
                  <button onClick={() => handleRemoveLinkedService(s.id)} className="text-blue-400 hover:text-red-500">
                    <FiX className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {linkedServices.length === 0 && <span className="text-xs text-gray-400">No services yet.</span>}
            </div>
            {addableServices.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <select value={addServiceId} onChange={(e) => setAddServiceId(e.target.value)} className={`text-sm px-2 py-1.5 ${INPUT_CLASS}`}>
                  <option value="">Add another service to this form…</option>
                  {addableServices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button onClick={handleAddServiceToForm} disabled={saving || !addServiceId} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-50">
                  Add
                </button>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">
              A service already using a different form will switch to this one if added here.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default BookingFormEditor;
