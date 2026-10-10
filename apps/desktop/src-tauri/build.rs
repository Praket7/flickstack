use std::fs;
use std::path::Path;

fn push_u16(bytes: &mut Vec<u8>, value: u16) {
    bytes.extend_from_slice(&value.to_le_bytes());
}

fn push_u32(bytes: &mut Vec<u8>, value: u32) {
    bytes.extend_from_slice(&value.to_le_bytes());
}

fn deterministic_windows_icon() -> Vec<u8> {
    const WIDTH: u32 = 32;
    const HEIGHT: u32 = 32;
    const DIRECTORY_SIZE: u32 = 6 + 16;
    const DIB_HEADER_SIZE: u32 = 40;
    const PIXEL_BYTES: u32 = WIDTH * HEIGHT * 4;
    const MASK_BYTES: u32 = 4 * HEIGHT;
    const IMAGE_BYTES: u32 = DIB_HEADER_SIZE + PIXEL_BYTES + MASK_BYTES;

    let mut bytes = Vec::with_capacity((DIRECTORY_SIZE + IMAGE_BYTES) as usize);

    // ICONDIR
    push_u16(&mut bytes, 0);
    push_u16(&mut bytes, 1);
    push_u16(&mut bytes, 1);

    // ICONDIRENTRY
    bytes.push(WIDTH as u8);
    bytes.push(HEIGHT as u8);
    bytes.push(0);
    bytes.push(0);
    push_u16(&mut bytes, 1);
    push_u16(&mut bytes, 32);
    push_u32(&mut bytes, IMAGE_BYTES);
    push_u32(&mut bytes, DIRECTORY_SIZE);

    // BITMAPINFOHEADER. ICO stores XOR and AND planes together, so height is doubled.
    push_u32(&mut bytes, DIB_HEADER_SIZE);
    push_u32(&mut bytes, WIDTH);
    push_u32(&mut bytes, HEIGHT * 2);
    push_u16(&mut bytes, 1);
    push_u16(&mut bytes, 32);
    push_u32(&mut bytes, 0);
    push_u32(&mut bytes, PIXEL_BYTES);
    push_u32(&mut bytes, 0);
    push_u32(&mut bytes, 0);
    push_u32(&mut bytes, 0);
    push_u32(&mut bytes, 0);

    // Opaque neutral fallback. The normal `tauri icon` workflow can replace this with
    // branded artwork, but clean source checkouts can still package on Windows.
    for _ in 0..(WIDTH * HEIGHT) {
        bytes.extend_from_slice(&[45, 45, 45, 255]);
    }
    bytes.resize((DIRECTORY_SIZE + IMAGE_BYTES) as usize, 0);
    bytes
}

fn ensure_windows_icon() {
    if !cfg!(target_os = "windows") {
        return;
    }

    let path = Path::new("icons/icon.ico");
    if path.exists() {
        return;
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).expect("create Tauri icon directory");
    }
    fs::write(path, deterministic_windows_icon()).expect("write deterministic Windows icon");
}

fn main() {
    ensure_windows_icon();
    tauri_build::build();
}
