# 🎨 Logo Replacement Guide

## Quick Start - Replace Logo in 3 Steps

### Step 1: Add Your Logo PNGs
Place your logo files in the public folder:
```
rakshak/public/logo-light.png  (Dark logo for light backgrounds)
rakshak/public/logo-dark.png   (Light/white logo for dark backgrounds)
```

**Recommended specs:**
- Format: PNG with transparent background
- Size: 512x512px or larger (will be scaled down)
- Aspect ratio: Square (1:1) works best
- **logo-light.png**: Your logo in dark colors (for white/light gray backgrounds)
- **logo-dark.png**: Your logo in light/white colors (for dark blue/black backgrounds)

### Step 2: Update Logo Component
Open `rakshak/components/common/Logo.js` and:

1. **Uncomment** lines 30-42 (the PNG version with theme support)
2. **Delete** or comment out lines 45-60 (the SVG version)

### Step 3: Update Favicon & PWA Icons

Replace these files in `/public`:
- `favicon.ico` - Browser tab icon (16x16, 32x32, 48x48)
- `icons/icon-192.png` - PWA icon (192x192)
- `icons/icon-512.png` - PWA icon (512x512)
- `apple-touch-icon.png` - iOS home screen (180x180)

**Tools to generate these:**
- https://realfavicongenerator.net/
- https://favicon.io/

---

## Files Already Updated ✅

The Logo component is now used in:
- ✅ Homepage navbar (light theme)
- ✅ Homepage footer (light theme)
- ✅ Login page (light theme)
- ✅ Register page (light theme)
- ✅ Admin login (light theme)
- ✅ User dashboard (light theme)
- ✅ All super-admin pages (light theme)
- ✅ Track report page (light theme)

**You only need to replace the logos once in the Logo component!**

---

## Theme Usage Examples

The Logo component automatically picks the right logo based on the `theme` prop:

```jsx
// For light backgrounds (white, light gray) - uses logo-light.png
<Logo size={24} theme="light" />

// For dark backgrounds (dark blue, black) - uses logo-dark.png
<Logo size={24} theme="dark" />

// Default is "light" if not specified
<Logo size={32} />
```

### Where to Use Each Theme:

**Light theme** (`theme="light"`):
- White backgrounds
- Light gray backgrounds (#F1F5F9, #F8FAFC)
- Light colored cards

**Dark theme** (`theme="dark"`):
- Dark blue backgrounds (#1E293B, #0F172A)
- Black backgrounds
- Dark colored navbars
- Footer with dark background

---

## Troubleshooting

**Logo not showing after replacement?**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh (Ctrl+F5)
3. Restart Next.js dev server: `npm run dev`

**Logo looks blurry?**
- Use a higher resolution PNG (at least 512x512)
- Make sure it's not being stretched

**Logo has white background?**
- Save as PNG with transparency
- Use a tool like Photoshop or remove.bg to remove background

---

## Current Logo Locations

All logos are centralized in: `components/common/Logo.js`

No need to update individual pages anymore!
