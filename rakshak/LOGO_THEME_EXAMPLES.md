# 🎨 Logo Theme Usage Guide

## Your Two Logo Files

```
/public/logo-light.png  →  Dark/colored logo (for light backgrounds)
/public/logo-dark.png   →  Light/white logo (for dark backgrounds)
```

---

## Visual Guide: Which Logo Where?

### ✅ Use `theme="light"` (logo-light.png - DARK logo)

**On WHITE or LIGHT backgrounds:**

```jsx
// White page background
<div style={{ background: 'white' }}>
  <Logo size={24} theme="light" />  ← Dark logo shows well
</div>

// Light gray background
<div style={{ background: '#F1F5F9' }}>
  <Logo size={28} theme="light" />  ← Dark logo shows well
</div>

// Light card
<div style={{ background: '#F8FAFC' }}>
  <Logo size={20} theme="light" />  ← Dark logo shows well
</div>
```

**Examples in your app:**
- ✅ Homepage navbar (white background)
- ✅ Login/Register cards (white background)
- ✅ Super admin dashboard (light gray #F1F5F9)
- ✅ Footer (if light colored)

---

### ✅ Use `theme="dark"` (logo-dark.png - LIGHT logo)

**On DARK or COLORED backgrounds:**

```jsx
// Dark blue navbar
<div style={{ background: '#1E293B' }}>
  <Logo size={24} theme="dark" />  ← Light logo shows well
</div>

// Black background
<div style={{ background: '#0F172A' }}>
  <Logo size={28} theme="dark" />  ← Light logo shows well
</div>

// Blue gradient
<div style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)' }}>
  <Logo size={20} theme="dark" />  ← Light logo shows well
</div>
```

**Examples in your app:**
- ✅ Dark mode pages (if you add dark mode)
- ✅ Blue gradient cards
- ✅ Dark footer
- ✅ Loading screens with dark backgrounds

---

## Quick Reference Table

| Background Color | Logo Theme | Logo File Used | Logo Color |
|-----------------|------------|----------------|------------|
| White (#FFFFFF) | `theme="light"` | logo-light.png | Dark/Colored |
| Light Gray (#F1F5F9) | `theme="light"` | logo-light.png | Dark/Colored |
| Light Blue (#EFF6FF) | `theme="light"` | logo-light.png | Dark/Colored |
| Dark Blue (#1E293B) | `theme="dark"` | logo-dark.png | Light/White |
| Black (#0F172A) | `theme="dark"` | logo-dark.png | Light/White |
| Blue Gradient | `theme="dark"` | logo-dark.png | Light/White |

---

## Logo Design Tips

### For logo-light.png (Dark version):
- Use your brand's primary colors
- Should have good contrast on white
- Can be colorful or dark
- Example: Blue, black, or colored logo

### For logo-dark.png (Light version):
- Should be white or very light colored
- Needs to show up on dark backgrounds
- Can have a subtle glow/shadow for depth
- Example: White, light gray, or light blue logo

---

## Testing Your Logos

After adding your PNGs, test them:

1. **Light theme test:**
   ```jsx
   <div style={{ background: 'white', padding: 20 }}>
     <Logo size={48} theme="light" />
   </div>
   ```
   ✅ Logo should be clearly visible

2. **Dark theme test:**
   ```jsx
   <div style={{ background: '#0F172A', padding: 20 }}>
     <Logo size={48} theme="dark" />
   </div>
   ```
   ✅ Logo should be clearly visible

---

## Current Pages & Their Themes

| Page | Background | Logo Theme |
|------|-----------|------------|
| Homepage | White | `light` |
| Login | White | `light` |
| Register | Light Gray | `light` |
| User Dashboard | Light Gray | `light` |
| Super Admin | Light Gray | `light` |
| Camp Dashboard | Dark (if dark mode) | `dark` |

You can change any of these by updating the `theme` prop in the Logo component!
