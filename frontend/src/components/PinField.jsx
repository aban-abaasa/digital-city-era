import React, { useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';

// 6-12 digit PIN input with a Show/Hide toggle. Styles: pages/BusinessLocalServerSetup.css (.bls-*).
// `action` renders beside the field (e.g. a "Generate" button).
const PinField = ({ id, value, onChange, autoComplete, label, hint, action, forceShown = false }) => {
  const [shown, setShown] = useState(false);
  const visible = shown || forceShown;
  return (
    <div className="bls-field">
      <label htmlFor={id}>{label}{hint && <small>{hint}</small>}</label>
      <div className="bls-pinrow">
        <div className="bls-pwrow">
          <input
            id={id}
            className="bls-input is-pin"
            type={visible ? 'text' : 'password'}
            inputMode="numeric"
            pattern="[0-9]{6,12}"
            minLength={6}
            maxLength={12}
            value={value}
            onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 12))}
            autoComplete={autoComplete}
            required
          />
          <button type="button" className="bls-pwtoggle" onClick={() => setShown((v) => !v)} aria-label={visible ? 'Hide PIN' : 'Show PIN'}>
            {visible ? <FiEyeOff /> : <FiEye />} {visible ? 'Hide' : 'Show'}
          </button>
        </div>
        {action}
      </div>
    </div>
  );
};

export default PinField;
