# Pagination UI Guide

## 🎨 Visual Components

### 1. Load More Announcements Button

Located at the bottom of the announcements list:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  [Announcement Card 1]                                  │
│  [Announcement Card 2]                                  │
│  [Announcement Card 3]                                  │
│  ...                                                    │
│  [Announcement Card 10]                                 │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  ⌄  Load More Announcements                       │ │
│  └───────────────────────────────────────────────────┘ │
│         (Orange border, white background)              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**States:**
- **Ready**: Shows chevron down icon + "Load More Announcements"
- **Loading**: Shows spinner + "Loading announcements..."
- **Hidden**: When all announcements are loaded

---

### 2. Load More Comments Button

Located within each announcement card, after the comments list:

```
┌─────────────────────────────────────────────────────────┐
│  📢 Team Announcement                                   │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Title: Important Update                               │
│  Body: This is an important announcement...            │
│                                                         │
│  💬 Comments (15)                                       │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  [Comment 1]                                            │
│  [Comment 2]                                            │
│  [Comment 3]                                            │
│  [Comment 4]                                            │
│  [Comment 5]                                            │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ⌄  Load More Comments                          │   │
│  └─────────────────────────────────────────────────┘   │
│       (Gray background, subtle border)                 │
│                                                         │
│  💭 Add your comment                                    │
│  [Text area for new comment]                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**States:**
- **Ready**: Shows chevron down icon + "Load More Comments"
- **Loading**: Shows spinner + "Loading comments..."
- **Hidden**: When all comments are loaded
- **No More**: Shows "All comments loaded" (italic gray text)

---

## 🎯 Button Variants

### Outline Variant (Announcements)
```css
Background: White (#FFFFFF)
Border: 2px solid Orange (#F58220)
Text: Orange (#F58220)
Hover: Orange background, White text
Icon: ChevronDown or Spinner
```

### Secondary Variant (Comments)
```css
Background: Light Gray (#F3F4F6)
Border: 1px solid Gray (#D1D5DB)
Text: Dark Gray (#374151)
Hover: Slightly darker gray
Icon: ChevronDown or Spinner
```

---

## 📱 Responsive Design

### Desktop (> 768px)
- Full width buttons
- Comfortable padding (px-4 py-3)
- Clear spacing between elements

### Mobile (< 768px)
- Full width buttons
- Slightly reduced padding
- Touch-friendly tap targets
- Smooth scrolling

---

## ⚡ Loading States

### Before Loading
```
┌─────────────────────────────────┐
│  ⌄  Load More Announcements     │
└─────────────────────────────────┘
```

### During Loading
```
┌─────────────────────────────────┐
│  ⟳  Loading announcements...    │
└─────────────────────────────────┘
     (Spinner animates)
```

### After Loading (More Available)
```
┌─────────────────────────────────┐
│  ⌄  Load More Announcements     │
└─────────────────────────────────┘
```

### After Loading (All Loaded)
```
(Button disappears)
```

---

## 🎨 Color Scheme

### Primary Orange
- **Main**: #F58220
- **Hover**: #E0741C
- **Light**: #FDB913

### Grays
- **Background**: #F9FAFB
- **Border**: #E5E7EB
- **Text**: #6B7280
- **Dark Text**: #111827

### States
- **Success**: #10B981
- **Error**: #EF4444
- **Warning**: #F59E0B

---

## 🔄 Animation Effects

### Button Hover
```css
transition: all 200ms ease-in-out
transform: scale(1.02) on hover
shadow: increases on hover
```

### Spinner
```css
animation: spin 1s linear infinite
```

### Slide In (New Items)
```css
animation: slide-in-from-bottom 500ms ease-out
stagger: 100ms per item
```

---

## 📊 Pagination Info Display

### Announcements Header
```
┌─────────────────────────────────────────┐
│  📢 Team Name                           │
│  • 25 announcements                     │
└─────────────────────────────────────────┘
```

### Comments Count
```
💬 Comments (15)
─────────────────
[5 comments shown]
⌄ Load More Comments (10 more)
```

---

## ✨ User Feedback

### Success Messages
```
┌─────────────────────────────────────────┐
│  ✓ Comment added successfully           │
└─────────────────────────────────────────┘
```

### Loading Indicators
```
┌─────────────────────────────────────────┐
│  ⟳ Loading announcements...             │
└─────────────────────────────────────────┘
```

### Empty States
```
┌─────────────────────────────────────────┐
│           📢                            │
│    No announcements yet                 │
│  Be the first to create one!            │
└─────────────────────────────────────────┘
```

---

## 🎯 Interaction Flow

### Loading More Announcements:
1. User scrolls to bottom
2. Sees "Load More Announcements" button
3. Clicks button
4. Button shows spinner + "Loading announcements..."
5. New announcements appear below existing ones
6. Button reappears if more available, or disappears if all loaded

### Loading More Comments:
1. User expands announcement
2. Sees first 5 comments
3. Sees "Load More Comments" button
4. Clicks button
5. Button shows spinner + "Loading comments..."
6. New comments appear below existing ones
7. Button updates or disappears based on remaining comments

---

## 🚀 Performance Indicators

### Fast Loading (< 500ms)
- Smooth transition
- No perceived delay
- Instant feedback

### Normal Loading (500ms - 2s)
- Spinner visible
- Clear loading state
- User knows system is working

### Slow Loading (> 2s)
- Spinner continues
- User can still interact with page
- No blocking behavior

---

## 📱 Mobile Optimizations

### Touch Targets
- Minimum 44px height
- Full width buttons
- Comfortable spacing

### Scrolling
- Smooth scroll behavior
- Proper momentum
- No janky animations

### Loading States
- Clear visual feedback
- No layout shifts
- Stable scroll position

---

## ✅ Accessibility

### Keyboard Navigation
- Tab to focus button
- Enter/Space to activate
- Clear focus indicators

### Screen Readers
- Descriptive button text
- Loading state announcements
- Proper ARIA labels

### Visual Indicators
- High contrast colors
- Clear loading states
- Visible focus rings

---

This UI guide ensures a consistent, professional, and user-friendly pagination experience across the entire application!
