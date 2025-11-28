use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;

/// Capture screen on Windows using GDI
#[tauri::command]
pub fn capture_screen() -> Result<String, String> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Gdi::{
        BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject,
        GetDC, GetDIBits, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER,
        BI_RGB, DIB_RGB_COLORS, SRCCOPY,
    };
    use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN};

    unsafe {
        let width = GetSystemMetrics(SM_CXSCREEN);
        let height = GetSystemMetrics(SM_CYSCREEN);

        if width <= 0 || height <= 0 {
            return Err("Failed to get screen dimensions".to_string());
        }

        let screen_dc = GetDC(HWND::default());
        let mem_dc = CreateCompatibleDC(screen_dc);
        let bitmap = CreateCompatibleBitmap(screen_dc, width, height);
        let old_bitmap = SelectObject(mem_dc, bitmap);

        let blt_result = BitBlt(mem_dc, 0, 0, width, height, screen_dc, 0, 0, SRCCOPY);
        if blt_result.is_err() {
            SelectObject(mem_dc, old_bitmap);
            let _ = DeleteObject(bitmap);
            let _ = DeleteDC(mem_dc);
            let _ = ReleaseDC(HWND::default(), screen_dc);
            return Err("BitBlt failed".to_string());
        }

        // Prepare bitmap info for extraction
        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height, // Negative for top-down DIB
                biPlanes: 1,
                biBitCount: 24,
                biCompression: BI_RGB.0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [Default::default()],
        };

        // Calculate row size with padding (rows must be 4-byte aligned)
        let row_size = ((width * 3 + 3) / 4) * 4;
        let image_size = (row_size * height) as usize;
        let mut pixels: Vec<u8> = vec![0; image_size];

        GetDIBits(
            mem_dc,
            bitmap,
            0,
            height as u32,
            Some(pixels.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS,
        );

        // Clean up GDI objects
        SelectObject(mem_dc, old_bitmap);
        let _ = DeleteObject(bitmap);
        let _ = DeleteDC(mem_dc);
        let _ = ReleaseDC(HWND::default(), screen_dc);

        // Convert BGR to RGB
        for chunk in pixels.chunks_exact_mut(3) {
            chunk.swap(0, 2);
        }

        // Remove padding from rows
        let mut unpadded_pixels: Vec<u8> = Vec::with_capacity((width * 3 * height) as usize);
        for row in 0..height {
            let start = (row * row_size) as usize;
            let end = start + (width * 3) as usize;
            unpadded_pixels.extend_from_slice(&pixels[start..end]);
        }

        // Encode as PNG in memory
        let mut png_data: Vec<u8> = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut png_data, width as u32, height as u32);
            encoder.set_color(png::ColorType::Rgb);
            encoder.set_depth(png::BitDepth::Eight);
            let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
            writer.write_image_data(&unpadded_pixels).map_err(|e| e.to_string())?;
        }

        Ok(BASE64_STANDARD.encode(png_data))
    }
}
