import React, { useState } from 'react';
import {
  FiUser, FiMail, FiPhone, FiBriefcase, FiMapPin,
  FiCalendar, FiFileText, FiUpload, FiCheckCircle,
  FiAlertCircle, FiCamera
} from 'react-icons/fi';
import { supabase } from '../services/supabase';
import { notificationService } from '../services/notificationService';

const EmployeeProfileSetup = ({ user, onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [profileData, setProfileData] = useState({
    fullName: user?.user_metadata?.full_name || '',
    email: user?.email || '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    city: '',
    position: '',
    department: '',
    previousExperience: '',
    educationLevel: '',
    skills: '',
    emergencyContact: '',
    emergencyPhone: '',
    idNumber: '',
    availability: 'full-time'
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateStep = (currentStep) => {
    const newErrors = {};

    if (currentStep === 1) {
      if (!profileData.fullName) newErrors.fullName = 'Full name is required';
      if (!profileData.phone) newErrors.phone = 'Phone number is required';
      if (!profileData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
      if (!profileData.gender) newErrors.gender = 'Gender is required';
    }

    if (currentStep === 2) {
      if (!profileData.address) newErrors.address = 'Address is required';
      if (!profileData.city) newErrors.city = 'City is required';
      if (!profileData.position) newErrors.position = 'Desired position is required';
      if (!profileData.department) newErrors.department = 'Department is required';
    }

    if (currentStep === 3) {
      if (!profileData.educationLevel) newErrors.educationLevel = 'Education level is required';
      if (!profileData.emergencyContact) newErrors.emergencyContact = 'Emergency contact is required';
      if (!profileData.emergencyPhone) newErrors.emergencyPhone = 'Emergency phone is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateStep(step)) return;

    setLoading(true);

    try {
      // Create employee profile pending approval
      const { error: profileError } = await supabase
        .from('users')
        .update({
          full_name: profileData.fullName,
          phone: profileData.phone,
          date_of_birth: profileData.dateOfBirth,
          gender: profileData.gender,
          address: profileData.address,
          city: profileData.city,
          department: profileData.department,
          position: profileData.position,
          education_level: profileData.educationLevel,
          skills: profileData.skills,
          previous_experience: profileData.previousExperience,
          emergency_contact: profileData.emergencyContact,
          emergency_phone: profileData.emergencyPhone,
          id_number: profileData.idNumber,
          availability: profileData.availability,
          is_active: false, // Pending admin approval
          profile_completed: true,
          submitted_at: new Date().toISOString()
        })
        .eq('auth_id', user.id);

      if (profileError) throw profileError;

      notificationService.show(
        '✅ Profile submitted successfully! Your application is pending admin approval.',
        'success',
        5000
      );

      if (onComplete) onComplete();

    } catch (error) {
      console.error('Profile submission error:', error);
      notificationService.show(
        error.message || 'Failed to submit profile',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Personal Information</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <FiUser className="inline mr-2" />
          Full Name *
        </label>
        <input
          type="text"
          name="fullName"
          value={profileData.fullName}
          onChange={handleChange}
          className={`w-full px-4 py-3 border ${errors.fullName ? 'border-red-500' : 'border-gray-300'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300`}
          placeholder="John Doe"
        />
        {errors.fullName && <p className="text-red-500 text-sm mt-1">{errors.fullName}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <FiMail className="inline mr-2" />
          Email Address
        </label>
        <input
          type="email"
          value={profileData.email}
          disabled
          className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 cursor-not-allowed"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FiPhone className="inline mr-2" />
            Phone Number *
          </label>
          <input
            type="tel"
            name="phone"
            value={profileData.phone}
            onChange={handleChange}
            className={`w-full px-4 py-3 border ${errors.phone ? 'border-red-500' : 'border-gray-300'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300`}
            placeholder="+256 700 000000"
          />
          {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FiCalendar className="inline mr-2" />
            Date of Birth *
          </label>
          <input
            type="date"
            name="dateOfBirth"
            value={profileData.dateOfBirth}
            onChange={handleChange}
            className={`w-full px-4 py-3 border ${errors.dateOfBirth ? 'border-red-500' : 'border-gray-300'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300`}
          />
          {errors.dateOfBirth && <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Gender *
        </label>
        <select
          name="gender"
          value={profileData.gender}
          onChange={handleChange}
          className={`w-full px-4 py-3 border ${errors.gender ? 'border-red-500' : 'border-gray-300'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300`}
        >
          <option value="">Select Gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
        {errors.gender && <p className="text-red-500 text-sm mt-1">{errors.gender}</p>}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Work Information</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <FiMapPin className="inline mr-2" />
          Home Address *
        </label>
        <input
          type="text"
          name="address"
          value={profileData.address}
          onChange={handleChange}
          className={`w-full px-4 py-3 border ${errors.address ? 'border-red-500' : 'border-gray-300'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300`}
          placeholder="Street address"
        />
        {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          City *
        </label>
        <input
          type="text"
          name="city"
          value={profileData.city}
          onChange={handleChange}
          className={`w-full px-4 py-3 border ${errors.city ? 'border-red-500' : 'border-gray-300'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300`}
          placeholder="Kampala"
        />
        {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <FiBriefcase className="inline mr-2" />
            Desired Position *
          </label>
          <select
            name="position"
            value={profileData.position}
            onChange={handleChange}
            className={`w-full px-4 py-3 border ${errors.position ? 'border-red-500' : 'border-gray-300'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300`}
          >
            <option value="">Select Position</option>
            <option value="cashier">Cashier</option>
            <option value="sales-associate">Sales Associate</option>
            <option value="stock-clerk">Stock Clerk</option>
            <option value="customer-service">Customer Service</option>
            <option value="shift-supervisor">Shift Supervisor</option>
            <option value="other">Other</option>
          </select>
          {errors.position && <p className="text-red-500 text-sm mt-1">{errors.position}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Department *
          </label>
          <select
            name="department"
            value={profileData.department}
            onChange={handleChange}
            className={`w-full px-4 py-3 border ${errors.department ? 'border-red-500' : 'border-gray-300'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300`}
          >
            <option value="">Select Department</option>
            <option value="sales">Sales</option>
            <option value="inventory">Inventory</option>
            <option value="customer-service">Customer Service</option>
            <option value="operations">Operations</option>
            <option value="administration">Administration</option>
          </select>
          {errors.department && <p className="text-red-500 text-sm mt-1">{errors.department}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Availability
        </label>
        <select
          name="availability"
          value={profileData.availability}
          onChange={handleChange}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300"
        >
          <option value="full-time">Full Time</option>
          <option value="part-time">Part Time</option>
          <option value="contract">Contract</option>
          <option value="flexible">Flexible</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <FiFileText className="inline mr-2" />
          Previous Experience (Optional)
        </label>
        <textarea
          name="previousExperience"
          value={profileData.previousExperience}
          onChange={handleChange}
          rows="3"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300"
          placeholder="Brief description of your previous work experience..."
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Additional Information</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Education Level *
        </label>
        <select
          name="educationLevel"
          value={profileData.educationLevel}
          onChange={handleChange}
          className={`w-full px-4 py-3 border ${errors.educationLevel ? 'border-red-500' : 'border-gray-300'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300`}
        >
          <option value="">Select Education Level</option>
          <option value="primary">Primary School</option>
          <option value="o-level">O-Level</option>
          <option value="a-level">A-Level</option>
          <option value="certificate">Certificate</option>
          <option value="diploma">Diploma</option>
          <option value="degree">Degree</option>
          <option value="masters">Masters</option>
        </select>
        {errors.educationLevel && <p className="text-red-500 text-sm mt-1">{errors.educationLevel}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Skills (Optional)
        </label>
        <textarea
          name="skills"
          value={profileData.skills}
          onChange={handleChange}
          rows="2"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300"
          placeholder="e.g., Customer service, POS systems, inventory management..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ID Number (Optional)
        </label>
        <input
          type="text"
          name="idNumber"
          value={profileData.idNumber}
          onChange={handleChange}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300"
          placeholder="National ID or Passport number"
        />
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-6">
        <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
          <FiAlertCircle className="mr-2 text-yellow-600" />
          Emergency Contact Information
        </h4>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Name *
            </label>
            <input
              type="text"
              name="emergencyContact"
              value={profileData.emergencyContact}
              onChange={handleChange}
              className={`w-full px-4 py-3 border ${errors.emergencyContact ? 'border-red-500' : 'border-gray-300'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300`}
              placeholder="Emergency contact person"
            />
            {errors.emergencyContact && <p className="text-red-500 text-sm mt-1">{errors.emergencyContact}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Phone *
            </label>
            <input
              type="tel"
              name="emergencyPhone"
              value={profileData.emergencyPhone}
              onChange={handleChange}
              className={`w-full px-4 py-3 border ${errors.emergencyPhone ? 'border-red-500' : 'border-gray-300'} rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300`}
              placeholder="+256 700 000000"
            />
            {errors.emergencyPhone && <p className="text-red-500 text-sm mt-1">{errors.emergencyPhone}</p>}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiBriefcase className="w-8 h-8 text-indigo-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Complete Your Profile</h2>
          <p className="text-gray-600 mt-2">
            Please provide your details so we can process your employment application
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                step >= s ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
              } font-semibold transition-all duration-300`}>
                {step > s ? <FiCheckCircle /> : s}
              </div>
              {s < 3 && (
                <div className={`w-16 h-1 mx-2 ${
                  step > s ? 'bg-indigo-600' : 'bg-gray-200'
                } transition-all duration-300`}></div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="px-6 py-3 text-gray-700 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-300 font-semibold"
                disabled={loading}
              >
                ← Back
              </button>
            ) : (
              <div></div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`px-8 py-3 ${
                step === 3 ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'
              } text-white rounded-xl transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <span>{step === 3 ? 'Submit Application' : 'Next'}</span>
                  {step < 3 && <span>→</span>}
                </>
              )}
            </button>
          </div>
        </form>

        {/* Info Message */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-blue-800 flex items-center">
            <FiAlertCircle className="mr-2 flex-shrink-0" />
            Your application will be reviewed by our admin team. You'll receive an email once your account is approved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmployeeProfileSetup;
