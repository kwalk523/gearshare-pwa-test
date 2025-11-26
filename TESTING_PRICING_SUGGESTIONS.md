# Equipment Detection Testing Guide

## How to Test Pricing Suggestions in AddGear Form

The equipment detection works by scanning the **title** field for specific keywords. Here are the exact phrases you should try typing to see suggestions:

### 📸 **Camera Equipment** (try typing these in the title field):
- **Canon R6** → Should detect "Canon EOS R6" 
- **Sony A7** → Should detect "Sony A7 III"
- **Nikon Z6** → Should detect "Nikon Z6 II" 
- **Fujifilm XT5** → Should detect "Fujifilm X-T5"
- **Canon R7** → Should detect "Canon EOS R7"

### 🎬 **Action Cameras**:
- **GoPro Hero** → Should detect "GoPro Hero 12"
- **DJI Action** → Should detect "DJI Action 4" 
- **Insta360** → Should detect "Insta360 X3"

### 🎤 **Microphones**:
- **Rode PodMic** → Should detect "Rode PodMic"
- **Blue Yeti** → Should detect "Blue Yeti" 
- **Shure SM7B** → Should detect "Shure SM7B"
- **Audio Technica AT2020** → Should detect "Audio-Technica AT2020"

### 🔊 **Audio Equipment**:
- **Zoom H5** → Should detect "Zoom H5"
- **Focusrite Scarlett** → Should detect "Focusrite Scarlett 2i2"
- **Yamaha HS8** → Should detect "Yamaha HS8"

### 💡 **Lighting**:
- **Godox AD200** → Should detect "Godox AD200"
- **Neewer 660** → Should detect "Neewer 660 LED Panel"

## ✨ **What Should Happen**:

1. **Type a title** like "Canon R6 Camera for Rent"
2. **Green alert appears** with equipment detection
3. **Shows suggested price range** (e.g., "$45-90 per day")  
4. **"Use Suggested Pricing" button** appears
5. **Auto-fills category** and deposit amount

## 🔍 **Debugging Steps**:

If suggestions don't appear:

1. **Check the console** (F12 → Console tab) for any JavaScript errors
2. **Try exact keywords** from the list above
3. **Type at least 4 characters** (detection starts after 3 characters)
4. **Check that the title field is focused** when typing

## 💡 **Example Test**:
1. Go to "Add New Gear"
2. In the **Title** field, type: **"Canon R6"**  
3. You should see a green box appear with:
   - "Equipment Detected: Canon EOS R6"
   - "Suggested daily rate: $45-90"
   - "Use Suggested Pricing" button
4. Click the button to auto-fill the daily rate

## 🐛 **Still Not Working?**

If you try the exact keywords above and don't see suggestions, there might be a JavaScript error. Check the browser console or let me know what you typed and I can investigate further.