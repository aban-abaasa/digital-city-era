# SupermartKera Color Design Update

## Overview
This document outlines the unified color design system applied across all SupermartKera portals (Manager, Cashier, and Admin) based on the landing page's emerald/green theme.

## Color Palette

### Primary Colors (Emerald/Green)
```css
--sk-emerald-50: #ecfdf5    /* Lightest emerald background */
--sk-emerald-100: #d1fae5   /* Light emerald borders */
--sk-emerald-200: #a7f3d0   /* Border hover states */
--sk-emerald-300: #6ee7b7   /* Subtle accents */
--sk-emerald-400: #34d399   /* Primary accent */
--sk-emerald-500: #10b981   /* Main brand color */
--sk-emerald-600: #059669   /* Primary buttons */
--sk-emerald-700: #047857   /* Button hover */
--sk-emerald-800: #065f46   /* Dark text */
--sk-emerald-900: #064e3b   /* Sidebar dark */
--sk-emerald-950: #022c22   /* Darkest background */
```

### Secondary Colors (Green)
```css
--sk-green-400: #4ade80
--sk-green-500: #22c55e
--sk-green-600: #16a34a
```

### Accent Colors (Teal)
```css
--sk-teal-400: #2dd4bf
--sk-teal-500: #14b8a6
--sk-teal-600: #0d9488
```

## Gradients

### Primary Gradient
```css
background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%);
```
**Use for**: Primary buttons, hero sections, important CTAs

### Soft Gradient
```css
background: linear-gradient(135deg, #34d399 0%, #22c55e 50%, #14b8a6 100%);
```
**Use for**: Headers, badges, accent elements

### Hero Background Gradient (Light Mode)
```css
background: linear-gradient(180deg, #ffffff 0%, #f0fdf4 45%, #ecfdf5 100%);
```
**Use for**: Page backgrounds, main containers

### Dark Background Gradient
```css
background: linear-gradient(135deg, #064e3b 0%, #065f46 100%);
```
**Use for**: Sidebars, dark mode elements

## Component Styling Guidelines

### Headers
- **Background**: Primary gradient (`from-emerald-500 via-green-600 to-teal-600`)
- **Text**: White
- **Shadow**: `0 4px 20px rgba(16, 185, 129, 0.25)`
- **Border**: None or `1px solid emerald-100` (light mode)

### Navigation Tabs
- **Inactive**: `rgba(255, 255, 255, 0.7)` text, transparent background
- **Hover**: `rgba(255, 255, 255, 0.1)` background, white text
- **Active**: Primary gradient background, white text, emerald shadow

### Cards & Panels
- **Light Mode**: 
  - Background: `white`
  - Border: `1px solid emerald-100`
  - Shadow: `0 4px 20px rgba(16, 185, 129, 0.1)`
  - Hover Shadow: `0 8px 32px rgba(16, 185, 129, 0.2)`
  
- **Dark Mode**:
  - Background: `rgba(6, 78, 59, 0.55)` with backdrop blur
  - Border: `rgba(16, 185, 129, 0.2)`
  - Shadow: Same as light mode

### Buttons

#### Primary Button
```css
background: linear-gradient(135deg, #10b981, #059669, #047857);
color: white;
box-shadow: 0 4px 16px rgba(16, 185, 129, 0.25);
```
**Hover**: Shift gradient, lift with `translateY(-2px)`, stronger shadow

#### Outline Button
```css
background: white;
color: emerald-600;
border: 2px solid emerald-200;
```
**Hover**: `emerald-50` background, `emerald-400` border

### Stat Cards
- **Background**: Gradient from `emerald-50` to `white`
- **Value Text**: Primary gradient with text clipping
- **Label**: `emerald-600` color, uppercase, bold
- **Icon Box**: `emerald-100` background, `emerald-600` text

### Input Fields
- **Border**: `2px solid emerald-200`
- **Focus**: `emerald-400` border with `rgba(16, 185, 129, 0.1)` shadow ring
- **Placeholder**: `slate-400`

### Badges
- **Default**: `emerald-50` background, `emerald-700` text, `emerald-200` border
- **Success**: Gradient from `emerald-100` to `green-100`
- **Primary**: Soft gradient with white text

### Tables
- **Header**: Gradient from `emerald-50` to `green-50`
- **Header Text**: `emerald-800`, bold
- **Border**: `emerald-200` (header), `emerald-100` (rows)
- **Row Hover**: `emerald-50` background

## Animation & Interaction

### Pulse Animation (for live indicators)
```css
@keyframes sk-pulse-emerald {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); }
  50% { box-shadow: 0 0 0 12px rgba(16, 185, 129, 0); }
}
```

### Shimmer Text (for hero titles)
```css
background: linear-gradient(90deg, #10b981, #34d399, #14b8a6, #10b981);
background-size: 200% auto;
animation: sk-shimmer-emerald 4s linear infinite;
```

### Hover Transitions
- **Duration**: `300ms`
- **Easing**: `cubic-bezier(0.22, 1, 0.36, 1)` for smooth, professional feel
- **Transform**: `translateY(-2px)` to `-4px` for lift effect

## Portal-Specific Applications

### Admin Portal
- **Sidebar**: Dark emerald gradient (`#064e3b` to `#065f46`)
- **Active Nav**: Left border `4px solid emerald-500`
- **User Avatar**: Primary gradient with emerald shadow

### Manager Portal
- **Header**: Replaced Uganda flag colors with emerald gradient
- **Stats Cards**: Emerald gradient backgrounds
- **Charts**: Emerald color scheme for data visualization
- **Navigation**: Active tab with emerald gradient

### Cashier Portal
- **POS Interface**: Emerald buttons and accents
- **Payment Methods**: Primary button for IcanEra Wallet in emerald
- **Transaction Cards**: Emerald borders and hover states
- **Scanner Interface**: Emerald success indicators

## Icon Colors
- **Primary Icons**: `emerald-600`
- **Hover Icons**: `emerald-700`
- **Background Icons**: `emerald-100` background with `emerald-600` icon
- **Success Icons**: `green-500`

## Chart Colors (Recharts)
```javascript
const CHART_COLORS = {
  primary: '#10b981',    // emerald-500
  secondary: '#34d399',  // emerald-400
  accent: '#14b8a6',     // teal-500
  light: '#6ee7b7',      // emerald-300
  dark: '#059669',       // emerald-600
}
```

## Dark Mode Considerations
- **Background**: `#061510` (very dark emerald)
- **Text**: `white` or `emerald-100/75`
- **Borders**: `emerald-800/25` with transparency
- **Cards**: `emerald-950/55` with backdrop blur
- **Accents**: Brighter emerald shades (`emerald-400`, `emerald-300`)

## Implementation Files

### New Files Created
1. **`frontend/src/styles/supermartkera-portals.css`** - Unified portal styles

### Updated Files
1. **`frontend/src/pages/AdminPortal.css`** - Admin portal specific styles
2. **Color variables and theme objects in JSX files** (to be updated)

### Files to Import New Styles
Add this import to all portal pages:
```javascript
import '../styles/supermartkera-portals.css';
```

## Usage Examples

### Using Utility Classes
```jsx
<div className="sk-card">
  <div className="sk-icon-box">
    <FiShoppingBag />
  </div>
  <h3 className="sk-text-emerald-dark">Card Title</h3>
  <button className="sk-btn-primary">Action</button>
</div>
```

### Using CSS Variables
```jsx
<div style={{
  background: 'var(--sk-gradient-primary)',
  color: 'white',
  padding: '1rem',
  borderRadius: '1rem'
}}>
  Custom Component
</div>
```

### Inline Tailwind Classes (matching theme)
```jsx
<div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
  <p className="text-emerald-700 font-semibold">Content</p>
</div>
```

## Migration Checklist

- [ ] Import `supermartkera-portals.css` in all portal files
- [ ] Replace Uganda flag gradient with emerald gradient in Manager Portal header
- [ ] Update ManagerNavigation tab colors to emerald theme
- [ ] Update AdminPortal sidebar and navigation colors
- [ ] Update CashierPortal header and button colors
- [ ] Replace blue/purple gradients with emerald equivalents
- [ ] Update PortalSwitcher portal colors (keep cashier's green as is)
- [ ] Update chart colors to use emerald palette
- [ ] Test dark mode compatibility
- [ ] Verify responsive design on mobile

## Best Practices

1. **Consistency**: Always use the defined CSS variables for colors
2. **Contrast**: Ensure text has sufficient contrast (WCAG AA minimum)
3. **Hierarchy**: Use gradient strength to indicate importance
4. **Accessibility**: Maintain focus indicators with emerald-400 border
5. **Performance**: Use CSS variables for dynamic theming
6. **Responsiveness**: Test all breakpoints with new colors

## Browser Compatibility
- All modern browsers (Chrome, Firefox, Safari, Edge)
- CSS custom properties supported
- Gradient backgrounds fully supported
- Backdrop filters may need fallbacks for older browsers

## Notes
- The emerald/green theme represents growth, trust, and financial success
- Maintains consistency with SupermartKera landing page
- Professional appearance suitable for business operations
- Colors tested for accessibility and readability
