// Minimal Tauri shell. All 7TV logic lives in src/lib/seventv.ts and runs
// on-device so the bearer token never touches a third-party server.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
